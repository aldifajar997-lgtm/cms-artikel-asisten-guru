import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler = async (err: Error, c: Context) => {
  // Sanitasi URL: hapus query params yang mungkin mengandung data sensitif
  const safeUrl = c.req.url.split('?')[0]
  // Batasi panjang pesan error di log untuk mencegah log injection
  const safeMessage = (err.message || 'Unknown error').substring(0, 200)

  console.error(`[ERROR] ${c.req.method} ${safeUrl} - ${safeMessage}`)

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }

  // Sembunyikan error teknis dari client — jangan pernah expose detail internal
  return c.json({ error: 'Terjadi kendala saat memproses permintaan Anda.' }, 500)
}

export const notFoundHandler = (c: Context) => {
  return c.json({ error: 'Endpoint tidak ditemukan.' }, 404)
}
