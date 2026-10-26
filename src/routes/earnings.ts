import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'
import xss from 'xss'

const cleanText = (val: string) => xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] })

const earnings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

export async function getActiveFeePolicy(db: any) {
  try {
    const config = await db.prepare(`
      SELECT * FROM admin_fee_config
      WHERE datetime(effective_from) <= datetime('now')
      ORDER BY effective_from DESC LIMIT 1
    `).first()

    const feeBps = typeof config?.fee_bps === 'number' ? config.fee_bps : 1500
    const feePercent = (feeBps / 100).toFixed(2).replace(/\.00$/, '') + '%'
    const creatorSharePercent = ((10000 - feeBps) / 100).toFixed(2).replace(/\.00$/, '') + '%'
    const minWithdrawal = typeof config?.min_withdrawal_amount === 'number' ? config.min_withdrawal_amount : 50000
    const minProductPrice = typeof config?.min_product_price === 'number' ? config.min_product_price : 10000
    const qrisBps = typeof config?.midtrans_qris_rate_bps === 'number' ? config.midtrans_qris_rate_bps : 70
    const vaFee = typeof config?.midtrans_va_fee === 'number' ? config.midtrans_va_fee : 4000
    const bankDisbursementFee = typeof config?.bank_disbursement_fee === 'number' ? config.bank_disbursement_fee : 2500
    const midtransFeePayer = config?.midtrans_fee_payer || 'buyer'
    const midtransFeeNote = config?.midtrans_fee_note || 'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)'

    return {
      id: config?.id || 'policy-default',
      fee_bps: feeBps,
      fee_percent: feePercent,
      creator_share_percent: creatorSharePercent,
      min_fee: config?.min_fee ?? null,
      max_fee: config?.max_fee ?? null,
      min_withdrawal_amount: minWithdrawal,
      min_product_price: minProductPrice,
      bank_disbursement_fee: bankDisbursementFee,
      midtrans: {
        payer: midtransFeePayer,
        payer_label: midtransFeePayer === 'buyer' 
          ? 'Dibebankan kepada Pembeli saat Checkout' 
          : (midtransFeePayer === 'platform' ? 'Ditanggung oleh Platform' : 'Dipotong dari Penjual'),
        qris_rate_bps: qrisBps,
        qris_rate_percent: (qrisBps / 100).toFixed(1).replace(/\.0$/, '') + '%',
        va_fee: vaFee,
        note: midtransFeeNote
      },
      note: config?.note || null,
      effective_from: config?.effective_from || new Date().toISOString()
    }
  } catch {
    return {
      id: 'policy-fallback',
      fee_bps: 1500,
      fee_percent: '15%',
      creator_share_percent: '85%',
      min_fee: null,
      max_fee: null,
      min_withdrawal_amount: 50000,
      min_product_price: 10000,
      bank_disbursement_fee: 2500,
      midtrans: {
        payer: 'buyer',
        payer_label: 'Dibebankan kepada Pembeli saat Checkout',
        qris_rate_bps: 70,
        qris_rate_percent: '0.7%',
        va_fee: 4000,
        note: 'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)'
      },
      note: null,
      effective_from: new Date().toISOString()
    }
  }
}

// ============================================================
// [Public/Seller/Admin] GET /api/earnings/policy
// Kebijakan fee platform, batas minimum transaksi, dan fee payment gateway aktif
// ============================================================
earnings.get('/policy', rateLimit(60, 60, 'earnings_policy'), async (c) => {
  const policy = await getActiveFeePolicy(c.env.DB)
  return c.json({ policy })
})

// Endpoint berikutnya wajib autentikasi seller/admin
earnings.use('/*', authMiddleware)

