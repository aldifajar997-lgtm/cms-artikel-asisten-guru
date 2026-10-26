import { Context, Next } from 'hono'
import { Bindings, Variables } from '../types'
import { HTTPException } from 'hono/http-exception'

export const rateLimit = (limit: number, windowSecs: number, prefix: string | ((c: Context<{ Bindings: Bindings; Variables: Variables }>) => string) = 'rate_limit') => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // 1. CF-Connecting-IP di-set oleh Cloudflare edge network dan terpercaya
    // Fallback bertingkat ke x-real-ip dan x-forwarded-for jika diakses melalui reverse proxy lokal
    const rawIp = c.req.header('CF-Connecting-IP') || 
                  c.req.header('x-real-ip') || 
                  c.req.header('x-forwarded-for')?.split(',')[0]?.trim();

    // Mencegah denial-of-service global jika header IP tidak ada (Audit #4)
    // Jangan satukan seluruh user tanpa header IP ke dalam satu bucket 'unknown'
    const userAgent = c.req.header('User-Agent') || '';
    const ip = rawIp || (userAgent ? `client_${userAgent.slice(0, 32)}` : crypto.randomUUID());

    // Fixed window: masukkan bucket waktu ke key sehingga setiap window punya counter terpisah
    const windowBucket = Math.floor(Date.now() / (windowSecs * 1000));
    const prefixValue = typeof prefix === 'function' ? prefix(c) : prefix;
    const key = `${prefixValue}:${ip}:${windowBucket}`;

    try {
      const current = await c.env.KV.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= limit) {
        // Blokir langsung dan jangan lakukan write KV berulang untuk menghemat operasi KV
        throw new HTTPException(429, { message: 'Terlalu banyak percobaan. Silakan tunggu beberapa saat.' });
      }

      // Cloudflare KV mewajibkan expirationTtl minimal 60 detik
      const safeTtl = Math.max(60, windowSecs * 2);
      await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: safeTtl });
    } catch (e) {
      if (e instanceof HTTPException) {
        throw e;
      }
      // Catat error KV untuk pemantauan observabilitas (Fail-open)
      console.error(`[RateLimit] KV operational error on ${key}:`, e);
    }

    await next();
  };
};
