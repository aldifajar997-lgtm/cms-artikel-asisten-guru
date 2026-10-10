CREATE TABLE IF NOT EXISTS product_reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, user_id)
);

ALTER TABLE products ADD COLUMN average_rating REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN total_reviews INTEGER DEFAULT 0;