// ============================================================
// [Seller] GET /api/earnings/summary
// Ringkasan total penghasilan seller yang sedang login
// ============================================================
earnings.get('/summary', rateLimit(30, 60, 'earnings_summary'), async (c) => {
  const user = c.get('user')

  // Tentukan seller_id: seller hanya boleh melihat miliknya sendiri,
  // super_admin bisa melihat seller manapun via query param ?seller_id=
  let sellerId = user.id
  if ((user.role === 'super_admin') && c.req.query('seller_id')) {
    sellerId = c.req.query('seller_id')!
  }

  // Filter periode (opsional)
  const fromDate = c.req.query('from') || null
  const toDate = c.req.query('to') || null

  let dateFilter = ''
  const params: any[] = [sellerId]

  if (fromDate) {
    dateFilter += ' AND paid_at >= ?'
    params.push(fromDate)
  }
  if (toDate) {
    dateFilter += ' AND paid_at <= ?'
    params.push(toDate)
  }

  const summary = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_transactions,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COALESCE(SUM(admin_fee_amount), 0) as total_admin_fee,
      COALESCE(SUM(seller_net_amount), 0) as total_net,
      -- Saldo Tertahan (Holding Period 3 Hari atau sedang dikomplain)
      COALESCE(SUM(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND (datetime('now') < datetime(COALESCE(hold_until, 'now')) OR dispute_status IN ('complained', 'under_review')) 
        THEN seller_net_amount ELSE 0 END), 0) as holding_payout,
      -- Saldo Aktif (Siap Ditarik: sudah lewat 3 hari dan bebas sengketa)
      COALESCE(SUM(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now')) 
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved')) 
        THEN seller_net_amount ELSE 0 END), 0) as available_payout,
      -- pending_payout dialiasikan ke available_payout demi kompatibilitas frontend eksisting
      COALESCE(SUM(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now')) 
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved')) 
        THEN seller_net_amount ELSE 0 END), 0) as pending_payout,
      -- Sedang Diproses (Masuk antrean withdrawal)
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NOT NULL THEN seller_net_amount ELSE 0 END), 0) as processing_payout,
      -- Sudah Ditransfer
      COALESCE(SUM(CASE WHEN payout_status = 'transferred' THEN seller_net_amount ELSE 0 END), 0) as paid_out,
      -- Counts
      COUNT(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND (datetime('now') < datetime(COALESCE(hold_until, 'now')) OR dispute_status IN ('complained', 'under_review')) 
        THEN 1 END) as holding_count,
      COUNT(CASE 
        WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL 
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now')) 
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved')) 
        THEN 1 END) as available_count,
      COUNT(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL THEN 1 END) as pending_count,
      COUNT(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NOT NULL THEN 1 END) as processing_count,
      COUNT(CASE WHEN payout_status = 'transferred' THEN 1 END) as transferred_count,
      COUNT(CASE WHEN dispute_status IN ('complained', 'under_review') THEN 1 END) as disputed_count
    FROM sale_transactions
    WHERE seller_id = ? AND status = 'settled'
    ${dateFilter}
  `).bind(...params).first()

  // Ambil fee & policy config yang aktif saat ini untuk ditampilkan ke seller
  const activeFeePolicy = await getActiveFeePolicy(c.env.DB)

  return c.json({
    seller_id: sellerId,
    period: { from: fromDate, to: toDate },
    summary,
    current_fee_policy: activeFeePolicy
  })
})

// ============================================================
// [Seller] GET /api/earnings/transactions
// Riwayat transaksi detail dengan informasi produk
// ============================================================
earnings.get('/transactions', rateLimit(20, 60, 'earnings_transactions'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 20, 100)

  let sellerId = user.id
  if ((user.role === 'super_admin') && c.req.query('seller_id')) {
    sellerId = c.req.query('seller_id')!
  }

  const fromDate = c.req.query('from') || null
  const toDate = c.req.query('to') || null
  const payoutStatus = c.req.query('payout_status') || null

  const countParams: any[] = [sellerId]
  const dataParams: any[] = [sellerId]
  let extraFilter = ''

  if (fromDate) {
    extraFilter += ' AND st.paid_at >= ?'
    countParams.push(fromDate)
    dataParams.push(fromDate)
  }
  if (toDate) {
    extraFilter += ' AND st.paid_at <= ?'
    countParams.push(toDate)
    dataParams.push(toDate)
  }
  if (payoutStatus && ['pending', 'transferred', 'skipped'].includes(payoutStatus)) {
    extraFilter += ' AND st.payout_status = ?'
    countParams.push(payoutStatus)
    dataParams.push(payoutStatus)
  }

  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total
    FROM sale_transactions st
    WHERE st.seller_id = ? AND st.status IN ('settled', 'refunded')
    ${extraFilter}
  `).bind(...countParams).first<{ total: number }>()

  dataParams.push(limit, offset)

  const transactions = await c.env.DB.prepare(`
    SELECT
      st.id,
      st.gross_amount,
      st.admin_fee_amount,
      st.seller_net_amount,
      st.applied_fee_bps,
      st.payment_method,
      st.status,
      st.payout_status,
      st.paid_at,
      st.processed_at,
      st.payout_at,
      st.hold_until,
      st.dispute_status,
      CASE 
        WHEN datetime('now') < datetime(COALESCE(st.hold_until, 'now')) OR st.dispute_status IN ('complained', 'under_review') THEN 1 
        ELSE 0 
      END as is_holding,
      p.id as product_id,
      p.title as product_title,
      p.slug as product_slug
    FROM sale_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    WHERE st.seller_id = ? AND st.status IN ('settled', 'refunded')
    ${extraFilter}
    ORDER BY st.paid_at DESC
    LIMIT ? OFFSET ?
  `).bind(...dataParams).all()

  return c.json({
    data: transactions.results,
    total: countResult?.total || 0,
    limit,
    offset
  })
})

// ============================================================
// [Seller] GET /api/earnings/products
// Statistik per-produk: berapa terjual, total penghasilan bersih
// ============================================================
earnings.get('/products', rateLimit(20, 60, 'earnings_products'), async (c) => {
  const user = c.get('user')

  let sellerId = user.id
  if ((user.role === 'super_admin') && c.req.query('seller_id')) {
    sellerId = c.req.query('seller_id')!
  }

  const fromDate = c.req.query('from') || null
  const toDate = c.req.query('to') || null
  const params: any[] = [sellerId]
  let dateFilter = ''

  if (fromDate) {
    dateFilter += ' AND st.paid_at >= ?'
    params.push(fromDate)
  }
  if (toDate) {
    dateFilter += ' AND st.paid_at <= ?'
    params.push(toDate)
  }

  const byProduct = await c.env.DB.prepare(`
    SELECT
      p.id as product_id,
      p.title as product_title,
      p.slug as product_slug,
      p.price as current_price,
      COUNT(st.id) as total_sales,
      COALESCE(SUM(st.gross_amount), 0) as total_gross,
      COALESCE(SUM(st.admin_fee_amount), 0) as total_admin_fee,
      COALESCE(SUM(st.seller_net_amount), 0) as total_net,
      MIN(st.paid_at) as first_sale_at,
      MAX(st.paid_at) as last_sale_at
    FROM sale_transactions st
    JOIN products p ON st.product_id = p.id
    WHERE st.seller_id = ? AND st.status = 'settled'
    ${dateFilter}
    GROUP BY st.product_id, p.id, p.title, p.slug, p.price
    ORDER BY total_net DESC
  `).bind(...params).all()

  return c.json({ data: byProduct.results })
})

