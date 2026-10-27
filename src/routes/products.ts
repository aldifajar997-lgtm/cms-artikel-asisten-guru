import { Hono } from 'hono'
import { verify, sign } from 'hono/jwt'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'
import { parseZipBuffer, extractZipEntry } from '../utils/zip-parser'
import { scanMainFileBuffer, MalwareScanReport } from '../utils/malware-scanner'
import { parseTrafficSource, parseDeviceType } from '../utils/traffic-parser'
import { getClientIp } from '../utils/client-ip'
import xss from 'xss'

export function isSuperAdminOrAdmin(user: any): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  const roleStr = String(user.role || '').toLowerCase()
  const roles = roleStr.split(',').map((r: string) => r.trim())
  return roles.includes('super admin') || roles.includes('super_admin') || roles.includes('admin')
}

const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'docs.google.com',
  'drive.google.com'
]

const customWhiteList = { ...(xss as any).getDefaultWhiteList() }
Object.keys(customWhiteList).forEach((tag) => {
  customWhiteList[tag].push('style', 'class')
})
customWhiteList.iframe = ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'class']
customWhiteList.video = ['src', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'style', 'class']
customWhiteList.audio = ['src', 'controls', 'style', 'class']
customWhiteList.source = ['src', 'type']

export const sanitizeRichContent = (html: string): string => {
  return xss(html, {
    whiteList: customWhiteList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
    onTagAttr: (tag, name, value) => {
      if (tag === 'iframe' && name === 'src') {
        try {
          const u = new URL(value)
          if (u.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.includes(u.hostname.toLowerCase())) {
            return `${name}="${(xss as any).escapeAttrValue(value)}"`
          }
        } catch {}
        // Hapus attribute src jika host tidak diizinkan (Audit #3)
        return ''
      }
      if ((tag === 'video' || tag === 'audio' || tag === 'source') && name === 'src') {
        try {
          if (value.startsWith('/') || value.startsWith('./')) {
            return `${name}="${(xss as any).escapeAttrValue(value)}"`
          }
          const u = new URL(value)
          if (u.protocol === 'https:' || u.protocol === 'http:') {
            return `${name}="${(xss as any).escapeAttrValue(value)}"`
          }
        } catch {}
        return ''
      }
      if (name === 'style') {
        const cleanStyle = value.replace(/javascript\s*:/gi, '').replace(/expression\s*\(/gi, '').replace(/vbscript\s*:/gi, '')
        return `${name}="${(xss as any).escapeAttrValue(cleanStyle)}"`
      }
    }
  })
}

const stripHtml = (val: string) => val ? xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] }).trim() : val;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBuf = enc.encode(a)
  const bBuf = enc.encode(b)
  if (aBuf.byteLength !== bBuf.byteLength) {
    crypto.subtle.timingSafeEqual(aBuf, aBuf)
    return false
  }
  return crypto.subtle.timingSafeEqual(aBuf, bBuf)
}

const products = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Ubah URL media relatif (/api/media/...) menjadi absolut agar bisa dipakai frontend eksternal
const toAbsoluteMediaUrl = (origin: string, url: unknown): string | null => {
  if (!url || typeof url !== 'string') return null
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

async function verifyInternalS2S(c: any): Promise<boolean> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.substring(7).trim()
  if (!token) return false

  // 1. Verifikasi JWT RS256 resmi dari Hub jika ditandatangani dengan private key Hub (Audit #1)
  if (c.env.HUB_PUBLIC_KEY && token.includes('.')) {
    try {
      const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as any
      if (payload && typeof payload === 'object') {
        const now = Math.floor(Date.now() / 1000)
        // Wajib belum expired
        if (payload.exp && typeof payload.exp === 'number' && payload.exp < now) {
          return false
        }
        // Wajib ada claim type dan aud yang sah
        const validAud = payload.aud === 'cms' || payload.aud === 'asisten-guru' || payload.aud === 'marketplace' || payload.aud === 'hub'
        const validType = payload.type === 's2s' || payload.type === 'hub_s2s' || payload.type === 'internal_review' || payload.type === 'internal'
        if (validAud && validType) {
          return true
        }
      }
    } catch {
      // bukan JWT RS256 valid
    }
  }

  // 2. Verifikasi jika environment menyetel S2S_INTERNAL_SECRET khusus dengan constant-time comparison (Audit #1)
  if (c.env.S2S_INTERNAL_SECRET) {
    if (timingSafeEqual(token, c.env.S2S_INTERNAL_SECRET)) {
      return true
    }
  }

  // CATATAN KEAMANAN (Audit #1): Fallback ke HUB_PUBLIC_KEY string DIHAPUS PERMANEN karena kunci publik bukan rahasia!
  return false
}

