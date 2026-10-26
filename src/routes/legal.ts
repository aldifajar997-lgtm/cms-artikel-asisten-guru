import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { Bindings, Variables } from '../types'
import { authMiddleware } from '../middlewares/auth'
import { rateLimit } from '../middlewares/rate-limit'
import { SELLER_TERMS_MARKDOWN } from '../data/seller-terms'
import { SELLER_PRIVACY_MARKDOWN } from '../data/seller-privacy'
import { renderLegalHtmlPage, LegalDocumentData } from '../utils/legal-html-template'

const legal = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Helper: Verifikasi otorisasi Super Admin
const verifySuperAdmin = (user: any) => {
  if (!user) {
    throw new HTTPException(401, { message: 'Sesi Anda telah berakhir, silakan login kembali.' })
  }
  const isSuper = user.role === 'super_admin' || user.id === 'super_admin'
  if (!isSuper) {
    throw new HTTPException(403, { message: 'Akses khusus Super Admin. Anda tidak memiliki izin untuk fitur ini.' })
  }
}

// Inisialisasi dokumen jika belum ada di database
export const ensureLegalDocumentSeeded = async (db: D1Database, id: string): Promise<LegalDocumentData> => {
  const existing = await db.prepare(
    'SELECT id, title, content, version, is_published, updated_at FROM legal_documents WHERE id = ?'
  ).bind(id).first<any>()

  if (existing) return existing

  let defaultTitle = ''
  let defaultContent = ''

  if (id === 'seller_terms') {
    defaultTitle = 'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru'
    defaultContent = SELLER_TERMS_MARKDOWN
  } else if (id === 'seller_privacy') {
    defaultTitle = 'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator'
    defaultContent = SELLER_PRIVACY_MARKDOWN
  } else {
    defaultTitle = 'Dokumen Legal Platform'
    defaultContent = '# Dokumen Legal Platform\n\nNaskah dokumen resmi belum tersedia atau sedang dalam penyesuaian.'
  }

  await db.prepare(`
    INSERT INTO legal_documents (id, title, content, version, is_published, updated_at)
    VALUES (?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
  `).bind(id, defaultTitle, defaultContent).run()

  // Simpan revisi awal
  await db.prepare(`
    INSERT INTO legal_document_revisions (document_id, version, title, content, change_summary, created_by, created_at)
    VALUES (?, 1, ?, ?, 'Inisialisasi dokumen resmi pertama kali', 'super_admin', CURRENT_TIMESTAMP)
  `).bind(id, defaultTitle, defaultContent).run()

  return {
    id,
    title: defaultTitle,
    content: defaultContent,
    version: 1,
    updated_at: new Date().toISOString()
  }
}

// Helper: Purge KV Cache saat Super Admin memperbarui / rollback dokumen
export const purgeLegalCache = async (env: Bindings, docId: string) => {
  const keys = [
    'cache:terms_seller',
    'cache:legal_html:seller_terms',
    'cache:legal_html:seller_privacy',
    `cache:legal_html:${docId}`
  ]
  await Promise.all(keys.map(k => env.KV.delete(k).catch(() => {})))
}