// ============================================================
// [Seller] GET /api/earnings/price-history/:product_id
// Riwayat perubahan harga suatu produk milik seller
// ============================================================
earnings.get('/price-history/:product_id', rateLimit(20, 60, 'price_history'), async (c) => {
  const user = c.get('user')
  const productId = c.req.param('product_id')

  // Pastikan seller hanya bisa lihat riwayat harga produknya sendiri
  const product = await c.env.DB.prepare(
    'SELECT author_id, title FROM products WHERE id = ?'
  ).bind(productId).first<{ author_id: string; title: string }>()

  if (!product) throw new HTTPException(404, { message: 'Produk tidak ditemukan.' })

  if (user.role !== 'super_admin' && product.author_id !== user.id) {
    throw new HTTPException(403, { message: 'Anda tidak memiliki akses ke riwayat harga produk ini.' })
  }

  const history = await c.env.DB.prepare(`
    SELECT
      ph.id,
      ph.price,
      ph.original_price,
      ph.change_reason,
      ph.effective_at,
      u.name as changed_by_name
    FROM product_price_history ph
    LEFT JOIN users u ON ph.changed_by = u.id
    WHERE ph.product_id = ?
    ORDER BY ph.effective_at DESC
    LIMIT 50
  `).bind(productId).all()

  return c.json({
    product_id: productId,
    product_title: product.title,
    history: history.results
  })
})

// ============================================================
// [Super Admin] GET /api/earnings/admin/overview
// Overview total seluruh seller (hanya untuk Super Admin)
// ============================================================
earnings.get('/admin/overview', requirePermission('view_dashboard'), rateLimit(10, 60, 'earnings_admin_overview'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Akses ditolak.' })
  }

  const fromDate = c.req.query('from') || null
  const toDate = c.req.query('to') || null

  // Base filter: selalu sertakan status = 'settled' dengan alias tabel yang jelas (prevent ambiguous column error)
  const conditions: string[] = ["st.status = 'settled'"]
  const params: any[] = []

  if (fromDate) {
    conditions.push('st.paid_at >= ?')
    params.push(fromDate)
  }
  if (toDate) {
    conditions.push('st.paid_at <= ?')
    params.push(toDate)
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`

  const platformSummary = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_transactions,
      COUNT(DISTINCT seller_id) as total_sellers,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COALESCE(SUM(admin_fee_amount), 0) as total_platform_fee,
      COALESCE(SUM(seller_net_amount), 0) as total_seller_payout,
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL THEN seller_net_amount ELSE 0 END), 0) as pending_payout_total,
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NOT NULL THEN seller_net_amount ELSE 0 END), 0) as processing_payout_total
    FROM sale_transactions st
    ${whereClause}
  `).bind(...params).first()

  // Leaderboard per seller — gunakan params yang sama
  const perSellerParams = [...params]
  const perSeller = await c.env.DB.prepare(`
    SELECT
      u.id as seller_id,
      u.name as seller_name,
      u.email as seller_email,
      COUNT(st.id) as total_sales,
      COALESCE(SUM(st.gross_amount), 0) as total_gross,
      COALESCE(SUM(st.admin_fee_amount), 0) as admin_fee_collected,
      COALESCE(SUM(st.seller_net_amount), 0) as net_owed_to_seller,
      COALESCE(SUM(CASE WHEN st.payout_status = 'pending' AND st.withdrawal_request_id IS NULL THEN st.seller_net_amount ELSE 0 END), 0) as pending_payout,
      COALESCE(SUM(CASE WHEN st.payout_status = 'pending' AND st.withdrawal_request_id IS NOT NULL THEN st.seller_net_amount ELSE 0 END), 0) as processing_payout
    FROM sale_transactions st
    JOIN users u ON st.seller_id = u.id
    ${whereClause}
    GROUP BY st.seller_id, u.id, u.name, u.email
    ORDER BY net_owed_to_seller DESC
    LIMIT 50
  `).bind(...perSellerParams).all()

  return c.json({
    period: { from: fromDate, to: toDate },
    platform: platformSummary,
    per_seller: perSeller.results
  })
})

// ============================================================
// [Super Admin] PUT /api/earnings/admin/payout/:transaction_id
// Tandai transaksi sudah ditransfer manual ke seller
// ============================================================
const payoutSchema = z.object({
  payout_status: z.enum(['transferred', 'skipped']),
  payout_note: z.string().max(500).optional(),
})

