import { Context, Next } from 'hono'
import { Bindings, Variables } from '../types'
import { HTTPException } from 'hono/http-exception'

export const rateLimit = (limit: number, windowSecs: number, prefix: string | ((c: Context<{ Bindings: Bindings; Variables: Variables }>) => string) = 'rate_limit') => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // CF-Connecting-IP di-set oleh edge network dan tidak bisa dipalsukan
    // selama traffic melewati proxy CDN (selalu terjadi untuk Workers).
    // Pastikan domain production mengaktifkan proxy (orange cloud ON).
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'

    // Fixed window: masukkan bucket waktu ke key sehingga
    // setiap window punya counter terpisah
    const windowBucket = Math.floor(Date.now() / (windowSecs * 1000))
    const prefixValue = typeof prefix === 'function' ? prefix(c) : prefix
    const key = `${prefixValue}:${ip}:${windowBucket}`

    try {
      const current = await c.env.KV.get(key)
      const count = current ? parseInt(current) : 0

      if (count >= limit) {
        throw new HTTPException(429, { message: 'Terlalu banyak percobaan. Silakan tunggu beberapa saat.' })
      }

      await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: windowSecs * 2 })
    } catch (e) {
      // Jika errornya dari HTTPException (berarti 429), lemparkan kembali
      if (e instanceof HTTPException) {
        throw e
      }
      // Selain itu (misal KV limit tercapai / error jaringan), biarkan request lewat (Fail Open)
      console.error('Rate limit KV error:', e)
    }

    await next()
  }
}
