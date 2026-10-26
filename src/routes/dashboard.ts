import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'
import { getTrafficSourceMeta } from '../utils/traffic-parser'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()

dashboard.use('*', authMiddleware)

function formatPaymentMethodName(method?: string | null): string {
  const m = (method || '').toLowerCase().trim()
  if (!m || m === 'other') return 'Online Payment'
  if (m === 'qris') return 'QRIS'
  if (m.includes('bca')) return 'BCA Virtual Account'
  if (m.includes('bni')) return 'BNI Virtual Account'
  if (m.includes('bri')) return 'BRI Virtual Account'
  if (m.includes('mandiri')) return 'Mandiri Bill'
  if (m.includes('permata')) return 'Permata VA'
  if (m.endsWith('_va') || m.includes('va')) return 'Virtual Account'
  if (m === 'gopay') return 'GoPay'
  if (m === 'shopeepay') return 'ShopeePay'
  if (m === 'wallet') return 'Saldo Akun'
  if (m === 'credit_card') return 'Kartu Kredit'
  if (m === 'cstore' || m.includes('indomaret') || m.includes('alfamart')) return 'Gerai Ritel'
  return m.toUpperCase()
}

function getPeriodConfig(periodQuery?: string) {
  const period = (periodQuery || '6m').toLowerCase().trim()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const now = new Date()

  if (period === '7d') {
    const timeline: { period: string; name: string }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const p = `${yyyy}-${mm}-${dd}`
      const name = `${dayNames[d.getDay()]} ${d.getDate()}`
      timeline.push({ period: p, name })
    }
    const startDate = `${timeline[0].period} 00:00:00`
    return {
      period: '7d',
      timeline,
      startDate,
      timeFormat: '%Y-%m-%d'
    }
  }

  if (period === '30d') {
    const timeline: { period: string; name: string }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const p = `${yyyy}-${mm}-${dd}`
      const name = `${d.getDate()} ${monthNames[d.getMonth()]}`
      timeline.push({ period: p, name })
    }
    const startDate = `${timeline[0].period} 00:00:00`
    return {
      period: '30d',
      timeline,
      startDate,
      timeFormat: '%Y-%m-%d'
    }
  }

  if (period === 'this_month') {
    const timeline: { period: string; name: string }[] = []
    const daysInMonth = now.getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const p = `${yyyy}-${mm}-${dd}`
      const name = `${day} ${monthNames[d.getMonth()]}`
      timeline.push({ period: p, name })
    }
    const startDate = `${timeline[0].period} 00:00:00`
    return {
      period: 'this_month',
      timeline,
      startDate,
      timeFormat: '%Y-%m-%d'
    }
  }

  if (period === 'all') {
    const timeline: { period: string; name: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const p = `${year}-${month}`
      const name = `${monthNames[d.getMonth()]} ${String(year).slice(-2)}`
      timeline.push({ period: p, name })
    }
    return {
      period: 'all',
      timeline,
      startDate: null,
      timeFormat: '%Y-%m'
    }
  }

  // Default: 6m
  const timeline: { period: string; name: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const p = `${year}-${month}`
    const name = `${monthNames[d.getMonth()]} ${String(year).slice(-2)}`
    timeline.push({ period: p, name })
  }
  const startDate = `${timeline[0].period}-01 00:00:00`
  return {
    period: '6m',
    timeline,
    startDate,
    timeFormat: '%Y-%m'
  }
}

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

