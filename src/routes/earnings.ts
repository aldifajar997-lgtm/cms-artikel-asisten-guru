import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { HTTPException } from 'hono/http-exception'
import { getPagination } from '../utils/pagination'
import { rateLimit } from '../middlewares/rate-limit'

const earnings = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL THEN seller_net_amount ELSE 0 END), 0) as pending_payout,
      COALESCE(SUM(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NOT NULL THEN seller_net_amount ELSE 0 END), 0) as processing_payout,
      COALESCE(SUM(CASE WHEN payout_status = 'transferred' THEN seller_net_amount ELSE 0 END), 0) as paid_out,
      COUNT(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NULL THEN 1 END) as pending_count,
      COUNT(CASE WHEN payout_status = 'pending' AND withdrawal_request_id IS NOT NULL THEN 1 END) as processing_count,
      COUNT(CASE WHEN payout_status = 'transferred' THEN 1 END) as transferred_count
    FROM sale_transactions
    WHERE seller_id = ? AND status = 'settled'
    ${dateFilter}
  `).bind(...params).first()

  // Ambil fee config yang aktif saat ini untuk ditampilkan ke seller
  const feeConfig = await c.env.DB.prepare(`
    SELECT fee_bps, min_fee, max_fee FROM admin_fee_config
    WHERE effective_from <= CURRENT_TIMESTAMP
    ORDER BY effective_from DESC LIMIT 1
  `).first<{ fee_bps: number; min_fee: number | null; max_fee: number | null }>()

  return c.json({
    seller_id: sellerId,
    period: { from: fromDate, to: toDate },
    summary,
    current_fee_policy: feeConfig ? {
      fee_percent: (feeConfig.fee_bps / 100).toFixed(2) + '%',
      min_fee: feeConfig.min_fee,
      max_fee: feeConfig.max_fee
    } : null
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
    WHERE st.seller_id = ? AND st.status = 'settled'
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
      st.payout_status,
      st.paid_at,
      st.processed_at,
      st.payout_at,
      p.id as product_id,
      p.title as product_title,
      p.slug as product_slug
    FROM sale_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    WHERE st.seller_id = ? AND st.status = 'settled'
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
      'SELECT id, payout_status, seller_id FROM sale_transactions WHERE id = ?'
    ).bind(transactionId).first<{ id: string; payout_status: string; seller_id: string }>()

    if (!existing) throw new HTTPException(404, { message: 'Transaksi tidak ditemukan.' })

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
// Melihat & mengelola konfigurasi potongan admin
// ============================================================
earnings.get('/admin/fee-config', requirePermission('view_dashboard'), rateLimit(10, 60, 'fee_config'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Akses ditolak.' })
  }

  const configs = await c.env.DB.prepare(`
    SELECT afc.id, afc.fee_bps, afc.min_fee, afc.max_fee, afc.note, afc.effective_from, u.name as set_by_name
    FROM admin_fee_config afc
    LEFT JOIN users u ON afc.set_by = u.id
    ORDER BY afc.effective_from DESC
    LIMIT 20
  `).all()

  return c.json({ data: configs.results })
})

const feeConfigSchema = z.object({
  fee_bps: z.number().int().min(0).max(10000),
  min_fee: z.number().int().min(0).optional().nullable(),
  max_fee: z.number().int().min(0).optional().nullable(),
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
      throw new HTTPException(400, { message: 'Batas minimum tidak boleh lebih besar dari batas maksimum.' })
    }

    const id = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO admin_fee_config (id, fee_bps, min_fee, max_fee, note, set_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.fee_bps,
      body.min_fee ?? null,
      body.max_fee ?? null,
      body.note ?? null,
      user.id
    ).run()

    return c.json({
      message: `Konfigurasi potongan baru berhasil dibuat: ${(body.fee_bps / 100).toFixed(2)}% per transaksi.`,
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

    // Hitung total dana yang bisa ditarik
    const summary = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(seller_net_amount), 0) as total_net
      FROM sale_transactions
      WHERE seller_id = ? AND status = 'settled' AND payout_status = 'pending' AND withdrawal_request_id IS NULL
    `).bind(user.id).first<{ total_net: number }>()

    const withdrawableAmount = summary?.total_net || 0
    if (withdrawableAmount < 10000) {
      throw new HTTPException(400, { message: 'Saldo minimum untuk ditarik adalah Rp 10.000.' })
    }

    const id = crypto.randomUUID()

    // Mulai transaksi manual atau eksekusi beruntun (karena D1 batch)
    // Gunakan INSERT ... SELECT ... HAVING untuk mencegah race condition (double withdrawal)
    const batchRes = await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO withdrawal_requests (id, seller_id, amount, bank_details, status)
        SELECT ?, seller_id, SUM(seller_net_amount), ?, 'pending'
        FROM sale_transactions
        WHERE seller_id = ? AND status = 'settled' AND payout_status = 'pending' AND withdrawal_request_id IS NULL
        GROUP BY seller_id
        HAVING SUM(seller_net_amount) >= 10000
        RETURNING amount
      `).bind(id, body.bank_details, user.id),
      c.env.DB.prepare(`
        UPDATE sale_transactions
        SET withdrawal_request_id = ?
        WHERE seller_id = ? AND status = 'settled' AND payout_status = 'pending' AND withdrawal_request_id IS NULL
      `).bind(id, user.id)
    ])

    if (batchRes[0].meta.changes === 0) {
      throw new HTTPException(400, { message: 'Gagal memproses penarikan. Saldo tidak mencukupi atau sedang diproses.' })
    }
    
    const actualAmountInserted = (batchRes[0].results as any)[0]?.amount || withdrawableAmount;

    return c.json({ message: 'Permintaan penarikan dana berhasil dibuat.', id, amount: actualAmountInserted })
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

export default earnings
