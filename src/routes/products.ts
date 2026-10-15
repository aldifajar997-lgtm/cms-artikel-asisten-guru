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

// Ubah URL media relatif (/api/media/...) menjadi absolut agar bisa dipakai frontend eksternal
const toAbsoluteMediaUrl = (origin: string, url: unknown): string | null => {
  if (!url || typeof url !== 'string') return null
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function verifyInternalS2S(c: any): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.substring(7).trim()
  if (!token) return false

  // 1. Verifikasi JWT RS256 resmi dari Hub jika ditandatangani dengan private key Hub
  if (c.env.HUB_PUBLIC_KEY) {
    try {
      const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as any
      if (payload) return true
    } catch {
      // bukan JWT RS256 valid, lanjutkan pengecekan berikutnya
    }
  }

  // 2. Verifikasi jika environment menyetel S2S_INTERNAL_SECRET khusus
  if (c.env.S2S_INTERNAL_SECRET && token === c.env.S2S_INTERNAL_SECRET) {
    return true
  }

  // 3. Fallback backward-compatible: jika Hub mengirim string HUB_PUBLIC_KEY (membersihkan spasi & newline)
  if (c.env.HUB_PUBLIC_KEY) {
    const cleanPublic = c.env.HUB_PUBLIC_KEY.replace(/[\r\n\s]/g, '')
    const cleanToken = token.replace(/[\r\n\s]/g, '')
    if (cleanPublic.length > 0 && cleanToken === cleanPublic) {
      return true
    }
  }

  return false
}

async function invalidateProductCaches(kv: KVNamespace, slug?: string) {
  try {
    const listPromises: Promise<any>[] = []
    if (slug) {
      listPromises.push(kv.delete(`cache:product_reviews:${slug}`))
    }
    const productList = await kv.list({ prefix: 'cache:products_list:' })
    // Batasi penghapusan hingga 50 key pertama agar tidak melebihi kuota subrequest dan delete KV
    for (const key of productList.keys.slice(0, 50)) {
      listPromises.push(kv.delete(key.name))
    }
    await Promise.all(listPromises)
  } catch (err) {
    console.error('Failed to invalidate product caches:', err)
  }
}

// --- PUBLIC & HUB ROUTES ---

products.get('/public', async (c) => {
  const { limit, offset } = getPagination(c, 12, 50)
  const search = c.req.query('search') || ''
  const categoryId = c.req.query('category_id') || ''
  const categorySlug = c.req.query('category_slug') || ''
  const sellerId = c.req.query('seller_id') || ''

  // Sanitasi input untuk mencegah Cache Key Poisoning & batas keras SQLite D1 LIKE (50 bytes)
  const safeSearch = search ? search.substring(0, 40).trim() : ''
  const safeCategorySlug = categorySlug ? categorySlug.substring(0, 100).trim() : ''
  const safeCategoryId = categoryId ? categoryId.substring(0, 50).trim() : ''
  const safeSellerId = sellerId ? sellerId.substring(0, 50).trim() : ''

  const cacheKey = `cache:products_list:${limit}:${offset}:${safeCategoryId || 'any'}:${safeCategorySlug || 'any'}:${safeSellerId || 'any'}:${safeSearch || 'none'}`

  const cachedData = await c.env.KV.get(cacheKey, 'json')
  if (cachedData) {
    return c.json(cachedData, 200, {
      'Cache-Control': 'public, max-age=180, stale-while-revalidate=300'
    })
  }
  
  let countQuery = "SELECT count(*) as total FROM products p WHERE p.status = 'published'"
  let dataQuery = `
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.cover_image_alt, p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt, p.detail_image_3_key, p.detail_image_3_alt, p.description, p.created_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, p.average_rating, p.total_reviews, c.name as category_name, c.slug as category_slug, u.id as seller_id, u.name as seller_name, u.avatar_url as seller_avatar_url, u.cover_url as seller_cover_url
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN users u ON p.author_id = u.id
    WHERE p.status = 'published'
  `
  const countParams: any[] = []
  const dataParams: any[] = []
  
  if (safeSearch) {
    countQuery += " AND (p.title LIKE ? OR p.description LIKE ?)"
    dataQuery += " AND (p.title LIKE ? OR p.description LIKE ?)"
    countParams.push(`%${safeSearch}%`, `%${safeSearch}%`)
    dataParams.push(`%${safeSearch}%`, `%${safeSearch}%`)
  }

  if (safeCategoryId) {
    countQuery += " AND p.category_id = ?"
    dataQuery += " AND p.category_id = ?"
    countParams.push(safeCategoryId)
    dataParams.push(safeCategoryId)
  } else if (safeCategorySlug) {
    countQuery += " AND p.category_id IN (SELECT id FROM categories WHERE slug = ? AND type = 'product')"
    dataQuery += " AND c.slug = ?"
    countParams.push(safeCategorySlug)
    dataParams.push(safeCategorySlug)
  }

  if (safeSellerId) {
    countQuery += " AND p.author_id = ?"
    dataQuery += " AND p.author_id = ?"
    countParams.push(safeSellerId)
    dataParams.push(safeSellerId)
  }
  
  dataQuery += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
  
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{total: number}>()
  const total = countResult?.total || 0
  
  dataParams.push(limit, offset)
  const results = await c.env.DB.prepare(dataQuery).bind(...dataParams).all()
  
  const origin = new URL(c.req.url).origin;
  const mappedResults = results.results.map((p: any) => ({
    ...p,
    cover_image_url: p.cover_image_key ? `${origin}/api/media/${p.cover_image_key}` : null,
    detail_image_1_url: p.detail_image_1_key ? `${origin}/api/media/${p.detail_image_1_key}` : null,
    detail_image_2_url: p.detail_image_2_key ? `${origin}/api/media/${p.detail_image_2_key}` : null,
    detail_image_3_url: p.detail_image_3_key ? `${origin}/api/media/${p.detail_image_3_key}` : null,
    seller_avatar_url: toAbsoluteMediaUrl(origin, p.seller_avatar_url),
    seller_cover_url: toAbsoluteMediaUrl(origin, p.seller_cover_url)
  }))

  const responseData = { data: mappedResults, limit, offset, total }

  c.executionCtx.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 180 })
  )

  return c.json(responseData, 200, {
    'Cache-Control': 'public, max-age=180, stale-while-revalidate=300'
  })
})