// Endpoint analitik komprehensif riil untuk Skema Artikel & Skema Produk (Mendukung Multi-Period)
dashboard.get('/analytics', requirePermission('view_dashboard'), rateLimit(30, 60, 'dashboard_analytics'), async (c) => {
  try {
    const user = c.get('user')
    const periodParam = c.req.query('period')
    const periodConfig = getPeriodConfig(periodParam)

    const isSuperAdmin = user.role === 'super_admin'
    const canEditAnyPost = isSuperAdmin || (user.permissions || []).includes('edit_any_post')
    const canEditAnyProduct = isSuperAdmin || (user.permissions || []).includes('edit_any_product')

    const postFilter = canEditAnyPost ? '' : ' WHERE author_id = ?'
    const postParams = canEditAnyPost ? [] : [user.id]

    const productFilter = canEditAnyProduct ? '' : ' WHERE author_id = ?'
    const productParams = canEditAnyProduct ? [] : [user.id]

    // Filter Penjualan Dasar
    const salesFilter = isSuperAdmin ? " WHERE status = 'settled'" : " WHERE status = 'settled' AND seller_id = ?"
    const salesParams = isSuperAdmin ? [] : [user.id]

    // Filter Penjualan Berdasarkan Periode Waktu
    let salesFilterWithDate = salesFilter
    const salesParamsWithDate = [...salesParams]
    if (periodConfig.startDate) {
      salesFilterWithDate += ' AND paid_at >= ?'
      salesParamsWithDate.push(periodConfig.startDate)
    }

  // 1. Statistik Riil Artikel
  const postStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_articles,
      COALESCE(SUM(word_count), 0) as total_words,
      COALESCE(ROUND(AVG(seo_score)), 0) as avg_score,
      COALESCE(ROUND(AVG(geo_score)), 0) as avg_geo_score,
      COALESCE(SUM(view_count), 0) as total_views,
      COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) as published_count,
      COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as draft_count
    FROM posts
    ${postFilter}
  `)
  const articleStats = postParams.length > 0 ? await postStmt.bind(...postParams).first<any>() : await postStmt.first<any>()

  // 2. Tren Bulanan Artikel (Publikasi & Tayangan)
  const postTrendStmt = c.env.DB.prepare(`
    SELECT 
      strftime('%Y-%m', COALESCE(published_at, created_at)) as period,
      COUNT(*) as count,
      COALESCE(SUM(view_count), 0) as views
    FROM posts
    ${postFilter}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 12
  `)
  const articleTrendRaw = postParams.length > 0 ? await postTrendStmt.bind(...postParams).all<any>() : await postTrendStmt.all<any>()

  // 3. Top 5 Artikel Paling Populer (Berdasarkan Tayangan)
  const topPostsStmt = c.env.DB.prepare(`
    SELECT id, title, slug, view_count, word_count, seo_score, geo_score, status, published_at
    FROM posts
    ${postFilter}
    ORDER BY view_count DESC, created_at DESC
    LIMIT 5
  `)
  const topArticles = postParams.length > 0 ? await topPostsStmt.bind(...postParams).all<any>() : await topPostsStmt.all<any>()

  // 4. Statistik Riil Produk (Katalog Keseluruhan)
  const prodStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_products,
      COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) as published_count,
      COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as draft_count,
      COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) as archived_count,
      COALESCE(SUM(view_count), 0) as total_views,
      COALESCE(SUM(sales_count), 0) as total_sales,
      COALESCE(ROUND(AVG(price)), 0) as avg_price
    FROM products
    ${productFilter}
  `)
  const productStats = productParams.length > 0 ? await prodStmt.bind(...productParams).first<any>() : await prodStmt.first<any>()

  // 4b. Rating & Total Ulasan Produk
  const ratingStmt = c.env.DB.prepare(`
    SELECT 
      COALESCE(ROUND(AVG(average_rating), 1), 0) as store_rating,
      COALESCE(SUM(total_reviews), 0) as total_reviews
    FROM products
    ${productFilter ? productFilter + " AND status = 'published'" : " WHERE status = 'published'"}
  `)
  const ratingStats = productParams.length > 0 ? await ratingStmt.bind(...productParams).first<any>() : await ratingStmt.first<any>()
  const storeRating = Number(ratingStats?.store_rating) || 0
  const totalReviews = Number(ratingStats?.total_reviews) || 0

  // 5. Saldo & Pendapatan Penjualan Produk Riil (Sepanjang Waktu / Dompet Aktif)
  const earningsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_transactions,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COALESCE(SUM(admin_fee_amount), 0) as total_admin_fee,
      COALESCE(SUM(seller_net_amount), 0) as total_net,
      COALESCE(SUM(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now')) 
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved')) 
        THEN seller_net_amount ELSE 0 END), 0) as pending_payout,
      COALESCE(SUM(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND (datetime('now') < datetime(COALESCE(hold_until, 'now')) OR dispute_status IN ('complained', 'under_review')) 
        THEN seller_net_amount ELSE 0 END), 0) as holding_payout,
      COALESCE(SUM(CASE WHEN payout_status = 'transferred' THEN seller_net_amount ELSE 0 END), 0) as paid_out
    FROM sale_transactions
    ${salesFilter}
  `)
  const productEarnings = salesParams.length > 0 ? await earningsStmt.bind(...salesParams).first<any>() : await earningsStmt.first<any>()

  // 5b. Pendapatan Penjualan Sesuai Periode Waktu Terpilih (Period Specific)
  const periodEarningsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_transactions,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COALESCE(SUM(admin_fee_amount), 0) as total_admin_fee,
      COALESCE(SUM(seller_net_amount), 0) as total_net
    FROM sale_transactions
    ${salesFilterWithDate}
  `)
  const periodEarnings = salesParamsWithDate.length > 0 
    ? await periodEarningsStmt.bind(...salesParamsWithDate).first<any>() 
    : await periodEarningsStmt.first<any>()

  // 6. Tren Penjualan & Pendapatan Produk Berdasarkan Periode Terpilih
  const salesTrendStmt = c.env.DB.prepare(`
    SELECT 
      strftime('${periodConfig.timeFormat}', paid_at) as period,
      COUNT(*) as sales,
      COALESCE(SUM(gross_amount), 0) as gross,
      COALESCE(SUM(seller_net_amount), 0) as earnings
    FROM sale_transactions
    ${salesFilterWithDate}
    GROUP BY period
    ORDER BY period ASC
  `)
  const salesTrendRaw = salesParamsWithDate.length > 0 ? await salesTrendStmt.bind(...salesParamsWithDate).all<any>() : await salesTrendStmt.all<any>()

  // 6b. Distribusi Metode Pembayaran Pembeli Sesuai Periode
  const paymentStmt = c.env.DB.prepare(`
    SELECT 
      COALESCE(payment_method, 'other') as method,
      COUNT(*) as count,
      COALESCE(SUM(gross_amount), 0) as gross,
      COALESCE(SUM(seller_net_amount), 0) as net
    FROM sale_transactions
    ${salesFilterWithDate}
    GROUP BY method
    ORDER BY count DESC
  `)
  const paymentRaw = salesParamsWithDate.length > 0 ? await paymentStmt.bind(...salesParamsWithDate).all<any>() : await paymentStmt.all<any>()

  const totalPeriodSales = Number(periodEarnings?.total_transactions) || 0
  const totalPeriodGross = Number(periodEarnings?.total_gross) || 0
  const totalPeriodNet = Number(periodEarnings?.total_net) || 0
  const aov = totalPeriodSales > 0 ? Math.round(totalPeriodGross / totalPeriodSales) : 0

  const totalPaymentsCount = (paymentRaw.results || []).reduce((acc: number, r: any) => acc + (Number(r.count) || 0), 0)
  const paymentDistribution = (paymentRaw.results || []).map((r: any) => {
    const count = Number(r.count) || 0
    const gross = Number(r.gross) || 0
    const net = Number(r.net) || 0
    const pct = totalPaymentsCount > 0 ? Number(((count / totalPaymentsCount) * 100).toFixed(1)) : 0
    return {
      method: r.method,
      name: formatPaymentMethodName(r.method),
      count,
      gross,
      net,
      percentage: pct
    }
  })

  // 7. Top 5 Produk Unggulan (Berdasarkan Penjualan & Tayangan)
  const topProdStmt = c.env.DB.prepare(`
    SELECT id, title, slug, price, original_price, status, view_count, sales_count, created_at
    FROM products
    ${productFilter}
    ORDER BY sales_count DESC, view_count DESC
    LIMIT 5
  `)
  const topProducts = productParams.length > 0 ? await topProdStmt.bind(...productParams).all<any>() : await topProdStmt.all<any>()

  // Pemetaan timeline kontinu agar grafik konsisten
  const articleTrendMap = new Map<string, { count: number; views: number }>()
  for (const row of (articleTrendRaw.results || [])) {
    if (row.period) {
      articleTrendMap.set(row.period, { count: Number(row.count) || 0, views: Number(row.views) || 0 })
    }
  }

  const salesTrendMap = new Map<string, { sales: number; earnings: number; gross: number }>()
  for (const row of (salesTrendRaw.results || [])) {
    if (row.period) {
      salesTrendMap.set(row.period, {
        sales: Number(row.sales) || 0,
        earnings: Number(row.earnings) || 0,
        gross: Number(row.gross) || 0
      })
    }
  }

  const articleTrend = periodConfig.timeline.map(m => {
    const data = articleTrendMap.get(m.period) || { count: 0, views: 0 }
    return {
      period: m.period,
      name: m.name,
      count: data.count,
      views: data.views
    }
  })

  const productTrend = periodConfig.timeline.map(m => {
    const data = salesTrendMap.get(m.period) || { sales: 0, earnings: 0, gross: 0 }
    return {
      period: m.period,
      name: m.name,
      sales: data.sales,
      earnings: data.earnings,
      gross: data.gross
    }
  })

  const totalArticles = Number(articleStats?.total_articles) || 0
  const publishedArticles = Number(articleStats?.published_count) || 0
  const draftArticles = Number(articleStats?.draft_count) || 0
  const totalArticleWords = Number(articleStats?.total_words) || 0
  const totalArticleViews = Number(articleStats?.total_views) || 0
  const avgArticleScore = Number(articleStats?.avg_score) || 0
  const avgGeoScore = Number(articleStats?.avg_geo_score) || 0
  const avgWords = totalArticles > 0 ? Math.round(totalArticleWords / totalArticles) : 0

  const totalProducts = Number(productStats?.total_products) || 0
  const publishedProducts = Number(productStats?.published_count) || 0
  const draftProducts = Number(productStats?.draft_count) || 0
  const archivedProducts = Number(productStats?.archived_count) || 0
  const totalProductViews = Number(productStats?.total_views) || 0
  const totalSales = Math.max(Number(productStats?.total_sales) || 0, Number(productEarnings?.total_transactions) || 0)
  const totalGrossRevenue = Number(productEarnings?.total_gross) || 0
  const totalNetRevenue = Number(productEarnings?.total_net) || 0
  const avgPrice = Number(productStats?.avg_price) || 0

  // Identifikasi peran pengguna untuk data khusus (Role-Tailored Executive Views)
  const userRoleStr = (user.role || '').toLowerCase()
  const userPerms = user.permissions || []
  const isAdminRole = isSuperAdmin || userRoleStr.includes('admin')
  const isEditorRole = isAdminRole || userRoleStr.includes('editor') || userPerms.includes('edit_any_post')
  const isSellerRole = isAdminRole || userRoleStr.includes('seller') || userPerms.includes('create_product')
  const isWriterRole = isAdminRole || isEditorRole || userRoleStr.includes('writer') || userPerms.includes('create_post')

  // A. Data Khusus Super Admin / Manajemen (Executive Cockpit)
  let executiveMetrics = null
  if (isAdminRole) {
    const platformStats = await c.env.DB.prepare(`
      SELECT 
        COALESCE(SUM(gross_amount), 0) as total_gross_gmv,
        COALESCE(SUM(admin_fee_amount), 0) as total_platform_fee_collected,
        COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN seller_net_amount ELSE 0 END), 0) as total_pending_seller_payout
      FROM sale_transactions
      WHERE status = 'settled'
    `).first<any>()

    const userCount = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE is_active = 1`).first<any>()
    const mediaCount = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM media`).first<any>()
    const authorCount = await c.env.DB.prepare(`SELECT COUNT(DISTINCT author_id) as count FROM posts`).first<any>()
    const sellerCount = await c.env.DB.prepare(`SELECT COUNT(DISTINCT author_id) as count FROM products`).first<any>()

    executiveMetrics = {
      total_gross_gmv: Number(platformStats?.total_gross_gmv) || 0,
      total_platform_fee_collected: Number(platformStats?.total_platform_fee_collected) || 0,
      total_pending_seller_payout: Number(platformStats?.total_pending_seller_payout) || 0,
      active_authors_count: Number(authorCount?.count) || 0,
      active_sellers_count: Number(sellerCount?.count) || 0,
      total_users_count: Number(userCount?.count) || 0,
      total_media_count: Number(mediaCount?.count) || 0,
      sync_queue_status: 'healthy'
    }
  }

  // B. Data Khusus Editor / Redaktur (Editorial Desk & Leaderboard)
  let editorialDesk = null
  if (isEditorRole) {
    const pendingReviewQueue = await c.env.DB.prepare(`
      SELECT 
        p.id, p.title, p.slug, p.word_count, p.seo_score, p.geo_score, p.updated_at,
        u.name as author_name, u.avatar_url as author_avatar_url
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'draft'
      ORDER BY p.updated_at DESC
      LIMIT 5
    `).all<any>()

    const authorLeaderboard = await c.env.DB.prepare(`
      SELECT 
        u.id as author_id, u.name as author_name, u.avatar_url,
        COUNT(p.id) as published_count,
        COALESCE(SUM(p.word_count), 0) as total_words,
        COALESCE(ROUND(AVG(p.seo_score)), 0) as avg_seo_score
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY published_count DESC, total_words DESC
      LIMIT 5
    `).all<any>()

    const pendingDraftsCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM posts WHERE status = 'draft'
    `).first<any>()

    editorialDesk = {
      pending_drafts_count: Number(pendingDraftsCount?.count) || 0,
      pending_review_queue: pendingReviewQueue.results || [],
      author_leaderboard: authorLeaderboard.results || []
    }
  }

  // C. Data Khusus Penulis / Kreator Konten (Creator Studio & Target Bulanan)
  let creatorGoals = null
  if (isWriterRole && user.id !== 'super_admin') {
    const userGoalRecord = await c.env.DB.prepare(`
      SELECT monthly_article_goal, monthly_word_goal, target_min_words
      FROM users WHERE id = ?
    `).bind(user.id).first<any>()

    const currentMonthStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as month_articles,
        COALESCE(SUM(word_count), 0) as month_words
      FROM posts
      WHERE author_id = ? 
        AND status = 'published'
        AND strftime('%Y-%m', COALESCE(published_at, created_at)) = strftime('%Y-%m', 'now')
    `).bind(user.id).first<any>()

    const monthlyArticleGoal = Number(userGoalRecord?.monthly_article_goal) || 10
    const monthlyWordGoal = Number(userGoalRecord?.monthly_word_goal) || 12000
    const articlesPublishedThisMonth = Number(currentMonthStats?.month_articles) || 0
    const wordsWrittenThisMonth = Number(currentMonthStats?.month_words) || 0

    creatorGoals = {
      monthly_article_goal: monthlyArticleGoal,
      articles_published_this_month: articlesPublishedThisMonth,
      article_goal_percentage: Math.min(100, Math.round((articlesPublishedThisMonth / Math.max(1, monthlyArticleGoal)) * 100)),
      monthly_word_goal: monthlyWordGoal,
      words_written_this_month: wordsWrittenThisMonth,
      word_goal_percentage: Math.min(100, Math.round((wordsWrittenThisMonth / Math.max(1, monthlyWordGoal)) * 100)),
      target_min_words: Number(userGoalRecord?.target_min_words) || 1200
    }
  }

  // 8. Statistik Trafik Pengunjung Toko & Produk (Atomic D1 Data)
  let trafficData = {
    total_views: 0,
    store_views: 0,
    product_views: 0,
    checkout_intents: 0,
    sources: [] as { source: string; name: string; count: number; percentage: number; color: string }[],
    devices: [] as { device_type: string; name: string; count: number; percentage: number }[]
  }

  try {
    let trafficDateFilter = ''
    const trafficParams: any[] = []
    if (!isSuperAdmin) {
      trafficDateFilter = ' WHERE seller_id = ?'
      trafficParams.push(user.id)
    }
    if (periodConfig.startDate) {
      trafficDateFilter += (trafficDateFilter ? ' AND' : ' WHERE') + ' date >= ?'
      trafficParams.push(periodConfig.startDate.slice(0, 10))
    }

    const eventStmt = c.env.DB.prepare(`
      SELECT event_type, COALESCE(SUM(count), 0) as total
      FROM store_daily_analytics
      ${trafficDateFilter}
      GROUP BY event_type
    `)
    const eventRes = trafficParams.length > 0 ? await eventStmt.bind(...trafficParams).all<any>() : await eventStmt.all<any>()
    for (const row of (eventRes.results || [])) {
      const val = Number(row.total) || 0
      if (row.event_type === 'store_view') trafficData.store_views = val
      if (row.event_type === 'product_view') trafficData.product_views = val
      if (row.event_type === 'checkout_intent') trafficData.checkout_intents = val
    }
    trafficData.total_views = trafficData.store_views + trafficData.product_views

    const sourceStmt = c.env.DB.prepare(`
      SELECT source, COALESCE(SUM(count), 0) as total
      FROM store_daily_analytics
      ${trafficDateFilter}
      GROUP BY source
      ORDER BY total DESC
    `)
    const sourceRes = trafficParams.length > 0 ? await sourceStmt.bind(...trafficParams).all<any>() : await sourceStmt.all<any>()
    const totalSourceCount = (sourceRes.results || []).reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0)
    trafficData.sources = (sourceRes.results || []).map((r: any) => {
      const count = Number(r.total) || 0
      const meta = getTrafficSourceMeta(r.source)
      return {
        source: r.source,
        name: meta.label,
        count,
        color: meta.color,
        percentage: totalSourceCount > 0 ? Number(((count / totalSourceCount) * 100).toFixed(1)) : 0
      }
    })

    const deviceStmt = c.env.DB.prepare(`
      SELECT device_type, COALESCE(SUM(count), 0) as total
      FROM store_daily_analytics
      ${trafficDateFilter}
      GROUP BY device_type
      ORDER BY total DESC
    `)
    const deviceRes = trafficParams.length > 0 ? await deviceStmt.bind(...trafficParams).all<any>() : await deviceStmt.all<any>()
    const totalDeviceCount = (deviceRes.results || []).reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0)
    trafficData.devices = (deviceRes.results || []).map((r: any) => {
      const count = Number(r.total) || 0
      const label = r.device_type === 'mobile' ? 'Smartphone (Mobile)' : (r.device_type === 'desktop' ? 'Laptop / PC (Desktop)' : 'Tablet')
      return {
        device_type: r.device_type,
        name: label,
        count,
        percentage: totalDeviceCount > 0 ? Number(((count / totalDeviceCount) * 100).toFixed(1)) : 0
      }
    })
  } catch (tErr) {
    console.warn('[Dashboard Traffic Query Warning]:', tErr)
  }

  // D. Data Khusus Seller (Merchant Center) - Menggunakan data periode akurat
  let sellerMetrics = null
  if (isSellerRole) {
    const periodViews = trafficData.total_views > 0 
      ? trafficData.total_views 
      : (periodConfig.period === 'all' ? (Number(productStats?.total_views) || 0) : 0)
    const sales = totalPeriodSales
    const conversionRate = periodViews > 0 
      ? Number(((sales / periodViews) * 100).toFixed(1)) 
      : (sales > 0 ? 100 : 0)
    const pendingPayout = Number(productEarnings?.pending_payout) || 0

    sellerMetrics = {
      conversion_rate: conversionRate,
      pending_payout: pendingPayout,
      is_withdrawal_eligible: pendingPayout >= 10000,
      total_sales: sales,
      total_views: periodViews > 0 ? periodViews : (Number(productStats?.total_views) || 0),
      aov: aov,
      store_rating: storeRating,
      total_reviews: totalReviews,
      selected_period: periodConfig.period,
      payment_methods: paymentDistribution
    }
  }

  // --- Fase 3: Kalkulasi Corong Konversi Belanja (Conversion Funnel) ---
  const effectiveStoreViews = trafficData.store_views
  const effectiveProductViews = trafficData.product_views > 0
    ? trafficData.product_views
    : (periodConfig.period === 'all' ? (Number(productStats?.total_views) || 0) : 0)
  const effectiveCheckoutIntents = trafficData.checkout_intents
  const effectiveCompletedSales = sellerMetrics?.total_sales ?? 0
  const totalImpressions = Math.max(effectiveStoreViews + effectiveProductViews, effectiveCompletedSales)

  const step1Count = Math.max(totalImpressions, effectiveStoreViews, effectiveProductViews)
  const step2Count = effectiveProductViews
  const step3Count = effectiveCheckoutIntents
  const step4Count = effectiveCompletedSales

  const funnelData = {
    total_impressions: totalImpressions,
    store_views: effectiveStoreViews,
    product_views: effectiveProductViews,
    checkout_intents: effectiveCheckoutIntents,
    completed_sales: effectiveCompletedSales,
    overall_cvr: totalImpressions > 0 ? Number(((effectiveCompletedSales / totalImpressions) * 100).toFixed(1)) : 0,
    steps: [
      {
        key: 'store_view',
        name: 'Total Kunjungan Toko & Modul',
        count: step1Count,
        step_conversion_rate: 100,
        overall_conversion_rate: 100,
        color: '#0D5B52'
      },
      {
        key: 'product_view',
        name: 'Melihat Detail Produk',
        count: step2Count,
        step_conversion_rate: step1Count > 0 ? Number(((step2Count / step1Count) * 100).toFixed(1)) : 0,
        overall_conversion_rate: step1Count > 0 ? Number(((step2Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#0284c7'
      },
      {
        key: 'checkout_intent',
        name: 'Klik Pesan / Beli',
        count: step3Count,
        step_conversion_rate: step2Count > 0 ? Number(((step3Count / step2Count) * 100).toFixed(1)) : 0,
        overall_conversion_rate: step1Count > 0 ? Number(((step3Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#d97706'
      },
      {
        key: 'completed_sale',
        name: 'Pembayaran Sukses',
        count: step4Count,
        step_conversion_rate: step3Count > 0 ? Number(((step4Count / step3Count) * 100).toFixed(1)) : (step2Count > 0 ? Number(((step4Count / step2Count) * 100).toFixed(1)) : 0),
        overall_conversion_rate: step1Count > 0 ? Number(((step4Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#059669'
      }
    ]
  }

  // --- Fase 3: Mesin Rekomendasi Cerdas Mitra (Smart Actionable Insights) ---
  const actionableInsights: any[] = []

  // 1. Deteksi Produk Populer Belum Terbeli
  const highViewLowSaleProduct = (topProducts.results || []).find((p: any) => {
    const views = Number(p.view_count) || 0
    const sales = Number(p.sales_count) || 0
    return views >= 15 && sales === 0
  })
  if (highViewLowSaleProduct) {
    actionableInsights.push({
      id: 'high-views-low-sales',
      category: 'conversion',
      type: 'warning',
      title: `Peluang Konversi: "${highViewLowSaleProduct.title.slice(0, 32)}..."`,
      message: `Produk ini telah dilihat ${highViewLowSaleProduct.view_count} kali namun belum ada transaksi. Coba perbarui sampel materi ajar gratis atau sediakan harga promo pengenalan.`,
      metric_highlight: `${highViewLowSaleProduct.view_count} tayangan • 0 terjual`,
      action_label: 'Kelola Produk',
      action_type: 'navigate_products'
    })
  }

  // 2. Deteksi Dominasi Jalur WhatsApp
  const waSource = (trafficData.sources || []).find((s: any) => s.source === 'whatsapp')
  if (waSource && waSource.percentage >= 25 && waSource.count > 0) {
    actionableInsights.push({
      id: 'whatsapp-primary-channel',
      category: 'traffic',
      type: 'success',
      title: 'WhatsApp Adalah Jalur Pembeli Terkuat Anda',
      message: `${waSource.percentage}% kunjungan toko berasal dari chat/grup WhatsApp. Waktu paling responsif membagikan modul baru adalah saat jam istirahat guru (12.00 - 13.00) dan petang (17.00 - 19.30).`,
      metric_highlight: `${waSource.percentage}% trafik WhatsApp`,
      action_label: 'Bagikan Tautan Toko',
      action_type: 'share_wa'
    })
  }

  // 3. Deteksi Dominasi Smartphone (Mobile First)
  const mobileDevice = (trafficData.devices || []).find((d: any) => d.device_type === 'mobile')
  if (mobileDevice && mobileDevice.percentage >= 60 && mobileDevice.count > 0) {
    actionableInsights.push({
      id: 'mobile-first-experience',
      category: 'traffic',
      type: 'info',
      title: 'Mayoritas Pembeli Membuka Toko via Smartphone',
      message: `${mobileDevice.percentage}% pembeli mengakses toko Anda lewat ponsel cerdas. Pastikan gambar sampul beresolusi jelas dengan teks judul yang besar dan mudah dibaca di layar HP.`,
      metric_highlight: `${mobileDevice.percentage}% pengguna Mobile`,
      action_label: undefined,
      action_type: 'none'
    })
  }

  // 4. Deteksi Kesehatan Katalog Produk
  if (publishedProducts < 3) {
    actionableInsights.push({
      id: 'expand-catalog',
      category: 'catalog',
      type: 'tip',
      title: 'Perbanyak Variasi Produk di Etalase Anda',
      message: `Etalase Anda saat ini memiliki ${publishedProducts} produk aktif. Mitra kreator dengan minimal 3 - 5 modul ajar tematik memiliki peluang penjualan 3x lebih tinggi.`,
      metric_highlight: `${publishedProducts} produk aktif`,
      action_label: 'Tambah Produk Baru',
      action_type: 'navigate_new_product'
    })
  } else {
    actionableInsights.push({
      id: 'solid-catalog',
      category: 'catalog',
      type: 'success',
      title: 'Etalase Katalog Anda Sangat Produktif',
      message: `Anda memiliki ${publishedProducts} modul digital aktif. Konsistensi menambah modul sesuai kalender akademik membantu pembeli setia melakukan repeat order.`,
      metric_highlight: `${publishedProducts} modul aktif`,
      action_label: 'Kelola Katalog',
      action_type: 'navigate_products'
    })
  }

  // 5. Reputasi Ulasan & Rating Toko
  if (storeRating >= 4.5 && totalReviews > 0) {
    actionableInsights.push({
      id: 'excellent-reputation',
      category: 'rating',
      type: 'success',
      title: `Reputasi Toko Sangat Memuaskan (⭐ ${storeRating.toFixed(1)})`,
      message: `Pembeli memberikan feedback sangat positif dari total ${totalReviews} ulasan terverifikasi. Terus pertahankan kecepatan respon bantuan file kepada pembeli.`,
      metric_highlight: `⭐ ${storeRating.toFixed(1)} / 5.0 (${totalReviews} ulasan)`,
      action_label: undefined,
      action_type: 'none'
    })
  }

  return c.json({
    status: 'success',
    data: {
      role_profile: {
        is_super_admin: isSuperAdmin,
        is_admin: isAdminRole,
        is_editor: isEditorRole,
        is_seller: isSellerRole,
        is_writer: isWriterRole,
        primary_role: isSuperAdmin ? 'super_admin' : (isAdminRole ? 'admin' : (isEditorRole ? 'editor' : (isSellerRole && !isWriterRole ? 'seller' : 'writer')))
      },
      executive_metrics: executiveMetrics,
      editorial_desk: editorialDesk,
      creator_goals: creatorGoals,
      seller_metrics: sellerMetrics,
      traffic: trafficData,
      funnel: funnelData,
      insights: actionableInsights,
      articles: {
        total_articles: totalArticles,
        published_count: publishedArticles,
        draft_count: draftArticles,
        total_words: totalArticleWords,
        avg_words: avgWords,
        avg_score: avgArticleScore,
        avg_geo_score: avgGeoScore,
        total_views: totalArticleViews,
        status_distribution: [
          { name: 'Terpublikasi', value: publishedArticles, color: '#0d9488' },
          { name: 'Draf', value: draftArticles, color: '#94a3b8' }
        ],
        trend: articleTrend,
        top_articles: topArticles.results || []
      },
      products: {
        total_products: totalProducts,
        published_count: publishedProducts,
        draft_count: draftProducts,
        archived_count: archivedProducts,
        total_views: totalProductViews,
        total_sales: totalPeriodSales,
        lifetime_sales: Math.max(Number(productStats?.total_sales) || 0, Number(productEarnings?.total_transactions) || 0),
        avg_price: avgPrice,
        aov: aov,
        store_rating: storeRating,
        total_reviews: totalReviews,
        total_gross_revenue: totalPeriodGross,
        total_net_revenue: totalPeriodNet,
        lifetime_gross_revenue: Number(productEarnings?.total_gross) || 0,
        lifetime_net_revenue: Number(productEarnings?.total_net) || 0,
        pending_payout: Number(productEarnings?.pending_payout) || 0,
        paid_out: Number(productEarnings?.paid_out) || 0,
        status_distribution: [
          { name: 'Terpublikasi', value: publishedProducts, color: '#10b981' },
          { name: 'Draf', value: draftProducts, color: '#f59e0b' },
          { name: 'Diarsipkan', value: archivedProducts, color: '#94a3b8' }
        ],
        trend: productTrend,
        top_products: topProducts.results || [],
        payment_methods: paymentDistribution,
        selected_period: periodConfig.period
      },
      overview: {
        total_content: totalArticles + totalProducts,
        total_views: totalArticleViews + totalProductViews,
        total_sales: totalSales,
        total_earnings: totalNetRevenue
      }
    }
  })
  } catch (error) {
    console.error('[Dashboard Analytics Error]:', error)
    return c.json({ error: 'Gagal memuat data analitik dashboard. Silakan coba beberapa saat lagi.' }, 500)
  }
})

// Endpoint Khusus Agregasi Trafik & Sumber Kunjungan (Protected)
dashboard.get('/analytics/traffic', requirePermission('view_dashboard'), rateLimit(30, 60, 'dashboard_traffic'), async (c) => {
  try {
    const user = c.get('user')
    const isSuperAdmin = user.role === 'super_admin'
    const periodParam = c.req.query('period')
    const periodConfig = getPeriodConfig(periodParam)

    let trafficDateFilter = ''
    const trafficParams: any[] = []
    if (!isSuperAdmin) {
      trafficDateFilter = ' WHERE seller_id = ?'
      trafficParams.push(user.id)
    }
    if (periodConfig.startDate) {
      trafficDateFilter += (trafficDateFilter ? ' AND' : ' WHERE') + ' date >= ?'
      trafficParams.push(periodConfig.startDate.slice(0, 10))
    }

    const [eventsRes, sourcesRes, devicesRes] = await Promise.all([
      (trafficParams.length > 0 
        ? c.env.DB.prepare(`SELECT event_type, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY event_type`).bind(...trafficParams) 
        : c.env.DB.prepare(`SELECT event_type, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY event_type`)).all<any>(),
      (trafficParams.length > 0 
        ? c.env.DB.prepare(`SELECT source, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY source ORDER BY total DESC`).bind(...trafficParams) 
        : c.env.DB.prepare(`SELECT source, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY source ORDER BY total DESC`)).all<any>(),
      (trafficParams.length > 0 
        ? c.env.DB.prepare(`SELECT device_type, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY device_type ORDER BY total DESC`).bind(...trafficParams) 
        : c.env.DB.prepare(`SELECT device_type, COALESCE(SUM(count), 0) as total FROM store_daily_analytics ${trafficDateFilter} GROUP BY device_type ORDER BY total DESC`)).all<any>()
    ])

    let storeViews = 0
    let productViews = 0
    let checkoutIntents = 0
    for (const r of (eventsRes.results || [])) {
      if (r.event_type === 'store_view') storeViews = Number(r.total) || 0
      if (r.event_type === 'product_view') productViews = Number(r.total) || 0
      if (r.event_type === 'checkout_intent') checkoutIntents = Number(r.total) || 0
    }

    const totalSources = (sourcesRes.results || []).reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0)
    const sources = (sourcesRes.results || []).map((r: any) => {
      const count = Number(r.total) || 0
      const meta = getTrafficSourceMeta(r.source)
      return {
        source: r.source,
        name: meta.label,
        count,
        color: meta.color,
        percentage: totalSources > 0 ? Number(((count / totalSources) * 100).toFixed(1)) : 0
      }
    })

    const totalDevices = (devicesRes.results || []).reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0)
    const devices = (devicesRes.results || []).map((r: any) => {
      const count = Number(r.total) || 0
      const label = r.device_type === 'mobile' ? 'Smartphone (Mobile)' : (r.device_type === 'desktop' ? 'Laptop / PC (Desktop)' : 'Tablet')
      return {
        device_type: r.device_type,
        name: label,
        count,
        percentage: totalDevices > 0 ? Number(((count / totalDevices) * 100).toFixed(1)) : 0
      }
    })

    return c.json({
      status: 'success',
      data: {
        selected_period: periodConfig.period,
        total_views: storeViews + productViews,
        store_views: storeViews,
        product_views: productViews,
        checkout_intents: checkoutIntents,
        sources,
        devices
      }
    })
  } catch (err) {
    console.error('[Traffic Analytics Error]:', err)
    return c.json({ error: 'Gagal memuat analitik trafik toko.' }, 500)
  }
})

// GET /dashboard/analytics/funnel: Endpoint analitik corong konversi belanja toko (Mitra Auth, Anti-IDOR, Friendly Errors)
dashboard.get('/analytics/funnel', rateLimit(30, 60, (c) => `analytics_funnel_${c.get('user')?.id || 'anon'}`), async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Sesi Anda telah berakhir, silakan login kembali.' }, 401)
  }

  try {
    const isSuperAdmin = user.role === 'super_admin'
    const periodParam = c.req.query('period')
    const periodConfig = getPeriodConfig(periodParam)

    let sellerFilter = ''
    const params: any[] = []
    if (!isSuperAdmin) {
      sellerFilter = ' WHERE seller_id = ?'
      params.push(user.id)
    }

    let trafficDateFilter = sellerFilter
    const trafficParams = [...params]
    if (periodConfig.startDate) {
      trafficDateFilter += (trafficDateFilter ? ' AND' : ' WHERE') + ' date >= ?'
      trafficParams.push(periodConfig.startDate.slice(0, 10))
    }

    const eventStmt = c.env.DB.prepare(`
      SELECT event_type, COALESCE(SUM(count), 0) as total
      FROM store_daily_analytics
      ${trafficDateFilter}
      GROUP BY event_type
    `)
    const eventRes = trafficParams.length > 0 ? await eventStmt.bind(...trafficParams).all<any>() : await eventStmt.all<any>()

    let storeViews = 0
    let productViews = 0
    let checkoutIntents = 0
    for (const r of (eventRes.results || [])) {
      if (r.event_type === 'store_view') storeViews = Number(r.total) || 0
      if (r.event_type === 'product_view') productViews = Number(r.total) || 0
      if (r.event_type === 'checkout_intent') checkoutIntents = Number(r.total) || 0
    }

    // Ambil penjualan riil di periode yang sama
    let salesDateFilter = isSuperAdmin ? " WHERE (status = 'settled' OR status IS NULL)" : " WHERE seller_id = ? AND (status = 'settled' OR status IS NULL)"
    const salesParams = isSuperAdmin ? [] : [user.id]
    if (periodConfig.startDate) {
      salesDateFilter += ' AND paid_at >= ?'
      salesParams.push(periodConfig.startDate)
    }

    const salesStmt = c.env.DB.prepare(`
      SELECT COUNT(*) as total_sales, COALESCE(SUM(seller_net_amount), 0) as total_net
      FROM sale_transactions
      ${salesDateFilter}
    `)
    const salesRes = salesParams.length > 0 ? await salesStmt.bind(...salesParams).first<any>() : await salesStmt.first<any>()
    const completedSales = Number(salesRes?.total_sales) || 0

    const totalImpressions = Math.max(storeViews + productViews, completedSales)
    const step1Count = Math.max(totalImpressions, storeViews, productViews)
    const step2Count = productViews
    const step3Count = checkoutIntents
    const step4Count = completedSales

    const steps = [
      {
        key: 'store_view',
        name: 'Total Kunjungan Toko & Modul',
        count: step1Count,
        step_conversion_rate: 100,
        overall_conversion_rate: 100,
        color: '#0D5B52'
      },
      {
        key: 'product_view',
        name: 'Melihat Detail Produk',
        count: step2Count,
        step_conversion_rate: step1Count > 0 ? Number(((step2Count / step1Count) * 100).toFixed(1)) : 0,
        overall_conversion_rate: step1Count > 0 ? Number(((step2Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#0284c7'
      },
      {
        key: 'checkout_intent',
        name: 'Klik Pesan / Beli',
        count: step3Count,
        step_conversion_rate: step2Count > 0 ? Number(((step3Count / step2Count) * 100).toFixed(1)) : 0,
        overall_conversion_rate: step1Count > 0 ? Number(((step3Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#d97706'
      },
      {
        key: 'completed_sale',
        name: 'Pembayaran Sukses',
        count: step4Count,
        step_conversion_rate: step3Count > 0 ? Number(((step4Count / step3Count) * 100).toFixed(1)) : (step2Count > 0 ? Number(((step4Count / step2Count) * 100).toFixed(1)) : 0),
        overall_conversion_rate: step1Count > 0 ? Number(((step4Count / step1Count) * 100).toFixed(1)) : 0,
        color: '#059669'
      }
    ]

    return c.json({
      status: 'success',
      data: {
        selected_period: periodConfig.period,
        total_impressions: totalImpressions,
        store_views: storeViews,
        product_views: productViews,
        checkout_intents: checkoutIntents,
        completed_sales: completedSales,
        overall_cvr: totalImpressions > 0 ? Number(((completedSales / totalImpressions) * 100).toFixed(1)) : 0,
        steps
      }
    })
  } catch (err) {
    console.error('[Funnel Analytics Error]:', err)
    return c.json({ error: 'Gagal memuat analitik corong konversi toko.' }, 500)
  }
})

export default dashboard
