import { Hono } from 'hono'
import { z } from 'zod'
import { sign, verify } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import xss from 'xss'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'

const customWhiteList = { ...(xss as any).getDefaultWhiteList() }
Object.keys(customWhiteList).forEach((tag) => {
  customWhiteList[tag].push('style', 'class')
})
customWhiteList.iframe = ['src', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'class']
customWhiteList.video = ['src', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'style', 'class']
customWhiteList.audio = ['src', 'controls', 'style', 'class']
customWhiteList.source = ['src', 'type']

const cleanText = (val: string) => xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// --- PUBLIC ROUTES ---

posts.get('/', rateLimit(500, 60, 'public_posts'), async (c) => {
  const { limit, offset } = getPagination(c, 10, 50)
  const categoryId = c.req.query('category_id')
  const searchQuery = c.req.query('q')
  const cursor = c.req.query('cursor')
  const sort = c.req.query('sort')
  const authorIdParam = c.req.query('author_id')

  // Batasi input pencarian maksimal 50 karakter untuk mencegah Cache Key Poisoning
  const safeSearchQueryRaw = searchQuery ? searchQuery.substring(0, 50) : null;

  // Normalisasi Cache Key untuk mencegah Cache Key Poisoning (Storage Exhaustion Attack)
  const cacheKey = `cache:posts_list:${limit}:${offset}:${categoryId || 'any'}:${authorIdParam || 'any'}:${sort || 'newest'}:${safeSearchQueryRaw || 'none'}:${cursor || 'none'}`
  
  const cachedData = await c.env.KV.get(cacheKey, 'json')
  if (cachedData) {
    return c.json(cachedData)
  }

  // Hapus p.seo_score untuk mencegah kebocoran strategi SEO ke publik
  let baseQuery = "SELECT p.id, p.slug, p.title, p.excerpt, p.featured_image, p.featured_image_alt, p.meta_title, p.meta_description, p.reading_time_minutes, p.view_count, p.author_id, p.category_id, p.published_at FROM posts p"
  let whereClauses = ["p.status = 'published'"]
  const params: any[] = []

  if (safeSearchQueryRaw) {
    // Sanitasi FTS5 untuk menghindari error query syntax
    const safeQuery = safeSearchQueryRaw.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    if (safeQuery.length > 0) {
      baseQuery += " JOIN posts_search ps ON p.id = ps.id"
      whereClauses.push("posts_search MATCH ?")
      params.push(`"${safeQuery}"*`)
    }
  }

  if (categoryId) {
    whereClauses.push("p.category_id = ?")
    params.push(categoryId)
  }
  
  if (authorIdParam) {
    whereClauses.push("p.author_id = ?")
    params.push(authorIdParam)
  }

  // Cursor Pagination (Keyset) lebih diprioritaskan daripada Offset
  if (cursor) {
    if (sort === 'popular') {
      whereClauses.push("p.view_count < ?")
    } else {
      whereClauses.push("p.published_at < ?")
    }
    params.push(cursor)
  }

  let finalQuery = `${baseQuery} WHERE ${whereClauses.join(' AND ')}`
  
  if (sort === 'popular') {
    finalQuery += ' ORDER BY p.view_count DESC, p.published_at DESC LIMIT ?'
  } else {
    finalQuery += ' ORDER BY p.published_at DESC LIMIT ?'
  }
  
  params.push(limit)
  
  if (!cursor) {
    finalQuery += " OFFSET ?"
    params.push(offset)
  }

  const results = await c.env.DB.prepare(finalQuery).bind(...params).all()

  const formatted = results.results.map((r: any) => ({
    ...r,
    published_at: r.published_at || null
  }))

  const nextCursor = formatted.length === limit ? (sort === 'popular' ? formatted[formatted.length - 1].view_count : formatted[formatted.length - 1].published_at) : null

  const responseData = { data: formatted, limit, offset, next_cursor: nextCursor }
  
  c.executionCtx.waitUntil(c.env.KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 60 }))

  return c.json(responseData)
})

