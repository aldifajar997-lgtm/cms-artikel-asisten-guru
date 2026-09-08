import { Context, Next } from 'hono'
import { Bindings, Variables } from '../types'
import { HTTPException } from 'hono/http-exception'

export const rateLimit = (limit: number, windowSecs: number, prefix: string = 'rate_limit') => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // CF-Connecting-IP di-set oleh edge network dan tidak bisa dipalsukan
    // selama traffic melewati proxy CDN (selalu terjadi untuk Workers).
    // Pastikan domain production mengaktifkan proxy (orange cloud ON).
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'

    // Fixed window: masukkan bucket waktu ke key sehingga
    // setiap window punya counter terpisah (fix M3: sliding window TTL)
    // dan mengurangi dampak race condition TOCTOU (fix C2)
    const windowBucket = Math.floor(Date.now() / (windowSecs * 1000))
    const key = `${prefix}:${ip}:${windowBucket}`

    const current = await c.env.KV.get(key)
    const count = current ? parseInt(current) : 0

    if (count >= limit) {
      throw new HTTPException(429, { message: 'Terlalu banyak percobaan. Silakan tunggu beberapa saat.' })
    }

    // TTL = 2x window agar key pasti expire setelah window selesai,
    // tapi tidak reset window karena key berubah setiap bucket
    await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: windowSecs * 2 })
    await next()
  }
}
