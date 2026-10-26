-- ==============================================================================
-- Migrasi: Penambahan Kolom Biodata Diri & Biodata Toko Calon Mitra Seller
-- File: migrasi/migration_mitra_onboarding_fields.sql
-- ==============================================================================

ALTER TABLE users ADD COLUMN personal_address TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN birth_date TEXT;
ALTER TABLE users ADD COLUMN store_name TEXT;
ALTER TABLE users ADD COLUMN store_description TEXT;
ALTER TABLE users ADD COLUMN store_address TEXT;