// Helper: Halaman Error Ramah Awam (Aturan User #7)
const renderFriendlyNotFoundHtml = (message: string): string => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dokumen Tidak Ditemukan — Asisten Guru</title>
  <meta name="robots" content="noindex, follow">
  <link rel="icon" type="image/svg+xml" href="https://asisten-guru.id/favicon.svg">
  <link rel="shortcut icon" href="https://asisten-guru.id/favicon.ico">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #fafaf9;
      color: #1c1917;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e7e5e4;
      border-radius: 1.5rem;
      padding: 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1.25rem;
      color: #0d5b52;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      color: #0f172a;
    }
    p {
      font-size: 0.9rem;
      color: #57534e;
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .btn {
      display: inline-block;
      background: #0d5b52;
      color: #ffffff;
      text-decoration: none;
      padding: 0.65rem 1.25rem;
      border-radius: 0.75rem;
      font-weight: 700;
      font-size: 0.85rem;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #083c36;
    }
  </style>
</head>
<body>
  <div class="card">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <h1>Dokumen Belum Tersedia</h1>
    <p>${message}</p>
    <a href="https://mitra.asisten-guru.id" class="btn">Kembali ke Portal Mitra</a>
  </div>
</body>
</html>`
}

// Helper Renderer HTML Statis dengan KV Edge Cache
export const renderLegalDocumentResponse = async (
  c: any,
  docId: string,
  activeSlug: 'tos' | 'privacy',
  canonicalPath: string
) => {
  const cacheKey = `cache:legal_html:${docId}`

  // 1. Coba baca dari Edge KV Cache
  try {
    const cachedHtml = await c.env.KV.get(cacheKey)
    if (cachedHtml) {
      c.header('Content-Type', 'text/html; charset=UTF-8')
      c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400')
      c.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'")
      c.header('X-Frame-Options', 'SAMEORIGIN')
      return c.html(cachedHtml)
    }
  } catch (err) {
    console.error('KV cache read error for legal html:', err)
  }

  // 2. Ambil dari database D1
  try {
    const doc = await ensureLegalDocumentSeeded(c.env.DB, docId)

    const portalUrl = 'https://mitra.asisten-guru.id'
    const canonicalUrl = `${portalUrl}${canonicalPath}`

    const html = renderLegalHtmlPage({
      doc,
      activeSlug,
      canonicalUrl,
      portalUrl
    })

    // Simpan ke KV Cache dengan TTL 24 jam (86400 detik)
    c.executionCtx.waitUntil(c.env.KV.put(cacheKey, html, { expirationTtl: 86400 }))

    c.header('Content-Type', 'text/html; charset=UTF-8')
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400')
    c.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; frame-ancestors 'self'")
    c.header('X-Frame-Options', 'SAMEORIGIN')
    return c.html(html)
  } catch (err) {
    console.error('Failed to render legal document HTML:', err)
    c.header('Content-Type', 'text/html; charset=UTF-8')
    return c.html(
      renderFriendlyNotFoundHtml('Dokumen legal yang Anda cari sedang dalam pembaruan atau belum dapat dimuat saat ini. Silakan coba kembali beberapa saat lagi.'),
      500
    )
  }
}

// =========================================================================
// ENDPOINT PUBLIK (Crawler, Robot, Pembaca Umum)
// =========================================================================

// --- A. GET /api/legal/public/:id ---
// Mengambil data dokumen legal dalam format JSON (Publik, Rate Limited)
legal.get('/public/:id', rateLimit(100, 60, 'legal_public_json'), async (c) => {
  const id = c.req.param('id')
  if (!id) {
    return c.json({ error: 'ID dokumen tidak valid', message: 'ID dokumen legal diperlukan.' }, 400)
  }

  try {
    const doc = await ensureLegalDocumentSeeded(c.env.DB, id)
    return c.json({
      data: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        version: doc.version,
        updated_at: doc.updated_at
      }
    }, 200, {
      'Cache-Control': 'public, max-age=1800, s-maxage=86400'
    })
  } catch (err) {
    console.error('Failed to get public legal doc:', err)
    return c.json({
      error: 'Dokumen tidak ditemukan',
      message: 'Dokumen legal yang Anda cari tidak tersedia.'
    }, 404)
  }
})

// --- B. GET /api/legal/public/:id/html ---
// Mengambil naskah dokumen dalam format HTML Statis lengkap (Publik, SEO Crawler)
legal.get('/public/:id/html', rateLimit(120, 60, 'legal_public_html'), async (c) => {
  const id = c.req.param('id')
  if (!id) {
    return c.html(renderFriendlyNotFoundHtml('ID dokumen tidak valid.'), 400)
  }
  const activeSlug = id === 'seller_privacy' ? 'privacy' : 'tos'
  const canonicalPath = activeSlug === 'privacy' ? '/privacy' : '/tos'

  return renderLegalDocumentResponse(c, id, activeSlug, canonicalPath)
})

// =========================================================================
// ENDPOINT SUPER ADMIN (Wajib Auth & Verifikasi Super Admin)
// =========================================================================

// --- 1. GET /api/legal/admin/documents ---
// Mengambil daftar seluruh dokumen legal aktif
legal.get('/admin/documents', authMiddleware, rateLimit(60, 60, 'legal_admin_list'), async (c) => {
  const user = c.get('user')
  verifySuperAdmin(user)

  // Pastikan kedua dokumen default sudah ter-seed
  await ensureLegalDocumentSeeded(c.env.DB, 'seller_terms')
  await ensureLegalDocumentSeeded(c.env.DB, 'seller_privacy')

  const docs = await c.env.DB.prepare(`
    SELECT ld.id, ld.title, ld.content, ld.version, ld.is_published, ld.updated_at,
           u.name as updated_by_name, u.email as updated_by_email
    FROM legal_documents ld
    LEFT JOIN users u ON ld.updated_by = u.id
    ORDER BY ld.id ASC
  `).all<any>()

  return c.json({
    data: docs.results || []
  })
})

// --- 2. GET /api/legal/admin/documents/:id ---
// Mengambil satu dokumen legal spesifik untuk dimuat ke editor
legal.get('/admin/documents/:id', authMiddleware, rateLimit(60, 60, 'legal_admin_detail'), async (c) => {
  const user = c.get('user')
  verifySuperAdmin(user)

  const id = c.req.param('id')
  if (!id) {
    throw new HTTPException(400, { message: 'ID dokumen diperlukan.' })
  }
  const doc = await ensureLegalDocumentSeeded(c.env.DB, id)

  // Ambil catatan revisi terakhir
  const lastRevision = await c.env.DB.prepare(`
    SELECT change_summary, created_at 
    FROM legal_document_revisions 
    WHERE document_id = ? 
    ORDER BY version DESC LIMIT 1
  `).bind(id).first<any>()

  return c.json({
    data: {
      ...doc,
      last_change_summary: lastRevision?.change_summary || null
    }
  })
})

// --- 3. PUT /api/legal/admin/documents/:id ---
// Menyimpan pembaruan dan mempublikasikan dokumen legal
const updateDocSchema = z.object({
  title: z.string().min(5, 'Judul dokumen minimal 5 karakter').max(200, 'Judul dokumen maksimal 200 karakter'),
  content: z.string().min(20, 'Konten naskah minimal 20 karakter').max(200000, 'Konten naskah legal maksimal 200.000 karakter'),
  change_summary: z.string().max(500, 'Ringkasan perubahan maksimal 500 karakter').optional()
})

legal.put('/admin/documents/:id', authMiddleware, rateLimit(20, 60, 'legal_admin_update'), zValidator('json', updateDocSchema), async (c) => {
  const user = c.get('user')
  verifySuperAdmin(user)

  const id = c.req.param('id')
  if (!id) {
    throw new HTTPException(400, { message: 'ID dokumen diperlukan.' })
  }
  const { title, content, change_summary } = c.req.valid('json')

  // Pastikan dokumen sudah ada
  const currentDoc = await ensureLegalDocumentSeeded(c.env.DB, id)

  const newVersion = (currentDoc.version || 1) + 1
  const summaryText = change_summary?.trim() || `Pembaruan naskah dokumen legal ke versi ${newVersion}`

  // Simpan revisi dari versi lama ke tabel riwayat revisi
  await c.env.DB.prepare(`
    INSERT INTO legal_document_revisions (document_id, version, title, content, change_summary, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    id,
    currentDoc.version,
    currentDoc.title,
    currentDoc.content,
    summaryText,
    user.id === 'super_admin' ? null : user.id
  ).run()

  // Update tabel dokumen legal aktif
  await c.env.DB.prepare(`
    UPDATE legal_documents 
    SET title = ?, content = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    title,
    content,
    newVersion,
    user.id === 'super_admin' ? null : user.id,
    id
  ).run()

  // Purge KV cache agar HTML statis langsung tersinkronisasi ke robot & publik
  c.executionCtx.waitUntil(purgeLegalCache(c.env, id))

  return c.json({
    message: 'Dokumen legal berhasil diperbarui dan dipublikasikan.',
    data: {
      id,
      title,
      version: newVersion,
      updated_at: new Date().toISOString()
    }
  })
})

// --- 4. GET /api/legal/admin/documents/:id/revisions ---
// Mengambil riwayat revisi untuk audit trail
legal.get('/admin/documents/:id/revisions', authMiddleware, rateLimit(30, 60, 'legal_admin_revisions'), async (c) => {
  const user = c.get('user')
  verifySuperAdmin(user)

  const id = c.req.param('id')
  if (!id) {
    throw new HTTPException(400, { message: 'ID dokumen diperlukan.' })
  }

  const revisions = await c.env.DB.prepare(`
    SELECT r.id, r.document_id, r.version, r.title, r.content, r.change_summary, r.created_at,
           u.name as created_by_name, u.email as created_by_email
    FROM legal_document_revisions r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.document_id = ?
    ORDER BY r.version DESC
    LIMIT 30
  `).bind(id).all<any>()

  return c.json({
    data: revisions.results || []
  })
})

// --- 5. POST /api/legal/admin/documents/:id/rollback/:revId ---
// Mengembalikan naskah dokumen ke versi snapshot masa lalu
legal.post('/admin/documents/:id/rollback/:revId', authMiddleware, rateLimit(10, 60, 'legal_admin_rollback'), async (c) => {
  const user = c.get('user')
  verifySuperAdmin(user)

  const id = c.req.param('id')
  const revId = c.req.param('revId')
  if (!id || !revId) {
    throw new HTTPException(400, { message: 'ID dokumen dan ID revisi diperlukan.' })
  }

  // Ambil snapshot revisi yang dituju
  const targetRevision = await c.env.DB.prepare(`
    SELECT id, document_id, version, title, content
    FROM legal_document_revisions
    WHERE id = ? AND document_id = ?
  `).bind(revId, id).first<any>()

  if (!targetRevision) {
    throw new HTTPException(404, { message: 'Versi dokumen yang dipilih tidak ditemukan dalam riwayat.' })
  }

  const currentDoc = await ensureLegalDocumentSeeded(c.env.DB, id)
  const newVersion = (currentDoc.version || 1) + 1
  const rollbackSummary = `Rollback naskah ke versi ${targetRevision.version}`

  // Catat versi sebelum rollback ke riwayat revisi
  await c.env.DB.prepare(`
    INSERT INTO legal_document_revisions (document_id, version, title, content, change_summary, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    id,
    currentDoc.version,
    currentDoc.title,
    currentDoc.content,
    rollbackSummary,
    user.id === 'super_admin' ? null : user.id
  ).run()

  // Terapkan naskah rollback ke tabel aktif
  await c.env.DB.prepare(`
    UPDATE legal_documents 
    SET title = ?, content = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    targetRevision.title,
    targetRevision.content,
    newVersion,
    user.id === 'super_admin' ? null : user.id,
    id
  ).run()

  // Purge KV cache
  c.executionCtx.waitUntil(purgeLegalCache(c.env, id))

  return c.json({
    message: `Dokumen berhasil dikembalikan ke versi ${targetRevision.version}.`,
    data: {
      id,
      title: targetRevision.title,
      version: newVersion
    }
  })
})

export default legal
