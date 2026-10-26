-- Migration: Add payment_method to sale_transactions
-- Memungkinkan pencatatan metode pembayaran (qris, bca_va, bni_va, wallet, gopay, dll) dari Hub
ALTER TABLE sale_transactions ADD COLUMN payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_sale_payment_method ON sale_transactions(seller_id, payment_method);