export async function invalidateProductCaches(kv: KVNamespace, slug?: string) {
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
  
  let countQuery = `
    SELECT count(*) as total 
    FROM products p 
    JOIN users u ON p.author_id = u.id
    WHERE p.status = 'published'
      AND u.is_active = 1
      AND (u.seller_status = 'approved' OR u.id = 'super_admin')
  `
  let dataQuery = `
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.cover_image_alt, p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt, p.detail_image_3_key, p.detail_image_3_alt, p.description, p.created_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, p.average_rating, p.total_reviews, c.name as category_name, c.slug as category_slug, u.id as seller_id, COALESCE(NULLIF(TRIM(u.store_name), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(u.store_slug), ''), 'Penjual Mitra') as seller_name, u.store_slug as seller_slug, u.avatar_url as seller_avatar_url, u.cover_url as seller_cover_url
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.author_id = u.id
    WHERE p.status = 'published'
      AND u.is_active = 1
      AND (u.seller_status = 'approved' OR u.id = 'super_admin')
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
    countQuery += " AND (p.author_id = ? OR LOWER(u.store_slug) = LOWER(?))"
    dataQuery += " AND (p.author_id = ? OR LOWER(u.store_slug) = LOWER(?))"
    countParams.push(safeSellerId, safeSellerId)
    dataParams.push(safeSellerId, safeSellerId)
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
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.cover_image_alt, p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt, p.detail_image_3_key, p.detail_image_3_alt, p.description, p.status, p.created_at, p.updated_at, p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, p.average_rating, p.total_reviews, c.name as category_name, c.slug as category_slug, u.id as seller_id, COALESCE(NULLIF(TRIM(u.store_name), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(u.store_slug), ''), 'Penjual Mitra') as seller_name, u.store_slug as seller_slug, u.avatar_url as seller_avatar_url, u.cover_url as seller_cover_url
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.author_id = u.id
    WHERE p.slug = ? 
      AND p.status = 'published'
      AND u.is_active = 1
      AND (u.seller_status = 'approved' OR u.id = 'super_admin')
  `).bind(slug).first()

  if (!product) {
    const history = await c.env.DB.prepare(
      "SELECT reference_id FROM slug_history WHERE old_slug = ? AND type = 'product'"
    ).bind(slug).first()

    if (history && history.reference_id) {
      const realProduct = await c.env.DB.prepare(`
        SELECT p.slug 
        FROM products p 
        JOIN users u ON p.author_id = u.id 
        WHERE p.id = ? 
          AND p.status = 'published'
          AND u.is_active = 1
          AND (u.seller_status = 'approved' OR u.id = 'super_admin')
      `).bind(history.reference_id).first<{ slug: string }>()
      if (realProduct) {
         return c.json({ is_redirect: true, new_slug: realProduct.slug }, 200)
      }
    }
    throw new HTTPException(404, { message: 'Produk tidak ditemukan atau saat ini tidak tersedia.' })
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


// --- PREVIEW ROUTE ---
products.get('/preview/:identifier', rateLimit(100, 60, 'preview_products'), async (c) => {
  const identifier = c.req.param('identifier');
  const token = c.req.query('token');

  if (!token) throw new HTTPException(401, { message: 'Token pratinjau tidak valid atau tidak ditemukan.' });

  let payload: any;
  try {
    payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    if (!payload || payload.type !== 'product_preview') {
      throw new Error('Invalid token type');
    }
  } catch (e) {
    throw new HTTPException(401, { message: 'Sesi pratinjau kedaluwarsa atau tidak valid.' });
  }

  // Ambil data produk tanpa membatasi status (draft/pending_review/published)
  const product = await c.env.DB.prepare(`
    SELECT p.id, p.slug, p.title, p.price, p.original_price, p.cover_image_key, p.cover_image_alt,
           p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt,
           p.detail_image_3_key, p.detail_image_3_alt, p.description, p.status, p.created_at, p.updated_at,
           p.category_id, p.meta_title, p.meta_description, p.view_count, p.sales_count, p.average_rating,
           p.total_reviews, c.name as category_name, c.slug as category_slug, u.id as seller_id,
           COALESCE(NULLIF(TRIM(u.store_name), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(u.store_slug), ''), 'Penjual Mitra') as seller_name,
           u.store_slug as seller_slug, u.avatar_url as seller_avatar_url, u.cover_url as seller_cover_url
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    JOIN users u ON p.author_id = u.id
    WHERE (p.id = ? OR p.slug = ?)
  `).bind(identifier, identifier).first();

  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan atau draf telah dihapus.' });

  // Verifikasi kecocokan token dengan produk
  if (String(product.id) !== String(payload.productId) && product.slug !== String(payload.productId)) {
    throw new HTTPException(401, { message: 'Token tidak cocok dengan produk ini.' });
  }

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Expires', '0');
  c.header('Surrogate-Control', 'no-store');

  const origin = new URL(c.req.url).origin;
  const mappedProduct = {
    ...product,
    cover_image_url: product.cover_image_key ? `${origin}/api/media/${product.cover_image_key}` : null,
    detail_image_1_url: product.detail_image_1_key ? `${origin}/api/media/${product.detail_image_1_key}` : null,
    detail_image_2_url: product.detail_image_2_key ? `${origin}/api/media/${product.detail_image_2_key}` : null,
    detail_image_3_url: product.detail_image_3_key ? `${origin}/api/media/${product.detail_image_3_key}` : null,
    seller_avatar_url: toAbsoluteMediaUrl(origin, product.seller_avatar_url),
    seller_cover_url: toAbsoluteMediaUrl(origin, product.seller_cover_url)
  };

  return c.json(mappedProduct);
});

products.post('/public/:slug/view', rateLimit(1, 60, (c) => `product_view_${c.req.param('slug')}`), async (c) => {
  const slug = c.req.param('slug')
  await c.env.DB.prepare(`
    UPDATE products SET view_count = COALESCE(view_count, 0) + 1 
    WHERE slug = ? AND status = 'published'
  `).bind(slug).run()
  
  return c.json({ message: 'View counted' })
})

const trackEventSchema = z.object({
  seller_id: z.string().optional().nullable(),
  product_id: z.string().optional().nullable(),
  product_slug: z.string().optional().nullable(),
  store_slug: z.string().max(100).optional().nullable(),
  event_type: z.enum(['store_view', 'product_view', 'checkout_intent']).default('product_view'),
  utm_source: z.string().max(100).optional().nullable(),
  utm_medium: z.string().max(100).optional().nullable(),
  utm_campaign: z.string().max(100).optional().nullable(),
  ref: z.string().max(100).optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  url: z.string().max(1000).optional().nullable()
})

// Public Track Event: Ingestion tayangan toko, produk, dan intent checkout dengan metode atomic upsert D1
products.post('/public/track-event', rateLimit(60, 60, (c) => `track_event_${getClientIp(c) || 'anon'}`), zValidator('json', trackEventSchema), async (c) => {
  try {
    const body = c.req.valid('json')
    let sellerId = (body.seller_id || '').trim()
    let productId = (body.product_id || '').trim()

    // 1. Jika sellerId belum ada tapi productId diberikan, cari author pemiliknya
    if (!sellerId && productId) {
      const prodById = await c.env.DB.prepare(`
        SELECT author_id FROM products WHERE id = ? LIMIT 1
      `).bind(productId).first<{ author_id: string }>()
      if (prodById) {
        sellerId = prodById.author_id
      }
    }

    // 2. Jika sellerId atau productId belum ada tapi product_slug diberikan, cari produk dan author
    if ((!sellerId || !productId) && body.product_slug) {
      const prod = await c.env.DB.prepare(`
        SELECT id, author_id FROM products WHERE slug = ? LIMIT 1
      `).bind(body.product_slug).first<{ id: string; author_id: string }>()
      if (prod) {
        if (!productId) productId = prod.id
        if (!sellerId) sellerId = prod.author_id
      }
    }

    // 3. Jika sellerId belum ada tapi store_slug diberikan, cari profil penjual
    if (!sellerId && body.store_slug) {
      const userBySlug = await c.env.DB.prepare(`
        SELECT id FROM users WHERE store_slug = ? LIMIT 1
      `).bind(body.store_slug.trim().toLowerCase()).first<{ id: string }>()
      if (userBySlug) {
        sellerId = userBySlug.id
      }
    }

    if (!sellerId) {
      return c.json({ success: false, message: 'Identitas toko mitra tidak valid' }, 400)
    }

    // 4. Verifikasi integritas seller_id di tabel users untuk mencegah Foreign Key constraint error
    const validSeller = await c.env.DB.prepare('SELECT id FROM users WHERE id = ? LIMIT 1').bind(sellerId).first()
    if (!validSeller) {
      return c.json({ success: false, message: 'Toko mitra tidak ditemukan' }, 404)
    }

    const eventType = body.event_type || 'product_view'
    const source = parseTrafficSource({
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      ref: body.ref,
      source: body.source,
      referrer: body.referrer || c.req.header('referer'),
      url: body.url
    })
    const deviceType = parseDeviceType(c.req.header('user-agent'))
    const date = new Date().toISOString().slice(0, 10)
    const rowId = `${sellerId}:${productId || 'store'}:${date}:${eventType}:${source}:${deviceType}`

    // Eksekusi transaksi atomik via batch D1 untuk mencegah inkonsistensi data & memangkas latensi round-trip
    const batchStatements = [
      c.env.DB.prepare(`
        INSERT INTO store_daily_analytics (
          id, seller_id, product_id, date, event_type, source, device_type, count, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(seller_id, product_id, date, event_type, source, device_type)
        DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP
      `).bind(rowId, sellerId, productId || '', date, eventType, source, deviceType)
    ]

    // Jika product_view, gabungkan update agregat view_count dalam batch yang sama (100% atomik)
    if (eventType === 'product_view' && productId) {
      batchStatements.push(
        c.env.DB.prepare(`
          UPDATE products SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?
        `).bind(productId)
      )
    }

    await c.env.DB.batch(batchStatements)

    return c.json({ success: true, message: 'Event berhasil dicatat' })
  } catch (err) {
    console.error('[Track Event Error]:', err)
    return c.json({ success: false, message: 'Gagal memproses data tayangan' }, 500)
  }
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
    const payload = await verify(token, c.env.HUB_PUBLIC_KEY, 'RS256') as { product_id?: string; type?: string; user_id?: string }
    
    // Pastikan token ini memang untuk tujuan download (bukan sale_trigger atau price_check)
    if (payload.type !== 'download_request') {
      throw new HTTPException(403, { message: 'Akses ditolak. Token tidak sesuai untuk operasi ini.' })
    }
    // MENCEGAH BYPASS (Bug #1): product_id di JWT harus cocok dengan URL
    if (payload.product_id !== targetId) {
      throw new HTTPException(403, { message: 'Token valid tapi TIDAK untuk produk ini.' })
    }

    const product = await c.env.DB.prepare('SELECT file_r2_key, status FROM products WHERE id = ?').bind(targetId).first<{ file_r2_key: string | null; status: string }>()
    if (!product || !product.file_r2_key) {
      throw new HTTPException(404, { message: 'File produk tidak ditemukan.' })
    }

    let fileKeyToServe = product.file_r2_key

    // PROTEKSI HAK UNDUH PEMBELI:
    // Cek apakah pembeli memiliki catatan snapshot transaksi (purchased_file_r2_key)
    if (payload.user_id) {
      try {
        const userTx = await c.env.DB.prepare(
          'SELECT purchased_file_r2_key FROM sale_transactions WHERE product_id = ? AND buyer_hub_id = ? ORDER BY paid_at DESC LIMIT 1'
        ).bind(targetId, payload.user_id).first<{ purchased_file_r2_key: string | null }>()

        // Jika produk sedang dalam kurasi ulang (pending_review/needs_revision/rejected) atau berkas aktif kosong/berbeda,
        // dan pembeli memiliki berkas sah yang dibeli sebelumnya di R2, sajikan berkas yang sah tersebut!
        if (userTx?.purchased_file_r2_key) {
          if (product.status !== 'published' || !fileKeyToServe) {
            fileKeyToServe = userTx.purchased_file_r2_key
          }
        }
      } catch (_) {
        // Fallback jika kolom purchased_file_r2_key belum ter-migrate
      }
    }

    let object = await c.env.R2.get(fileKeyToServe as string)
    if (!object && fileKeyToServe !== product.file_r2_key && product.file_r2_key) {
      object = await c.env.R2.get(product.file_r2_key as string)
      fileKeyToServe = product.file_r2_key
    }

    if (!object) {
      throw new HTTPException(404, { message: 'File tidak ada di penyimpanan.' })
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Content-Length', object.size.toString())
    
    const keyParts = (fileKeyToServe as string).split('/')
    const rawName = keyParts[keyParts.length - 1]
    const fileName = rawName.length > 37 ? rawName.substring(37) : (rawName || 'digital-product')
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`)
    
    return new Response(object.body, { headers })
  } catch (e: any) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(401, { message: 'Akses ditolak. Token tidak valid.' })
  }
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

  const product = await c.env.DB.prepare(`
    SELECT p.id, p.price, p.status, p.title, u.is_active, u.seller_status, u.id as author_id
    FROM products p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `).bind(targetId).first<{ id: string; price: number; status: string; title: string; is_active: number; seller_status: string | null; author_id: string }>()

  if (!product) {
    throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })
  }
  if (product.status !== 'published') {
    throw new HTTPException(400, { message: 'Produk belum di-publish atau sedang tidak aktif.' })
  }
  if (product.is_active !== 1 || (product.author_id !== 'super_admin' && product.seller_status !== 'approved')) {
    throw new HTTPException(400, { message: 'Penjual produk ini sedang tidak aktif. Transaksi pembelian tidak dapat diproses.' })
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
    payment_method?: string    // Metode pembayaran dari Midtrans (qris, bca_va, gopay, wallet, dll)
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

  // ─── IDEMPOTENCY CHECK (Database + KV) ───────────────────────────
  const idempotencyKey = `used_sale_token:${salePayload.hub_transaction_id}`
  const isUsed = await c.env.KV.get(idempotencyKey)
  if (isUsed) {
    // Bersifat idempotent: kembalikan 200 OK agar Hub tidak melakukan retry
    return c.json({ message: 'Transaksi sudah diproses sebelumnya.' })
  }

  // Double-check langsung ke database D1 untuk memastikan konsistensi kuat
  const existingSale = await c.env.DB.prepare(
    'SELECT id FROM sale_transactions WHERE hub_transaction_id = ?'
  ).bind(salePayload.hub_transaction_id).first()
  if (existingSale) {
    await c.env.KV.put(idempotencyKey, '1', { expirationTtl: 259200 })
    return c.json({ message: 'Transaksi sudah diproses sebelumnya.' })
  }
  // ─────────────────────────────────────────────────────────────────

  // ─── VALIDASI PRICE LOCK TOKEN ───────────────────────────────────
  // Ini adalah garis pertahanan utama terhadap race condition harga.
  // Harga yang valid adalah harga yang dikunci saat Hub memanggil /internal/:id/price,
  // BUKAN harga produk saat ini di DB (yang bisa sudah berubah).
  const priceLockKey = `price_lock:${salePayload.price_lock_token}`
  const priceLockRaw = await c.env.KV.get(priceLockKey)

  let priceLock: { product_id: string; price: number; locked_at: string }

  if (!priceLockRaw) {
    // Fallback Anti-Desinkronisasi: Jika token di KV sudah kedaluwarsa (misal pembeli transfer VA/QRIS setelah batas waktu token),
    // cek harga produk saat ini di database. Jika harga belum pernah berubah dan cocok dengan gross_amount yang dibayar pembeli,
    // izinkan pencatatan penjualan agar hak bagi hasil seller tidak hilang.
    const currentProd = await c.env.DB.prepare('SELECT price FROM products WHERE id = ?').bind(targetId).first<{ price: number }>()
    if (currentProd && currentProd.price === salePayload.gross_amount) {
      console.warn(`[Price Lock Fallback] Token ${salePayload.price_lock_token} kedaluwarsa di KV, namun harga produk ${targetId} cocok (Rp ${currentProd.price}). Melanjutkan pencatatan penjualan.`);
      priceLock = {
        product_id: targetId,
        price: currentProd.price,
        locked_at: salePayload.paid_at || new Date().toISOString()
      }
    } else {
      throw new HTTPException(410, { message: 'Sesi checkout telah kedaluwarsa atau harga produk telah berubah. Silakan mulai proses pembelian kembali.' })
    }
  } else {
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
    if (salePayload.gross_amount !== priceLock.price) {
      throw new HTTPException(409, {
        message: `Nominal pembayaran tidak sesuai dengan harga yang berlaku. Transaksi dibatalkan untuk keamanan.`
      })
    }
  }

  // ─── TANDAI IDEMPOTENCY (setelah validasi berhasil) ───────────────
  // TTL 72 jam — cukup untuk mendeteksi retry dari Hub dalam window yang wajar
  await c.env.KV.put(idempotencyKey, '1', { expirationTtl: 259200 })
  // ─────────────────────────────────────────────────────────────────

  // Ambil data produk termasuk pemilik (seller) dan file_r2_key saat ini
  const product = await c.env.DB.prepare(
    'SELECT id, author_id, price, file_r2_key FROM products WHERE id = ?'
  ).bind(targetId).first<{ id: string; author_id: string; price: number; file_r2_key: string | null }>()

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
    WHERE datetime(effective_from) <= datetime(?)
    ORDER BY effective_from DESC LIMIT 1
  `).bind(salePayload.paid_at).first<{ id: string; fee_bps: number; min_fee: number | null; max_fee: number | null }>()

  // Kalkulasi potongan admin (default 1500 bps = 15% jika konfigurasi tidak ditemukan)
  const feeBps = typeof feeConfig?.fee_bps === 'number' ? feeConfig.fee_bps : 1500
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
  const paymentMethod = salePayload.payment_method
    ? String(salePayload.payment_method).trim().slice(0, 50).toLowerCase()
    : 'other'

  // Simpan record transaksi ke ledger & update sales_count secara atomik
  // Masa tunggu kliring (Holding Period): 5 hari (120 jam) sejak pembayaran terverifikasi
  // untuk mengakomodasi penuh 3 hari kerja masa garansi komplain pembeli (melewati akhir pekan)
  // Gunakan datetime(?, '+5 days') SQLite agar format waktu konsisten secara kanonikal YYYY-MM-DD HH:MM:SS
  // Snapshot berkas fisik yang sah saat transaksi pembelian diverifikasi
  const purchasedFileKey = product.file_r2_key || null

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO sale_transactions (
          id, product_id, seller_id,
          price_history_id, gross_amount,
          fee_config_id, applied_fee_bps, admin_fee_amount, seller_net_amount,
          hub_transaction_id, buyer_hub_id, status, paid_at,
          hold_until, dispute_status, payment_method, purchased_file_r2_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'settled', ?, datetime(?, '+5 days'), 'none', ?, ?)
      `).bind(
        transactionId, targetId, product.author_id,
        priceHistory?.id ?? null, grossAmount,
        feeConfig?.id ?? null, feeBps, adminFee, sellerNetAmount,
        salePayload.hub_transaction_id, salePayload.buyer_hub_id ?? null, salePayload.paid_at,
        salePayload.paid_at, paymentMethod, purchasedFileKey
      ),
      c.env.DB.prepare(
        'UPDATE products SET sales_count = COALESCE(sales_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(targetId)
    ])
  } catch (err: any) {
    // Fallback jika kolom purchased_file_r2_key belum selesai dieksekusi di skema D1
    if (err?.message?.includes('no such column') || err?.message?.includes('purchased_file_r2_key')) {
      await c.env.DB.batch([
        c.env.DB.prepare(`
          INSERT INTO sale_transactions (
            id, product_id, seller_id,
            price_history_id, gross_amount,
            fee_config_id, applied_fee_bps, admin_fee_amount, seller_net_amount,
            hub_transaction_id, buyer_hub_id, status, paid_at,
            hold_until, dispute_status, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'settled', ?, datetime(?, '+5 days'), 'none', ?)
        `).bind(
          transactionId, targetId, product.author_id,
          priceHistory?.id ?? null, grossAmount,
          feeConfig?.id ?? null, feeBps, adminFee, sellerNetAmount,
          salePayload.hub_transaction_id, salePayload.buyer_hub_id ?? null, salePayload.paid_at,
          salePayload.paid_at, paymentMethod
        ),
        c.env.DB.prepare(
          'UPDATE products SET sales_count = COALESCE(sales_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(targetId)
      ])
    } else {
      throw err
    }
  }
  
  // Hapus price lock token hanya setelah transaksi berhasil disimpan ke database D1
  await c.env.KV.delete(priceLockKey)
  
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

  // Defense-in-depth: sanitasi & batasi panjang komentar (Audit #1)
  const safeComment = comment && typeof comment === 'string' 
    ? stripHtml(comment).substring(0, 500) 
    : null;

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
      `).bind(reviewId, productId, accountId, rating, safeComment),
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

// ─── S2S ORDER LIFECYCLE & COMPLAINT HANDLING ──────────────────────────

const completeOrderSchema = z.object({
  hub_transaction_id: z.string().trim().min(1, 'ID transaksi wajib diisi'),
  buyer_hub_id: z.string().trim().optional(),
})

// [S2S Hub] POST /api/products/internal/order/complete
// Dipanggil oleh Hub ketika Pembeli mengklik tombol "Selesai" (Konfirmasi Terima Produk)
// Mempercepat rilis dana dari "Saldo Tertahan" langsung ke "Saldo Aktif" seller seketika.
products.post('/internal/order/complete', rateLimit(200, 60, 'internal_order_complete'), zValidator('json', completeOrderSchema), async (c) => {
  const isAuthorized = await verifyInternalS2S(c)
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Akses ditolak. Autentikasi server-to-server tidak valid.' })
  }

  const { hub_transaction_id, buyer_hub_id } = c.req.valid('json')

  const sale = await c.env.DB.prepare(`
    SELECT id, seller_id, product_id, gross_amount, seller_net_amount, status, payout_status, hold_until, dispute_status, buyer_hub_id
    FROM sale_transactions
    WHERE hub_transaction_id = ?
  `).bind(hub_transaction_id).first<{
    id: string
    seller_id: string
    product_id: string
    gross_amount: number
    seller_net_amount: number
    status: string
    payout_status: string
    hold_until: string | null
    dispute_status: string | null
    buyer_hub_id: string | null
  }>()

  if (!sale) {
    throw new HTTPException(404, { message: 'Transaksi tidak ditemukan.' })
  }

  // Verifikasi kepemilikan pembeli (Audit: IDOR Prevention)
  if (sale.buyer_hub_id && buyer_hub_id && sale.buyer_hub_id !== buyer_hub_id) {
    throw new HTTPException(403, { message: 'Akses ditolak. Transaksi ini bukan milik pembeli yang bersangkutan.' })
  }

  if (sale.status !== 'settled') {
    throw new HTTPException(400, { message: 'Transaksi tidak dalam status aktif atau lunas.' })
  }

  if (sale.dispute_status === 'complained' || sale.dispute_status === 'under_review') {
    throw new HTTPException(400, { message: 'Pesanan sedang dalam penanganan komplain sehingga belum dapat diselesaikan otomatis.' })
  }

  // Jika payout sudah ditransfer, order sudah tuntas (Idempoten)
  if (sale.payout_status === 'transferred') {
    return c.json({
      success: true,
      message: 'Pesanan sudah selesai sebelumnya dan dana telah ditransfer ke seller.',
      transaction_id: sale.id,
      seller_net_amount: sale.seller_net_amount,
      cleared_at: sale.hold_until
    })
  }

  // Cek apakah waktu hold_until sudah lewat secara database (Idempoten)
  const isAlreadyCleared = await c.env.DB.prepare(`
    SELECT 1 FROM sale_transactions
    WHERE id = ? AND datetime('now') >= datetime(COALESCE(hold_until, 'now'))
  `).bind(sale.id).first()

  if (isAlreadyCleared) {
    return c.json({
      success: true,
      message: 'Pesanan sudah selesai sebelumnya. Dana sudah berada di Saldo Aktif seller.',
      transaction_id: sale.id,
      seller_net_amount: sale.seller_net_amount,
      cleared_at: sale.hold_until
    })
  }

  // Rilis saldo seketika: set hold_until ke datetime('now')
  await c.env.DB.prepare(`
    UPDATE sale_transactions
    SET hold_until = datetime('now')
    WHERE id = ?
  `).bind(sale.id).run()

  return c.json({
    success: true,
    message: 'Konfirmasi pesanan selesai berhasil. Dana telah resmi dimasukkan ke Saldo Aktif seller.',
    transaction_id: sale.id,
    seller_net_amount: sale.seller_net_amount,
    cleared_at: new Date().toISOString()
  })
})

const complaintOrderSchema = z.object({
  hub_transaction_id: z.string().trim().min(1, 'ID transaksi wajib diisi'),
  buyer_hub_id: z.string().trim().min(1, 'ID pembeli wajib diisi'),
  category: z.enum(['corrupt_file', 'broken_link', 'content_mismatch', 'other']),
  reason: z.string().trim().min(5, 'Alasan komplain minimal 5 karakter').max(1000, 'Alasan komplain maksimal 1000 karakter').transform(stripHtml),
  evidence_urls: z.array(
    z.string().trim().url('Format tautan bukti tidak valid').refine(v => !/^\s*(javascript|data|vbscript):/i.test(v) && (/^https?:\/\//i.test(v) || v.startsWith('/')), 'Protokol tautan bukti tidak aman.')
  ).max(5).optional(),
})

// [S2S Hub] POST /api/products/internal/order/complaint
// Dipanggil oleh Hub ketika Pembeli mengajukan komplain atas file rusak/link mati/isi tidak sesuai
// Membekukan transaksi dan memasukkan tiket ke order_complaints sehingga dana ditahan
products.post('/internal/order/complaint', rateLimit(100, 60, 'internal_order_complaint'), zValidator('json', complaintOrderSchema), async (c) => {
  const isAuthorized = await verifyInternalS2S(c)
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Akses ditolak. Autentikasi server-to-server tidak valid.' })
  }

  const body = c.req.valid('json')

  const sale = await c.env.DB.prepare(`
    SELECT id, seller_id, product_id, gross_amount, seller_net_amount, status, payout_status, hold_until, dispute_status, paid_at, buyer_hub_id, withdrawal_request_id
    FROM sale_transactions
    WHERE hub_transaction_id = ?
  `).bind(body.hub_transaction_id).first<{
    id: string
    seller_id: string
    product_id: string
    gross_amount: number
    seller_net_amount: number
    status: string
    payout_status: string
    hold_until: string | null
    dispute_status: string | null
    paid_at: string
    buyer_hub_id: string | null
    withdrawal_request_id: string | null
  }>()

  if (!sale) {
    throw new HTTPException(404, { message: 'Transaksi tidak ditemukan.' })
  }

  // Verifikasi kepemilikan pembeli (Audit: IDOR Prevention)
  if (sale.buyer_hub_id && sale.buyer_hub_id !== body.buyer_hub_id) {
    throw new HTTPException(403, { message: 'Akses ditolak. Transaksi ini bukan milik pembeli yang mengajukan komplain.' })
  }

  if (sale.status === 'refunded') {
    throw new HTTPException(400, { message: 'Transaksi ini telah dikembalikan (refund) sebelumnya.' })
  }

  // Jika dana sudah ditransfer ke rekening seller, tolak komplain otomatis
  if (sale.payout_status === 'transferred') {
    throw new HTTPException(400, { message: 'Pesanan telah selesai dan dana telah ditransfer ke seller. Silakan hubungi CS untuk bantuan lebih lanjut.' })
  }

  // Batas waktu pengajuan komplain: 3 hari kerja sejak pembayaran (S&K Pasal 5 Ayat 2)
  // Gunakan toleransi 5 hari kalender (+5 days) di database untuk mengakomodasi 3 hari kerja + akhir pekan
  const isBeyondWindow = await c.env.DB.prepare(`
    SELECT 1 FROM sale_transactions
    WHERE id = ? AND datetime('now') > datetime(paid_at, '+5 days')
  `).bind(sale.id).first()

  if (isBeyondWindow) {
    throw new HTTPException(400, { message: 'Batas waktu pengajuan komplain (3 hari kerja sejak pembayaran) telah berakhir.' })
  }

  // Cek apakah ada komplain aktif yang belum selesai
  const existingComplaint = await c.env.DB.prepare(`
    SELECT id, status FROM order_complaints
    WHERE transaction_id = ? AND status IN ('open', 'seller_replied', 'under_review')
  `).bind(sale.id).first<{ id: string; status: string }>()

  if (existingComplaint) {
    return c.json({
      success: true,
      message: 'Komplain untuk transaksi ini sudah tercatat dan sedang dalam penanganan tim investigasi.',
      complaint_id: existingComplaint.id,
      status: existingComplaint.status
    })
  }

  const complaintId = crypto.randomUUID()
  const safeReason = stripHtml(body.reason).substring(0, 1000)
  const evidenceJson = body.evidence_urls ? JSON.stringify(body.evidence_urls) : null

  // Mitigasi Race Condition Penarikan:
  // Jika transaksi ini kebetulan sedang berada dalam antrean penarikan (withdrawal_request_id),
  // kurangi amount penarikan dan lepaskan ikatan transaksi agar admin tidak mentransfer dana yang disengketakan.
  const batchStatements = [
    c.env.DB.prepare(`
      INSERT INTO order_complaints (
        id, transaction_id, hub_transaction_id, buyer_hub_id,
        seller_id, product_id, category, reason, evidence_urls, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `).bind(
      complaintId, sale.id, body.hub_transaction_id, body.buyer_hub_id,
      sale.seller_id, sale.product_id, body.category, safeReason, evidenceJson
    ),
    c.env.DB.prepare(`
      UPDATE sale_transactions
      SET dispute_status = 'complained', withdrawal_request_id = NULL
      WHERE id = ?
    `).bind(sale.id)
  ]

  if (sale.withdrawal_request_id) {
    batchStatements.push(
      c.env.DB.prepare(`
        UPDATE withdrawal_requests
        SET amount = MAX(0, amount - ?)
        WHERE id = ? AND status = 'pending'
      `).bind(sale.seller_net_amount, sale.withdrawal_request_id)
    )
  }

  await c.env.DB.batch(batchStatements)

  return c.json({
    success: true,
    message: 'Laporan komplain berhasil dicatat. Penahanan dana transaksi telah dibekukan sementara untuk investigasi.',
    complaint_id: complaintId
  })
})

const resolveComplaintSchema = z.object({
  hub_transaction_id: z.string().trim().min(1, 'ID transaksi Hub wajib diisi'),
  action: z.enum(['refund', 'release']), // 'refund' = approve buyer refund; 'release' = reject complaint & release funds to seller
  admin_notes: z.string().trim().max(500).optional(),
})

// [S2S Hub] POST /api/products/internal/order/complaint/resolve
// Dipanggil oleh Hub Admin App ketika komplain disetujui untuk refund atau ditolak
products.post('/internal/order/complaint/resolve', rateLimit(100, 60, 'internal_order_complaint_resolve'), zValidator('json', resolveComplaintSchema), async (c) => {
  const isAuthorized = await verifyInternalS2S(c)
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Akses ditolak. Autentikasi server-to-server tidak valid.' })
  }

  const { hub_transaction_id, action, admin_notes } = c.req.valid('json')

  const sale = await c.env.DB.prepare(`
    SELECT id, seller_id, product_id, status, payout_status, dispute_status, withdrawal_request_id, seller_net_amount
    FROM sale_transactions
    WHERE hub_transaction_id = ?
  `).bind(hub_transaction_id).first<{
    id: string
    seller_id: string
    product_id: string
    status: string
    payout_status: string
    dispute_status: string
    withdrawal_request_id: string | null
    seller_net_amount: number
  }>()

  if (!sale) {
    throw new HTTPException(404, { message: 'Transaksi tidak ditemukan di CMS.' })
  }

  // Cari komplain terkait transaksi ini
  const complaint = await c.env.DB.prepare(`
    SELECT id, status FROM order_complaints
    WHERE transaction_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).bind(sale.id).first<{ id: string; status: string }>()

  const cleanNotes = admin_notes ? stripHtml(admin_notes).substring(0, 500) : null

  if (action === 'refund') {
    if (sale.payout_status === 'transferred') {
      throw new HTTPException(400, {
        message: 'Dana transaksi ini telah terlanjur ditransfer ke rekening seller. Rekonsiliasi manual diperlukan.'
      })
    }

    const batchStatements = [
      c.env.DB.prepare(`
        UPDATE sale_transactions
        SET status = 'refunded', dispute_status = 'refunded', withdrawal_request_id = NULL
        WHERE id = ?
      `).bind(sale.id),
      c.env.DB.prepare(`
        UPDATE products
        SET sales_count = MAX(0, COALESCE(sales_count, 0) - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(sale.product_id)
    ]

    if (complaint) {
      batchStatements.push(
        c.env.DB.prepare(`
          UPDATE order_complaints
          SET status = 'resolved_refunded', admin_notes = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(cleanNotes, complaint.id)
      )
    }

    if (sale.withdrawal_request_id) {
      batchStatements.push(
        c.env.DB.prepare(`
          UPDATE withdrawal_requests
          SET amount = MAX(0, amount - ?)
          WHERE id = ? AND status = 'pending'
        `).bind(sale.seller_net_amount, sale.withdrawal_request_id)
      )
    }

    await c.env.DB.batch(batchStatements)

    return c.json({
      success: true,
      message: 'Transaksi berhasil disinkronkan ke status Refunded di CMS.',
      hub_transaction_id,
      status: 'refunded'
    })
  } else {
    // Action: 'release' (Tolak komplain & rilis dana ke Saldo Aktif seller)
    const batchStatements = [
      c.env.DB.prepare(`
        UPDATE sale_transactions
        SET dispute_status = 'resolved', hold_until = datetime('now')
        WHERE id = ?
      `).bind(sale.id)
    ]

    if (complaint) {
      batchStatements.push(
        c.env.DB.prepare(`
          UPDATE order_complaints
          SET status = 'resolved_rejected', admin_notes = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(cleanNotes, complaint.id)
      )
    }

    await c.env.DB.batch(batchStatements)

    return c.json({
      success: true,
      message: 'Komplain berhasil ditutup di CMS. Dana transaksi telah resmi dilepaskan ke Saldo Aktif seller.',
      hub_transaction_id,
      status: 'resolved'
    })
  }
})

// [S2S Hub] GET /api/products/internal/order/:hub_transaction_id/complaint
// Mengambil detail komplain & tanggapan terbaru dari seller di CMS untuk disinkronkan ke Hub
products.get('/internal/order/:hub_transaction_id/complaint', rateLimit(200, 60, 'internal_order_complaint_get'), async (c) => {
  const isAuthorized = await verifyInternalS2S(c)
  if (!isAuthorized) {
    throw new HTTPException(401, { message: 'Akses ditolak. Autentikasi server-to-server tidak valid.' })
  }

  const hubTxnId = c.req.param('hub_transaction_id')
  const complaint = await c.env.DB.prepare(`
    SELECT 
      oc.id, oc.hub_transaction_id, oc.category, oc.reason, oc.evidence_urls,
      oc.status, oc.seller_response, oc.seller_replacement_url, oc.seller_responded_at,
      oc.admin_notes, oc.created_at, oc.resolved_at,
      st.status as sale_status, st.dispute_status, st.hold_until, st.paid_at,
      COALESCE(NULLIF(TRIM(u.store_name), ''), NULLIF(TRIM(u.name), ''), NULLIF(TRIM(u.store_slug), ''), 'Penjual Mitra') as seller_name
    FROM order_complaints oc
    JOIN sale_transactions st ON oc.transaction_id = st.id
    JOIN users u ON oc.seller_id = u.id
    WHERE oc.hub_transaction_id = ?
    ORDER BY oc.created_at DESC LIMIT 1
  `).bind(hubTxnId).first()

  if (!complaint) {
    return c.json({ success: false, message: 'Data komplain tidak ditemukan di CMS.' }, 404)
  }

  return c.json({ success: true, data: complaint })
})



// --- PROTECTED ROUTES (CMS ADMIN) ---

products.use('/*', authMiddleware)

products.post('/upload-file', requirePermission('upload_media'), rateLimit(5, 60, 'upload_media'), async (c) => {
  const user = c.get('user')

  // Verifikasi akun seller aktif & telah disetujui (cegah upload berkas produk sebelum diverifikasi)
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui. Anda belum dapat mengunggah berkas produk.' })
    }
  }

  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format pengunggahan berkas produk tidak valid atau transmisi terputus.' })
  }
  const file = body['file']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File tidak ditemukan dalam request.' })
  }

  // 1. Validasi Ukuran (Max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    throw new HTTPException(400, { message: 'Ukuran file melebihi batas (Max 50MB).' })
  }

  // 2. Validasi Ekstensi & Magic Bytes (Wajib Format Arsip ZIP)
  const fileNameLower = file.name.toLowerCase()
  if (!fileNameLower.endsWith('.zip')) {
    throw new HTTPException(400, {
      message: 'Format berkas tidak diizinkan. Seluruh materi produk digital wajib dikemas dalam format arsip .zip agar rapi dan dapat ditinjau oleh kurator.'
    })
  }

  const headerBuffer = await file.slice(0, 4).arrayBuffer()
  const headerView = new Uint8Array(headerBuffer)
  const headerHex = Array.from(headerView).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  
  // Deteksi Format Aman Arsip ZIP (PK..)
  const isZip = headerHex.startsWith('504B0304') || headerHex.startsWith('504B0506') || headerHex.startsWith('504B0708')
  
  if (!isZip) {
    throw new HTTPException(400, {
      message: 'Berkas yang diunggah bukan arsip ZIP yang sah atau berkas mengalami kerusakan.'
    })
  }

  // 3. Sanitasi Nama File & Generate R2 Key
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
  const r2Key = `products/${crypto.randomUUID()}-${cleanFileName}`

  // Upload ke R2 menggunakan stream agar tidak memakan RAM berlebih
  await c.env.R2.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  // SECURITY HARDENING (Point #3): Simpan catatan kepemilikan file ke tabel media D1
  const mediaId = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    mediaId,
    r2Key,
    cleanFileName,
    file.type || 'application/octet-stream',
    file.size,
    user.id === 'super_admin' ? null : user.id
  ).run()

  return c.json({ r2_key: r2Key, name: cleanFileName, size: file.size })
})

