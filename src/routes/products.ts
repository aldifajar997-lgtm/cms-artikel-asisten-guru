import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'
import xss from 'xss'

const customWhiteList = { ...(xss as any).getDefaultWhiteList() }
Object.keys(customWhiteList).forEach((tag) => {
  customWhiteList[tag].push('style', 'class')
})
customWhiteList.iframe = ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'class']
customWhiteList.video = ['src', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'style', 'class']
customWhiteList.audio = ['src', 'controls', 'style', 'class']
customWhiteList.source = ['src', 'type']

const stripHtml = (val: string) => val ? val.replace(/<[^>]*>?/gm, '').trim() : val;

const products = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// --- PUBLIC & HUB ROUTES ---

products.get('/public', rateLimit(500, 60, 'public_products'), async (c) => {
  const { limit, offset } = getPagination(c, 12, 50)
  const search = c.req.query('search') || ''
  
  let countQuery = "SELECT count(*) as total FROM products p WHERE p.status = 'published'"
  let dataQuery = `
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.description, p.created_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, c.name as category_name, c.slug as category_slug
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'published'
  `
  const params: any[] = []
  
  if (search) {
    countQuery += " AND (p.title LIKE ? OR p.description LIKE ?)"
    dataQuery += " AND (p.title LIKE ? OR p.description LIKE ?)"
    params.push(`%${search}%`, `%${search}%`)
  }
  
  dataQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
  
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{total: number}>()
  const total = countResult?.total || 0
  
  params.push(limit, offset)
  const results = await c.env.DB.prepare(dataQuery).bind(...params).all()
  
  const origin = new URL(c.req.url).origin;
  const mappedResults = results.results.map((p: any) => ({
    ...p,
    cover_image_url: p.cover_image_key ? `${origin}/api/media/${p.cover_image_key}` : null
  }))

  return c.json({ data: mappedResults, limit, offset, total })
})

products.get('/public/:slug', rateLimit(500, 60, 'public_products_detail'), async (c) => {
  const slug = c.req.param('slug')
  
  const product = await c.env.DB.prepare(`
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.description, p.status, p.created_at, p.updated_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, c.name as category_name, c.slug as category_slug
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ? AND p.status = 'published'
  `).bind(slug).first()

  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // NO CACHE: Hub requires real-time price
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  c.header('Expires', '0')
  c.header('Surrogate-Control', 'no-store')

  const origin = new URL(c.req.url).origin;
  const mappedProduct = {
    ...product,
    cover_image_url: product.cover_image_key ? `${origin}/api/media/${product.cover_image_key}` : null
  }

  return c.json(mappedProduct)
})

products.post('/public/:slug/view', rateLimit(1, 60, (c) => `product_view_${c.req.param('slug')}`), async (c) => {
  const slug = c.req.param('slug')
  await c.env.DB.prepare(`
    UPDATE products SET view_count = COALESCE(view_count, 0) + 1 
    WHERE slug = ? AND status = 'published'
  `).bind(slug).run()
  
  return c.json({ message: 'View counted' })
})

products.post('/internal/:id/download', rateLimit(5000, 60, 'internal_download'), async (c) => {
  const targetId = c.req.param('id')
  
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!token || !c.env.HUB_PUBLIC_KEY) {
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak ditemukan atau kunci publik tidak dikonfigurasi.' })
  }

  try {
    // Verifikasi JWT dari Hub menggunakan algoritma asimetris RS256
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { product_id?: string }
    
    // MENCEGAH BYPASS (Bug #1)
    if (payload.product_id !== targetId) {
      throw new HTTPException(403, { message: 'Token valid tapi TIDAK untuk produk ini.' })
    }
  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }

  const product = await c.env.DB.prepare('SELECT file_r2_key FROM products WHERE id = ?').bind(targetId).first()
  if (!product || !product.file_r2_key) {
    throw new HTTPException(404, { message: 'File produk tidak ditemukan.' })
  }

  const object = await c.env.R2.get(product.file_r2_key as string)
  if (!object) {
    throw new HTTPException(404, { message: 'File tidak ada di penyimpanan.' })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Content-Length', object.size.toString())
  
  const keyParts = (product.file_r2_key as string).split('/')
  const rawName = keyParts[keyParts.length - 1]
  const fileName = rawName.length > 37 ? rawName.substring(37) : (rawName || 'digital-product')
  headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
  
  return new Response(object.body, { headers })
})

