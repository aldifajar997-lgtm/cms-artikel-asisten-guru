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
 * Format tanggal dari database ke YYYY-MM-DD.
 * Return null jika input null atau format tidak valid (fix M7: jangan fake date).
 */
const formatDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  return datePart
}

const SITEMAP_PAGE_SIZE = 1000

// Fix L1: Tidak ekspos informasi "CMS Backend API" + fix L6: tambah Cache-Control
seo.get('/', (c) => {
  return c.text('OK', 200, {
    'Cache-Control': 'public, max-age=60'
  })
})

// --- SITEMAP INDEX (fix H2: pagination untuk >1000 konten) ---
seo.get('/sitemap.xml', rateLimit(20, 60, 'sitemap'), async (c) => {
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))

  try {
    const postCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM posts WHERE status = 'published'"
    ).first<{ count: number }>()

    const productCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM products WHERE status = 'published'"
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
seo.get('/sitemap-posts-*', rateLimit(20, 60, 'sitemap'), async (c) => {
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

    // Halaman utama hanya di page 1
    if (page === 1) {
      postUrls += `
  <url>
    <loc>${frontendUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`
    }

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
seo.get('/sitemap-products-*', rateLimit(20, 60, 'sitemap'), async (c) => {
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
      "SELECT slug, updated_at, title, cover_image_key, cover_image_alt, detail_image_1_key, detail_image_1_alt, detail_image_2_key, detail_image_2_alt, detail_image_3_key, detail_image_3_alt FROM products WHERE status = 'published' ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    ).bind(SITEMAP_PAGE_SIZE, offset).all()

    let productUrls = ''

    if (page === 1) {
      productUrls += `
  <url>
    <loc>${frontendUrl}/toko</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`
    }

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
seo.get('/sitemap-taxonomy.xml', rateLimit(20, 60, 'sitemap'), async (c) => {
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL))

  try {
    const categories = await c.env.DB.prepare(
      "SELECT slug, type FROM categories LIMIT 5000"
    ).all()

    const tags = await c.env.DB.prepare(
      "SELECT slug FROM tags LIMIT 5000"
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

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${categoryUrls}${tagUrls}
</urlset>`

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch {
    return c.text('', 503, { 'Retry-After': '3600' })
  }
})

seo.get('/robots.txt', rateLimit(20, 60, 'robots'), (c) => {
  const frontendUrl = getSafeFrontendUrl(c.env.HUB_URL || c.env.FRONTEND_URL)

  const content = `User-agent: *
Allow: /api/media/
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
