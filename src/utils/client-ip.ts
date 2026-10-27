import { Context } from 'hono'

/**
 * Cloudflare Worker synthetic IP yang digunakan saat cross-zone subrequest.
 * Ketika Worker di Zone A fetch ke Zone B, Cloudflare menimpa CF-Connecting-IP menjadi IP ini.
 */
const CLOUDFLARE_WORKER_SYNTHETIC_IP = '2a06:98c0:3600::103'

/**
 * Mendapatkan IP klien asli dengan aman:
 * 1. Mengutamakan CF-Connecting-IP jika bukan IP sintetis Worker Cloudflare.
 * 2. Jika CF-Connecting-IP adalah IP sintetis Worker (akibat reverse proxy Worker antar-zona),
 *    maka ambil dari X-Real-IP atau entri pertama X-Forwarded-For yang dikirimkan oleh Worker proxy.
 * 3. Fallback bertingkat jika dijalankan di environment development lokal.
 */
export function getClientIp(c: Context<any>): string {
  const cfIp = c.req.header('CF-Connecting-IP')?.trim()

  if (cfIp && cfIp !== CLOUDFLARE_WORKER_SYNTHETIC_IP) {
    return cfIp
  }

  // Jika lewat Cloudflare Worker Proxy (Cross-Zone), gunakan X-Real-IP atau X-Forwarded-For
  const xRealIp = c.req.header('X-Real-IP')?.trim()
  if (xRealIp) {
    return xRealIp
  }

  const xff = c.req.header('X-Forwarded-For')
  if (xff) {
    const firstIp = xff.split(',')[0]?.trim()
    if (firstIp) {
      return firstIp
    }
  }

  // Fallback terakhir: jika CF-Connecting-IP ada (meskipun synthetic IP saat dev/proxy)
  return cfIp || ''
}
