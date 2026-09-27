import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { errorHandler, notFoundHandler } from './middlewares/error-handler'
import { Bindings, Variables } from './types'

import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import postsRoutes from './routes/posts'
import mediaRoutes from './routes/media'
import categoriesRoutes from './routes/categories'
import tagsRoutes from './routes/tags'
import dashboardRoutes from './routes/dashboard'
import seoRoutes from './routes/seo'
import settingsRoutes from './routes/settings'
import productsRoutes from './routes/products'
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', secureHeaders({
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginResourcePolicy: 'cross-origin',
  xFrameOptions: 'DENY',
  xXssProtection: '1; mode=block',
  contentSecurityPolicy: {
    defaultSrc: ["'none'"]
  }
}))

// Middleware Global — CORS dari environment variable (fix H1: hapus hardcoded localhost)
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || 'https://asisten-guru.id,https://www.asisten-guru.id')
    .split(',').map((s: string) => s.trim()).filter(Boolean)

  const corsHandler = cors({
    origin: allowedOrigins,
    credentials: true
  })

  return corsHandler(c, next)
})

app.onError(errorHandler)
app.notFound(notFoundHandler)

// Routes
app.get('/api/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ status: 'ok', db: 'ok' }, 200)
  } catch {
    return c.json({ status: 'degraded', db: 'error' }, 503)
  }
})
app.route('/api/auth', authRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/posts', postsRoutes)
app.route('/api/media', mediaRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/tags', tagsRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/products', productsRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/', seoRoutes)
export default {
  fetch: app.fetch,
  scheduled: async (event: any, env: Bindings, ctx: any) => {
    ctx.waitUntil((async () => {
      console.log('Menjalankan cron job Garbage Collector R2 untuk Marketplace...');
      
      try {
        // 1. Kumpulkan semua r2 key yang AKTIF digunakan di database D1
        const res = await env.DB.prepare('SELECT file_r2_key, cover_image_key FROM products').all()
        const activeKeys = new Set<string>()
        res.results.forEach((row: any) => {
          if (row.file_r2_key) activeKeys.add(row.file_r2_key)
          if (row.cover_image_key) activeKeys.add(row.cover_image_key)
        })

        // 2. Iterasi seluruh object di R2 yang berawalan 'products/'
        let cursor: string | undefined
        let deletedCount = 0
        
        do {
          const list: any = await env.R2.list({ prefix: 'products/', cursor })
          
          for (const object of list.objects) {
            // Hapus jika file tidak terdaftar di DB DAN usianya lebih dari 24 jam (mengamankan file yang sedang diunggah)
            const isOlderThan24h = (new Date().getTime() - object.uploaded.getTime()) > 86400000
            
            if (!activeKeys.has(object.key) && isOlderThan24h) {
              await env.R2.delete(object.key)
              deletedCount++
              console.log(`[GC] Berhasil menghapus file yatim (orphan): ${object.key}`)
            }
          }
          cursor = list.truncated ? list.cursor : undefined
        } while (cursor)
        
        console.log(`Cron job selesai. Total file sampah terhapus: ${deletedCount}`)
      } catch (error) {
        console.error('Terjadi kesalahan saat menjalankan Garbage Collector R2:', error)
      }
      
      // 3. Trigger S2S Sync Queue di Hub
      try {
        console.log('Men-trigger S2S Sync Queue di Hub...');
        // env.HUB_PUBLIC_KEY digunakan sebagai otorisasi internal
        const res = await fetch(`${env.HUB_URL || 'https://asisten-guru.id'}/api/payment/sync-queue`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.HUB_PUBLIC_KEY}` }
        });
        
        if (res.ok) {
           const result = await res.json();
           console.log(`[S2S Queue] Status: OK, Processed: ${result.processed}, Success: ${result.success_count}`);
        } else {
           console.error(`[S2S Queue] Trigger failed with status: ${res.status}`);
        }
      } catch (err) {
        console.error('Gagal men-trigger S2S Queue Hub:', err);
      }
    })())
  }
}
