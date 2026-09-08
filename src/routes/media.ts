import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { isSafeImage, getContentTypeFromMagicBytes } from '../utils/magic-bytes'
import { rateLimit } from '../middlewares/rate-limit'

const media = new Hono<{ Bindings: Bindings; Variables: Variables }>()

media.get('/avatars/:r2_key', async (c) => {
  const key = c.req.param('r2_key')
  const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const objectPath = `avatars/${safeKey}`

  const object = await c.env.R2.get(objectPath)
  if (!object) {
    throw new HTTPException(404, { message: 'File avatar tidak ditemukan.' })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000')
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(object.body, { headers })
})

media.get('/:r2_key', async (c) => {
  const key = c.req.param('r2_key')
  // Sanitasi path traversal
  const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '')

  const object = await c.env.R2.get(safeKey)
  if (!object) {
    throw new HTTPException(404, { message: 'File tidak ditemukan.' })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000') // Cache 1 tahun di Edge/Browser
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(object.body, { headers })
})

// --- PROTECTED ROUTES ---

media.post('/', authMiddleware, requirePermission('upload_media'), rateLimit(5, 60, 'upload_media'), async (c) => {
  const user = c.get('user')
  const body = await c.req.parseBody()
  const file = body['file']
  const uploadType = body['type'] as string || 'content' // 'avatar' | 'content' | 'featured'

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File tidak ditemukan dalam request.' })
  }

  // 1. Validasi Ukuran berdasarkan tipe
  let MAX_SIZE = 1 * 1024 * 1024 // default 1MB (konten)
  let sizeLabel = '1MB'

  if (uploadType === 'avatar') {
    MAX_SIZE = 2 * 1024 * 1024
    sizeLabel = '2MB'
  } else if (uploadType === 'featured') {
    MAX_SIZE = 5 * 1024 * 1024
    sizeLabel = '5MB'
  }

  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: `Ukuran file melebihi batas (Max ${sizeLabel}).` })
  }

  // 2. Validasi Ekstensi File
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  if (!allowedExtensions.includes(fileExtension)) {
    throw new HTTPException(400, { message: 'Ekstensi file tidak diizinkan. Hanya JPG, PNG, WEBP.' })
  }

  // 3. Validasi Magic Bytes (Anti-Spoofing)
  const arrayBuffer = await file.arrayBuffer()
  if (!isSafeImage(arrayBuffer)) {
    throw new HTTPException(400, { message: 'Format file tidak valid atau rusak.' })
  }

  // 3. Derive content-type dari magic bytes (BUKAN dari header client yang bisa dipalsu)
  const detectedContentType = getContentTypeFromMagicBytes(arrayBuffer)
  if (!detectedContentType) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, WEBP yang diterima.' })
  }

  // 4. Sanitasi Nama File & Generate R2 Key
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const r2Key = `${crypto.randomUUID()}-${cleanFileName}`

  // Upload ke R2 dengan content-type yang di-derive dari magic bytes
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: detectedContentType }
  })

  // Simpan ke D1
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, r2Key, cleanFileName, detectedContentType, file.size, user.id === 'super_admin' ? null : user.id).run()

  // Return JSON format yang cocok dengan ekspektasi SunEditor / frontend
  const url = `/api/media/${r2Key}`
  return c.json({
    result: [
      {
        url,
        name: cleanFileName,
        size: file.size
      }
    ]
  })
})

// Endpoint DELETE media — hapus dari R2 + D1
media.delete('/:id', authMiddleware, requirePermission('delete_media'), async (c) => {
  const mediaId = c.req.param('id')

  const record = await c.env.DB.prepare(
    'SELECT id, r2_key, uploaded_by FROM media WHERE id = ?'
  ).bind(mediaId).first()

  if (!record) {
    throw new HTTPException(404, { message: 'File tidak ditemukan.' })
  }

  const user = c.get('user')
  // Hanya pemilik atau super_admin yang bisa menghapus
  if (user.role !== 'super_admin' && record.uploaded_by !== user.id) {
    throw new HTTPException(403, { message: 'Anda tidak berhak menghapus file ini.' })
  }

  // Hapus dari R2
  await c.env.R2.delete(record.r2_key as string)

  // Hapus dari D1
  await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run()

  return c.json({ message: 'File berhasil dihapus.' })
})

export default media