products.get('/internal/:id/price', rateLimit(500, 60, 'internal_price'), async (c) => {
  const targetId = c.req.param('id')
  
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!token || !c.env.HUB_PUBLIC_KEY) {
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak ditemukan atau kunci publik tidak dikonfigurasi.' })
  }

  try {
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { type?: string }
    if (payload.type !== 'price_check') {
      throw new HTTPException(403, { message: 'Token valid tapi BUKAN untuk pengecekan harga.' })
    }
  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }

  const product = await c.env.DB.prepare('SELECT id, price, status, title FROM products WHERE id = ?').bind(targetId).first()
  if (!product) {
    throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })
  }
  if (product.status !== 'published') {
    throw new HTTPException(400, { message: 'Produk belum di-publish.' })
  }

  return c.json({ success: true, price: product.price, title: product.title })
})

products.post('/internal/:id/sale', rateLimit(500, 60, 'internal_sale'), async (c) => {
  const targetId = c.req.param('id')
  
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!token || !c.env.HUB_PUBLIC_KEY) {
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak ditemukan atau kunci publik tidak dikonfigurasi.' })
  }

  try {
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { product_id?: string, type?: string, jti?: string }
    if (payload.product_id !== targetId || payload.type !== 'sale_trigger') {
      throw new HTTPException(403, { message: 'Token valid tapi BUKAN untuk trigering sale produk ini.' })
    }

    // MENCEGAH REPLAY ATTACK
    // Gunakan 'jti' (JWT ID) jika ada, atau gunakan bagian signature dari token sebagai fallback unik
    const uniqueTokenId = payload.jti || token.split('.')[2]
    const kvKey = `used_sale_token:${uniqueTokenId}`
    
    const isUsed = await c.env.KV.get(kvKey)
    if (isUsed) {
      // Bersifat idempotent: kembalikan 200 OK agar Hub menganggap sukses dan tidak melakukan retry
      return c.json({ message: 'Sale already counted (Replay detected)' })
    }

    // Tandai token sebagai telah digunakan (disimpan di KV selama 24 jam)
    await c.env.KV.put(kvKey, '1', { expirationTtl: 86400 })

  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }

  await c.env.DB.prepare(`
    UPDATE products SET sales_count = COALESCE(sales_count, 0) + 1 
    WHERE id = ?
  `).bind(targetId).run()
  
  return c.json({ message: 'Sale counted' })
})

// --- PROTECTED ROUTES (CMS ADMIN) ---

products.use('/*', authMiddleware)

products.post('/upload-file', requirePermission('upload_media'), rateLimit(5, 60, 'upload_media'), async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File tidak ditemukan dalam request.' })
  }

  // 1. Validasi Ukuran (Max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    throw new HTTPException(400, { message: 'Ukuran file melebihi batas (Max 50MB).' })
  }

  // 2. Validasi Magic Bytes (Keamanan File Upload)
  const headerBuffer = await file.slice(0, 4).arrayBuffer()
  const headerView = new Uint8Array(headerBuffer)
  const headerHex = Array.from(headerView).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  
  // Deteksi Format Aman (PDF, ZIP, RAR)
  const isZip = headerHex.startsWith('504B0304') || headerHex.startsWith('504B0506') || headerHex.startsWith('504B0708')
  const isPdf = headerHex.startsWith('25504446')
  const isRar = headerHex.startsWith('52617221')
  
  if (!isZip && !isPdf && !isRar) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya menerima .zip, .rar, dan .pdf.' })
  }

  // 3. Sanitasi Nama File & Generate R2 Key
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const r2Key = `products/${crypto.randomUUID()}-${cleanFileName}`

  // Upload ke R2 menggunakan stream agar tidak memakan RAM berlebih
  await c.env.R2.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  return c.json({ r2_key: r2Key, name: cleanFileName, size: file.size })
})

const productSchema = z.object({
  title: z.string().trim().min(1).max(255).transform(stripHtml),
  slug: z.string().trim().min(1).max(255).regex(slugRegex, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung').transform(stripHtml),
  description: z.string().optional().nullable().transform(val => val ? xss(val, { whiteList: customWhiteList }) : val),
  price: z.coerce.number().int().min(0, 'Harga final tidak boleh negatif'),
  original_price: z.coerce.number().int().min(0).optional().nullable(),
  cover_image_key: z.string().optional().nullable(),
  file_r2_key: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
})

products.get('/admin/all', requirePermission('view_dashboard'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 50, 100)

  let query = "SELECT id, slug, title, description, price, original_price, cover_image_key, file_r2_key, status, created_at, category_id, meta_title, meta_description, view_count, sales_count FROM products"
  const params: any[] = []
  
  const canSeeAll = ['super_admin', 'Admin', 'Editor']
  if (!canSeeAll.includes(user.role)) {
    query += " WHERE author_id = ?"
    params.push(user.id)
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  const results = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: results.results, limit, offset })
})

