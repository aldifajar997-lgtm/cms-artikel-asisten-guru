-- ==============================================================================
-- Migrasi: Registrasi Seller SSO Asisten Guru & Kurasi Produk Digital
-- File: migrasi/migration_seller_sso_and_curation.sql
-- ==============================================================================

-- 1. Penambahan Kolom Akun Seller & Hub SSO ke Tabel Users
ALTER TABLE users ADD COLUMN hub_account_id TEXT;
ALTER TABLE users ADD COLUMN seller_status TEXT NOT NULL DEFAULT 'none'; -- 'none', 'pending', 'approved', 'rejected', 'suspended'
ALTER TABLE users ADD COLUMN seller_applied_at DATETIME;
ALTER TABLE users ADD COLUMN seller_approved_at DATETIME;
ALTER TABLE users ADD COLUMN seller_approved_by TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN seller_rejection_reason TEXT;
ALTER TABLE users ADD COLUMN bank_name TEXT;
ALTER TABLE users ADD COLUMN bank_account_number TEXT;
ALTER TABLE users ADD COLUMN bank_account_holder TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hub_account_id ON users(hub_account_id) WHERE hub_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_seller_status ON users(seller_status);

-- 2. Penambahan Kolom Kurasi & Moderasi ke Tabel Products
ALTER TABLE products ADD COLUMN review_notes TEXT;
ALTER TABLE products ADD COLUMN submitted_for_review_at DATETIME;
ALTER TABLE products ADD COLUMN reviewed_at DATETIME;
ALTER TABLE products ADD COLUMN reviewed_by TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_products_curation_status ON products(status, submitted_for_review_at DESC);

-- 3. Tabel Proteksi State CSRF untuk Alur SSO Hub Asisten Guru
CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    redirect_uri TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- 4. Pastikan Role Seller & Hak Akses Terdaftar
INSERT OR IGNORE INTO roles (id, name, description) 
VALUES ('role-seller', 'Seller', 'Mitra Kreator & Penjual Produk Digital');

INSERT OR IGNORE INTO permissions (id, name) VALUES 
  ('create_product', 'create_product'),
  ('edit_product', 'edit_product'),
  ('delete_product', 'delete_product'),
  ('view_dashboard', 'view_dashboard'),
  ('upload_media', 'upload_media'),
  ('delete_media', 'delete_media');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Seller' AND p.name IN (
  'create_product', 
  'edit_product', 
  'delete_product', 
  'view_dashboard', 
  'upload_media', 
  'delete_media'
);
