-- ==============================================================================
-- Migrasi: Penambahan Kolom Nomor WhatsApp / HP Aktif User & Mitra Seller
-- File: migrasi/migration_phone_number.sql
-- ==============================================================================

ALTER TABLE users ADD COLUMN phone_number TEXT;