earnings.put(
  '/admin/payout/:transaction_id',
  requirePermission('view_dashboard'),
  rateLimit(30, 60, 'payout_update'),
  zValidator('json', payoutSchema),
  async (c) => {
    const user = c.get('user')
    if (user.role !== 'super_admin') {
      throw new HTTPException(403, { message: 'Akses ditolak.' })
    }

    const transactionId = c.req.param('transaction_id')
    const body = c.req.valid('json')

    const existing = await c.env.DB.prepare(
      'SELECT id, status, dispute_status, payout_status, seller_id, withdrawal_request_id FROM sale_transactions WHERE id = ?'
    ).bind(transactionId).first<{ id: string; status: string; dispute_status: string | null; payout_status: string; seller_id: string; withdrawal_request_id: string | null }>()

    if (!existing) throw new HTTPException(404, { message: 'Transaksi tidak ditemukan.' })

    if (existing.status === 'refunded' || ['complained', 'under_review'].includes(existing.dispute_status || '')) {
      throw new HTTPException(400, {
        message: 'Transaksi ini sedang dalam penanganan komplain atau telah di-refund sehingga pembayaran manual tidak dapat diproses.'
      })
    }

    // Proteksi Cegah Double Payout:
    // Jika transaksi sedang masuk dalam antrean penarikan dana massal, tolak perubahan manual
    if (existing.withdrawal_request_id) {
      throw new HTTPException(400, {
        message: 'Transaksi ini sedang terikat dalam antrean penarikan dana massal (Withdrawal Request). Harap selesaikan proses pembayaran melalui tab Penarikan Dana untuk mencegah double transfer.'
      })
    }

    if (existing.payout_status !== 'pending') {
      return c.json({ message: `Status pembayaran sudah: ${existing.payout_status}. Tidak ada perubahan.` })
    }

    await c.env.DB.prepare(`
      UPDATE sale_transactions
      SET payout_status = ?, payout_note = ?, payout_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(body.payout_status, body.payout_note ?? null, transactionId).run()

    return c.json({ message: `Status pembayaran berhasil diperbarui menjadi "${body.payout_status}".` })
  }
)

// ============================================================
// [Super Admin] GET /api/earnings/admin/fee-config
// Melihat & mengelola konfigurasi potongan admin & gateway
// ============================================================
earnings.get('/admin/fee-config', requirePermission('view_dashboard'), rateLimit(10, 60, 'fee_config'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Akses ditolak.' })
  }

  const configs = await c.env.DB.prepare(`
    SELECT afc.*, u.name as set_by_name
    FROM admin_fee_config afc
    LEFT JOIN users u ON afc.set_by = u.id
    ORDER BY afc.effective_from DESC
    LIMIT 50
  `).all()

  return c.json({ data: configs.results })
})

const feeConfigSchema = z.object({
  fee_bps: z.number().int().min(0).max(10000),
  min_fee: z.number().int().min(0).optional().nullable(),
  max_fee: z.number().int().min(0).optional().nullable(),
  min_withdrawal_amount: z.number().int().min(1000).max(10000000).optional().default(50000),
  min_product_price: z.number().int().min(0).max(10000000).optional().default(10000),
  midtrans_fee_payer: z.enum(['buyer', 'platform', 'seller']).optional().default('buyer'),
  midtrans_qris_rate_bps: z.number().int().min(0).max(1000).optional().default(70),
  midtrans_va_fee: z.number().int().min(0).max(50000).optional().default(4000),
  midtrans_fee_note: z.string().max(500).optional(),
  bank_disbursement_fee: z.number().int().min(0).max(50000).optional().default(2500),
  note: z.string().max(500).optional(),
})

earnings.post(
  '/admin/fee-config',
  requirePermission('view_dashboard'),
  rateLimit(5, 60, 'fee_config_write'),
  zValidator('json', feeConfigSchema),
  async (c) => {
    const user = c.get('user')
    if (user.role !== 'super_admin') {
      throw new HTTPException(403, { message: 'Akses ditolak.' })
    }

    const body = c.req.valid('json')

    if (body.min_fee != null && body.max_fee != null && body.min_fee > body.max_fee) {
      throw new HTTPException(400, { message: 'Batas minimum potongan tidak boleh lebih besar dari batas maksimum.' })
    }

    const id = crypto.randomUUID()
    const midtransNote = body.midtrans_fee_note?.trim() || 
      'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)'

    await c.env.DB.prepare(`
      INSERT INTO admin_fee_config (
        id, fee_bps, min_fee, max_fee, 
        min_withdrawal_amount, min_product_price, 
        midtrans_fee_payer, midtrans_qris_rate_bps, midtrans_va_fee, 
        midtrans_fee_note, bank_disbursement_fee, 
        note, set_by, effective_from
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      id,
      body.fee_bps,
      body.min_fee ?? null,
      body.max_fee ?? null,
      body.min_withdrawal_amount,
      body.min_product_price,
      body.midtrans_fee_payer,
      body.midtrans_qris_rate_bps,
      body.midtrans_va_fee,
      midtransNote,
      body.bank_disbursement_fee,
      body.note ?? null,
      user.id
    ).run()

    return c.json({
      message: `Konfigurasi kebijakan baru berhasil diterapkan: ${(body.fee_bps / 100).toFixed(2)}% platform (Kreator ${((10000 - body.fee_bps) / 100).toFixed(2)}%). Transaksi terdahulu tetap terlindungi sesuai riwayat kesepakatan masing-masing.`,
      id
    })
  }
)

// ============================================================
// [Seller] GET /api/earnings/withdrawals
// Mengambil riwayat permintaan penarikan dana
// ============================================================
earnings.get('/withdrawals', rateLimit(20, 60, 'earnings_withdrawals'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 20, 100)
  const status = c.req.query('status') || null

  let filter = ' seller_id = ? '
  const params: any[] = [user.id]

  if (status) {
    filter += ' AND status = ? '
    params.push(status)
  }

  const withdrawals = await c.env.DB.prepare(`
    SELECT id, amount, bank_details, status, created_at, processed_at, admin_note, transfer_receipt_url
    FROM withdrawal_requests
    WHERE ${filter}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const count = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM withdrawal_requests WHERE ${filter}
  `).bind(...params).first<{ total: number }>()

  return c.json({ data: withdrawals.results, total: count?.total || 0, limit, offset })
})

// ============================================================
// [Seller] POST /api/earnings/withdrawals
// Membuat permintaan penarikan dana baru
// ============================================================
const withdrawSchema = z.object({
  bank_details: z.string().trim().min(5).max(500),
})

