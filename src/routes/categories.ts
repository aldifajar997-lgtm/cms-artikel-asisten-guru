import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'
import xss from 'xss'

const cleanText = (val: string) => xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const categories = new Hono<{ Bindings: Bindings; Variables: Variables }>()

categories.get('/', rateLimit(500, 60, 'public_categories'), async (c) => {
  const { limit, offset } = getPagination(c, 10, 100)

  const list = await c.env.DB.prepare(
    `SELECT c.id, c.slug, c.name, c.description, c.target_keywords, c.color, c.created_at, c.parent_id, p.name as parent_name,
            (SELECT COUNT(id) FROM posts post WHERE post.category_id = c.id AND post.status = 'published') as article_count
     FROM categories c
     LEFT JOIN categories p ON c.parent_id = p.id
     ORDER BY c.parent_id ASC, c.name ASC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all()
  return c.json({ data: list.results, limit, offset })
})

const schema = z.object({
  name: z.string().min(1).max(100).transform(cleanText),
  slug: z.string().min(1).max(100).regex(slugRegex, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung').transform(cleanText),
  description: z.string().max(500).optional().transform(v => v ? cleanText(v) : v),
  target_keywords: z.array(z.string().transform(cleanText)).optional(),
  color: z.string().transform(cleanText).optional(),
  parent_id: z.string().nullable().optional()
})

categories.post('/', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), zValidator('json', schema), async (c) => {
  const { name, slug, description, target_keywords, color, parent_id } = c.req.valid('json')
  const id = crypto.randomUUID()

  try {
    await c.env.DB.prepare('INSERT INTO categories (id, slug, name, description, target_keywords, color, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, slug, name, description || null, target_keywords ? JSON.stringify(target_keywords) : null, color || null, parent_id || null).run()
    return c.json({ message: 'Kategori berhasil dibuat.', id })
  } catch {
    throw new HTTPException(400, { message: 'Gagal membuat kategori. Slug mungkin sudah digunakan.' })
  }
})

categories.put('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), zValidator('json', schema), async (c) => {
  const id = c.req.param('id')
  const { name, slug, description, target_keywords, color, parent_id } = c.req.valid('json')

  try {
    const result = await c.env.DB.prepare('UPDATE categories SET slug = ?, name = ?, description = ?, target_keywords = ?, color = ?, parent_id = ? WHERE id = ?')
      .bind(slug, name, description || null, target_keywords ? JSON.stringify(target_keywords) : null, color || null, parent_id || null, id).run()

    if (result.meta.changes === 0) throw new HTTPException(404, { message: 'Kategori tidak ditemukan.' })
    return c.json({ message: 'Kategori berhasil diperbarui.' })
  } catch (e) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(400, { message: 'Gagal memperbarui kategori. Slug mungkin sudah digunakan.' })
  }
})

categories.delete('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), async (c) => {
  const id = c.req.param('id')
  
  // Update semua sub-kategori agar parent_id menjadi NULL sebelum parent dihapus
  // Mencegah "Orphan Category Bug" yang membuat sub-kategori hilang dari UI Editor
  await c.env.DB.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').bind(id).run()

  const result = await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Kategori tidak ditemukan.' })
  }
  return c.json({ message: 'Kategori berhasil dihapus.' })
})

export default categories