const productSchema = z.object({
  title: z.string().trim().min(1).max(255).transform(stripHtml),
  slug: z.string().trim().max(255).optional().nullable().transform(val => val ? stripHtml(val) : val),
  description: z.string().max(100000, 'Deskripsi produk maksimal 100.000 karakter').optional().nullable().transform(val => val ? sanitizeRichContent(val) : val),
  price: z.coerce.number().int().min(0, 'Harga final tidak boleh negatif'),
  original_price: z.coerce.number().int().min(0).optional().nullable(),
  cover_image_key: z.string().regex(/^[a-zA-Z0-9.\-_\/]+$/, 'Format cover image tidak valid').refine(v => !v.includes('..'), 'Path traversal tidak diizinkan').optional().nullable(),
  cover_image_alt: z.string().max(255).optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_1_key: z.string().regex(/^[a-zA-Z0-9.\-_\/]+$/, 'Format gambar detail tidak valid').refine(v => !v.includes('..'), 'Path traversal tidak diizinkan').optional().nullable(),
  detail_image_1_alt: z.string().max(255).optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_2_key: z.string().regex(/^[a-zA-Z0-9.\-_\/]+$/, 'Format gambar detail tidak valid').refine(v => !v.includes('..'), 'Path traversal tidak diizinkan').optional().nullable(),
  detail_image_2_alt: z.string().max(255).optional().nullable().transform(val => val ? stripHtml(val) : val),
  detail_image_3_key: z.string().regex(/^[a-zA-Z0-9.\-_\/]+$/, 'Format gambar detail tidak valid').refine(v => !v.includes('..'), 'Path traversal tidak diizinkan').optional().nullable(),
  detail_image_3_alt: z.string().max(255).optional().nullable().transform(val => val ? stripHtml(val) : val),
  file_r2_key: z.string().regex(/^products\/[a-zA-Z0-9.\-_]+$/, 'Format berkas produk tidak valid').optional().nullable(),
  category_id: z.string().max(100).optional().nullable(),
  meta_title: z.string().max(100, 'Meta title maksimal 100 karakter').optional().nullable().transform(val => val ? stripHtml(val) : val),
  meta_description: z.string().max(300, 'Meta description maksimal 300 karakter').optional().nullable().transform(val => val ? stripHtml(val) : val),
  status: z.enum(['draft', 'pending_review', 'published', 'needs_revision', 'rejected', 'archived']).default('draft'),
})

