import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { isSafeImage, getContentTypeFromMagicBytes } from '../utils/magic-bytes'
import { rateLimit } from '../middlewares/rate-limit'
import { runMarketplaceR2GarbageCollector } from '../utils/garbage-collector'

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

media.get('/covers/:r2_key', async (c) => {
  const key = c.req.param('r2_key')
  const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const object = await c.env.R2.get(`covers/${safeKey}`)
  if (!object) {
    throw new HTTPException(404, { message: 'Foto sampul tidak ditemukan.' })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000')
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(object.body, { headers })
})

media.get('/store-backgrounds/:r2_key', async (c) => {
  const key = c.req.param('r2_key')
  if (!key || !/^bg-[A-Za-z0-9_-]+-[0-9]+\.(jpg|jpeg|png|webp)$/i.test(key)) {
    throw new HTTPException(400, { message: 'Nama berkas gambar latar belakang tidak valid.' })
  }
  const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const object = await c.env.R2.get(`store-backgrounds/${safeKey}`)
  if (!object) {
    throw new HTTPException(404, { message: 'Gambar latar belakang etalase tidak ditemukan.' })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000')
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(object.body, { headers })
})

media.get('/sample-products/:r2_key', async (c) => {
  const key = c.req.param('r2_key')
  const safeKey = key.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const object = await c.env.R2.get(`sample-products/${safeKey}`)
  if (!object) {
    throw new HTTPException(404, { message: 'Foto contoh produk tidak ditemukan.' })
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

media.post('/', authMiddleware, requirePermission('upload_media'), rateLimit(30, 60, 'upload_media'), async (c) => {
  const user = c.get('user')
  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format pengunggahan berkas media tidak valid atau transmisi terputus.' })
  }
  const file = body['file']
  const uploadType = body['type'] as string || 'content' // 'avatar' | 'content' | 'featured'

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File tidak ditemukan dalam request.' })
  }

  // 1. Validasi Ukuran berdasarkan tipe
  let MAX_SIZE = 3 * 1024 * 1024 // default 3MB (konten & foto detail produk)
  let sizeLabel = '3MB'

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

// Endpoint DELETE media — hapus dari R2 + D1 (Hanya Super Admin di UI Utama)
media.delete('/:id', authMiddleware, requirePermission('delete_media'), async (c) => {
  const mediaId = c.req.param('id')
  const user = c.get('user')

  // ATURAN KETAT: Hanya Super Admin di antarmuka administrasi utama yang berhak menghapus berkas penyimpanan secara permanen
  if (user.role !== 'super_admin') {
    throw new HTTPException(403, {
      message: 'Akses ditolak. Hanya Super Admin di panel administrasi utama yang berhak menghapus berkas penyimpanan secara permanen.'
    })
  }

  const record = await c.env.DB.prepare(
    'SELECT id, r2_key, uploaded_by FROM media WHERE id = ?'
  ).bind(mediaId).first<{ id: string; r2_key: string; uploaded_by: string | null }>()

  if (!record) {
    throw new HTTPException(404, { message: 'Berkas media tidak ditemukan.' })
  }

  // PROTEKSI KONSUMEN: Cek apakah berkas ini terikat dengan produk digital yang pernah dibeli pengguna (termasuk snapshot riwayat transaksi)
  const salesCheck = await c.env.DB.prepare(`
    SELECT COALESCE(p.title, 'Produk Terkait') as title, COUNT(st.id) as sales_count
    FROM sale_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    WHERE st.purchased_file_r2_key = ? OR p.file_r2_key = ?
    GROUP BY st.product_id
  `).bind(record.r2_key, record.r2_key).first<{ title: string; sales_count: number }>()

  if (salesCheck && salesCheck.sales_count > 0) {
    throw new HTTPException(400, {
      message: `Berkas digital tidak dapat dimusnahkan karena terikat dengan produk "${salesCheck.title}" yang telah memiliki ${salesCheck.sales_count} transaksi pembelian. Untuk menjaga hak unduh pembeli sah, berkas ini dilindungi sistem.`
    })
  }

  // Hapus dari R2
  await c.env.R2.delete(record.r2_key as string)

  // Bersihkan referensi (Orphaned Key Prevention) pada products dan posts
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE products SET cover_image_key = NULL WHERE cover_image_key = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE products SET detail_image_1_key = NULL WHERE detail_image_1_key = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE products SET detail_image_2_key = NULL WHERE detail_image_2_key = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE products SET detail_image_3_key = NULL WHERE detail_image_3_key = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE products SET file_r2_key = NULL WHERE file_r2_key = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE posts SET featured_image = NULL WHERE featured_image = ?').bind(record.r2_key),
    c.env.DB.prepare('UPDATE users SET avatar_url = NULL WHERE avatar_url = ?').bind(`/api/media/${record.r2_key}`),
    c.env.DB.prepare('UPDATE users SET cover_url = NULL WHERE cover_url = ?').bind(`/api/media/${record.r2_key}`),
    c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId)
  ])

  return c.json({ message: 'Berkas berhasil dihapus permanen oleh Super Admin.' })
})

// Endpoint Pemicu Manual Garbage Collector R2 Marketplace (Hanya Super Admin di Panel Administrasi Utama)
media.post('/admin/gc-cleanup', authMiddleware, requirePermission('delete_media'), rateLimit(5, 60, 'media_admin_gc'), async (c) => {
  const user = c.get('user')

  if (user.role !== 'super_admin') {
    throw new HTTPException(403, {
      message: 'Akses ditolak. Hanya Super Admin di panel administrasi utama yang berhak memicu pembersihan berkas R2.'
    })
  }

  const report = await runMarketplaceR2GarbageCollector(c.env, true)

  return c.json({
    message: 'Pembersihan berkas orphan R2 Marketplace berhasil dieksekusi.',
    report: {
      scanned_files: report.scannedCount,
      deleted_files: report.deletedCount,
      protected_active_keys: report.activeCount,
      errors: report.errors
    }
  })
})

export default media
