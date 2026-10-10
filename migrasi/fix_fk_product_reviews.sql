-- Script untuk menghapus dan membuat ulang tabel product_reviews tanpa foreign key users
-- (Hanya jalankan ini jika migration sebelumnya sudah terlanjur di-apply ke production D1)

PRAGMA foreign_keys = OFF;

CREATE TABLE product_reviews_new (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, user_id)
);

INSERT INTO product_reviews_new SELECT * FROM product_reviews;

DROP TABLE product_reviews;
ALTER TABLE product_reviews_new RENAME TO product_reviews;

PRAGMA foreign_keys = ON;