products.get('/admin/all', requirePermission('view_dashboard'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 50, 100)
  const includeDescription = c.req.query('include_description') === 'true'
  const descCol = includeDescription ? 'description' : "'' as description"

  let query = `SELECT id, slug, title, ${descCol}, price, original_price, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, file_r2_key, status, review_notes, submitted_for_review_at, reviewed_at, created_at, category_id, meta_title, meta_description, view_count, sales_count, average_rating, total_reviews FROM products`
  const params: any[] = []
  
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda masih dalam proses kurasi atau belum disetujui.' })
    }
    query += " WHERE author_id = ?"
    params.push(user.id)
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  const results = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: results.results, limit, offset })
})


products.get('/admin/preview-token/:id', requirePermission('edit_product'), async (c) => {
  const targetId = c.req.param('id');
  const user = c.get('user');

  const existing = await c.env.DB.prepare('SELECT id, author_id FROM products WHERE id = ?').bind(targetId).first<{ id: string; author_id: string }>();
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' });

  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak melihat pratinjau produk milik mitra lain.' });
    }
  }

  // Buat JWT khusus pratinjau valid 15 menit (mematuhi Rule #1: Anti-Static Token)
  const token = await sign({
    productId: targetId,
    type: 'product_preview',
    exp: Math.floor(Date.now() / 1000) + 15 * 60
  }, c.env.JWT_SECRET);

  return c.json({ data: token });
});

