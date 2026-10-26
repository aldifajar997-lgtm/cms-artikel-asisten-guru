-- ============================================================
-- MIGRATION: Storefront & Traffic Intelligence Analytics (D1 Atomic)
-- Versi: 1.0
-- Tanggal: 2026-10-22
-- ============================================================
-- Catatan Arsitektur:
-- Menggunakan model Atomic Daily Rollup (Counter Upsert) agar hemat kuota I/O D1
-- dan mencegah lock table pada lonjakan trafik.

CREATE TABLE IF NOT EXISTS store_daily_analytics (
    id TEXT PRIMARY KEY, -- Deterministic ID: {seller_id}:{date}:{event_type}:{source}:{device_type}
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL DEFAULT '', -- String kosong untuk kunjungan etalase toko
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    event_type TEXT NOT NULL CHECK(event_type IN ('store_view', 'product_view', 'checkout_intent')),
    source TEXT NOT NULL DEFAULT 'direct', -- 'whatsapp', 'instagram', 'tiktok', 'facebook', 'google', 'direct', 'other'
    device_type TEXT NOT NULL DEFAULT 'mobile', -- 'mobile', 'tablet', 'desktop'
    count INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, product_id, date, event_type, source, device_type)
);

-- Composite Covering Index untuk Query Agregasi Cepat (< 15ms)
CREATE INDEX IF NOT EXISTS idx_store_daily_seller_date 
ON store_daily_analytics(seller_id, date DESC, event_type, source);

CREATE INDEX IF NOT EXISTS idx_store_daily_product 
ON store_daily_analytics(product_id, date DESC) WHERE product_id != '';
