CREATE TABLE IF NOT EXISTS slug_history (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'post' or 'product'
  reference_id TEXT NOT NULL,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slug_history_old_type ON slug_history(old_slug, type);