products.get('/admin/:id', requirePermission('edit_product'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  let query = "SELECT * FROM products WHERE id = ?"
  const params: any[] = [targetId]

  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda masih dalam proses kurasi atau belum disetujui.' })
    }
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

  // Verifikasi hak akses dan status seller jika bukan Super Admin dan bukan staff dengan izin edit_any_product (Admin/Editor)
  const isPrivilegedStaff = user.role === 'super_admin' || (user.permissions || []).includes('edit_any_product')

  if (!isPrivilegedStaff) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string }>()
    if (dbSeller?.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda masih dalam proses peninjauan oleh admin. Anda belum dapat mengunggah produk.' })
    }
    // Seller biasa wajib membuat produk sebagai draft terlebih dahulu sebelum diajukan kurasi
    if (body.status === 'published' || body.status === 'pending_review') {
      body.status = 'draft'
    }
  } else if (user.role !== 'super_admin') {
    // Pastikan user internal (Admin/Editor) memiliki status seller_status = 'approved' di DB
    // agar produk yang diunggah dapat tampil di etalase marketplace dan valid saat transaksi
    await c.env.DB.prepare("UPDATE users SET seller_status = 'approved', seller_approved_at = COALESCE(seller_approved_at, CURRENT_TIMESTAMP) WHERE id = ? AND (seller_status IS NULL OR seller_status != 'approved')").bind(user.id).run()
  }
  
  const cleanDescription = body.description ? sanitizeRichContent(body.description) : null

  const id = crypto.randomUUID()
  const authorId = user.id

  if (body.category_id) {
    const catCheck = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(body.category_id).first()
    if (!catCheck || catCheck.type !== 'product') {
      throw new HTTPException(400, { message: 'Kategori yang dipilih tidak valid untuk produk.' })
    }
  }

  // Validasi batas minimum harga produk berbayar sesuai kebijakan platform
  if (body.price > 0) {
    const feeConfig = await c.env.DB.prepare(`
      SELECT min_product_price FROM admin_fee_config
      WHERE datetime(effective_from) <= datetime('now')
      ORDER BY effective_from DESC LIMIT 1
    `).first<{ min_product_price: number }>()
    const minProductPrice = typeof feeConfig?.min_product_price === 'number' ? feeConfig.min_product_price : 10000
    if (body.price < minProductPrice) {
      throw new HTTPException(400, {
        message: `Harga produk berbayar minimal Rp ${minProductPrice.toLocaleString('id-ID')} (atau Rp 0 jika materi gratis).`
      })
    }
  }

  // SECURITY HARDENING (Point #3): Validasi kepemilikan file_r2_key jika diisi
  if (body.file_r2_key && !isPrivilegedStaff) {
    const fileMedia = await c.env.DB.prepare('SELECT uploaded_by FROM media WHERE r2_key = ?').bind(body.file_r2_key).first<{ uploaded_by: string | null }>()
    if (!fileMedia || fileMedia.uploaded_by !== user.id) {
      throw new HTTPException(403, { message: 'Berkas digital yang dipilih tidak valid atau bukan milik Anda.' })
    }
  }

  // Kunci slug produk: selalu dibuat otomatis dari judul produk tanpa skema custom slug
  let productSlug = generateSlug(body.title)
  if (!productSlug) {
    productSlug = `produk-${Date.now()}`
  }

  try {
    // Insert produk + snapshot harga awal secara atomik
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO products (
          id, slug, title, description, price, original_price, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, file_r2_key, status, author_id, category_id, meta_title, meta_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, productSlug, body.title, cleanDescription, body.price, body.original_price ?? null, 
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

    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, productSlug))
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

  const cleanDescription = body.description ? sanitizeRichContent(body.description) : null

  if (body.category_id) {
    const catCheck = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(body.category_id).first()
    if (!catCheck || catCheck.type !== 'product') {
      throw new HTTPException(400, { message: 'Kategori yang dipilih tidak valid untuk produk.' })
    }
  }

  // Validasi batas minimum harga produk berbayar sesuai kebijakan platform
  if (body.price > 0) {
    const feeConfig = await c.env.DB.prepare(`
      SELECT min_product_price FROM admin_fee_config
      WHERE datetime(effective_from) <= datetime('now')
      ORDER BY effective_from DESC LIMIT 1
    `).first<{ min_product_price: number }>()
    const minProductPrice = typeof feeConfig?.min_product_price === 'number' ? feeConfig.min_product_price : 10000
    if (body.price < minProductPrice) {
      throw new HTTPException(400, {
        message: `Harga produk berbayar minimal Rp ${minProductPrice.toLocaleString('id-ID')} (atau Rp 0 jika materi gratis).`
      })
    }
  }

  const existing = await c.env.DB.prepare('SELECT author_id, status, price, original_price, file_r2_key, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt, slug FROM products WHERE id = ?').bind(targetId).first<{ author_id: string; status: string; price: number; original_price: number | null; file_r2_key: string | null; cover_image_key: string | null; cover_image_alt: string | null; detail_image_1_key: string | null; detail_image_1_alt: string | null; detail_image_2_key: string | null; detail_image_2_alt: string | null; detail_image_3_key: string | null; detail_image_3_alt: string | null; slug: string }>()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // Blokir edit produk yang sudah diarsipkan (mencegah un-archive bypass & perubahan data)
  if (existing.status === 'archived') {
    throw new HTTPException(403, { message: 'Produk yang sudah diarsipkan tidak dapat diedit. Buat produk baru jika diperlukan.' })
  }

  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui atau sedang tidak aktif.' })
    }
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak mengedit produk ini.' })
    }
  }

  // LOOPHOLE FIX: Cegah downgrade dari 'published' ke 'draft'
  // Jika ini dibiarkan, Seller bisa mengubah produk 'published' menjadi 'draft', lalu menembak endpoint Hard Delete!
  if (existing.status === 'published' && body.status === 'draft') {
    throw new HTTPException(400, { message: 'Produk yang sudah publik tidak dapat dikembalikan menjadi draf. Gunakan fitur Arsip jika ingin menyembunyikannya dari etalase.' })
  }

  // Seller biasa tidak boleh langsung menyetel produk non-published menjadi published
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    if (body.status === 'published' && existing.status !== 'published') {
      body.status = 'pending_review'
    }
    // SECURITY HARDENING: Re-curation Gate Anti Bait-and-Switch
    // Jika seller mengganti berkas unduhan digital (file_r2_key) pada produk yang sedang published,
    // status WAJIB diturunkan ke 'pending_review' agar materi baru dikurasi ulang oleh admin/kurator.
    if (existing.status === 'published' && body.file_r2_key && body.file_r2_key !== existing.file_r2_key) {
      body.status = 'pending_review'
    }
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

  // SECURITY HARDENING (Point #3): Validasi kepemilikan file_r2_key jika diganti/diisi baru
  if (body.file_r2_key && body.file_r2_key !== existing.file_r2_key && user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const fileMedia = await c.env.DB.prepare('SELECT uploaded_by FROM media WHERE r2_key = ?').bind(body.file_r2_key).first<{ uploaded_by: string | null }>()
    if (!fileMedia || fileMedia.uploaded_by !== user.id) {
      throw new HTTPException(403, { message: 'Berkas digital yang dipilih tidak valid atau bukan milik Anda.' })
    }
  }

  // PROTEKSI INTEGRITAS BERKAS & IMMUTABILITY:
  // JANGAN PERNAH menghapus file fisik R2 lama saat seller memperbarui produk!
  // Berkas lama di R2 tetap disimpan untuk melindungi hak unduh pembeli yang membeli versi sebelumnya
  // dan mencegah seller memusnahkan data materi yang sudah dibeli.
  // Hanya Super Admin dari antarmuka administrasi utama yang berhak menghapus berkas penyimpanan secara permanen.

  // Cek apakah harga berubah untuk membuat snapshot riwayat harga
  // existing sudah mengandung price dan original_price, tidak perlu query kedua
  const priceChanged =
    existing.price !== body.price ||
    (existing.original_price ?? null) !== (body.original_price ?? null)

  // Kunci slug produk: selalu dibuat otomatis dari judul produk tanpa skema custom slug
  const productSlug = generateSlug(body.title) || existing.slug

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
        productSlug, body.title, cleanDescription, body.price, body.original_price ?? null,
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
    if (existing && existing.slug && productSlug && productSlug !== existing.slug) {
      const historyId = crypto.randomUUID()
      statements.push(c.env.DB.prepare(`
        INSERT INTO slug_history (id, type, reference_id, old_slug, new_slug)
        VALUES (?, 'product', ?, ?, ?)
        ON CONFLICT(old_slug, type) DO UPDATE SET new_slug = excluded.new_slug, reference_id = excluded.reference_id
      `).bind(historyId, targetId, existing.slug, productSlug))
    }

    await c.env.DB.batch(statements)

    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, productSlug || existing.slug))
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

  // Otorisasi Kepemilikan & Status Kemitraan
  if (user.role !== 'super_admin' && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui atau sedang tidak aktif.' })
    }
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

  const existing = await c.env.DB.prepare('SELECT author_id, file_r2_key, status FROM products WHERE id = ?').bind(targetId).first<{ author_id: string; file_r2_key: string | null; status: string }>()
  if (!existing) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  const isSuperAdmin = user.role === 'super_admin'

  // Otorisasi Kepemilikan (Memperbolehkan Admin yang punya hak edit_any_product) & Status Kemitraan
  if (!isSuperAdmin && !(user.permissions || []).includes('edit_any_product')) {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui atau sedang tidak aktif.' })
    }
    if (existing.author_id !== user.id) {
      throw new HTTPException(403, { message: 'Anda tidak berhak menghapus produk ini.' })
    }
  }
  
  // 1. CEK INTEGRITAS TRANSAKSI: Jika produk sudah pernah memiliki riwayat penjualan di sale_transactions, DILARANG HARD DELETE!
  const salesCheck = await c.env.DB.prepare('SELECT COUNT(*) as count FROM sale_transactions WHERE product_id = ?').bind(targetId).first<{ count: number }>()
  if (salesCheck && salesCheck.count > 0) {
    throw new HTTPException(400, {
      message: 'Produk ini telah memiliki riwayat transaksi pembelian oleh pengguna. Demi integritas hak unduh pembeli dan pembukuan keuangan, produk tidak dapat dihapus permanen. Silakan gunakan fitur Arsip.'
    })
  }

  // 2. ATURAN HARD DELETE HANYA SUPER ADMIN:
  if (!isSuperAdmin) {
    // Mitra/Seller hanya diizinkan menghapus rancangan draf lokal yang belum pernah terbit/dijual
    if (existing.status !== 'draft') {
      throw new HTTPException(403, { message: 'Anda hanya diizinkan menghapus produk draf. Gunakan fitur Arsip untuk produk publik.' })
    }
    // Hapus record produk draf di database D1 tanpa menyentuh/memusnahkan file R2
    await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(targetId).run()
    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, (existing as any).slug))
    return c.json({ message: 'Rancangan draf produk berhasil dihapus.' })
  }

  // 3. EKSEKUSI SUPER ADMIN HARD DELETE (Hanya jika belum pernah ada transaksi penjualan):
  const deleteBatch: any[] = []
  if (existing.file_r2_key) {
    await c.env.R2.delete(existing.file_r2_key as string).catch(() => {})
    deleteBatch.push(c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(existing.file_r2_key))
  }
  
  // Eksekusi Hard Delete D1 secara Atomik
  deleteBatch.push(c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(targetId))
  await c.env.DB.batch(deleteBatch)

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, (existing as any).slug))
  return c.json({ message: 'Produk dan berkas digital berhasil dimusnahkan permanen oleh Super Admin.' })
})

