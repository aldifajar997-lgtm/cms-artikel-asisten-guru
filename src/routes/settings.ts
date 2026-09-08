import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'
import xss from 'xss'

const settings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET settings dibuat publik agar frontend (Hub) dapat merender konfigurasi global (Logo, Title, dll)
settings.get('/', rateLimit(500, 60, 'public_settings'), async (c) => {
  const list = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const PUBLIC_SETTINGS_KEYS = ['site_title', 'site_description', 'logo_url', 'contact_email', 'theme_color']
  const result: Record<string, string> = {}
  list.results.forEach((row: any) => {
    if (PUBLIC_SETTINGS_KEYS.includes(row.key)) {
      result[row.key] = row.value
    }
  })
  return c.json(result)
})

const singleSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string()
})

const schema = z.union([
  singleSchema,
  z.array(singleSchema)
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

  return c.json({ message: 'Pengaturan berhasil disimpan.' })
})

export default settings
