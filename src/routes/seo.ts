import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { rateLimit } from '../middlewares/rate-limit'
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
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.FRONTEND_URL)) // fix H5: escape frontendUrl

  try {
    const postCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM posts WHERE status = 'published'"
    ).first<{ count: number }>()

    const totalPostPages = Math.max(1, Math.ceil((postCount?.count || 0) / SITEMAP_PAGE_SIZE))

    let sitemaps = ''
    for (let i = 1; i <= totalPostPages; i++) {
      sitemaps += `
  <sitemap>
    <loc>${frontendUrl}/sitemap-posts-${i}.xml</loc>
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
seo.get('/sitemap-posts-:page.xml', rateLimit(20, 60, 'sitemap'), async (c) => {
  const pageRaw = parseInt(c.req.param('page') || '1')
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const offset = (page - 1) * SITEMAP_PAGE_SIZE
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.FRONTEND_URL))

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

// --- SUB-SITEMAP: Categories + Tags ---
seo.get('/sitemap-taxonomy.xml', rateLimit(20, 60, 'sitemap'), async (c) => {
  const frontendUrl = escapeXml(getSafeFrontendUrl(c.env.FRONTEND_URL))

  try {
    const categories = await c.env.DB.prepare(
      "SELECT slug FROM categories LIMIT 5000"
    ).all()

    const tags = await c.env.DB.prepare(
      "SELECT slug FROM tags LIMIT 5000"
    ).all()

    const categoryUrls = categories.results.map(category => `
  <url>
    <loc>${frontendUrl}/blog/kategori/${escapeXml(category.slug as string)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')

    // Hub belum memiliki rute untuk tag, namun kita siapkan strukturnya di /blog/tag/
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
  const frontendUrl = getSafeFrontendUrl(c.env.FRONTEND_URL)

  const content = `User-agent: *
Disallow: /api/
Allow: /sitemap.xml
Allow: /sitemap-posts-*.xml
Allow: /sitemap-taxonomy.xml
Sitemap: ${frontendUrl}/sitemap.xml`

  return c.text(content, 200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'public, max-age=86400'
  })
})

export default seo
