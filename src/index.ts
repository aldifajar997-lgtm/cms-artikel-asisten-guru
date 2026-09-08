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

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', secureHeaders({
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginResourcePolicy: 'cross-origin',
  xFrameOptions: 'DENY',
  xXssProtection: '1; mode=block',
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"]
    }
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
app.route('/api/dashboard', dashboardRoutes)
app.route('/', seoRoutes)
export default app
