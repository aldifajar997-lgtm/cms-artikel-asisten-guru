-- ==============================================================================
-- Migrasi: Custom Vanity Store Slug (asisten-guru.id/:namatoko)
-- File: migrasi/migration_store_slug.sql
-- ==============================================================================

-- 1. Tambah kolom store_slug pada tabel users (nullable untuk akun biasa / pembeli)
ALTER TABLE users ADD COLUMN store_slug TEXT;

-- 2. Buat partial unique index untuk mencegah duplikasi slug antar mitra guru
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_store_slug 
ON users(store_slug) 
WHERE store_slug IS NOT NULL;

-- 3. Catatan: Slug toko dibuat 1x seumur hidup secara sadar oleh masing-masing mitra yang sudah disetujui (approved)
-- melalui antarmuka Store Appearance Studio dengan konfirmasi dialog permanen.
-- Oleh karena itu, backfill otomatis tidak diaktifkan demi mencegah penguncian slug yang tidak dikehendaki mitra.