// --- MODUL KURASI & MODERASI PRODUK DIGITAL ---

// 1. Seller mengajukan produk ke antrean kurasi
products.post('/:id/submit-review', rateLimit(30, 60, 'product_submit_review'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  // Verifikasi status kemitraan aktif & approved
  if (user.role !== 'super_admin') {
    const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
    if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
      throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui atau sedang tidak aktif.' })
    }
  }

  const product = await c.env.DB.prepare(
    'SELECT id, author_id, status, title, price, cover_image_key, file_r2_key FROM products WHERE id = ?'
  ).bind(targetId).first<any>()

  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // Anti-IDOR: hanya pemilik produk yang boleh mengajukan review
  if (product.author_id !== user.id && user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Anda tidak berhak mengajukan produk ini.' })
  }

  // Validasi transisi status yang sah
  if (product.status === 'pending_review') {
    throw new HTTPException(400, { message: 'Produk ini sudah berada dalam antrean kurasi.' })
  }
  if (product.status === 'published') {
    throw new HTTPException(400, { message: 'Produk ini sudah berstatus publik dan sedang tayang di etalase.' })
  }
  if (product.status === 'archived') {
    throw new HTTPException(400, { message: 'Produk yang diarsip tidak dapat diajukan kurasi. Aktifkan kembali status draf terlebih dahulu.' })
  }

  // Validasi kelayakan produk
  if (!product.title || product.title.trim().length === 0) {
    throw new HTTPException(400, { message: 'Judul produk tidak boleh kosong.' })
  }
  if (!product.price || product.price < 10000) {
    throw new HTTPException(400, { message: 'Harga produk minimal Rp10.000 sesuai ketentuan kemitraan.' })
  }
  if (!product.cover_image_key) {
    throw new HTTPException(400, { message: 'Foto cover utama produk wajib diunggah sebelum mengajukan kurasi.' })
  }
  if (!product.file_r2_key) {
    throw new HTTPException(400, { message: 'Berkas digital produk (.zip) wajib diunggah sebelum mengajukan kurasi.' })
  }

  const res = await c.env.DB.prepare(`
    UPDATE products 
    SET status = 'pending_review', 
        submitted_for_review_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('draft', 'needs_revision', 'rejected')
  `).bind(targetId).run()

  if (res.meta?.changes === 0) {
    throw new HTTPException(409, { message: 'Status produk telah berubah, silakan muat ulang halaman.' })
  }

  return c.json({ message: 'Produk berhasil diajukan untuk peninjauan admin.' })
})

// 2. Admin mengambil antrean produk yang menunggu kurasi (Khusus Super Admin & Admin)
products.get('/admin/curation-queue', rateLimit(60, 60, 'curate_queue'), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const list = await c.env.DB.prepare(`
    SELECT p.id, p.slug, p.title, p.description, p.price, p.original_price, 
           p.cover_image_key, p.cover_image_alt, p.file_r2_key, p.status, 
           p.review_notes, p.submitted_for_review_at, p.category_id,
           u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
    FROM products p
    LEFT JOIN users u ON p.author_id = u.id
    WHERE p.status = 'pending_review'
    ORDER BY p.submitted_for_review_at ASC
  `).all()

  return c.json({ data: list.results })
})

