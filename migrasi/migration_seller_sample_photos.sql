-- ==============================================================================
-- Migrasi: Kolom Foto Contoh Produk untuk Kurasi Calon Mitra Seller
-- File: migrasi/migration_seller_sample_photos.sql
-- ==============================================================================

ALTER TABLE users ADD COLUMN seller_sample_photos TEXT;
