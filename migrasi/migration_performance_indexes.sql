-- ==============================================================================
-- Migrasi: Penambahan Database Indexing untuk Optimasi Performa Pembacaan D1
-- File: migrasi/migration_performance_indexes.sql
-- Database: cms-db (D1)
-- ==============================================================================
-- Catatan Keamanan:
-- 1. Semua perintah menggunakan `CREATE INDEX IF NOT EXISTS` sehingga 100% aman
--    dijalankan ulang (idempotent) tanpa risiko error atau duplikasi.
-- 2. Index yang sudah ada di database produksi (seperti idx_products_status_created,
--    idx_products_status_category, idx_reviews_product_created) sengaja tidak
--    diduplikasi untuk menjaga kebersihan skema dan kecepatan penulisan (INSERT/UPDATE).
-- ==============================================================================

-- 1. OPTIMASI ARTIKEL & KATEGORI (CMS Blog Hot-Path)
-- Mempercepat query artikel terpopuler: WHERE status = 'published' ORDER BY view_count DESC
CREATE INDEX IF NOT EXISTS idx_posts_status_views 
ON posts(status, view_count DESC);

-- Mempercepat filter artikel per kategori: WHERE status = 'published' AND category_id = ? ORDER BY published_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_status_category 
ON posts(status, category_id, published_at DESC);

-- Mempercepat filter artikel milik penulis/author tertentu
CREATE INDEX IF NOT EXISTS idx_posts_author_status 
ON posts(author_id, status, published_at DESC);

-- Mempercepat pencarian artikel berdasarkan tag (menghindari full scan pada tabel pivot)
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id 
ON post_tags(tag_id, post_id);

-- 2. OPTIMASI JOIN SELLER & PENGGUNA (Marketplace Listing JOIN)
-- Mempercepat JOIN: users u ON p.author_id = u.id WHERE u.is_active = 1 AND u.seller_status = 'approved'
CREATE INDEX IF NOT EXISTS idx_users_active_seller_status 
ON users(is_active, seller_status);

-- 3. OPTIMASI TRANSAKSI PENJUALAN & KOMPLAIN (Ledger & Sengketa)
-- Mempercepat lookup transaksi yang tertaut pada permohonan penarikan dana (withdrawal)
CREATE INDEX IF NOT EXISTS idx_sale_withdrawal 
ON sale_transactions(withdrawal_request_id);

-- Mempercepat lookup tiket komplain berdasarkan ID transaksi
CREATE INDEX IF NOT EXISTS idx_order_complaints_txn 
ON order_complaints(transaction_id);

-- 4. OPTIMASI SESI & REFRESH TOKEN (Keamanan & Pembersihan Rutin)
-- Mempercepat validasi dan penghapusan token sesi per user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_expires 
ON refresh_tokens(user_id, expires_at);
