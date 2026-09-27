ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN meta_title TEXT;
ALTER TABLE products ADD COLUMN meta_description TEXT;
ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN sales_count INTEGER DEFAULT 0;
