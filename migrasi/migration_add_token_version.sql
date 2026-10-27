-- ==============================================================================
-- Migrasi Penambahan Kolom token_version (Token Revocation List / Instant Killswitch)
-- File: migrasi/migration_add_token_version.sql
-- Database: cms-db (D1)
-- ==============================================================================
-- Tujuan:
-- 1. Menambahkan kolom token_version INTEGER DEFAULT 1 pada tabel users.
-- 2. Bersifat aditif & backward-compatible 100%. Data lama yang bernilai NULL/1
--    akan dianggap versi 1 sehingga sesi aktif yang sah tidak terganggu.
-- ==============================================================================

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
