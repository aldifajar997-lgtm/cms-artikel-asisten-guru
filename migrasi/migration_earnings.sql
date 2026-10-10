-- ============================================================
-- MIGRATION: Earnings & Transaction Tracking System
-- Versi: 1.0
-- Tanggal: 2026-09-29
-- ============================================================
-- Catatan: Semua nilai harga disimpan dalam satuan TERKECIL (sen/rupiah penuh integer)
-- Potongan admin dihitung dalam basis points (1 basis point = 0.01%)
-- Contoh: admin_fee_bps = 1000 berarti potongan 10%

-- ============================================================
-- TABEL 1: Riwayat Perubahan Harga Produk
-- ============================================================
-- Tujuan: Setiap kali harga produk berubah, snapshot disimpan di sini
-- sehingga sistem bisa MEMETAKAN harga yang berlaku pada saat transaksi
-- terjadi (bukan harga sekarang).
CREATE TABLE IF NOT EXISTS product_price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- Harga jual saat itu (setelah diskon jika ada)
    price INTEGER NOT NULL,
    -- Harga asli/coret saat itu (sebelum diskon, bisa NULL)
    original_price INTEGER,
    -- Siapa yang mengubah harga ini (user CMS)
    changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    -- Alasan perubahan (opsional, untuk audit trail)
    change_reason TEXT,
    -- Waktu perubahan (nanoseconds precision untuk ordering yang tepat)
    effective_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id, effective_at DESC);

-- ============================================================
-- TABEL 2: Konfigurasi Potongan Admin (Admin Fee)
-- ============================================================
-- Tujuan: Menyimpan riwayat berapa % potongan admin yang berlaku
-- pada periode tertentu. Ini memungkinkan potongan diubah tanpa
-- mempengaruhi kalkulasi transaksi lama (audit-safe).
CREATE TABLE IF NOT EXISTS admin_fee_config (
    id TEXT PRIMARY KEY,
    -- Persentase potongan dalam basis points (1 bps = 0.01%)
    -- Contoh: 1000 = 10%, 500 = 5%, 1500 = 15%
    fee_bps INTEGER NOT NULL CHECK(fee_bps >= 0 AND fee_bps <= 10000),
    -- Potongan minimum dalam satuan terkecil (rupiah), bisa NULL = tidak ada minimum
    min_fee INTEGER,
    -- Potongan maksimum dalam satuan terkecil (rupiah), bisa NULL = tidak ada cap
    max_fee INTEGER,
    -- Siapa yang mengatur ini
    set_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    -- Catatan/alasan perubahan kebijakan
    note TEXT,
    -- Berlaku mulai kapan
    effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_config_effective ON admin_fee_config(effective_from DESC);

-- ============================================================
-- TABEL 3: Transaksi Penjualan (Sales Ledger)
-- ============================================================
-- Tujuan: Setiap notifikasi "pembayaran berhasil" dari Hub menghasilkan
-- SATU record di sini. Ini adalah buku besar pendapatan seller.
CREATE TABLE IF NOT EXISTS sale_transactions (
    id TEXT PRIMARY KEY,
    -- ID produk yang terjual
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    -- ID seller/penulis pemilik produk
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- === SNAPSHOT HARGA SAAT TRANSAKSI ===
    -- (Harga dikunci saat transaksi terjadi, TIDAK berubah meski harga produk berubah kemudian)
    -- ID record riwayat harga yang berlaku saat ini
    price_history_id TEXT REFERENCES product_price_history(id) ON DELETE SET NULL,
    -- Harga aktual yang dibayar pembeli (cross-check dari Hub payload)
    gross_amount INTEGER NOT NULL,

    -- === KALKULASI POTONGAN ADMIN ===
    -- ID konfigurasi fee yang dipakai untuk kalkulasi ini
    fee_config_id TEXT REFERENCES admin_fee_config(id) ON DELETE SET NULL,
    -- Besaran fee_bps yang dipakai saat kalkulasi (snapshot, tidak berubah)
    applied_fee_bps INTEGER NOT NULL DEFAULT 0,
    -- Nominal potongan admin (sudah termasuk logika min/max jika ada)
    admin_fee_amount INTEGER NOT NULL DEFAULT 0,
    -- Nominal bersih yang menjadi hak seller (gross_amount - admin_fee_amount)
    seller_net_amount INTEGER NOT NULL,

    -- === METADATA TRANSAKSI DARI HUB ===
    -- Transaction ID unik dari Hub (untuk idempotency & reconciliation)
    hub_transaction_id TEXT UNIQUE NOT NULL,
    -- User Hub yang membeli (ID akun di Hub, bukan di CMS ini)
    buyer_hub_id TEXT,
    -- Status transaksi: 'settled' (lunas), 'refunded' (dikembalikan)
    status TEXT NOT NULL DEFAULT 'settled' CHECK(status IN ('settled', 'refunded')),
    -- Waktu pembayaran berhasil dikonfirmasi Hub
    paid_at DATETIME NOT NULL,
    -- Waktu CMS menerima dan memproses notifikasi ini
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- === SPLIT BILL (untuk arsip, eksekusi manual) ===
    -- Status transfer manual ke seller: 'pending', 'transferred', 'skipped'
    payout_status TEXT NOT NULL DEFAULT 'pending' CHECK(payout_status IN ('pending', 'transferred', 'skipped')),
    -- Tanggal Super Admin mengeksekusi transfer manual
    payout_at DATETIME,
    -- Catatan transfer (nomor rekening, konfirmasi, dll) — hanya visible ke Super Admin
    payout_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_sale_seller ON sale_transactions(seller_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_product ON sale_transactions(product_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_status ON sale_transactions(status, payout_status);
CREATE INDEX IF NOT EXISTS idx_sale_hub_txn ON sale_transactions(hub_transaction_id);

-- ============================================================
-- SEED: Konfigurasi Fee Default (10%)
-- ============================================================
-- Ubah nilai ini sesuai kebijakan platform sebelum deploy!
INSERT OR IGNORE INTO admin_fee_config (id, fee_bps, note, set_by, effective_from)
VALUES (
    'default-fee-v1',
    1000,  -- 10%
    'Konfigurasi awal potongan platform 10% per transaksi',
    NULL,
    CURRENT_TIMESTAMP
);