// 3. Admin menyetujui produk -> terbit publik
products.put('/admin/:id/approve', rateLimit(30, 60, 'curate_approve'), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const prod = await c.env.DB.prepare('SELECT id, slug, status, cover_image_key, file_r2_key FROM products WHERE id = ?').bind(targetId).first<any>()
  if (!prod) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  if (prod.status !== 'pending_review') {
    throw new HTTPException(400, { message: 'Hanya produk dalam status menunggu kurasi yang dapat disetujui.' })
  }
  if (!prod.cover_image_key) {
    throw new HTTPException(400, { message: 'Produk tidak dapat disetujui karena cover utama belum diunggah.' })
  }
  if (!prod.file_r2_key) {
    throw new HTTPException(400, { message: 'Produk tidak dapat disetujui karena berkas digital belum diunggah.' })
  }

  // HARDENING: Verifikasi integritas berkas di R2 & Pindai Malware sebelum persetujuan final
  const r2Obj = await c.env.R2.get(prod.file_r2_key)
  if (!r2Obj) {
    throw new HTTPException(400, { message: 'Berkas digital produk tidak ditemukan di penyimpanan penyimpanan.' })
  }
  const cleanName = prod.file_r2_key.split('/').pop() || 'file'
  const buf = await r2Obj.arrayBuffer()
  const malwareReport = scanMainFileBuffer(buf, cleanName)
  if (!malwareReport.isClean) {
    throw new HTTPException(400, { message: 'Produk tidak dapat disetujui karena berkas terdeteksi mengandung ancaman keamanan / malware.' })
  }

  const headerBytes = new Uint8Array(buf.slice(0, 4))
  const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b
  if (isZip) {
    const archiveInfo = parseZipBuffer(buf)
    // Cek apakah ada ancaman mutlak / critical (cloaking, exploit script, path traversal, unicode spoof)
    const hasCriticalThreat = (archiveInfo.threats || []).some(
      t => t.severity === 'critical' || t.type === 'cloaked_executable' || t.type === 'path_traversal' || t.type === 'unicode_spoof' || t.type === 'script'
    )
    if (hasCriticalThreat) {
      throw new HTTPException(400, { message: 'Produk tidak dapat disetujui karena berkas di dalam arsip ZIP terindikasi berbahaya atau menyamarkan program berbahaya.' })
    }
  }

  const approveRes = await c.env.DB.prepare(`
    UPDATE products 
    SET status = 'published', 
        published_at = CURRENT_TIMESTAMP,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?,
        review_notes = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending_review'
  `).bind(user.id, targetId).run()

  if (approveRes.meta?.changes === 0) {
    throw new HTTPException(409, { message: 'Status produk telah berubah atau sudah diproses oleh kurator lain.' })
  }

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, prod.slug))
  return c.json({ message: 'Produk berhasil disetujui dan telah tayang di etalase publik.' })
})

// 4. Schema kurasi (Revisi / Tolak) yang mendukung notes maupun review_notes
const revisionSchema = z.object({
  review_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
}).refine(data => {
  const val = (data.review_notes || data.notes || '').trim()
  return val.length >= 5 && val.length <= 1000
}, { message: 'Catatan kurasi minimal 5 karakter dan maksimal 1000 karakter.' })

// 4. Admin meminta revisi ke seller
products.put('/admin/:id/request-revision', rateLimit(30, 60, 'curate_revision'), zValidator('json', revisionSchema), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const body = c.req.valid('json')
  const review_notes = stripHtml((body.review_notes || body.notes || '').trim())

  const prod = await c.env.DB.prepare('SELECT id, slug, status FROM products WHERE id = ?').bind(targetId).first<any>()
  if (!prod) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  if (prod.status !== 'pending_review') {
    throw new HTTPException(400, { message: 'Hanya produk dalam status menunggu kurasi yang dapat diminta revisi.' })
  }

  const revRes = await c.env.DB.prepare(`
    UPDATE products 
    SET status = 'needs_revision', 
        review_notes = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending_review'
  `).bind(review_notes, user.id, targetId).run()

  if (revRes.meta?.changes === 0) {
    throw new HTTPException(409, { message: 'Status produk telah berubah atau sudah diproses oleh kurator lain.' })
  }

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, prod.slug))
  return c.json({ message: 'Catatan perbaikan berhasil dikirim ke seller.' })
})

// 5. Admin menolak produk
products.put('/admin/:id/reject', rateLimit(30, 60, 'curate_reject'), zValidator('json', revisionSchema), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const body = c.req.valid('json')
  const review_notes = stripHtml((body.review_notes || body.notes || '').trim())

  const prod = await c.env.DB.prepare('SELECT id, slug, status FROM products WHERE id = ?').bind(targetId).first<any>()
  if (!prod) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  if (prod.status !== 'pending_review') {
    throw new HTTPException(400, { message: 'Hanya produk dalam status menunggu kurasi yang dapat ditolak.' })
  }

  const rejRes = await c.env.DB.prepare(`
    UPDATE products 
    SET status = 'rejected', 
        review_notes = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'pending_review'
  `).bind(review_notes, user.id, targetId).run()

  if (rejRes.meta?.changes === 0) {
    throw new HTTPException(409, { message: 'Status produk telah berubah atau sudah diproses oleh kurator lain.' })
  }

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV, prod.slug))
  return c.json({ message: 'Produk telah ditolak dan tidak dapat ditayangkan.' })
})

