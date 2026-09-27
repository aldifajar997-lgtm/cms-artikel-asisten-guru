-- Tambahkan kolom type ke tabel categories
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'article';

-- Tambahkan kolom alt text dan detail image ke tabel products
ALTER TABLE products ADD COLUMN cover_image_alt TEXT;
ALTER TABLE products ADD COLUMN detail_image_1_key TEXT;
ALTER TABLE products ADD COLUMN detail_image_1_alt TEXT;
ALTER TABLE products ADD COLUMN detail_image_2_key TEXT;
ALTER TABLE products ADD COLUMN detail_image_2_alt TEXT;
ALTER TABLE products ADD COLUMN detail_image_3_key TEXT;
ALTER TABLE products ADD COLUMN detail_image_3_alt TEXT;
