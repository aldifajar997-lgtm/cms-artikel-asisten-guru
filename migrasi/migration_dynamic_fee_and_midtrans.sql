-- ============================================================
-- MIGRATION: Skema Kebijakan Bagi Hasil Dinamis & Biaya Midtrans
-- Tanggal: 2026-10-19
-- ============================================================

-- 1. Pastikan tabel admin_fee_config lengkap dengan kolom kebijakan dinamis
CREATE TABLE IF NOT EXISTS admin_fee_config (
    id TEXT PRIMARY KEY,
    fee_bps INTEGER NOT NULL CHECK(fee_bps >= 0 AND fee_bps <= 10000),
    min_fee INTEGER,
    max_fee INTEGER,
    min_withdrawal_amount INTEGER NOT NULL DEFAULT 50000,
    min_product_price INTEGER NOT NULL DEFAULT 10000,
    midtrans_fee_payer TEXT NOT NULL DEFAULT 'buyer',
    midtrans_qris_rate_bps INTEGER NOT NULL DEFAULT 70,
    midtrans_va_fee INTEGER NOT NULL DEFAULT 4000,
    midtrans_fee_note TEXT DEFAULT 'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)',
    bank_disbursement_fee INTEGER NOT NULL DEFAULT 2500,
    set_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Kolom baru untuk tabel admin_fee_config jika tabel sudah ada sebelumnya
ALTER TABLE admin_fee_config ADD COLUMN min_withdrawal_amount INTEGER NOT NULL DEFAULT 50000;
ALTER TABLE admin_fee_config ADD COLUMN min_product_price INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE admin_fee_config ADD COLUMN midtrans_fee_payer TEXT NOT NULL DEFAULT 'buyer';
ALTER TABLE admin_fee_config ADD COLUMN midtrans_qris_rate_bps INTEGER NOT NULL DEFAULT 70;
ALTER TABLE admin_fee_config ADD COLUMN midtrans_va_fee INTEGER NOT NULL DEFAULT 4000;
ALTER TABLE admin_fee_config ADD COLUMN midtrans_fee_note TEXT DEFAULT 'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)';
ALTER TABLE admin_fee_config ADD COLUMN bank_disbursement_fee INTEGER NOT NULL DEFAULT 2500;

CREATE INDEX IF NOT EXISTS idx_fee_config_effective ON admin_fee_config(effective_from DESC);

-- 2. Index partial untuk mencegah double submission penarikan dana simultan (race condition)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_single_pending_withdrawal 
ON withdrawal_requests(seller_id) WHERE status = 'pending';

-- 3. Seed konfigurasi awal resmi: 15% Platform (85% Kreator) sesuai S&K Pasal 4 Ayat 2
INSERT OR IGNORE INTO admin_fee_config (
    id, fee_bps, min_fee, max_fee, 
    min_withdrawal_amount, min_product_price, 
    midtrans_fee_payer, midtrans_qris_rate_bps, midtrans_va_fee, 
    midtrans_fee_note, bank_disbursement_fee, 
    note, set_by, effective_from
) VALUES (
    'policy-official-v1',
    1500, -- 15% (Kreator 85%)
    NULL,
    NULL,
    50000, -- Min penarikan Rp 50.000
    10000, -- Min harga produk Rp 10.000
    'buyer', -- Midtrans dibebankan ke pembeli saat checkout
    70,    -- 0.7% QRIS
    4000,  -- Rp 4.000 VA
    'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)',
    2500,  -- Biaya BI-Fast Rp 2.500
    'Kebijakan resmi skema bagi hasil 85:15 dan transparansi fee gateway Midtrans',
    NULL,
    CURRENT_TIMESTAMP
);