posts.get('/:slug', rateLimit(500, 60, 'public_posts'), async (c) => {
  const slug = c.req.param('slug')
  const tz = c.req.query('timezone') || 'Asia/Jakarta'
  
  const cacheKey = `cache:post_slug:${slug}`
  const cachedData = await c.env.KV.get(cacheKey, 'json')
  if (cachedData) {
    return c.json(cachedData)
  }

  // Hapus focus_keyword, secondary_keywords, seo_score, word_count dari hasil query ke publik
  const post = await c.env.DB.prepare(
    "SELECT id, slug, title, excerpt, content, featured_image, featured_image_alt, featured_image_caption, meta_title, meta_description, reading_time_minutes, view_count, author_id, category_id, status, published_at, created_at, updated_at FROM posts WHERE slug = ? AND status = 'published'"
  ).bind(slug).first()

  if (!post) throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })

  const formatted = {
    ...post,
    published_at: post.published_at || null,
    created_at: post.created_at || null,
    updated_at: post.updated_at || null
  }

  // Ambil tags untuk post ini
  const tags = await c.env.DB.prepare(
    'SELECT t.id, t.slug, t.name FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ?'
  ).bind(post.id).all()

  const responseData = { ...formatted, tags: tags.results }
  
  c.executionCtx.waitUntil(c.env.KV.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 3600 }))

  return c.json(responseData)
})

posts.get('/preview/:id', rateLimit(100, 60, 'preview_posts'), async (c) => {
  const id = c.req.param('id')
  const token = c.req.query('token')
  
  if (!token) throw new HTTPException(401, { message: 'Token pratinjau tidak valid atau tidak ditemukan.' })

  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256')
    if (!payload || payload.type !== 'preview' || payload.postId !== id) {
      throw new Error('Invalid token')
    }
  } catch (e) {
    throw new HTTPException(401, { message: 'Sesi pratinjau kedaluwarsa atau tidak valid.' })
  }

  // Ambil post tanpa memperhatikan status (draft/published)
  const post = await c.env.DB.prepare(
    "SELECT id, slug, title, excerpt, content, featured_image, featured_image_alt, featured_image_caption, meta_title, meta_description, focus_keyword, secondary_keywords, seo_score, word_count, reading_time_minutes, view_count, author_id, category_id, status, published_at, created_at, updated_at FROM posts WHERE id = ?"
  ).bind(id).first()

  if (!post) throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })

  let parsedSecondary = []
  if (post.secondary_keywords) {
    try { parsedSecondary = JSON.parse(post.secondary_keywords as string) } catch {}
  }

  const formatted = {
    ...post,
    secondary_keywords: parsedSecondary,
    published_at: post.published_at || null,
    created_at: post.created_at || null,
    updated_at: post.updated_at || null
  }

  const tags = await c.env.DB.prepare(
    'SELECT t.id, t.slug, t.name FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE pt.post_id = ?'
  ).bind(post.id).all()

  return c.json({ ...formatted, tags: tags.results })
})

posts.post('/:slug/view', rateLimit(1, 60, (c) => `post_view_${c.req.param('slug')}`), async (c) => {
  const slug = c.req.param('slug')
  
  const result = await c.env.DB.prepare(
    "UPDATE posts SET view_count = COALESCE(view_count, 0) + 1 WHERE slug = ? AND status = 'published'"
  ).bind(slug).run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })
  }

  return c.json({ message: 'View count bertambah.' })
})

// --- PROTECTED ROUTES (Requires Auth) ---

posts.use('*', authMiddleware)

const stripHtml = (val: string) => val ? val.replace(/<[^>]*>?/gm, '').trim() : val;

const postSchema = z.object({
  title: z.string().trim().min(1).max(255).transform(stripHtml),
  slug: z.string().trim().min(1).max(255).regex(slugRegex, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung').transform(stripHtml),
  excerpt: z.string().max(500).optional().transform(v => v ? stripHtml(v) : v),
  content: z.string().optional(),
  featured_image: z.string().optional(),
  featured_image_alt: z.string().optional().transform(v => v ? stripHtml(v) : v),
  featured_image_caption: z.string().optional().transform(v => v ? stripHtml(v) : v),
  meta_title: z.string().max(70).optional().transform(v => v ? stripHtml(v) : v),
  meta_description: z.string().max(160).optional().transform(v => v ? stripHtml(v) : v),
  focus_keyword: z.string().optional().transform(v => v ? stripHtml(v) : v),
  secondary_keywords: z.array(z.string().transform(stripHtml)).optional(),
  seo_score: z.number().min(0).max(100).optional(),
  word_count: z.number().min(0).max(100000).optional(),
  reading_time_minutes: z.number().min(0).max(1000).optional(),
  category_id: z.string().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  tag_ids: z.array(z.string()).optional()
}).superRefine((data, ctx) => {
  if (data.status === 'published') {
    const rawContentLength = data.content ? stripHtml(data.content).length : 0;
    if (rawContentLength < 50) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Artikel published harus memiliki konten minimal 50 karakter.', path: ['content'] })
    }
  }
})

