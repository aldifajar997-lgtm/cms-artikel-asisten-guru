-- ============================================================
-- MIGRATION: Holding Period (3 Hari) & Penanganan Komplain Pembeli
-- Versi: 1.0
-- Tanggal: 2026-10-19
-- ============================================================

-- 1. Tambah kolom hold_until dan dispute_status ke sale_transactions
ALTER TABLE sale_transactions ADD COLUMN hold_until DATETIME;
ALTER TABLE sale_transactions ADD COLUMN dispute_status TEXT NOT NULL DEFAULT 'none';

-- 2. Backfill hold_until untuk transaksi yang sudah ada
UPDATE sale_transactions 
SET hold_until = datetime(paid_at, '+3 days')
WHERE hold_until IS NULL;

-- 3. Tabel Order Complaints / Sengketa Pembeli
CREATE TABLE IF NOT EXISTS order_complaints (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES sale_transactions(id) ON DELETE CASCADE,
    hub_transaction_id TEXT NOT NULL,
    buyer_hub_id TEXT NOT NULL,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK(category IN ('corrupt_file', 'broken_link', 'content_mismatch', 'other')),
    reason TEXT NOT NULL,
    evidence_urls TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'seller_replied', 'under_review', 'resolved_refunded', 'resolved_rejected')),
    seller_response TEXT,
    seller_replacement_url TEXT,
    seller_responded_at DATETIME,
    admin_notes TEXT,
    resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_hold_until ON sale_transactions(seller_id, hold_until, payout_status);
CREATE INDEX IF NOT EXISTS idx_complaints_seller ON order_complaints(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_hub_txn ON order_complaints(hub_transaction_id);