earnings.post(
  '/withdrawals',
  rateLimit(5, 60, 'earnings_withdrawals_post'),
  zValidator('json', withdrawSchema),
  async (c) => {
    const user = c.get('user')
    const body = c.req.valid('json')

    // Verifikasi akun seller aktif & telah disetujui (cegah penarikan dana dari akun yang ditangguhkan/pending)
    if (user.role !== 'super_admin') {
      const dbSeller = await c.env.DB.prepare('SELECT seller_status, is_active FROM users WHERE id = ?').bind(user.id).first<{ seller_status: string; is_active: number }>()
      if (!dbSeller || dbSeller.is_active === 0 || dbSeller.seller_status !== 'approved') {
        throw new HTTPException(403, { message: 'Akun kemitraan Anda belum disetujui atau sedang ditangguhkan.' })
      }
    }

    // Audit: Pastikan seller tidak memiliki permintaan penarikan dana lain yang sedang pending
    const activePending = await c.env.DB.prepare(`
      SELECT id, amount, created_at FROM withdrawal_requests
      WHERE seller_id = ? AND status = 'pending'
    `).bind(user.id).first<{ id: string; amount: number; created_at: string }>()

    if (activePending) {
      throw new HTTPException(400, {
        message: 'Anda masih memiliki permintaan penarikan dana yang sedang diproses oleh admin. Harap tunggu hingga proses selesai sebelum mengajukan penarikan baru.'
      })
    }

    const activePolicy = await getActiveFeePolicy(c.env.DB)
    const minWithdrawal = activePolicy.min_withdrawal_amount || 50000

    // Hitung total dana aktif yang sah ditarik (telah melewati masa holding 3 hari & bebas komplain)
    const summary = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(seller_net_amount), 0) as total_net
      FROM sale_transactions
      WHERE seller_id = ? 
        AND status = 'settled' 
        AND payout_status = 'pending' 
        AND withdrawal_request_id IS NULL
        AND seller_net_amount > 0
        AND datetime('now') >= datetime(COALESCE(hold_until, 'now'))
        AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved'))
    `).bind(user.id).first<{ total_net: number }>()

    const withdrawableAmount = summary?.total_net || 0
    if (withdrawableAmount < minWithdrawal) {
      throw new HTTPException(400, { 
        message: `Saldo aktif yang siap ditarik belum mencukupi batas minimum penarikan (Rp ${minWithdrawal.toLocaleString('id-ID')}). Transaksi baru masih dalam masa tunggu kliring 3 hari.` 
      })
    }

    const id = crypto.randomUUID()

    // Mulai transaksi atomik via D1 batch
    // Gunakan INSERT ... SELECT ... HAVING untuk mencegah race condition (double withdrawal)
    const batchRes = await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO withdrawal_requests (id, seller_id, amount, bank_details, status)
        SELECT ?, seller_id, SUM(seller_net_amount), ?, 'pending'
        FROM sale_transactions
        WHERE seller_id = ? 
          AND status = 'settled' 
          AND payout_status = 'pending' 
          AND withdrawal_request_id IS NULL
          AND seller_net_amount > 0
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now'))
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved'))
        GROUP BY seller_id
        HAVING SUM(seller_net_amount) >= ?
        RETURNING amount
      `).bind(id, body.bank_details, user.id, minWithdrawal),
      c.env.DB.prepare(`
        UPDATE sale_transactions
        SET withdrawal_request_id = ?
        WHERE seller_id = ? 
          AND status = 'settled' 
          AND payout_status = 'pending' 
          AND withdrawal_request_id IS NULL
          AND seller_net_amount > 0
          AND datetime('now') >= datetime(COALESCE(hold_until, 'now'))
          AND (dispute_status IS NULL OR dispute_status IN ('none', 'resolved'))
      `).bind(id, user.id)
    ])

    if (batchRes[0].meta.changes === 0) {
      // Rollback pengikatan transaksi jika tidak ada withdrawal_requests yang tercipta (anti-orphaned lock)
      await c.env.DB.prepare('UPDATE sale_transactions SET withdrawal_request_id = NULL WHERE withdrawal_request_id = ?').bind(id).run();
      throw new HTTPException(400, { message: 'Gagal memproses penarikan. Saldo aktif tidak mencukupi atau sedang diproses.' })
    }
    
    const actualAmountInserted = (batchRes[0].results as any)[0]?.amount || withdrawableAmount;

    return c.json({ message: 'Permintaan penarikan dana berhasil dibuat. Tim admin akan memverifikasi dan mentransfer ke rekening Anda.', id, amount: actualAmountInserted })
  }
)