products.get('/public/:slug', async (c) => {
  const slug = c.req.param('slug')
  
  const product = await c.env.DB.prepare(`
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.cover_image_alt, p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt, p.detail_image_3_key, p.detail_image_3_alt, p.description, p.status, p.created_at, p.updated_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, p.average_rating, p.total_reviews, c.name as category_name, c.slug as category_slug, u.id as seller_id, u.name as seller_name, u.avatar_url as seller_avatar_url, u.cover_url as seller_cover_url
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN users u ON p.author_id = u.id
    WHERE p.slug = ? AND p.status = 'published'
  `).bind(slug).first()

  if (!product) {
    const history = await c.env.DB.prepare(
      "SELECT reference_id FROM slug_history WHERE old_slug = ? AND type = 'product'"
    ).bind(slug).first()

    if (history && history.reference_id) {
      const realProduct = await c.env.DB.prepare("SELECT slug FROM products WHERE id = ? AND status = 'published'").bind(history.reference_id).first()
      if (realProduct) {
         return c.json({ is_redirect: true, new_slug: realProduct.slug }, 200)
      }
    }
    throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })
  }

  // NO CACHE: Hub requires real-time price
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  c.header('Expires', '0')
  c.header('Surrogate-Control', 'no-store')

  const origin = new URL(c.req.url).origin;
  const mappedProduct = {
    ...product,
    cover_image_url: product.cover_image_key ? `${origin}/api/media/${product.cover_image_key}` : null,
    detail_image_1_url: product.detail_image_1_key ? `${origin}/api/media/${product.detail_image_1_key}` : null,
    detail_image_2_url: product.detail_image_2_key ? `${origin}/api/media/${product.detail_image_2_key}` : null,
    detail_image_3_url: product.detail_image_3_key ? `${origin}/api/media/${product.detail_image_3_key}` : null,
    seller_avatar_url: toAbsoluteMediaUrl(origin, product.seller_avatar_url),
    seller_cover_url: toAbsoluteMediaUrl(origin, product.seller_cover_url)
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
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { product_id?: string; type?: string }
    
    // Pastikan token ini memang untuk tujuan download (bukan sale_trigger atau price_check)
    if (payload.type !== 'download_request') {
      throw new HTTPException(403, { message: 'Akses ditolak. Token tidak sesuai untuk operasi ini.' })
    }
    // MENCEGAH BYPASS (Bug #1): product_id di JWT harus cocok dengan URL
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
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { type?: string; product_id?: string }
    if (payload.type !== 'price_check') {
      throw new HTTPException(403, { message: 'Token valid tapi BUKAN untuk pengecekan harga.' })
    }
    if (payload.product_id !== targetId) {
      throw new HTTPException(403, { message: 'Token pengecekan harga tidak sesuai dengan produk ini.' })
    }
  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }

  const product = await c.env.DB.prepare(
    'SELECT id, price, status, title FROM products WHERE id = ?'
  ).bind(targetId).first<{ id: string; price: number; status: string; title: string }>()

  if (!product) {
    throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })
  }
  if (product.status !== 'published') {
    throw new HTTPException(400, { message: 'Produk belum di-publish.' })
  }

  // ─── PRICE LOCK TOKEN ────────────────────────────────────────────
  // Terbitkan token pendek yang mengunci harga ini.
  // Hub WAJIB menyertakan token ini di JWT sale_trigger.
  // Ini mencegah race condition: jika harga berubah setelah price_check,
  // CMS akan menolak sale karena token tidak cocok dengan harga baru.
  //
  // TTL HARUS ≥ Midtrans payment expiry (60 menit) + buffer retry (30 menit)
  // Jika TTL lebih pendek dari payment expiry, user yang bayar setelah token expired
  // akan kehilangan earning seller (uang masuk tapi CMS tolak sale trigger).
  const PRICE_LOCK_TTL_SECONDS = 5400 // 90 menit
  const priceLockId = crypto.randomUUID()
  const priceLockKey = `price_lock:${priceLockId}`
  const priceLockPayload = JSON.stringify({
    product_id: targetId,
    price: product.price,
    locked_at: new Date().toISOString()
  })
  await c.env.KV.put(priceLockKey, priceLockPayload, { expirationTtl: PRICE_LOCK_TTL_SECONDS })
  // ─────────────────────────────────────────────────────────────────

  return c.json({
    success: true,
    price: product.price,
    title: product.title,
    price_lock_token: priceLockId,
    price_lock_expires_in_seconds: PRICE_LOCK_TTL_SECONDS
  })

})

