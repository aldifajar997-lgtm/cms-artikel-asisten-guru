import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'
import xss from 'xss'

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

settings.get('/', async (c) => {
  const cacheKey = 'cache:settings_public'
  const cached = await c.env.KV.get(cacheKey, 'json')
  if (cached) {
    return c.json(cached, 200, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
    })
  }

  const list = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const PUBLIC_SETTINGS_KEYS = ['site_title', 'site_description', 'logo_url', 'contact_email', 'theme_color']
  const result: Record<string, string> = {}
  list.results.forEach((row: any) => {
    if (PUBLIC_SETTINGS_KEYS.includes(row.key)) {
      result[row.key] = row.value
    }
  })

  c.executionCtx.waitUntil(c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 }))
  return c.json(result, 200, {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
  })
})

const singleSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10000, 'Nilai pengaturan maksimal 10.000 karakter')
})

const schema = z.union([
  singleSchema,
  z.array(singleSchema).max(50, 'Maksimal 50 pengaturan sekaligus')
])

settings.put('/', authMiddleware, requirePermission('manage_settings'), rateLimit(30, 60, 'settings_write'), zValidator('json', schema), async (c) => {
  const payload = c.req.valid('json')
  const items = Array.isArray(payload) ? payload : [payload]

  const stmts = items.map(item => {
    // Strip semua HTML tags dari pengaturan (kecuali untuk custom scripts kalau didukung di masa depan, saat ini murni teks)
    const cleanValue = xss(item.value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })
    return c.env.DB.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(item.key, cleanValue)
  })

  if (stmts.length > 0) {
    await c.env.DB.batch(stmts)
  }

  c.executionCtx.waitUntil(c.env.KV.delete('cache:settings_public'))
  return c.json({ message: 'Pengaturan berhasil disimpan.' })
})

export default settings