// ============================================================
// [Seller] POST /api/earnings/withdrawals/:id/cancel
// Membatalkan permintaan penarikan dana mandiri jika masih berstatus pending
// ============================================================
earnings.post(
  '/withdrawals/:id/cancel',
  rateLimit(10, 60, 'earnings_withdrawals_cancel'),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const existing = await c.env.DB.prepare(
      'SELECT id, seller_id, status FROM withdrawal_requests WHERE id = ?'
    ).bind(id).first<{ id: string; seller_id: string; status: string }>()

    if (!existing) {
      throw new HTTPException(404, { message: 'Permintaan penarikan tidak ditemukan.' })
    }

    if (existing.seller_id !== user.id && user.role !== 'super_admin') {
      throw new HTTPException(403, { message: 'Anda tidak memiliki hak untuk membatalkan penarikan ini.' })
    }

    if (existing.status !== 'pending') {
      throw new HTTPException(400, {
        message: `Permintaan penarikan tidak dapat dibatalkan karena saat ini sudah berstatus "${existing.status}".`
      })
    }

    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE withdrawal_requests
        SET status = 'rejected', admin_note = 'Dibatalkan sendiri oleh penjual', processed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `).bind(id),
      c.env.DB.prepare(`
        UPDATE sale_transactions
        SET withdrawal_request_id = NULL
        WHERE withdrawal_request_id = ? AND payout_status = 'pending'
      `).bind(id)
    ])

    return c.json({ message: 'Permintaan penarikan dana berhasil dibatalkan. Saldo Anda telah dikembalikan ke Saldo Aktif.' })
  }
)

// ============================================================
// [Super Admin] GET /api/earnings/admin/withdrawals
// Mengambil semua permintaan penarikan dana
// ============================================================
earnings.get('/admin/withdrawals', requirePermission('view_dashboard'), rateLimit(20, 60, 'admin_withdrawals'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const { limit, offset } = getPagination(c, 50, 200)
  const status = c.req.query('status') || null

  let filter = ' 1=1 '
  const params: any[] = []

  if (status) {
    filter += ' AND w.status = ? '
    params.push(status)
  }

  const withdrawals = await c.env.DB.prepare(`
    SELECT w.*, u.name as seller_name, u.email as seller_email, p.name as processed_by_name
    FROM withdrawal_requests w
    JOIN users u ON w.seller_id = u.id
    LEFT JOIN users p ON w.processed_by = p.id
    WHERE ${filter}
    ORDER BY w.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const count = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM withdrawal_requests w WHERE ${filter}
  `).bind(...params).first<{ total: number }>()

  return c.json({ data: withdrawals.results, total: count?.total || 0, limit, offset })
})

// ============================================================
// [Super Admin] PUT /api/earnings/admin/withdrawals/:id
// Menandai penarikan selesai beserta bukti transfer
// ============================================================
const adminWithdrawSchema = z.object({
  status: z.enum(['completed', 'rejected']),
  admin_note: z.string().max(500).optional(),
  transfer_receipt_url: z.string().url().max(1000).optional().or(z.literal('')),
}).refine(data => {
  if (data.status === 'completed' && (!data.transfer_receipt_url || data.transfer_receipt_url.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Sistem Menolak: Bukti transfer (URL) WAJIB disertakan jika penarikan disetujui (Selesai).",
  path: ["transfer_receipt_url"]
})

earnings.put(
  '/admin/withdrawals/:id',
  requirePermission('view_dashboard'),
  rateLimit(20, 60, 'admin_withdrawals_put'),
  zValidator('json', adminWithdrawSchema),
  async (c) => {
    const user = c.get('user')
    if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

    const id = c.req.param('id')
    const body = c.req.valid('json')

    const existing = await c.env.DB.prepare('SELECT status FROM withdrawal_requests WHERE id = ?').bind(id).first<{ status: string }>()
    if (!existing) throw new HTTPException(404, { message: 'Permintaan penarikan tidak ditemukan.' })
    if (existing.status !== 'pending') throw new HTTPException(400, { message: `Status saat ini adalah ${existing.status}.` })

    if (body.status === 'completed') {
      // Audit: Cek apakah ada transaksi dalam bundle penarikan ini yang sedang disengketakan/dikomplain atau direfund
      const disputeCheck = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM sale_transactions
        WHERE withdrawal_request_id = ? 
          AND (dispute_status IN ('complained', 'under_review', 'refunded') OR status = 'refunded')
      `).bind(id).first<{ count: number }>()

      if (disputeCheck && disputeCheck.count > 0) {
        throw new HTTPException(400, {
          message: 'Tidak dapat menyelesaikan penarikan: terdapat transaksi di dalam antrean ini yang sedang dalam status komplain atau telah dibatalkan/refund. Tolak penarikan ini agar transaksi yang sah dapat dipisahkan.'
        })
      }

      const batchRes = await c.env.DB.batch([
        c.env.DB.prepare(`
          UPDATE withdrawal_requests
          SET status = 'completed', admin_note = ?, transfer_receipt_url = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
          WHERE id = ? AND status = 'pending'
        `).bind(body.admin_note || null, body.transfer_receipt_url || null, user.id, id),
        c.env.DB.prepare(`
          UPDATE sale_transactions
          SET payout_status = 'transferred', payout_at = CURRENT_TIMESTAMP, payout_note = ?
          WHERE withdrawal_request_id = ? AND payout_status = 'pending'
        `).bind('Transferred via batch withdrawal', id)
      ])

      if (batchRes[0].meta.changes === 0) {
        throw new HTTPException(400, { message: 'Status penarikan sudah berubah atau tidak valid.' })
      }
    } else {
      // Jika direject, kembalikan sale_transactions ke pending agar bisa ditarik lagi nanti
      const batchRes = await c.env.DB.batch([
        c.env.DB.prepare(`
          UPDATE withdrawal_requests
          SET status = 'rejected', admin_note = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
          WHERE id = ? AND status = 'pending'
        `).bind(body.admin_note || null, user.id, id),
        c.env.DB.prepare(`
          UPDATE sale_transactions
          SET withdrawal_request_id = NULL
          WHERE withdrawal_request_id = ? AND payout_status = 'pending'
        `).bind(id)
      ])

      if (batchRes[0].meta.changes === 0) {
        throw new HTTPException(400, { message: 'Status penarikan sudah berubah atau tidak valid.' })
      }
    }

    return c.json({ message: `Status penarikan berhasil diubah menjadi ${body.status}.` })
  }
)

// ============================================================
// [Seller] GET /api/earnings/complaints
// Mengambil daftar komplain pembeli atas produk seller yang sedang login
// ============================================================
earnings.get('/complaints', rateLimit(20, 60, 'seller_complaints_list'), async (c) => {
  const user = c.get('user')
  const { limit, offset } = getPagination(c, 20, 100)
  const status = c.req.query('status') || null

  let filter = ' oc.seller_id = ? '
  const params: any[] = [user.id]

  if (status) {
    filter += ' AND oc.status = ? '
    params.push(status)
  }

  const complaints = await c.env.DB.prepare(`
    SELECT 
      oc.id, oc.transaction_id, oc.hub_transaction_id,
      oc.category, oc.reason, oc.evidence_urls, oc.status,
      oc.seller_response, oc.seller_replacement_url, oc.seller_responded_at,
      oc.admin_notes, oc.created_at, oc.resolved_at,
      p.title as product_title, p.slug as product_slug,
      st.gross_amount, st.seller_net_amount, st.paid_at
    FROM order_complaints oc
    JOIN sale_transactions st ON oc.transaction_id = st.id
    JOIN products p ON oc.product_id = p.id
    WHERE ${filter}
    ORDER BY oc.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const count = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM order_complaints oc WHERE ${filter}
  `).bind(...params).first<{ total: number }>()

  return c.json({ data: complaints.results, total: count?.total || 0, limit, offset })
})