products.post('/internal/:id/sale', rateLimit(500, 60, 'internal_sale'), async (c) => {
  const targetId = c.req.param('id')
  
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  if (!token || !c.env.HUB_PUBLIC_KEY) {
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak ditemukan atau kunci publik tidak dikonfigurasi.' })
  }

  let salePayload: {
    product_id?: string
    type?: string
    jti?: string
    hub_transaction_id?: string
    buyer_hub_id?: string
    gross_amount?: number
    paid_at?: string
    price_lock_token?: string  // WAJIB: token dari /internal/:id/price
  }

  try {
    salePayload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as typeof salePayload
    if (salePayload.type !== 'sale_trigger') {
      throw new HTTPException(403, { message: 'Token valid tapi tidak dapat digunakan untuk operasi ini.' })
    }
    // product_id di JWT harus ada dan harus sesuai dengan :id di URL
    // Ini mencegah satu token digunakan untuk trigger sale produk yang berbeda
    if (!salePayload.product_id || salePayload.product_id !== targetId) {
      throw new HTTPException(403, { message: 'Token tidak sesuai dengan produk yang dimaksud.' })
    }
  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }

  // ─── VALIDASI FIELD WAJIB ─────────────────────────────────────────
  if (!salePayload.hub_transaction_id) {
    throw new HTTPException(400, { message: 'Data transaksi tidak lengkap: ID transaksi wajib disertakan.' })
  }
  if (typeof salePayload.gross_amount !== 'number' || salePayload.gross_amount <= 0) {
    throw new HTTPException(400, { message: 'Data transaksi tidak lengkap: Nominal pembayaran tidak valid.' })
  }
  if (!salePayload.price_lock_token) {
    throw new HTTPException(400, { message: 'Data transaksi tidak lengkap: Token konfirmasi harga wajib disertakan.' })
  }
  if (!salePayload.paid_at) {
    throw new HTTPException(400, { message: 'Data transaksi tidak lengkap: Waktu pembayaran wajib disertakan.' })
  }
  // Validasi timestamp paid_at: tidak boleh di masa depan dan tidak boleh terlalu lama.
  // Window diperlebar ke 7 hari (bukan 24 jam) karena:
  // - Retry queue (s2s_sync_queue) bisa mencoba ulang berhari-hari jika CMS sempat down.
  // - Garis pertahanan utama terhadap waktu yang sudah lewat adalah price_lock_token (TTL 90 menit),
  //   BUKAN window paid_at ini. paid_at hanya sebagai sanity check pada timestamp yang ganjil.
  const paidAtMs = new Date(salePayload.paid_at).getTime()
  if (isNaN(paidAtMs)) {
    throw new HTTPException(400, { message: 'Data transaksi tidak valid: Format waktu pembayaran tidak dikenali.' })
  }
  const nowMs = Date.now()
  const maxFutureMs = nowMs + 5 * 60 * 1000           // toleransi 5 menit ke depan (clock skew)
  const maxPastMs   = nowMs - 7 * 24 * 60 * 60 * 1000 // 7 hari ke belakang (cukup untuk retry queue)
  if (paidAtMs > maxFutureMs) {
    throw new HTTPException(400, { message: 'Data transaksi tidak valid: Waktu pembayaran tidak boleh di masa depan.' })
  }
  if (paidAtMs < maxPastMs) {
    throw new HTTPException(400, { message: 'Data transaksi tidak dapat diproses: Waktu pembayaran sudah terlalu lama. Hubungi administrator.' })
  }
  // ─────────────────────────────────────────────────────────────────

  // ─── IDEMPOTENCY CHECK ───────────────────────────────────────────
  const idempotencyKey = `used_sale_token:${salePayload.hub_transaction_id}`
  const isUsed = await c.env.KV.get(idempotencyKey)
  if (isUsed) {
    // Bersifat idempotent: kembalikan 200 OK agar Hub tidak melakukan retry
    return c.json({ message: 'Transaksi sudah diproses sebelumnya.' })
  }
  // ─────────────────────────────────────────────────────────────────

  // ─── VALIDASI PRICE LOCK TOKEN ───────────────────────────────────
  // Ini adalah garis pertahanan utama terhadap race condition harga.
  // Harga yang valid adalah harga yang dikunci saat Hub memanggil /internal/:id/price,
  // BUKAN harga produk saat ini di DB (yang bisa sudah berubah).
  const priceLockKey = `price_lock:${salePayload.price_lock_token}`
  const priceLockRaw = await c.env.KV.get(priceLockKey)

  if (!priceLockRaw) {
    // Token tidak ditemukan: sudah expired (>10 menit) atau tidak pernah dibuat
    throw new HTTPException(410, { message: 'Sesi checkout telah kedaluwarsa. Silakan mulai proses pembelian kembali.' })
  }

  let priceLock: { product_id: string; price: number; locked_at: string }
  try {
    priceLock = JSON.parse(priceLockRaw)
  } catch {
    throw new HTTPException(500, { message: 'Terjadi kesalahan saat memproses transaksi.' })
  }

  // Pastikan price lock token ini memang untuk produk yang dimaksud
  if (priceLock.product_id !== targetId) {
    throw new HTTPException(403, { message: 'Token konfirmasi harga tidak sesuai dengan produk ini.' })
  }

  // Validasi gross_amount dari Hub HARUS PERSIS sama dengan harga yang dikunci
  // Toleransi 0: tidak ada diskon tambahan, tidak ada markup, tidak ada kesalahan nominal.
  if (salePayload.gross_amount !== priceLock.price) {
    throw new HTTPException(409, {
      message: `Nominal pembayaran tidak sesuai dengan harga yang berlaku. Transaksi dibatalkan untuk keamanan.`
    })
  }

  // Hapus price lock token setelah divalidasi (one-time use)
  await c.env.KV.delete(priceLockKey)
  // ─────────────────────────────────────────────────────────────────

  // ─── TANDAI IDEMPOTENCY (setelah validasi berhasil) ───────────────
  // TTL 72 jam — cukup untuk mendeteksi retry dari Hub dalam window yang wajar
  await c.env.KV.put(idempotencyKey, '1', { expirationTtl: 259200 })
  // ─────────────────────────────────────────────────────────────────

  // Ambil data produk termasuk pemilik (seller)
  const product = await c.env.DB.prepare(
    'SELECT id, author_id, price FROM products WHERE id = ?'
  ).bind(targetId).first<{ id: string; author_id: string; price: number }>()

  if (!product || !product.author_id) {
    throw new HTTPException(404, { message: 'Produk tidak ditemukan atau tidak memiliki penjual.' })
  }

  // gross_amount sudah tervalidasi oleh price lock: ini adalah harga yang benar-benar dibayar
  const grossAmount = salePayload.gross_amount

  // Cari snapshot riwayat harga yang berlaku saat price_lock dibuat
  // Ini menjamin audit trail: transaksi ini mengacu ke harga BERAPA yang berlaku
  const priceLockLockedAt = priceLock.locked_at
  const priceHistory = await c.env.DB.prepare(`
    SELECT id FROM product_price_history
    WHERE product_id = ? AND price = ? AND effective_at <= ?
    ORDER BY effective_at DESC LIMIT 1
  `).bind(targetId, grossAmount, priceLockLockedAt).first<{ id: string }>()

  // Ambil konfigurasi fee yang berlaku saat transaksi terjadi (paid_at, bukan sekarang)
  const feeConfig = await c.env.DB.prepare(`
    SELECT id, fee_bps, min_fee, max_fee FROM admin_fee_config
    WHERE effective_from <= ?
    ORDER BY effective_from DESC LIMIT 1
  `).bind(salePayload.paid_at).first<{ id: string; fee_bps: number; min_fee: number | null; max_fee: number | null }>()

  // Kalkulasi potongan admin
  const feeBps = feeConfig?.fee_bps ?? 0
  let adminFee = Math.floor((grossAmount * feeBps) / 10000)

  if (feeConfig?.min_fee != null && adminFee < feeConfig.min_fee) {
    adminFee = feeConfig.min_fee
  }
  if (feeConfig?.max_fee != null && adminFee > feeConfig.max_fee) {
    adminFee = feeConfig.max_fee
  }
  // Fee tidak pernah boleh melebihi gross
  adminFee = Math.min(adminFee, grossAmount)

  const sellerNetAmount = grossAmount - adminFee
  const transactionId = crypto.randomUUID()

  // Simpan record transaksi ke ledger & update sales_count secara atomik
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO sale_transactions (
        id, product_id, seller_id,
        price_history_id, gross_amount,
        fee_config_id, applied_fee_bps, admin_fee_amount, seller_net_amount,
        hub_transaction_id, buyer_hub_id, status, paid_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'settled', ?)
    `).bind(
      transactionId, targetId, product.author_id,
      priceHistory?.id ?? null, grossAmount,
      feeConfig?.id ?? null, feeBps, adminFee, sellerNetAmount,
      salePayload.hub_transaction_id, salePayload.buyer_hub_id ?? null, salePayload.paid_at
    ),
    c.env.DB.prepare(
      'UPDATE products SET sales_count = COALESCE(sales_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(targetId)
  ])
  
  return c.json({ message: 'Transaksi berhasil diproses.' })
})

// --- REVIEWS ROUTES ---
products.get('/public/:slug/reviews', async (c) => {
  const slug = c.req.param('slug');
  const cacheKey = `cache:product_reviews:${slug}`;
  
  const cachedData = await c.env.KV.get(cacheKey, 'json');
  if (cachedData) {
    return c.json(cachedData, 200, {
      'Cache-Control': 'public, max-age=180, stale-while-revalidate=300'
    });
  }

  // Get productId
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: string }>();
  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' });

  // Get reviews (Dibatasi 50 terbaru untuk mencegah memory crash)
  const reviews = await c.env.DB.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, r.user_id 
    FROM product_reviews r
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT 50
  `).bind(product.id).all();

  const responseData = { success: true, reviews: reviews.results };

  c.executionCtx.waitUntil(
    c.env.KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 180 })
  );

  return c.json(responseData, 200, {
    'Cache-Control': 'public, max-age=180, stale-while-revalidate=300'
  });
});

