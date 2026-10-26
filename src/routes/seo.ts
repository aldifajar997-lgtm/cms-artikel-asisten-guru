import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { rateLimit } from '../middlewares/rate-limit'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { getSafeFrontendUrl } from '../utils/url'

const seo = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const escapeXml = (str: string) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')


/**
 * Format tanggal dari database ke ISO-8601 komplit.
 * Return null jika input null atau format tidak valid (fix M7: jangan fake date).
 */
const formatDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('.')[0] + '+00:00'
  } catch (e) {
    return null
  }
}

const SITEMAP_PAGE_SIZE = 1000

// Fix L1: Tidak ekspos informasi "CMS Backend API" + fix L6: tambah Cache-Control
seo.get('/', (c) => {
  return c.text('OK', 200, {
    'Cache-Control': 'public, max-age=60'
  })
})

// --- SITEMAP INDEX (fix H2: pagination untuk >1000 konten) ---
seo.get('/sitemap.xml', async (c) => {
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))

  try {
    const postCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM posts WHERE status = 'published'"
    ).first<{ count: number }>()

    const productCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM products p 
       JOIN users u ON p.author_id = u.id 
       WHERE p.status = 'published' 
         AND u.is_active = 1 
         AND (u.seller_status = 'approved' OR u.id = 'super_admin')`
    ).first<{ count: number }>()

    const totalPostPages = Math.max(1, Math.ceil((postCount?.count || 0) / SITEMAP_PAGE_SIZE))
    const totalProductPages = Math.max(1, Math.ceil((productCount?.count || 0) / SITEMAP_PAGE_SIZE))

    let sitemaps = ''
    for (let i = 1; i <= totalPostPages; i++) {
      sitemaps += `
  <sitemap>
    <loc>${frontendUrl}/sitemap-posts-${i}.xml</loc>
  </sitemap>`
    }

    for (let i = 1; i <= totalProductPages; i++) {
      sitemaps += `
  <sitemap>
    <loc>${frontendUrl}/sitemap-products-${i}.xml</loc>
  </sitemap>`
    }

    sitemaps += `
  <sitemap>
    <loc>${frontendUrl}/sitemap-taxonomy.xml</loc>
  </sitemap>`

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}
</sitemapindex>`

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch {
    return c.text('', 503, { 'Retry-After': '3600' })
  }
})

