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

const tags = new Hono<{ Bindings: Bindings; Variables: Variables }>()

tags.get('/', rateLimit(500, 60, 'public_tags'), async (c) => {
  const { limit, offset } = getPagination(c, 50, 100)

  const list = await c.env.DB.prepare(
    `SELECT id, slug, name, created_at,
            (SELECT COUNT(*) FROM post_tags pt JOIN posts p ON pt.post_id = p.id WHERE pt.tag_id = tags.id AND p.status = 'published') as article_count
     FROM tags 
     ORDER BY name ASC 
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all()
  return c.json({ data: list.results, limit, offset })
})

const schema = z.object({
  name: z.string().min(1).max(100).transform(cleanText),
  slug: z.string().min(1).max(100).regex(slugRegex, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung').transform(cleanText)
})

tags.post('/', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'tag_write'), zValidator('json', schema), async (c) => {
  const { name, slug } = c.req.valid('json')
  const id = crypto.randomUUID()

  try {
    await c.env.DB.prepare('INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)').bind(id, slug, name).run()
    return c.json({ message: 'Tag berhasil dibuat.', id })
  } catch {
    throw new HTTPException(400, { message: 'Gagal membuat tag. Slug mungkin sudah digunakan.' })
  }
})

tags.put('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'tag_write'), zValidator('json', schema), async (c) => {
  const id = c.req.param('id')
  const { name, slug } = c.req.valid('json')

  try {
    const result = await c.env.DB.prepare('UPDATE tags SET slug = ?, name = ? WHERE id = ?')
      .bind(slug, name, id).run()

    if (result.meta.changes === 0) throw new HTTPException(404, { message: 'Tag tidak ditemukan.' })
    return c.json({ message: 'Tag berhasil diperbarui.' })
  } catch (e) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(400, { message: 'Gagal memperbarui tag. Slug mungkin sudah digunakan.' })
  }
})

tags.delete('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'tag_write'), async (c) => {
  const id = c.req.param('id')
  const result = await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Tag tidak ditemukan.' })
  }
  return c.json({ message: 'Tag berhasil dihapus.' })
})

export default tags