products.post('/internal-reviews', rateLimit(500, 60, 'internal_reviews'), async (c) => {
  const isAuthorized = await verifyInternalS2S(c);
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Unauthorized S2S Call' });
  }

  const { productId, accountId, rating, comment } = await c.req.json();
  if (!productId || !accountId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw new HTTPException(400, { message: 'Data tidak valid.' });
  }

  // Defense-in-depth: batasi panjang komentar di sisi server juga
  if (comment && typeof comment === 'string' && comment.length > 500) {
    throw new HTTPException(400, { message: 'Ulasan terlalu panjang.' });
  }

  // Verifikasi pembelian sudah dilakukan di layer Hub API sebelum S2S call ini

  const reviewId = crypto.randomUUID();
  try {
    // Gunakan batch agar Insert/Update dan Update Aggregate bersifat Atomik
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO product_reviews (id, product_id, user_id, rating, comment)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(product_id, user_id) DO UPDATE SET 
          rating = excluded.rating,
          comment = excluded.comment,
          created_at = CURRENT_TIMESTAMP
      `).bind(reviewId, productId, accountId, rating, comment),
      c.env.DB.prepare(`
        UPDATE products 
        SET total_reviews = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ?),
            average_rating = (SELECT AVG(rating) FROM product_reviews WHERE product_id = ?)
        WHERE id = ?
      `).bind(productId, productId, productId)
    ]);
    
    const prod = await c.env.DB.prepare('SELECT slug FROM products WHERE id = ?').bind(productId).first<{ slug: string }>();
    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, prod?.slug));
    return c.json({ success: true, id: reviewId });
  } catch (err: any) {
    throw err;
  }
});

products.get('/internal-reviews/my', rateLimit(500, 60, 'internal_reviews_my'), async (c) => {
  const isAuthorized = await verifyInternalS2S(c);
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Unauthorized S2S Call' });
  }

  const productId = c.req.query('productId');
  const accountId = c.req.query('accountId');

  if (!productId || !accountId) {
    throw new HTTPException(400, { message: 'Missing parameters' });
  }

  const review = await c.env.DB.prepare(`
    SELECT id, rating, comment, created_at 
    FROM product_reviews 
    WHERE product_id = ? AND user_id = ?
  `).bind(productId, accountId).first();

  return c.json({ success: true, review: review || null });
});

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
  cover_image_alt: z.string().optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_1_key: z.string().optional().nullable(),
  detail_image_1_alt: z.string().optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_2_key: z.string().optional().nullable(),
  detail_image_2_alt: z.string().optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_3_key: z.string().optional().nullable(),
  detail_image_3_alt: z.string().optional().nullable().transform(val => val ? stripHtml(val) : val),
  file_r2_key: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  status: z.enum(['draft', 'published']).default('draft'),
})

products.get('/admin/all', requirePermission('view_dashboard'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 50, 100)

  let query = "SELECT id, slug, title, description, price, original_price, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, file_r2_key, status, created_at, category_id, meta_title, meta_description, view_count, sales_count, average_rating, total_reviews FROM products"
  const params: any[] = []
  
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    query += " WHERE author_id = ?"
    params.push(user.id)
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  const results = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: results.results, limit, offset })
})

products.get('/admin/:id', requirePermission('edit_product'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  let query = "SELECT * FROM products WHERE id = ?"
  const params: any[] = [targetId]

  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    query += " AND author_id = ?"
    params.push(user.id)
  }

  const product = await c.env.DB.prepare(query).bind(...params).first()
  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  return c.json({ data: product })
})

products.post('/', requirePermission('create_product'), rateLimit(30, 60, 'product_write'), zValidator('json', productSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  
  const cleanDescription = body.description ? xss(body.description, { whiteList: customWhiteList }) : null

  const id = crypto.randomUUID()
  const authorId = user.id

  if (body.category_id) {
    const catCheck = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(body.category_id).first()
    if (!catCheck || catCheck.type !== 'product') {
      throw new HTTPException(400, { message: 'Kategori yang dipilih tidak valid untuk produk.' })
    }
  }

  try {
    // Insert produk + snapshot harga awal secara atomik
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO products (
          id, slug, title, description, price, original_price, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, file_r2_key, status, author_id, category_id, meta_title, meta_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.slug, body.title, cleanDescription, body.price, body.original_price ?? null, 
        body.cover_image_key || null, body.cover_image_alt ?? null,
        body.detail_image_1_key || null, body.detail_image_1_alt ?? null,
        body.detail_image_2_key || null, body.detail_image_2_alt ?? null,
        body.detail_image_3_key || null, body.detail_image_3_alt ?? null,
        body.file_r2_key || null, body.status, authorId,
        body.category_id || null, body.meta_title || null, body.meta_description || null
      ),
      // Snapshot harga awal produk
      c.env.DB.prepare(`
        INSERT INTO product_price_history (id, product_id, price, original_price, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), id, body.price, body.original_price ?? null,
        authorId, 'Harga awal saat produk dibuat'
      )
    ])

    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, body.slug))
    return c.json({ message: 'Produk berhasil dibuat.', id })
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      throw new HTTPException(400, { message: 'Gagal menyimpan: Judul atau Tautan (slug) sudah digunakan oleh produk lain.' })
    }
    throw new HTTPException(400, { message: 'Gagal membuat produk.' })
  }
})

