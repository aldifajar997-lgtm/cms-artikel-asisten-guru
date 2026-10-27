import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
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
import trendsRoutes from './routes/trends'
import earningsRoutes from './routes/earnings'
import legalRoutes, { renderLegalDocumentResponse } from './routes/legal'
import { runDailyGarbageCollector } from './utils/garbage-collector'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  const path = c.req.path.toLowerCase()
  const isLegalHtml = path === '/tos' || path === '/privacy' || path.endsWith('/html')

  if (isLegalHtml) {
    const middleware = secureHeaders({
      referrerPolicy: 'strict-origin-when-cross-origin',
      crossOriginResourcePolicy: 'cross-origin',
      xFrameOptions: 'SAMEORIGIN',
      xXssProtection: '1; mode=block',
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'self'"]
      }
    })
    return middleware(c, next)
  }

  const defaultMiddleware = secureHeaders({
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginResourcePolicy: 'cross-origin',
    xFrameOptions: 'DENY',
    xXssProtection: '1; mode=block',
    contentSecurityPolicy: {
      defaultSrc: ["'none'"]
    }
  })
  return defaultMiddleware(c, next)
})

// Middleware Global — CORS ketat: Hanya exact match dari ALLOWED_ORIGINS (Audit #2)
app.use('*', async (c, next) => {
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || 'https://asisten-guru.id,https://asisten-guru.my.id')
    .split(',').map((s: string) => s.trim().replace(/\/$/, '')).filter(Boolean)

  const corsHandler = cors({
    origin: (origin) => {
      // Jika request tanpa header Origin (misal cURL, server-to-server, cron internal), izinkan fallback domain utama
      if (!origin) return allowedOrigins[0];
      // Hanya izinkan exact match dari ALLOWED_ORIGINS (mencegah evilasisten-guru.id dan localhost.evil.com)
      if (allowedOrigins.includes(origin)) return origin;
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })

  return corsHandler(c, next)
})

// Middleware Pembatasan Ukuran Payload (Anti-DoS & Memory Exhaustion):
// - Endpoint upload berkas digital produk (/api/products/upload-file): batas 55MB (toleransi 50MB file + multipart header)
// - Endpoint media gambar (/api/media): batas 10MB
// - Endpoint upload avatar/sampul/foto kurasi (/api/users/me/*): batas 5MB
// - Seluruh endpoint API lainnya (JSON/teks): dibatasi ketat maksimal 2MB (menolak payload 50MB/10GB sebelum membebani RAM Cloudflare Worker)
app.use('/api/*', async (c, next) => {
  const path = c.req.path
  let maxSize = 2 * 1024 * 1024 // 2MB default untuk JSON / API biasa
  let errorMsg = 'Ukuran data yang dikirimkan melebihi batas maksimal sistem (Maks 2MB).'

  if (path === '/api/products/upload-file') {
    maxSize = 55 * 1024 * 1024
    errorMsg = 'Ukuran berkas melebihi batas maksimal yang diizinkan (Maks 50MB).'
  } else if (path === '/api/media') {
    maxSize = 10 * 1024 * 1024
    errorMsg = 'Ukuran berkas media melebihi batas maksimal yang diizinkan (Maks 10MB).'
  } else if (path.startsWith('/api/users/me/avatar') || path.startsWith('/api/users/me/cover') || path.startsWith('/api/users/me/sample-photos') || path.startsWith('/api/users/me/appearance')) {
    maxSize = 5 * 1024 * 1024
    errorMsg = 'Ukuran berkas gambar melebihi batas maksimal yang diizinkan (Maks 5MB).'
  }

  const limiter = bodyLimit({
    maxSize,
    onError: (ctx) => ctx.json({ error: errorMsg, message: errorMsg }, 413)
  })

  return limiter(c, next)
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
app.route('/api/trends', trendsRoutes)
app.route('/api/earnings', earningsRoutes)
app.route('/api/legal', legalRoutes)

// Rute Publik Dokumen Legal Statis (Hanya 2 Dokumen: Syarat & Ketentuan dan Kebijakan Privasi)
app.get('/tos', (c) => renderLegalDocumentResponse(c, 'seller_terms', 'tos', '/tos'))
app.get('/privacy', (c) => renderLegalDocumentResponse(c, 'seller_privacy', 'privacy', '/privacy'))

app.route('/', seoRoutes)
export default {
  fetch: app.fetch,
  scheduled: async (event: any, env: Bindings, ctx: any) => {
    ctx.waitUntil((async () => {
      // 1. Garbage Collector R2 untuk Marketplace (prefix 'products/'):
      // Dijalankan sekali sehari pada jam sepi (20:00 UTC = 03:00 WIB)
      // Menggunakan KV daily lock agar tidak dieksekusi berulang dalam interval cron 15 menitan.
      const now = new Date()
      const currentUtcHour = now.getUTCHours()
      const currentUtcMin = now.getUTCMinutes()
      const todayDateStr = now.toISOString().slice(0, 10)

      let shouldRunGc = false
      if (event?.type === 'manual') {
        shouldRunGc = true
      } else if (currentUtcHour === 20) {
        // Target: Jam 20 UTC = 03:00 WIB
        try {
          const lastRunDate = await env.KV.get('gc_marketplace_last_run_date')
          if (lastRunDate !== todayDateStr) {
            shouldRunGc = true
            // Tandai sudah berjalan hari ini (kunci kadaluarsa dalam 2 hari)
            await env.KV.put('gc_marketplace_last_run_date', todayDateStr, { expirationTtl: 172800 })
          }
        } catch {
          // Fallback jika KV sedang tidak dapat diakses: jalankan pada rentang menit 0-14
          if (currentUtcMin < 15) {
            shouldRunGc = true
          }
        }
      }

      if (shouldRunGc) {
        console.log('Menjalankan cron job harian Garbage Collector R2 (Marketplace & Artikel) jam 3 pagi WIB...')
        try {
          const report = await runDailyGarbageCollector(env, event?.type === 'manual')
          console.log(`[Scheduled GC] Selesai: Marketplace [Hapus: ${report.marketplace.deletedCount}, Lindungi: ${report.marketplace.activeCount}], Artikel [Hapus: ${report.articles.deletedCount}, Lindungi: ${report.articles.activeCount}]`)
        } catch (error) {
          console.error('Terjadi kesalahan saat menjalankan Garbage Collector R2 harian:', error)
        }
      }
      
      // 2. Trigger S2S Sync Queue di Hub (berjalan setiap interval cron)
      try {
        // S2S Token wajib menggunakan secret rahasia bersama (Audit #1)
        const s2sToken = env.S2S_INTERNAL_SECRET || ''
        if (s2sToken) {
          const res = await fetch(`${env.HUB_URL || 'https://asisten-guru.id'}/api/payment/sync-queue`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${s2sToken}` }
          });
          
          if (res.ok) {
             const result = (await res.json()) as any;
             console.log(`[S2S Queue] Status: OK, Processed: ${result.processed}, Success: ${result.success_count}`);
          } else {
             console.error(`[S2S Queue] Trigger failed with status: ${res.status}`);
          }
        } else {
          console.warn('[S2S Queue] Lewati sync-queue karena S2S_INTERNAL_SECRET belum dikonfigurasi.');
        }
      } catch (err) {
        console.error('Gagal men-trigger S2S Queue Hub:', err);
      }
    })())
  }
}