products.get('/admin/:id', requirePermission('edit_post'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  let query = "SELECT * FROM products WHERE id = ?"
  const params: any[] = [targetId]

  const allowedToViewAny = ['super_admin', 'Admin', 'Editor']
  if (!allowedToViewAny.includes(user.role)) {
    query += " AND author_id = ?"
    params.push(user.id)
  }

  const product = await c.env.DB.prepare(query).bind(...params).first()
  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  return c.json({ data: product })
})

products.post('/', requirePermission('create_post'), rateLimit(30, 60, 'product_write'), zValidator('json', productSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  
  const cleanDescription = body.description ? xss(body.description, { whiteList: customWhiteList }) : null

  const id = crypto.randomUUID()
  const authorId = user.id

  try {
    await c.env.DB.prepare(`
      INSERT INTO products (
        id, slug, title, description, price, original_price, cover_image_key, file_r2_key, status, author_id, category_id, meta_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.slug, body.title, cleanDescription, body.price, body.original_price || null, 
      body.cover_image_key || null, body.file_r2_key || null, body.status, authorId,
      body.category_id || null, body.meta_title || null, body.meta_description || null
    ).run()

    return c.json({ message: 'Produk berhasil dibuat.', id })
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      throw new HTTPException(400, { message: 'Gagal menyimpan: Judul atau Tautan (slug) sudah digunakan oleh produk lain.' })
    }
    throw new HTTPException(400, { message: 'Gagal membuat produk.' })
  }
})

products.put('/:id', requirePermission('edit_post'), rateLimit(30, 60, 'product_write'), zValidator('json', productSchema), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')
  const body = c.req.valid('json')

  const cleanDescription = body.description ? xss(body.description, { whiteList: customWhiteList }) : null

  const existing = await c.env.DB.prepare('SELECT author_id, status, file_r2_key, cover_image_key FROM products WHERE id = ?').bind(targetId).first()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  const allowedToEditAny = ['super_admin', 'Admin', 'Editor']
  if (!allowedToEditAny.includes(user.role)) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak mengedit produk ini.' })
    }
  }

  // Logika R2: Hapus file lama jika file diganti atau dihapus (null)
  const newFileKey = body.file_r2_key !== undefined ? body.file_r2_key : existing.file_r2_key
  const newCoverKey = body.cover_image_key !== undefined ? body.cover_image_key : existing.cover_image_key

  if (existing.file_r2_key && newFileKey !== existing.file_r2_key) {
    await c.env.R2.delete(existing.file_r2_key as string).catch(() => {})
  }
  // Catatan: cover_image_key tidak dihapus dari R2 di sini karena dikelola oleh tabel media (Media Library) dan mungkin digunakan oleh entitas lain.

  try {
    await c.env.DB.prepare(`
      UPDATE products SET
        slug = ?, title = ?, description = ?, price = ?, original_price = ?,
        cover_image_key = ?, file_r2_key = ?, status = ?, category_id = ?, meta_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.slug, body.title, cleanDescription, body.price, body.original_price || null,
      newCoverKey || null, newFileKey || null, body.status, body.category_id || null, body.meta_title || null, body.meta_description || null, targetId
    ).run()

    return c.json({ message: 'Produk berhasil diperbarui.' })
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      throw new HTTPException(400, { message: 'Gagal menyimpan: Judul atau Tautan (slug) sudah digunakan oleh produk lain.' })
    }
    throw new HTTPException(400, { message: 'Gagal memperbarui produk.' })
  }
})

products.delete('/:id', requirePermission('delete_post'), rateLimit(30, 60, 'product_write'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  const existing = await c.env.DB.prepare('SELECT author_id, file_r2_key FROM products WHERE id = ?').bind(targetId).first()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  const allowedToDeleteAny = ['super_admin', 'Admin', 'Editor']
  if (!allowedToDeleteAny.includes(user.role)) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak mengarsipkan produk ini.' })
    }
  }

  // Soft Delete: Ganti status menjadi archived alih-alih menghapus data fisik
  // Jangan hapus file di R2 untuk melindungi hak pembeli lama
  await c.env.DB.prepare("UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(targetId).run()

  return c.json({ message: 'Produk berhasil diarsipkan (Soft Delete).' })
})

export default products