products.put('/:id', requirePermission('edit_product'), rateLimit(30, 60, 'product_write'), zValidator('json', productSchema), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')
  const body = c.req.valid('json')

  const cleanDescription = body.description ? xss(body.description, { whiteList: customWhiteList }) : null

  if (body.category_id) {
    const catCheck = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(body.category_id).first()
    if (!catCheck || catCheck.type !== 'product') {
      throw new HTTPException(400, { message: 'Kategori yang dipilih tidak valid untuk produk.' })
    }
  }

  const existing = await c.env.DB.prepare('SELECT author_id, status, price, original_price, file_r2_key, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, slug FROM products WHERE id = ?').bind(targetId).first<{ author_id: string; status: string; price: number; original_price: number | null; file_r2_key: string | null; cover_image_key: string | null; cover_image_alt: string | null; detail_image_1_key: string | null; detail_image_1_alt: string | null; detail_image_2_key: string | null; detail_image_2_alt: string | null; detail_image_3_key: string | null; detail_image_3_alt: string | null; slug: string }>()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // Blokir edit produk yang sudah diarsipkan (mencegah un-archive bypass & perubahan data)
  if (existing.status === 'archived') {
    throw new HTTPException(403, { message: 'Produk yang sudah diarsipkan tidak dapat diedit. Buat produk baru jika diperlukan.' })
  }

  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak mengedit produk ini.' })
    }
  }

  // LOOPHOLE FIX: Cegah downgrade dari 'published' ke 'draft'
  // Jika ini dibiarkan, Seller bisa mengubah produk 'published' menjadi 'draft', lalu menembak endpoint Hard Delete!
  if (existing.status === 'published' && body.status === 'draft') {
    throw new HTTPException(400, { message: 'Produk yang sudah publik tidak dapat dikembalikan menjadi draf. Gunakan fitur Arsip jika ingin menyembunyikannya dari etalase.' })
  }

  const newFileKey = body.file_r2_key !== undefined ? body.file_r2_key : existing.file_r2_key
  const newCoverKey = body.cover_image_key !== undefined ? body.cover_image_key : existing.cover_image_key
  const newCoverAlt = body.cover_image_alt !== undefined ? body.cover_image_alt : existing.cover_image_alt
  const newDetail1Key = body.detail_image_1_key !== undefined ? body.detail_image_1_key : existing.detail_image_1_key
  const newDetail1Alt = body.detail_image_1_alt !== undefined ? body.detail_image_1_alt : existing.detail_image_1_alt
  const newDetail2Key = body.detail_image_2_key !== undefined ? body.detail_image_2_key : existing.detail_image_2_key
  const newDetail2Alt = body.detail_image_2_alt !== undefined ? body.detail_image_2_alt : existing.detail_image_2_alt
  const newDetail3Key = body.detail_image_3_key !== undefined ? body.detail_image_3_key : existing.detail_image_3_key
  const newDetail3Alt = body.detail_image_3_alt !== undefined ? body.detail_image_3_alt : existing.detail_image_3_alt

  // Hapus file R2 lama jika file diganti atau dihapus (null)
  if (existing.file_r2_key && newFileKey !== existing.file_r2_key) {
    await c.env.R2.delete(existing.file_r2_key as string).catch(() => {})
    await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(existing.file_r2_key).run()
  }
  // Catatan: cover_image_key tidak dihapus dari R2 di sini karena dikelola oleh tabel media (Media Library) dan mungkin digunakan oleh entitas lain.

  // Cek apakah harga berubah untuk membuat snapshot riwayat harga
  // existing sudah mengandung price dan original_price, tidak perlu query kedua
  const priceChanged =
    existing.price !== body.price ||
    (existing.original_price ?? null) !== (body.original_price ?? null)

  try {
    const statements = [
      c.env.DB.prepare(`
        UPDATE products SET
          slug = ?, title = ?, description = ?, price = ?, original_price = ?,
          cover_image_key = ?, cover_image_alt = ?,
          detail_image_1_key = ?, detail_image_1_alt = ?,
          detail_image_2_key = ?, detail_image_2_alt = ?,
          detail_image_3_key = ?, detail_image_3_alt = ?,
          file_r2_key = ?, status = ?, category_id = ?, meta_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        body.slug, body.title, cleanDescription, body.price, body.original_price ?? null,
        newCoverKey || null, newCoverAlt ?? null,
        newDetail1Key || null, newDetail1Alt ?? null,
        newDetail2Key || null, newDetail2Alt ?? null,
        newDetail3Key || null, newDetail3Alt ?? null,
        newFileKey || null, body.status, body.category_id || null, body.meta_title || null, body.meta_description || null, targetId
      )
    ]

    // Jika harga berubah, simpan snapshot riwayat harga
    if (priceChanged) {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO product_price_history (id, product_id, price, original_price, changed_by, change_reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(), targetId, body.price, body.original_price ?? null,
          user.id, 'Perubahan harga oleh admin CMS'
        )
      )
    }

    // Log history jika slug berubah
    if (existing && existing.slug && body.slug && body.slug !== existing.slug) {
      const historyId = crypto.randomUUID()
      statements.push(c.env.DB.prepare(`
        INSERT INTO slug_history (id, type, reference_id, old_slug, new_slug)
        VALUES (?, 'product', ?, ?, ?)
        ON CONFLICT(old_slug, type) DO UPDATE SET new_slug = excluded.new_slug, reference_id = excluded.reference_id
      `).bind(historyId, targetId, existing.slug, body.slug))
    }

    await c.env.DB.batch(statements)

    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, body.slug || existing.slug))
    return c.json({ message: 'Produk berhasil diperbarui.' })
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      throw new HTTPException(400, { message: 'Gagal menyimpan: Judul atau Tautan (slug) sudah digunakan oleh produk lain.' })
    }
    throw new HTTPException(400, { message: 'Gagal memperbarui produk.' })
  }
})

products.put('/:id/archive', requirePermission('edit_product'), rateLimit(30, 60, 'product_write'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  const existing = await c.env.DB.prepare('SELECT author_id, status FROM products WHERE id = ?').bind(targetId).first()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // Otorisasi Kepemilikan
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak mengarsipkan produk ini.' })
    }
  }

  if (existing.status === 'archived') {
    return c.json({ message: 'Produk sudah dalam status arsip.' })
  }
  if (existing.status === 'draft') {
    throw new HTTPException(400, { message: 'Produk draft tidak bisa diarsipkan, silakan hapus permanen.' })
  }

  await c.env.DB.prepare("UPDATE products SET status = 'archived', slug = slug || '-archived-' || strftime('%s', 'now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(targetId).run()
  
  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, (existing as any).slug))
  return c.json({ message: 'Produk berhasil diarsipkan.' })
})

products.delete('/:id', requirePermission('delete_product'), rateLimit(30, 60, 'product_write'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  const existing = await c.env.DB.prepare('SELECT author_id, file_r2_key, status FROM products WHERE id = ?').bind(targetId).first()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  const isSuperAdmin = user.role === 'super_admin'

  // Otorisasi Kepemilikan (Memperbolehkan Admin yang punya hak edit_any_product)
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak menghapus produk ini.' })
    }
  }
  
  // Perlindungan Hard Delete: Hanya Super Admin yang boleh menghapus produk selain draf
  if (user.role !== 'super_admin' && existing.status !== 'draft') {
    throw new HTTPException(403, { message: 'Anda hanya diizinkan menghapus produk draf. Gunakan fitur Arsip untuk produk publik.' })
  }

  // Eksekusi R2 & D1 Media Cleanup (Hard Delete)
  if (existing.file_r2_key) {
    await c.env.R2.delete(existing.file_r2_key as string).catch(() => {})
    await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(existing.file_r2_key).run()
  }
  
  // Eksekusi Hard Delete D1
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(targetId).run()

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, (existing as any).slug))
  return c.json({ message: 'Produk dan berkas digital berhasil dimusnahkan permanen.' })
})

export default products
