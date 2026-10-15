import { Hono } from 'hono'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>()

dashboard.use('*', authMiddleware)

function getLast6Months(): { period: string; name: string }[] {
  const result: { period: string; name: string }[] = []
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const now = new Date()
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const period = `${year}-${month}`
    const name = `${monthNames[d.getMonth()]} ${String(year).slice(-2)}`
    result.push({ period, name })
  }
  return result
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

// Endpoint analitik komprehensif riil untuk Skema Artikel & Skema Produk
dashboard.get('/analytics', requirePermission('view_dashboard'), rateLimit(30, 60, 'dashboard_analytics'), async (c) => {
  try {
    const user = c.get('user')
    const isSuperAdmin = user.role === 'super_admin'
  const canEditAnyPost = isSuperAdmin || (user.permissions || []).includes('edit_any_post')
  const canEditAnyProduct = isSuperAdmin || (user.permissions || []).includes('edit_any_product')

  const postFilter = canEditAnyPost ? '' : ' WHERE author_id = ?'
  const postParams = canEditAnyPost ? [] : [user.id]

  const productFilter = canEditAnyProduct ? '' : ' WHERE author_id = ?'
  const productParams = canEditAnyProduct ? [] : [user.id]

  const salesFilter = isSuperAdmin ? " WHERE status = 'settled'" : " WHERE status = 'settled' AND seller_id = ?"
  const salesParams = isSuperAdmin ? [] : [user.id]

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

  // 4. Statistik Riil Produk
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

  // 5. Pendapatan Penjualan Produk dari sale_transactions
  const earningsStmt = c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_transactions,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COALESCE(SUM(admin_fee_amount), 0) as total_admin_fee,
      COALESCE(SUM(seller_net_amount), 0) as total_net,
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL THEN seller_net_amount ELSE 0 END), 0) as pending_payout,
      COALESCE(SUM(CASE WHEN payout_status = 'transferred' THEN seller_net_amount ELSE 0 END), 0) as paid_out
    FROM sale_transactions
    ${salesFilter}
  `)
  const productEarnings = salesParams.length > 0 ? await earningsStmt.bind(...salesParams).first<any>() : await earningsStmt.first<any>()

  // 6. Tren Bulanan Penjualan & Pendapatan Produk
  const salesTrendStmt = c.env.DB.prepare(`
    SELECT 
      strftime('%Y-%m', paid_at) as period,
      COUNT(*) as sales,
      COALESCE(SUM(gross_amount), 0) as gross,
      COALESCE(SUM(seller_net_amount), 0) as earnings
    FROM sale_transactions
    ${salesFilter}
    GROUP BY period
    ORDER BY period DESC
    LIMIT 12
  `)
  const salesTrendRaw = salesParams.length > 0 ? await salesTrendStmt.bind(...salesParams).all<any>() : await salesTrendStmt.all<any>()

  // 7. Top 5 Produk Unggulan (Berdasarkan Penjualan & Tayangan)
  const topProdStmt = c.env.DB.prepare(`
    SELECT id, title, slug, price, original_price, status, view_count, sales_count, created_at
    FROM products
    ${productFilter}
    ORDER BY sales_count DESC, view_count DESC
    LIMIT 5
  `)
  const topProducts = productParams.length > 0 ? await topProdStmt.bind(...productParams).all<any>() : await topProdStmt.all<any>()

  // Pemetaan timeline kontinu 6 bulan terakhir agar grafik konsisten
  const months = getLast6Months()
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

  const articleTrend = months.map(m => {
    const data = articleTrendMap.get(m.period) || { count: 0, views: 0 }
    return {
      period: m.period,
      name: m.name,
      count: data.count,
      views: data.views
    }
  })

  const productTrend = months.map(m => {
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

  // D. Data Khusus Seller (Merchant Center)
  let sellerMetrics = null
  if (isSellerRole) {
    const views = Number(productStats?.total_views) || 0
    const sales = Number(productStats?.total_sales) || 0
    const conversionRate = views > 0 ? Number(((sales / views) * 100).toFixed(1)) : 0
    const pendingPayout = Number(productEarnings?.pending_payout) || 0

    sellerMetrics = {
      conversion_rate: conversionRate,
      pending_payout: pendingPayout,
      is_withdrawal_eligible: pendingPayout >= 10000,
      total_sales: sales,
      total_views: views
    }
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
        total_sales: totalSales,
        avg_price: avgPrice,
        total_gross_revenue: totalGrossRevenue,
        total_net_revenue: totalNetRevenue,
        pending_payout: Number(productEarnings?.pending_payout) || 0,
        paid_out: Number(productEarnings?.paid_out) || 0,
        status_distribution: [
          { name: 'Terpublikasi', value: publishedProducts, color: '#10b981' },
          { name: 'Draf', value: draftProducts, color: '#f59e0b' },
          { name: 'Diarsipkan', value: archivedProducts, color: '#94a3b8' }
        ],
        trend: productTrend,
        top_products: topProducts.results || []
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

export default dashboard
