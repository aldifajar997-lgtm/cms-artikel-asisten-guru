-- ===================================================================
-- MIGRATION: DOKUMEN LEGAL MITRA & AUDIT TRAIL REVISI
-- Tabel penyimpanan naskah hukum (S&K, Kebijakan Privasi, dsb)
-- beserta riwayat revisi kepatuhan UU PDP & hukum kemitraan.
-- ===================================================================

-- 1. Tabel Utama Dokumen Legal Aktif
CREATE TABLE IF NOT EXISTS legal_documents (
    id TEXT PRIMARY KEY,                       -- 'seller_terms', 'seller_privacy'
    title TEXT NOT NULL,                      -- Judul resmi dokumen
    content TEXT NOT NULL,                    -- Konten Markdown
    version INTEGER NOT NULL DEFAULT 1,       -- Versi nomor bulat (1, 2, 3...)
    is_published INTEGER NOT NULL DEFAULT 1,  -- 1 = Terbit/Aktif, 0 = Draf
    updated_by TEXT,                          -- ID Super Admin yang terakhir mengubah
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Tabel Riwayat Revisi & Audit Trail Hukum
CREATE TABLE IF NOT EXISTS legal_document_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,                -- Relasi ke legal_documents.id
    version INTEGER NOT NULL,                 -- Nomor versi saat revisi ini disimpan
    title TEXT NOT NULL,                      -- Judul naskah pada revisi ini
    content TEXT NOT NULL,                    -- Snapshot konten lengkap
    change_summary TEXT,                      -- Catatan rilis/ringkasan perubahan
    created_by TEXT,                          -- ID Super Admin pembuat revisi
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES legal_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_legal_rev_doc_ver 
    ON legal_document_revisions(document_id, version DESC);