// 6. Admin menginspeksi struktur file produk untuk kurasi (Microsoft Explorer format)
products.get('/admin/:id/files', rateLimit(60, 60, 'curate_files_inspect'), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const prod = await c.env.DB.prepare(`
    SELECT p.id, p.slug, p.title, p.description, p.price, p.original_price, 
           p.cover_image_key, p.cover_image_alt, 
           p.detail_image_1_key, p.detail_image_1_alt,
           p.detail_image_2_key, p.detail_image_2_alt,
           p.detail_image_3_key, p.detail_image_3_alt,
           p.file_r2_key, p.status, p.review_notes, p.submitted_for_review_at, 
           p.category_id, p.created_at, p.author_id,
           u.name as author_name, u.email as author_email, u.avatar_url as author_avatar
    FROM products p
    LEFT JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `).bind(targetId).first<any>()

  if (!prod) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  // Ambil juga foto sampel kurasi dari seller (sample-products/...)
  let samplePhotos: any[] = []
  if (prod.author_id) {
    const samples = await c.env.DB.prepare(`
      SELECT id, r2_key, file_name, mime_type, size_bytes, created_at
      FROM media
      WHERE uploaded_by = ? AND r2_key LIKE 'sample-products/%'
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(prod.author_id).all()
    samplePhotos = samples.results || []
  }

  // Cek file digital utama di R2 & Pindai Malware
  let archiveInfo: any = null
  let malwareReport: MalwareScanReport | null = null
  let mainFileMeta: any = {
    exists: false,
    key: prod.file_r2_key || null,
    name: prod.file_r2_key ? prod.file_r2_key.split('/').pop() : null,
    size: 0,
    type: 'unknown',
    isArchive: false
  }

  if (prod.file_r2_key) {
    const r2Obj = await c.env.R2.get(prod.file_r2_key)
    if (r2Obj) {
      mainFileMeta.exists = true
      mainFileMeta.size = r2Obj.size
      mainFileMeta.uploaded = r2Obj.uploaded

      const cleanName = prod.file_r2_key.split('/').pop() || 'file'
      const extMatch = cleanName.includes('.') ? cleanName.split('.').pop() || '' : ''
      const ext = extMatch.toLowerCase()
      mainFileMeta.name = cleanName
      mainFileMeta.extension = ext

      const buf = await r2Obj.arrayBuffer()
      
      // JALANKAN PEMINDAIAN MALWARE & ANCAMAN PADA BERKAS UTAMA
      malwareReport = scanMainFileBuffer(buf, cleanName)

      const headerBytes = new Uint8Array(buf.slice(0, 4))
      const isZip = headerBytes[0] === 0x50 && headerBytes[1] === 0x4b
      const isPdf = headerBytes[0] === 0x25 && headerBytes[1] === 0x50 && headerBytes[2] === 0x44 && headerBytes[3] === 0x46
      const isRar = headerBytes[0] === 0x52 && headerBytes[1] === 0x61 && headerBytes[2] === 0x72 && headerBytes[3] === 0x21

      if (isZip) {
        mainFileMeta.type = 'zip'
        mainFileMeta.isArchive = true
        archiveInfo = parseZipBuffer(buf)
        // Gabungkan ancaman dari arsip jika ada (bedakan malware kritis vs peringatan macro edukasi)
        if (archiveInfo.threats && archiveInfo.threats.length > 0) {
          const hasCriticalThreat = archiveInfo.threats.some((t: any) => t.severity === 'critical' || t.type === 'cloaked_executable' || t.type === 'path_traversal' || t.type === 'unicode_spoof' || t.type === 'script');
          if (hasCriticalThreat) {
            malwareReport.isClean = false;
            malwareReport.threatLevel = 'critical';
          } else if (malwareReport.threatLevel === 'clean') {
            malwareReport.threatLevel = 'medium';
          }
          malwareReport.totalThreats += archiveInfo.threats.length;
          malwareReport.threats = [...malwareReport.threats, ...archiveInfo.threats];
          malwareReport.warnings = malwareReport.threats.filter((t: any) => t.type === 'macro' || t.severity === 'medium' || t.severity === 'low');
        }

        // ANALISIS KEPATUHAN SOP & DETEKSI README / MATERI EDITABLE / TAUTAN EKSTERNAL
        let readmeEntry: any = null
        const readmeNames = ['readme.txt', 'readme.md', 'panduan_produk.txt', 'panduan.txt', 'panduan_guru.txt', 'baca_saya.txt', 'instruksi.txt', 'panduan_materi.txt']
        
        for (const entry of archiveInfo.entries) {
          if (!entry.isDirectory) {
            const base = entry.name.toLowerCase()
            if (readmeNames.includes(base) || base.startsWith('readme') || base.startsWith('panduan_') || base.startsWith('panduan-')) {
              readmeEntry = entry
              break
            }
          }
        }

        let readmeContent: string | null = null
        if (readmeEntry && !readmeEntry.isSuspicious) {
          try {
            const extracted = await extractZipEntry(buf, readmeEntry.path)
            if (extracted && extracted.data) {
              const decoder = new TextDecoder('utf-8')
              readmeContent = decoder.decode(extracted.data)
            }
          } catch {}
        }

        // Hitung berkas yang bisa diedit (editable files: docx, pptx, xlsx, dll)
        const editableExtensions = new Set(['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'odt', 'odp', 'ods'])
        let editableCount = 0
        const editableFilesList: string[] = []
        archiveInfo.entries.forEach((e: any) => {
          if (!e.isDirectory && editableExtensions.has((e.extension || '').toLowerCase())) {
            editableCount++
            if (editableFilesList.length < 10) {
              editableFilesList.push(e.name)
            }
          }
        })

        // Deteksi Tautan Eksternal dari isi README dan deskripsi produk
        const urlRegex = /(https?:\/\/[^\s<>"']+)/gi
        const detectedUrlsSet = new Set<string>()
        
        const scanTextForUrls = (txt: string | null | undefined) => {
          if (!txt) return
          const matches = txt.match(urlRegex)
          if (matches) {
            matches.forEach(u => {
              const cleanUrl = u.replace(/[.,;:)\]]+$/, '')
              if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
                detectedUrlsSet.add(cleanUrl)
              }
            })
          }
        }

        scanTextForUrls(readmeContent)
        scanTextForUrls(prod.description)

        const detectedLinks = Array.from(detectedUrlsSet).map(urlStr => {
          let domain = ''
          let type: 'canva' | 'gdrive' | 'dropbox' | 'playstore' | 'appstore' | 'github' | 'installer_app' | 'custom_app' | 'generic' | 'suspicious' = 'generic'
          let isSuspicious = false
          let warningNote: string | null = null
          let pathname = ''

          try {
            const parsed = new URL(urlStr)
            domain = parsed.hostname.toLowerCase()
            pathname = parsed.pathname.toLowerCase()
            
            if (domain.includes('canva.com')) {
              type = 'canva'
              if (!urlStr.includes('/view') && !urlStr.includes('template')) {
                warningNote = 'Periksa apakah link ini Template Link resmi Canva (bisa diduplikasi), bukan link kolaborasi privat.'
              }
            } else if (domain.includes('drive.google.com') || domain.includes('docs.google.com')) {
              type = 'gdrive'
              warningNote = 'Wajib verifikasi apakah izin akses sudah diatur ke "Siapa saja yang memiliki link" (Public View).'
            } else if (domain.includes('dropbox.com')) {
              type = 'dropbox'
            } else if (domain.includes('play.google.com')) {
              type = 'playstore'
              warningNote = 'Aplikasi Android resmi dari Google Play Store.'
            } else if (domain.includes('apps.apple.com')) {
              type = 'appstore'
              warningNote = 'Aplikasi iOS/macOS resmi dari Apple App Store.'
            } else if (domain.includes('github.com')) {
              type = 'github'
              warningNote = 'Repositori / Berkas Rilis GitHub.'
            } else if (pathname.endsWith('.apk') || pathname.endsWith('.exe') || pathname.endsWith('.msi') || pathname.endsWith('.dmg') || pathname.endsWith('.pkg')) {
              type = 'installer_app'
              warningNote = 'Tautan unduhan berkas installer (.apk/.exe). Wajib uji unduh dan cek VirusTotal sebelum menyetujui.'
            } else if (['bit.ly', 'tinyurl.com', 's.id', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'adfly', 'safelinku', 'linkvertise'].some(bad => domain.includes(bad))) {
              type = 'suspicious'
              isSuspicious = true
              warningNote = 'Pemendek link atau safelink iklan terdeteksi! Dilarang menyembunyikan link tujuan.'
            } else if (pathname.includes('/download') || pathname.includes('/app') || pathname.includes('/apk')) {
              type = 'custom_app'
              warningNote = 'Tautan unduhan aplikasi dari server mandiri seller. Pastikan seller menyertakan garansi akses & panduan di README.'
            }
          } catch {
            domain = 'unknown'
          }

          const source = readmeContent && readmeContent.includes(urlStr) ? 'readme' : 'description'

          return {
            url: urlStr,
            domain,
            type,
            isSuspicious,
            warningNote,
            source
          }
        })

        archiveInfo.sopAnalysis = {
          hasReadme: !!readmeEntry,
          readmeStatus: readmeEntry ? 'found' : 'missing',
          readmePath: readmeEntry ? readmeEntry.path : null,
          readmeFileName: readmeEntry ? readmeEntry.name : null,
          readmeName: readmeEntry ? readmeEntry.name : null,
          readmeContent,
          hasEditableFiles: editableCount > 0,
          editableFilesCount: editableCount,
          editableFilesList,
          detectedLinks,
          externalUrls: detectedLinks
        }
      } else if (isPdf) {
        mainFileMeta.type = 'pdf'
        mainFileMeta.isArchive = false
      } else if (isRar) {
        mainFileMeta.type = 'rar'
        mainFileMeta.isArchive = true
      } else {
        mainFileMeta.type = ext || 'file'
      }
    }
  }

  // Susun foto cover & detail
  const galleryImages: any[] = []
  if (prod.cover_image_key) {
    galleryImages.push({
      type: 'cover',
      name: 'Cover Utama (Sampul)',
      key: prod.cover_image_key,
      alt: prod.cover_image_alt || prod.title
    })
  }
  if (prod.detail_image_1_key) {
    galleryImages.push({
      type: 'detail_1',
      name: 'Foto Detail 1',
      key: prod.detail_image_1_key,
      alt: prod.detail_image_1_alt || ''
    })
  }
  if (prod.detail_image_2_key) {
    galleryImages.push({
      type: 'detail_2',
      name: 'Foto Detail 2',
      key: prod.detail_image_2_key,
      alt: prod.detail_image_2_alt || ''
    })
  }
  if (prod.detail_image_3_key) {
    galleryImages.push({
      type: 'detail_3',
      name: 'Foto Detail 3',
      key: prod.detail_image_3_key,
      alt: prod.detail_image_3_alt || ''
    })
  }

  return c.json({
    product: prod,
    mainFile: mainFileMeta,
    archiveInfo,
    malwareReport,
    galleryImages,
    samplePhotos
  })
})

// 7. Admin preview berkas file kurasi secara langsung (Khusus Super Admin & Admin)
products.get('/admin/:id/files/preview', rateLimit(100, 60, 'curate_file_preview'), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const prod = await c.env.DB.prepare(`
    SELECT id, file_r2_key, author_id, 
           cover_image_key, detail_image_1_key, detail_image_2_key, detail_image_3_key 
    FROM products 
    WHERE id = ?
  `).bind(targetId).first<{
    id: string;
    file_r2_key: string | null;
    author_id: string;
    cover_image_key: string | null;
    detail_image_1_key: string | null;
    detail_image_2_key: string | null;
    detail_image_3_key: string | null;
  }>()
  if (!prod) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  const sourceType = c.req.query('source') || 'zip_entry'
  const entryPath = c.req.query('path') || ''

  // Set header keamanan ketat untuk mencegah XSS jika berkas berupa SVG atau script
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self' data:; style-src 'unsafe-inline'; sandbox")

  if (sourceType === 'zip_entry') {
    if (!prod.file_r2_key) throw new HTTPException(404, { message: 'Berkas digital tidak ditemukan.' })
    if (!entryPath) throw new HTTPException(400, { message: 'Path berkas tidak boleh kosong.' })

    const r2Obj = await c.env.R2.get(prod.file_r2_key)
    if (!r2Obj) throw new HTTPException(404, { message: 'Berkas arsip tidak ditemukan di penyimpanan.' })

    const buffer = await r2Obj.arrayBuffer()
    let extracted: any = null
    try {
      extracted = await extractZipEntry(buffer, entryPath)
    } catch (err: any) {
      throw new HTTPException(400, { message: err?.message || 'Gagal mengekstrak berkas arsip untuk pratinjau.' })
    }

    if (!extracted) {
      throw new HTTPException(404, { message: 'Berkas tidak dapat diekstrak atau jenis kompresi tidak didukung untuk pratinjau langsung.' })
    }

    const fileName = entryPath.split('/').pop() || 'preview'
    c.header('Content-Type', extracted.mimeType)
    c.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
    return c.body(extracted.data as any)
  }

  if (sourceType === 'main') {
    if (!prod.file_r2_key) throw new HTTPException(404, { message: 'Berkas digital tidak ditemukan.' })
    const r2Obj = await c.env.R2.get(prod.file_r2_key)
    if (!r2Obj) throw new HTTPException(404, { message: 'Berkas tidak ditemukan di penyimpanan.' })

    const fileName = prod.file_r2_key.split('/').pop() || 'document.pdf'
    const contentType = r2Obj.httpMetadata?.contentType || 'application/pdf'
    c.header('Content-Type', contentType)
    c.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)
    return c.body(r2Obj.body)
  }

  if (sourceType === 'sample') {
    const sampleKey = entryPath.replace(/^sample-products\//, '').replace(/[^a-zA-Z0-9.\-_]/g, '')
    if (!sampleKey) {
      throw new HTTPException(400, { message: 'Kunci foto sampel tidak valid.' })
    }
    const fullPath = `sample-products/${sampleKey}`

    // Validasi otorisasi: pastikan foto sampel ini benar diunggah oleh author produk (anti-object traversal)
    if (prod.author_id) {
      const sampleMedia = await c.env.DB.prepare('SELECT id FROM media WHERE uploaded_by = ? AND r2_key = ?').bind(prod.author_id, fullPath).first()
      if (!sampleMedia) {
        throw new HTTPException(403, { message: 'Foto sampel tidak terdaftar pada produk ini.' })
      }
    }

    const r2Obj = await c.env.R2.get(fullPath)
    if (!r2Obj) throw new HTTPException(404, { message: 'Foto sampel tidak ditemukan.' })

    c.header('Content-Type', r2Obj.httpMetadata?.contentType || 'image/jpeg')
    return c.body(r2Obj.body)
  }

  if (sourceType === 'gallery') {
    const imageKey = entryPath
    if (!/^[a-zA-Z0-9.\-_]+$/.test(imageKey)) {
      throw new HTTPException(400, { message: 'Kunci gambar tidak valid.' })
    }

    // Validasi otorisasi: pastikan imageKey terdaftar pada galeri produk ini
    const allowedGalleryKeys = [
      prod.cover_image_key,
      prod.detail_image_1_key,
      prod.detail_image_2_key,
      prod.detail_image_3_key
    ].filter(Boolean)

    if (!allowedGalleryKeys.includes(imageKey)) {
      throw new HTTPException(403, { message: 'Kunci gambar tidak terdaftar pada produk ini.' })
    }

    const r2Obj = await c.env.R2.get(imageKey)
    if (!r2Obj) throw new HTTPException(404, { message: 'Foto tidak ditemukan di penyimpanan.' })

    c.header('Content-Type', r2Obj.httpMetadata?.contentType || 'image/jpeg')
    return c.body(r2Obj.body)
  }

  throw new HTTPException(400, { message: 'Sumber berkas tidak dikenal.' })
})

// 8. Admin mengunduh seluruh file asli produk (Khusus Super Admin & Admin)
products.get('/admin/:id/download-file', rateLimit(20, 60, 'curate_file_download'), async (c) => {
  const user = c.get('user')
  if (!isSuperAdminOrAdmin(user)) {
    throw new HTTPException(403, { message: 'Akses ditolak. Fitur kurasi produk hanya untuk Super Admin dan Admin.' })
  }

  const targetId = c.req.param('id')
  const prod = await c.env.DB.prepare('SELECT id, file_r2_key, title FROM products WHERE id = ?').bind(targetId).first<{ id: string; file_r2_key: string | null; title: string }>()
  if (!prod || !prod.file_r2_key) {
    throw new HTTPException(404, { message: 'Berkas digital produk tidak ditemukan.' })
  }

  const r2Obj = await c.env.R2.get(prod.file_r2_key)
  if (!r2Obj) {
    throw new HTTPException(404, { message: 'Berkas tidak ditemukan di penyimpanan.' })
  }

  const cleanFileName = prod.file_r2_key.split('/').pop() || 'product-file.zip'
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Content-Type', r2Obj.httpMetadata?.contentType || 'application/octet-stream')
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFileName)}"`)
  return c.body(r2Obj.body)
})

export default products