posts.get('/admin/stats', async (c) => {
  const user = c.get('user')
  let query = `
    SELECT 
      COUNT(*) as total_articles,
      SUM(word_count) as total_words,
      AVG(seo_score) as avg_score,
      SUM(view_count) as total_views,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
    FROM posts
  `
  const params: any[] = []
  
  if (user.role !== 'super_admin') {
    query += ' WHERE author_id = ?'
    params.push(user.id)
  }
  
  const result = await c.env.DB.prepare(query).bind(...params).first()
  return c.json({ data: result })
})

posts.get('/admin/preview-token/:id', requirePermission('edit_post'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  if (user.role !== 'super_admin') {
    const existing = await c.env.DB.prepare('SELECT author_id FROM posts WHERE id = ?').bind(targetId).first()
    if (!existing) throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })
    if (existing.author_id !== user.id) throw new HTTPException(403, { message: 'Anda tidak berhak melihat preview artikel ini.' })
  }

  // Buat JWT khusus preview valid 15 menit
  const token = await sign({
    postId: targetId,
    type: 'preview',
    exp: Math.floor(Date.now() / 1000) + 15 * 60
  }, c.env.JWT_SECRET)

  return c.json({ data: token })
})

posts.get('/admin/all', async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 50, 100)

  const search = c.req.query('search')
  const categoryId = c.req.query('category_id')
  const status = c.req.query('status')
  const sort = c.req.query('sort')

  let query = "SELECT posts.id, posts.slug, posts.title, posts.excerpt, posts.featured_image, posts.featured_image_alt, posts.featured_image_caption, posts.meta_title, posts.meta_description, posts.focus_keyword, posts.secondary_keywords, posts.seo_score, posts.word_count, posts.reading_time_minutes, posts.view_count, posts.author_id, posts.category_id, posts.status, posts.published_at, posts.created_at, posts.updated_at, users.name as author_name, (SELECT json_group_array(tag_id) FROM post_tags WHERE post_id = posts.id) as tag_ids FROM posts LEFT JOIN users ON posts.author_id = users.id"
  const params: any[] = []
  const conditions: string[] = []
  
  if (user.role !== 'super_admin') {
    conditions.push('posts.author_id = ?')
    params.push(user.id)
  }
  
  if (search) {
    conditions.push('(posts.title LIKE ? OR posts.focus_keyword LIKE ? OR posts.excerpt LIKE ?)')
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern, searchPattern)
  }
  
  if (categoryId && categoryId !== 'all') {
    conditions.push('posts.category_id = ?')
    params.push(categoryId)
  }
  
  if (status && status !== 'all') {
    const safeStatus = ['draft', 'published'].includes(status as string) ? status : 'draft'
    conditions.push('posts.status = ?')
    params.push(safeStatus)
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  
  if (sort === 'oldest') {
    query += ' ORDER BY posts.created_at ASC'
  } else if (sort === 'score') {
    query += ' ORDER BY posts.seo_score DESC'
  } else if (sort === 'words') {
    query += ' ORDER BY posts.word_count DESC'
  } else if (sort === 'popular') {
    query += ' ORDER BY posts.view_count DESC'
  } else {
    query += ' ORDER BY posts.created_at DESC'
  }
  
  query += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const results = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ data: results.results, limit, offset })
})