// ============================================================
// [Seller] PUT /api/earnings/complaints/:id/respond
// Memberikan tanggapan / tautan perbaikan file atas komplain pembeli
// ============================================================
const sellerRespondSchema = z.object({
  seller_response: z.string().trim().min(5, 'Tanggapan minimal 5 karakter').max(1000, 'Tanggapan maksimal 1000 karakter').transform(cleanText),
  seller_replacement_url: z.string().trim().url('Tautan perbaikan harus berupa URL valid').refine(v => !/^\s*(javascript|data|vbscript):/i.test(v) && (/^https?:\/\//i.test(v) || v === ''), 'Protokol tautan perbaikan tidak aman.').optional().or(z.literal('')),
})

earnings.put(
  '/complaints/:id/respond',
  rateLimit(10, 60, 'seller_complaint_respond'),
  zValidator('json', sellerRespondSchema),
  async (c) => {
    const user = c.get('user')
    const complaintId = c.req.param('id')
    const body = c.req.valid('json')

    const complaint = await c.env.DB.prepare(`
      SELECT id, seller_id, status, hub_transaction_id FROM order_complaints WHERE id = ?
    `).bind(complaintId).first<{ id: string; seller_id: string; status: string; hub_transaction_id: string }>()

    if (!complaint) {
      throw new HTTPException(404, { message: 'Komplain tidak ditemukan.' })
    }

    if (complaint.seller_id !== user.id && user.role !== 'super_admin') {
      throw new HTTPException(403, { message: 'Anda tidak memiliki hak untuk menanggapi komplain ini.' })
    }

    if (complaint.status === 'resolved_refunded' || complaint.status === 'resolved_rejected') {
      throw new HTTPException(400, { message: 'Komplain ini sudah diselesaikan dan tidak dapat ditanggapi lagi.' })
    }

    await c.env.DB.prepare(`
      UPDATE order_complaints
      SET seller_response = ?,
          seller_replacement_url = ?,
          seller_responded_at = CURRENT_TIMESTAMP,
          status = 'seller_replied',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.seller_response,
      body.seller_replacement_url || null,
      complaintId
    ).run()

    // Sinkronisasi S2S ke Hub agar pembeli bisa melihat tanggapan penjual
    const hubUrl = c.env.HUB_URL || 'https://asisten-guru.id'
    const s2sSecret = c.env.S2S_INTERNAL_SECRET || ''
    if (complaint.hub_transaction_id) {
      if (!s2sSecret) {
        console.warn('[Complaints S2S] S2S_INTERNAL_SECRET belum disetel. Hub tidak dapat disinkronkan.')
      } else {
        c.executionCtx.waitUntil((async () => {
          try {
            const res = await fetch(`${hubUrl}/api/marketplace/order/complaint/seller-response`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${s2sSecret}`
              },
              body: JSON.stringify({
                hub_transaction_id: complaint.hub_transaction_id,
                seller_response: body.seller_response,
                seller_replacement_url: body.seller_replacement_url || null
              })
            })
            if (!res.ok) {
              const errBody = await res.text()
              console.error(`[Complaints S2S] Gagal sinkronisasi seller response ke Hub. Status: ${res.status}, Body: ${errBody}`)
            }
          } catch (s2sErr) {
            console.error('[Complaints S2S] Failed to notify Hub about seller response:', s2sErr)
          }
        })())
      }
    }

    return c.json({ message: 'Tanggapan atas komplain berhasil dikirimkan.' })
  }
)

// ============================================================
// [Super Admin] GET /api/earnings/admin/complaints
// Mengambil seluruh komplain pembeli di platform
// ============================================================
earnings.get('/admin/complaints', requirePermission('view_dashboard'), rateLimit(20, 60, 'admin_complaints_list'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const { limit, offset } = getPagination(c, 50, 200)
  const status = c.req.query('status') || null

  let filter = ' 1=1 '
  const params: any[] = []

  if (status) {
    filter += ' AND oc.status = ? '
    params.push(status)
  }

  const complaints = await c.env.DB.prepare(`
    SELECT 
      oc.*,
      u.name as seller_name, u.email as seller_email,
      p.title as product_title, p.slug as product_slug,
      st.gross_amount, st.seller_net_amount, st.paid_at,
      r.name as resolved_by_name
    FROM order_complaints oc
    JOIN users u ON oc.seller_id = u.id
    JOIN products p ON oc.product_id = p.id
    JOIN sale_transactions st ON oc.transaction_id = st.id
    LEFT JOIN users r ON oc.resolved_by = r.id
    WHERE ${filter}
    ORDER BY oc.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all()

  const count = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM order_complaints oc WHERE ${filter}
  `).bind(...params).first<{ total: number }>()

  return c.json({ data: complaints.results, total: count?.total || 0, limit, offset })
})

// ============================================================
// [Super Admin] PUT /api/earnings/admin/complaints/:id/resolve
// Menyelesaikan komplain (Refund pembeli atau Tolak komplain & rilis dana ke seller)
// ============================================================
const adminResolveComplaintSchema = z.object({
  action: z.enum(['refund', 'release']), // 'refund' = setujui refund pembeli, 'release' = tolak komplain & rilis dana ke seller
  admin_notes: z.string().trim().max(500).optional(),
})

