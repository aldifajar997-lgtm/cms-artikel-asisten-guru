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
  const typeFilter = c.req.query('type')

  let baseQuery = `
    SELECT c.id, c.slug, c.name, c.type, c.description, c.target_keywords, c.color, c.created_at, c.parent_id, p.name as parent_name,
           (SELECT COUNT(id) FROM posts post WHERE post.category_id = c.id AND post.status = 'published') as article_count,
           (SELECT COUNT(id) FROM products prod WHERE prod.category_id = c.id AND prod.status = 'published') as product_count
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
  `
  
  const params: any[] = []
  
  if (typeFilter && ['article', 'product'].includes(typeFilter)) {
    if (typeFilter === 'article') {
      baseQuery += ` WHERE (c.type = ? OR c.type IS NULL) `
      params.push('article')
    } else {
      baseQuery += ` WHERE c.type = ? `
      params.push(typeFilter)
    }
  }

  baseQuery += ` ORDER BY c.parent_id ASC, c.name ASC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const list = await c.env.DB.prepare(baseQuery).bind(...params).all()
  
  // Format hasil untuk mengembalikan JSON array pada target_keywords (bukan string mentah)
  const formattedResults = list.results.map((cat: any) => ({
    ...cat,
    target_keywords: cat.target_keywords ? JSON.parse(cat.target_keywords as string) : []
  }))
  
  return c.json({ data: formattedResults, limit, offset })
})

const schema = z.object({
  name: z.string().min(1).max(100).transform(cleanText),
  slug: z.string().min(1).max(100).regex(slugRegex, 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung').transform(cleanText),
  type: z.enum(['article', 'product']).default('article'),
  description: z.string().max(500).optional().transform(v => v ? cleanText(v) : v),
  target_keywords: z.array(z.string().transform(cleanText)).optional(),
  color: z.string().transform(cleanText).optional(),
  parent_id: z.string().nullable().optional()
})

categories.post('/', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), zValidator('json', schema), async (c) => {
  const { name, slug, type, description, target_keywords, color, parent_id } = c.req.valid('json')
  const id = crypto.randomUUID()

  // Validasi parent harus bertipe sama dan produk tidak boleh punya hierarki
  if (parent_id) {
    if (type === 'product') {
      throw new HTTPException(400, { message: 'Kategori produk tidak mendukung hierarki (induk harus kosong).' })
    }
    
    const parentCat = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(parent_id).first()
    if (!parentCat || parentCat.type !== type) {
      throw new HTTPException(400, { message: 'Kategori induk harus memiliki tipe yang sama.' })
    }
  }

  try {
    await c.env.DB.prepare('INSERT INTO categories (id, slug, name, type, description, target_keywords, color, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, slug, name, type, description || null, target_keywords ? JSON.stringify(target_keywords) : null, color || null, parent_id || null).run()
    return c.json({ message: 'Kategori berhasil dibuat.', id })
  } catch {
    throw new HTTPException(400, { message: 'Gagal membuat kategori. Slug mungkin sudah digunakan.' })
  }
})

categories.put('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), zValidator('json', schema), async (c) => {
  const id = c.req.param('id')
  const { name, slug, type, description, target_keywords, color, parent_id } = c.req.valid('json')

  // Cek apakah kategori ada dan ambil tipe lama
  const existing = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(id).first()
  if (!existing) throw new HTTPException(404, { message: 'Kategori tidak ditemukan.' })

  // Cegah perubahan tipe jika kategori sudah dipakai oleh konten
  if (existing.type !== type) {
    if (existing.type === 'article') {
      const usedByPosts = await c.env.DB.prepare('SELECT COUNT(id) as cnt FROM posts WHERE category_id = ?').bind(id).first()
      if (usedByPosts && (usedByPosts.cnt as number) > 0) {
        throw new HTTPException(400, { message: 'Tidak bisa mengubah tipe kategori. Kategori ini sudah digunakan oleh artikel.' })
      }
    } else if (existing.type === 'product') {
      const usedByProducts = await c.env.DB.prepare('SELECT COUNT(id) as cnt FROM products WHERE category_id = ?').bind(id).first()
      if (usedByProducts && (usedByProducts.cnt as number) > 0) {
        throw new HTTPException(400, { message: 'Tidak bisa mengubah tipe kategori. Kategori ini sudah digunakan oleh produk.' })
      }
    }
  }

  // Validasi parent harus bertipe sama, tidak sirkular, dan produk tak boleh berhierarki
  if (parent_id) {
    if (type === 'product') {
      throw new HTTPException(400, { message: 'Kategori produk tidak mendukung hierarki (induk harus kosong).' })
    }
    
    // Deep Circular Dependency Check
    let currentParent: string | null = parent_id;
    while (currentParent) {
      if (currentParent === id) {
        throw new HTTPException(400, { message: 'Kategori tidak boleh membentuk siklus (lingkaran) dengan sub-kategorinya.' })
      }
      const ancestorRow: any = await c.env.DB.prepare('SELECT parent_id FROM categories WHERE id = ?').bind(currentParent).first();
      currentParent = ancestorRow ? (ancestorRow.parent_id as string | null) : null;
    }
    
    const parentCat = await c.env.DB.prepare('SELECT type FROM categories WHERE id = ?').bind(parent_id).first()
    if (!parentCat || parentCat.type !== type) {
      throw new HTTPException(400, { message: 'Kategori induk harus memiliki tipe yang sama.' })
    }
  }

  try {
    const result = await c.env.DB.prepare('UPDATE categories SET slug = ?, name = ?, type = ?, description = ?, target_keywords = ?, color = ?, parent_id = ? WHERE id = ?')
      .bind(slug, name, type, description || null, target_keywords ? JSON.stringify(target_keywords) : null, color || null, parent_id || null, id).run()

    if (result.meta.changes === 0) throw new HTTPException(404, { message: 'Kategori tidak ditemukan.' })
    return c.json({ message: 'Kategori berhasil diperbarui.' })
  } catch (e) {
    if (e instanceof HTTPException) throw e
    throw new HTTPException(400, { message: 'Gagal memperbarui kategori. Slug mungkin sudah digunakan.' })
  }
})

categories.delete('/:id', authMiddleware, requirePermission('manage_taxonomy'), rateLimit(30, 60, 'category_write'), async (c) => {
  const id = c.req.param('id')
  
  // Hapus referensi di sub-kategori, posts, dan products sebelum delete
  // Mencegah Orphan Reference Bug (D1/SQLite FK tidak selalu aktif)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').bind(id),
    c.env.DB.prepare('UPDATE posts SET category_id = NULL WHERE category_id = ?').bind(id),
    c.env.DB.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').bind(id),
  ])

  const result = await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Kategori tidak ditemukan.' })
  }
  return c.json({ message: 'Kategori berhasil dihapus.' })
})

export default categories