posts.post('/', requirePermission('create_post'), rateLimit(30, 60, 'post_write'), zValidator('json', postSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')

  // Sanitasi HTML (Stored XSS Protection) dengan dukungan Iframe untuk Embed dan Style
  const cleanContent = body.content ? xss(body.content, { whiteList: customWhiteList }) : null

  const id = crypto.randomUUID()
  const publishedAt = body.status === 'published' ? new Date().toISOString() : null
  const authorId = user.id === 'super_admin' ? null : user.id

  try {
    const stmts = []
    stmts.push(
      c.env.DB.prepare(`
        INSERT INTO posts (
          id, slug, title, excerpt, content, featured_image, featured_image_alt, featured_image_caption,
          meta_title, meta_description, focus_keyword, secondary_keywords, seo_score, word_count, reading_time_minutes,
          author_id, category_id, status, published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.slug, body.title, body.excerpt || null, cleanContent,
        body.featured_image || null, body.featured_image_alt || null, body.featured_image_caption || null,
        body.meta_title || null, body.meta_description || null,
        body.focus_keyword || null, body.secondary_keywords ? JSON.stringify(body.secondary_keywords) : null,
        body.seo_score || null, body.word_count || null, body.reading_time_minutes || null,
        authorId, body.category_id || null, body.status, publishedAt
      )
    )

    if (body.tag_ids && body.tag_ids.length > 0) {
      const tagStmt = c.env.DB.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)')
      body.tag_ids.forEach(tagId => stmts.push(tagStmt.bind(id, tagId)))
    }

    await c.env.DB.batch(stmts)
    return c.json({ message: 'Artikel berhasil dibuat.', id })
  } catch (error: any) {
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      throw new HTTPException(400, { message: 'Kategori atau Tag yang dipilih tidak valid.' })
    }
    throw new HTTPException(400, { message: 'Gagal membuat artikel. Pastikan slug belum digunakan.' })
  }
})

posts.put('/:id', requirePermission('edit_post'), rateLimit(30, 60, 'post_write'), zValidator('json', postSchema), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')
  const body = c.req.valid('json')

  // Verifikasi Ownership jika bukan super_admin
  const existing = await c.env.DB.prepare('SELECT author_id, slug FROM posts WHERE id = ?').bind(targetId).first()
  if (!existing) throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })
  
  if (user.role !== 'super_admin') {
    if (existing.author_id !== user.id) throw new HTTPException(403, { message: 'Anda tidak berhak mengedit artikel milik orang lain.' })
  }

  // Sanitasi HTML (Stored XSS Protection) dengan dukungan Iframe untuk Embed dan Style
  const cleanContent = body.content ? xss(body.content, { whiteList: customWhiteList }) : null
  const publishedAt = body.status === 'published' ? new Date().toISOString() : null

  try {
    const stmts = []
    stmts.push(
      c.env.DB.prepare(`
        UPDATE posts SET
          slug = ?, title = ?, excerpt = ?, content = ?, featured_image = ?,
          featured_image_alt = ?, featured_image_caption = ?,
          meta_title = ?, meta_description = ?, focus_keyword = ?, secondary_keywords = ?,
          seo_score = ?, word_count = ?, reading_time_minutes = ?,
          category_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP,
          published_at = COALESCE(published_at, ?)
        WHERE id = ?
      `).bind(
        body.slug, body.title, body.excerpt || null, cleanContent, body.featured_image || null,
        body.featured_image_alt || null, body.featured_image_caption || null,
        body.meta_title || null, body.meta_description || null,
        body.focus_keyword || null, body.secondary_keywords ? JSON.stringify(body.secondary_keywords) : null,
        body.seo_score || null, body.word_count || null, body.reading_time_minutes || null,
        body.category_id || null, body.status, publishedAt, targetId
      )
    )

    if (body.tag_ids !== undefined) {
      stmts.push(c.env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(targetId))
      if (body.tag_ids.length > 0) {
        const tagStmt = c.env.DB.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)')
        body.tag_ids.forEach(tagId => stmts.push(tagStmt.bind(targetId, tagId)))
      }
    }

    await c.env.DB.batch(stmts)
    
    // Invalidasi cache KV
    if (existing && existing.slug) {
      c.executionCtx.waitUntil(c.env.KV.delete(`cache:post_slug:${existing.slug}`))
    }
    if (body.slug && body.slug !== existing?.slug) {
      c.executionCtx.waitUntil(c.env.KV.delete(`cache:post_slug:${body.slug}`))
    }

    return c.json({ message: 'Artikel berhasil diperbarui.' })
  } catch (error: any) {
    if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
      throw new HTTPException(400, { message: 'Kategori atau Tag yang dipilih tidak valid.' })
    }
    throw new HTTPException(400, { message: 'Gagal memperbarui artikel. Pastikan slug belum digunakan.' })
  }
})

posts.delete('/:id', requirePermission('delete_post'), rateLimit(30, 60, 'post_write'), async (c) => {
  const targetId = c.req.param('id')
  const user = c.get('user')

  // Selalu cek keberadaan resource terlebih dahulu
  const existing = await c.env.DB.prepare('SELECT author_id, slug FROM posts WHERE id = ?').bind(targetId).first()
  if (!existing) {
    throw new HTTPException(404, { message: 'Artikel tidak ditemukan.' })
  }

  if (user.role !== 'super_admin' && existing.author_id !== user.id) {
    throw new HTTPException(403, { message: 'Anda tidak berhak menghapus artikel ini.' })
  }

  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(targetId).run()
  
  if (existing.slug) {
    c.executionCtx.waitUntil(c.env.KV.delete(`cache:post_slug:${existing.slug}`))
  }
  
  return c.json({ message: 'Artikel berhasil dihapus.' })
})

export default posts
