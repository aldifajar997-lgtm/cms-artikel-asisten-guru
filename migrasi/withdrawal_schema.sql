CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL,
    bank_details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'rejected')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    admin_note TEXT,
    transfer_receipt_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_seller ON withdrawal_requests(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);

ALTER TABLE sale_transactions ADD COLUMN withdrawal_request_id TEXT REFERENCES withdrawal_requests(id) ON DELETE SET NULL;
