-- ==============================================================================
-- Migrasi: Penambahan Konfigurasi Appearance (Tampilan & Tema Toko Mitra)
-- File: migrasi/migration_store_appearance.sql
-- ==============================================================================

-- 1. Tambah kolom store_appearance pada tabel users
ALTER TABLE users ADD COLUMN store_appearance TEXT;

-- 2. Buat index parsial untuk performa query profil publik toko mitra
CREATE INDEX IF NOT EXISTS idx_users_seller_public 
ON users(id, is_active, seller_status) 
WHERE is_active = 1 AND seller_status = 'approved';
