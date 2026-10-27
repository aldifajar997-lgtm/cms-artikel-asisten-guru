-- ==============================================================================
-- Migrasi Sinkronisasi Indexing Database Cloudflare D1 (cms-db)
-- File: migrasi/migration_remote_sync_indexes.sql
-- Database: cms-db (D1)
-- ==============================================================================
-- Tujuan:
-- 1. Mengeliminasi Full-Table Scan pada query berkas media berdasarkan pengunggah
-- 2. Mengoptimalkan query katalog produk publik gabungan (status + created_at)
-- 3. Mengoptimalkan lookup transaksi sengketa/komplain pada sale_transactions
-- 4. Semua index menggunakan IF NOT EXISTS sehingga aman dan idempotent
-- ==============================================================================

-- 1. INDEXING TABEL MEDIA
-- Mempercepat query: SELECT ... FROM media WHERE uploaded_by = ? ORDER BY created_at DESC
-- Serta lookup kepemilikan media saat upload/delete
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by_created
ON media(uploaded_by, created_at DESC);

-- Mempercepat verifikasi r2_key dengan uploaded_by
CREATE INDEX IF NOT EXISTS idx_media_r2_key_uploaded
ON media(r2_key, uploaded_by);

-- 2. INDEXING TABEL SALE TRANSACTIONS (SENGKETA & KOMPLAIN)
-- Mempercepat klausa: WHERE seller_id = ? AND status = 'settled' AND payout_status = 'pending' AND withdrawal_request_id IS NULL
CREATE INDEX IF NOT EXISTS idx_sale_withdrawable_lookup
ON sale_transactions(seller_id, status, payout_status, withdrawal_request_id);

-- 3. INDEXING TABEL PRODUCTS (FALLBACK FILTER KATEGORI & AUTHOR)
CREATE INDEX IF NOT EXISTS idx_products_category_created
ON products(category_id, created_at DESC);