earnings.put(
  '/admin/complaints/:id/resolve',
  requirePermission('view_dashboard'),
  rateLimit(20, 60, 'admin_complaints_resolve'),
  zValidator('json', adminResolveComplaintSchema),
  async (c) => {
    const user = c.get('user')
    if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

    const id = c.req.param('id')
    const { action, admin_notes } = c.req.valid('json')

    const complaint = await c.env.DB.prepare(`
      SELECT id, transaction_id, status, hub_transaction_id FROM order_complaints WHERE id = ?
    `).bind(id).first<{ id: string; transaction_id: string; status: string; hub_transaction_id: string }>()

    if (!complaint) {
      throw new HTTPException(404, { message: 'Komplain tidak ditemukan.' })
    }

    if (complaint.status === 'resolved_refunded' || complaint.status === 'resolved_rejected') {
      throw new HTTPException(400, { message: `Komplain sudah diselesaikan sebelumnya (${complaint.status}).` })
    }

    // Ambil data transaksi penjualan terkait
    const sale = await c.env.DB.prepare(`
      SELECT id, product_id, payout_status, withdrawal_request_id, seller_net_amount FROM sale_transactions WHERE id = ?
    `).bind(complaint.transaction_id).first<{ id: string; product_id: string; payout_status: string; withdrawal_request_id: string | null; seller_net_amount: number }>()

    if (!sale) {
      throw new HTTPException(404, { message: 'Transaksi terkait komplain ini tidak ditemukan.' })
    }

    if (action === 'refund') {
      // Jika dana telah terlanjur ditransfer ke seller
      if (sale.payout_status === 'transferred') {
        throw new HTTPException(400, {
          message: 'Dana transaksi ini telah terlanjur ditransfer ke rekening seller. Refund otomatis tidak dapat diproses sebelum rekonsiliasi manual dilakukan.'
        })
      }

      // 1. Sinkronisasi S2S ke Hub terlebih dahulu untuk memastikan Saldo Dompet Pembeli berhasil dikreditkan
      const hubUrl = c.env.HUB_URL || 'https://asisten-guru.id'
      const s2sSecret = c.env.S2S_INTERNAL_SECRET || ''

      if (complaint.hub_transaction_id) {
        if (!s2sSecret) {
          throw new HTTPException(500, {
            message: 'Konfigurasi integrasi server belum lengkap (S2S Secret belum disetel). Silakan hubungi tim pengembang.'
          })
        }

        try {
          const hubRes = await fetch(`${hubUrl}/api/marketplace/order/complaint/resolve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${s2sSecret}`
            },
            body: JSON.stringify({
              hub_transaction_id: complaint.hub_transaction_id,
              action: 'refund',
              admin_notes: admin_notes || null
            })
          })

          if (!hubRes.ok) {
            let hubErrMsg = 'Hub menolak proses pengembalian dana.'
            try {
              const errJson = await hubRes.json() as any
              if (errJson?.error) hubErrMsg = errJson.error
              else if (errJson?.message) hubErrMsg = errJson.message
            } catch {
              hubErrMsg = `HTTP ${hubRes.status}`
            }
            console.error('[Complaints S2S] Gagal proses refund di Hub:', hubRes.status, hubErrMsg)
            throw new HTTPException(502, {
              message: 'Gagal memproses pengembalian saldo pembeli di server pusat. Data transaksi di CMS belum diubah. Silakan coba sesaat lagi.'
            })
          }
        } catch (hubErr: any) {
          if (hubErr instanceof HTTPException) throw hubErr
          console.error('[Complaints S2S] Error connecting to Hub:', hubErr)
          throw new HTTPException(502, {
            message: 'Tidak dapat terhubung ke server pusat untuk mengkreditkan saldo pembeli. Silakan coba kembali sesaat lagi.'
          })
        }
      }

      // 2. Hub berhasil memproses refund -> Terapkan pembatalan transaksi dan status komplain di CMS secara atomik
      const refundBatch = [
        c.env.DB.prepare(`
          UPDATE order_complaints
          SET status = 'resolved_refunded', admin_notes = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(admin_notes || null, user.id, id),
        c.env.DB.prepare(`
          UPDATE sale_transactions
          SET status = 'refunded', dispute_status = 'refunded', withdrawal_request_id = NULL
          WHERE id = ?
        `).bind(complaint.transaction_id),
        c.env.DB.prepare(`
          UPDATE products
          SET sales_count = MAX(0, COALESCE(sales_count, 0) - 1), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(sale.product_id)
      ]

      // Jika transaksi ini masih terikat ke antrean penarikan dana pending, kurangi amount penarikan
      if (sale.withdrawal_request_id) {
        refundBatch.push(
          c.env.DB.prepare(`
            UPDATE withdrawal_requests
            SET amount = MAX(0, amount - ?)
            WHERE id = ? AND status = 'pending'
          `).bind(sale.seller_net_amount, sale.withdrawal_request_id)
        )
      }

      await c.env.DB.batch(refundBatch)

      return c.json({ message: 'Komplain berhasil diselesaikan dengan status Refund Pembeli. Saldo pembeli telah dikreditkan di Hub dan transaksi seller telah dibatalkan.' })
    } else {
      // Tolak komplain & rilis dana: rilis dana langsung ke Saldo Aktif seller
      await c.env.DB.batch([
        c.env.DB.prepare(`
          UPDATE order_complaints
          SET status = 'resolved_rejected', admin_notes = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(admin_notes || null, user.id, id),
        c.env.DB.prepare(`
          UPDATE sale_transactions
          SET dispute_status = 'resolved', hold_until = datetime('now')
          WHERE id = ?
        `).bind(complaint.transaction_id)
      ])

      // Sinkronisasi S2S ke Hub bahwa komplain ditolak
      const hubUrl = c.env.HUB_URL || 'https://asisten-guru.id'
      const s2sSecret = c.env.S2S_INTERNAL_SECRET || ''
      if (complaint.hub_transaction_id) {
        if (!s2sSecret) {
          console.warn('[Complaints S2S] S2S_INTERNAL_SECRET belum disetel. Hub tidak dapat disinkronkan.')
        } else {
          c.executionCtx.waitUntil((async () => {
            try {
              const res = await fetch(`${hubUrl}/api/marketplace/order/complaint/resolve`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${s2sSecret}`
                },
                body: JSON.stringify({
                  hub_transaction_id: complaint.hub_transaction_id,
                  action: 'release',
                  admin_notes: admin_notes || null
                })
              })
              if (!res.ok) {
                const errBody = await res.text()
                console.error(`[Complaints S2S] Gagal tolak komplain di Hub. Status: ${res.status}, Body: ${errBody}`)
              }
            } catch (s2sErr) {
              console.error('[Complaints S2S] Failed to notify Hub about complaint rejection:', s2sErr)
            }
          })())
        }
      }

      return c.json({ message: 'Komplain telah ditutup. Dana transaksi telah resmi dilepaskan ke Saldo Aktif seller.' })
    }
  }
)

export default earnings

