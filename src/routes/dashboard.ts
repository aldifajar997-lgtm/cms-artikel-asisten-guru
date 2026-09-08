import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()

dashboard.use('*', authMiddleware)

// S7: Dashboard stats membutuhkan permission check
dashboard.get('/stats', requirePermission('view_dashboard'), rateLimit(20, 60, 'dashboard_stats'), async (c) => {
  const postsCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM posts').first('count')
  const usersCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first('count')
  const mediaCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM media').first('count')

  return c.json({
    total_posts: postsCount,
    total_users: usersCount,
    total_media: mediaCount
  })
})

export default dashboard
