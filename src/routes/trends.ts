import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware } from '../middlewares/auth'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

router.get('/suggest', authMiddleware, async (c) => {
  try {
    const keyword = c.req.query('keyword')
    if (!keyword) {
      return c.json({ keyword: '', trends: [] }, 200)
    }

    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`
    
    // Cloudflare Workers fetch cache (Cache API) to avoid spamming Google Suggest and hitting rate limit
    const cache = caches.default
    const cacheKey = new Request(url)
    let response = await cache.match(cacheKey)

    if (!response) {
      // If not in cache, fetch from Google
      const res = await fetch(url)
      
      if (!res.ok) {
        throw new Error('Gagal mengambil data dari Google Suggest API')
      }
      
      // Clone response to put in cache
      response = new Response(res.body, res)
      // Cache for 1 hour (3600 seconds) - use SET to override any existing Cache-Control like private
      response.headers.set('Cache-Control', 'public, max-age=3600')
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()))
    }

    const rawData = await response.json()
    // Google Suggest returns [ "original_query", ["suggest1", "suggest2", ...] ]
    const trends = Array.isArray(rawData) && rawData.length > 1 ? rawData[1] : []

    return c.json({
      keyword,
      trends
    })
  } catch (error) {
    console.error('Trend API Error:', error)
    // Return empty array instead of 500 error to avoid breaking the editor
    return c.json({ keyword: c.req.query('keyword') || '', trends: [] }, 200)
  }
})

export default router