// --- SUB-SITEMAP: Posts (paginated) ---
seo.get('/sitemap-posts-*', async (c) => {
  const path = c.req.path
  // Ekstrak angka dari /sitemap-posts-1.xml
  const match = path.match(/sitemap-posts-(\d+)\.xml/)
  if (!match) {
    return c.text('Not found', 404)
  }

  const pageRaw = parseInt(match[1])
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const offset = (page - 1) * SITEMAP_PAGE_SIZE
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))

  try {
    const posts = await c.env.DB.prepare(
      "SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    ).bind(SITEMAP_PAGE_SIZE, offset).all()

    let postUrls = ''

    // Halaman utama sudah dihandle oleh sitemap-hub.xml di frontend

    postUrls += posts.results.map(post => {
      const lastmod = formatDate(post.updated_at as string)
      // Fix M7+H6: hanya tampilkan <lastmod> jika tanggal valid, dan escape hasilnya
      const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
      return `
  <url>
    <loc>${frontendUrl}/blog/${escapeXml(post.slug as string)}</loc>${lastmodTag}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${postUrls}
</urlset>`

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch {
    return c.text('', 503, { 'Retry-After': '3600' })
  }
})

// --- SUB-SITEMAP: Products (paginated) ---
seo.get('/sitemap-products-*', async (c) => {
  const path = c.req.path
  const match = path.match(/sitemap-products-(\d+)\.xml/)
  if (!match) {
    return c.text('Not found', 404)
  }

  const pageRaw = parseInt(match[1])
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const offset = (page - 1) * SITEMAP_PAGE_SIZE
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))
  const origin = new URL(c.req.url).origin

  try {
    const products = await c.env.DB.prepare(
      `SELECT p.slug, p.updated_at, p.title, p.cover_image_key, p.cover_image_alt, p.detail_image_1_key, p.detail_image_1_alt, p.detail_image_2_key, p.detail_image_2_alt, p.detail_image_3_key, p.detail_image_3_alt 
       FROM products p 
       JOIN users u ON p.author_id = u.id 
       WHERE p.status = 'published' 
         AND u.is_active = 1 
         AND (u.seller_status = 'approved' OR u.id = 'super_admin') 
       ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`
    ).bind(SITEMAP_PAGE_SIZE, offset).all()

    let productUrls = ''

    // Halaman root /toko sudah dihandle oleh sitemap-hub.xml di frontend

    productUrls += products.results.map(product => {
      const lastmod = formatDate(product.updated_at as string)
      const lastmodTag = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
      
      let imageTags = ''
      const images = [
        { key: product.cover_image_key, alt: product.cover_image_alt || product.title },
        { key: product.detail_image_1_key, alt: product.detail_image_1_alt || (product.detail_image_1_key ? `${product.title} - Detail 1` : '') },
        { key: product.detail_image_2_key, alt: product.detail_image_2_alt || (product.detail_image_2_key ? `${product.title} - Detail 2` : '') },
        { key: product.detail_image_3_key, alt: product.detail_image_3_alt || (product.detail_image_3_key ? `${product.title} - Detail 3` : '') }
      ]
      
      for (const img of images) {
        if (img.key) {
          imageTags += `\n    <image:image>\n      <image:loc>${origin}/api/media/${escapeXml(img.key as string)}</image:loc>`
          if (img.alt) {
            imageTags += `\n      <image:caption>${escapeXml(img.alt as string)}</image:caption>`
          }
          imageTags += `\n    </image:image>`
        }
      }

      return `
  <url>
    <loc>${frontendUrl}/toko?item=${escapeXml(product.slug as string)}</loc>${lastmodTag}${imageTags}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${productUrls}
</urlset>`

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch {
    return c.text('', 503, { 'Retry-After': '3600' })
  }
})

// --- SUB-SITEMAP: Categories + Tags ---
seo.get('/sitemap-taxonomy.xml', async (c) => {
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))

  try {
    const categories = await c.env.DB.prepare(
      "SELECT slug, type FROM categories LIMIT 5000"
    ).all()

    const tags = await c.env.DB.prepare(
      "SELECT slug FROM tags LIMIT 5000"
    ).all()

    const authors = await c.env.DB.prepare(
      "SELECT DISTINCT u.id FROM users u JOIN posts p ON p.author_id = u.id WHERE p.status = 'published' LIMIT 5000"
    ).all()

    const sellers = await c.env.DB.prepare(
      `SELECT DISTINCT u.id, u.store_slug 
       FROM users u 
       JOIN products p ON p.author_id = u.id 
       WHERE p.status = 'published' AND u.is_active = 1 AND (u.seller_status = 'approved' OR u.id = 'super_admin') 
       LIMIT 5000`
    ).all()

    const categoryUrls = categories.results.map(category => {
      if (category.type === 'product') {
        return `
  <url>
    <loc>${frontendUrl}/toko?category=${escapeXml(category.slug as string)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
      }
      return `
  <url>
    <loc>${frontendUrl}/blog/kategori/${escapeXml(category.slug as string)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
    }).join('')

    const tagUrls = tags.results.map(tag => `
  <url>
    <loc>${frontendUrl}/blog/tag/${escapeXml(tag.slug as string)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('')

    const authorUrls = authors.results.map(author => `
  <url>
    <loc>${frontendUrl}/blog/penulis/${author.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')

    const sellerUrls = sellers.results.map(seller => {
      const sellerPath = seller.store_slug ? `${seller.store_slug}` : `toko/penjual/${seller.id}`
      return `
  <url>
    <loc>${frontendUrl}/${sellerPath}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${categoryUrls}${tagUrls}${authorUrls}${sellerUrls}
</urlset>`

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch {
    return c.text('', 503, { 'Retry-After': '3600' })
  }
})

seo.get('/robots.txt', (c) => {
  const frontendUrl = getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL)

  const content = `User-agent: *
Allow: /api/media/
Allow: /tos
Allow: /privacy
Disallow: /api/
Allow: /sitemap.xml
Allow: /sitemap-posts-*.xml
Allow: /sitemap-products-*.xml
Allow: /sitemap-taxonomy.xml
Sitemap: ${frontendUrl}/sitemap.xml`

  return c.text(content, 200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400'
  })
})

export default seo
