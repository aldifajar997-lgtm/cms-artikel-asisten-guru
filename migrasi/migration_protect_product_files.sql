-- ==============================================================================
-- Migrasi: Proteksi Hak Unduh Pembeli & Riwayat Berkas Digital
-- File: migrasi/migration_protect_product_files.sql
-- ==============================================================================

-- 1. Tambah kolom purchased_file_r2_key ke tabel sale_transactions
-- Kolom ini menyimpan snapshot file_r2_key yang aktif saat pembeli melakukan checkout/pembayaran,
-- memastikan pembeli selalu memiliki akses ke berkas yang sah dibeli meski seller mengganti berkas di kemudian hari.
ALTER TABLE sale_transactions ADD COLUMN purchased_file_r2_key TEXT;

CREATE INDEX IF NOT EXISTS idx_sale_purchased_file ON sale_transactions(product_id, buyer_hub_id, purchased_file_r2_key);
