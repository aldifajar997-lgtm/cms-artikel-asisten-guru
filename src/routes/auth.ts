import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { rateLimit } from '../middlewares/rate-limit'
import { comparePassword, hashPassword, hashToken } from '../utils/hash'
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt'
import { verifyTurnstile } from '../utils/turnstile'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware } from '../middlewares/auth'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { getSafeFrontendUrl } from '../utils/url'

import { verifyHubJWT } from '../utils/hub-jwt'
import { SELLER_TERMS_MARKDOWN } from '../data/seller-terms'
import { SELLER_PRIVACY_MARKDOWN } from '../data/seller-privacy'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid').max(254, 'Email maksimal 254 karakter').trim().toLowerCase(),
  password: z.string().min(1, 'Password tidak boleh kosong').max(128, 'Password maksimal 128 karakter'),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan').max(4096, 'Token Turnstile tidak valid')
})

auth.post('/login', rateLimit(5, 60, 'login'), zValidator('json', loginSchema), async (c) => {
  const { email, password, 'cf-turnstile-response': turnstileToken } = c.req.valid('json')

  if (!c.env.TURNSTILE_SECRET || !c.env.TURNSTILE_HOSTNAMES) {
    throw new HTTPException(500, { message: 'Konfigurasi keamanan sistem belum lengkap. Hubungi administrator.' })
  }

  const isValidTurnstile = await verifyTurnstile(
    turnstileToken,
    c.env.TURNSTILE_SECRET,
    'login',
    c.env.TURNSTILE_HOSTNAMES,
    c.req.header('CF-Connecting-IP')
  )
  if (!isValidTurnstile) {
    throw new HTTPException(403, { message: 'Verifikasi keamanan gagal (CAPTCHA tidak valid).' })
  }

  // --- SUPER ADMIN FALLBACK (via env, password sudah di-hash) ---
  if (c.env.SUPER_ADMIN_EMAIL && c.env.SUPER_ADMIN_PASSWORD_HASH) {
    if (email === c.env.SUPER_ADMIN_EMAIL) {
      const isValidSA = await comparePassword(password, c.env.SUPER_ADMIN_PASSWORD_HASH)
      if (isValidSA) {
        const payload = {
          id: 'super_admin',
          email,
          role: 'super_admin',
          jti: crypto.randomUUID()
        }
        const accessToken = await generateAccessToken(payload, c.env.JWT_SECRET)
        const refreshToken = await generateRefreshToken(payload, c.env.JWT_SECRET)
        const hashedRefresh = await hashToken(refreshToken)

        // Pastikan super_admin ada di tabel users agar tidak gagal FOREIGN KEY constraint
        await c.env.DB.prepare(`
          INSERT INTO users (id, email, name, password_hash, is_active)
          VALUES ('super_admin', ?, 'Super Admin', ?, 1)
          ON CONFLICT(id) DO UPDATE SET 
            email = excluded.email,
            password_hash = excluded.password_hash
        `).bind(email, c.env.SUPER_ADMIN_PASSWORD_HASH).run()

        // Simpan refresh token (di-hash) super admin ke DB agar bisa di-revoke
        await c.env.DB.prepare(`
          INSERT INTO refresh_tokens (id, user_id, token, user_agent, ip_address, expires_at)
          VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
        `).bind(
          crypto.randomUUID(),
          'super_admin',
          hashedRefresh,
          c.req.header('User-Agent') || null,
          c.req.header('CF-Connecting-IP') || null
        ).run()

        setCookie(c, 'refresh_token', refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 7 * 24 * 60 * 60,
          path: '/'
        })

        // Refresh token HANYA di cookie HttpOnly, tidak di body response
        return c.json({ access_token: accessToken })
      }
      
      // SECURITY PATCH: Jika email adalah super admin tapi password salah,
      // langsung tolak di sini. Jangan biarkan kode berlanjut ke bawah,
      // karena akan menyebabkan proses hashing 2x yang bisa membocorkan 
      // identitas email super admin lewat Timing Attack.
      throw new HTTPException(401, { message: 'Email atau password salah.' })
    }
  }

  // --- USER NORMAL ---
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, is_active FROM users WHERE email = ?'
  ).bind(email).first()

  // SECURITY PATCH: Mencegah Timing Attack (Email Enumeration).
  // Jika user tidak ada, kita tetap melakukan perhitungan hash tiruan (dummy)
  // agar waktu respons server tetap sama (sekitar ~100ms) antara email terdaftar dan tidak terdaftar.
  // BUG FIX: Memastikan dummyHash memiliki panjang 60 karakter yang valid standar bcrypt, 
  // karena library bcrypt akan langsung error (0ms) jika formatnya salah, yang membatalkan fungsi proteksinya.
  const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
  const hashToCompare = user ? (user.password_hash as string) : dummyHash
  
  const isValid = await comparePassword(password, hashToCompare)

  if (!user || !isValid) {
    throw new HTTPException(401, { message: 'Email atau password salah.' })
  }

  // Cek apakah akun aktif
  if (!user.is_active) {
    throw new HTTPException(403, { message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' })
  }

  const roleQuery = await c.env.DB.prepare(`
    SELECT r.name as role_name, p.name as permission_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = ?
  `).bind(user.id).all()

  const permissions = roleQuery.results.map(r => r.permission_name).filter(Boolean) as string[]
  const roles = [...new Set(roleQuery.results.map(r => r.role_name).filter(Boolean) as string[])]
  let assignedRole = roles.includes('Admin') ? 'Admin' : (roles.includes('Editor') ? 'Editor' : (roles[0] || 'user'))
  const role = user.id === 'super_admin' ? 'super_admin' : assignedRole

  const payload = {
    id: user.id as string,
    email: user.email as string,
    role,
    permissions,
    jti: crypto.randomUUID()
  }

  const accessToken = await generateAccessToken(payload, c.env.JWT_SECRET)
  const refreshToken = await generateRefreshToken(payload, c.env.JWT_SECRET)
  const hashedRefresh = await hashToken(refreshToken)

  // 1. Garbage Collection (Piggyback)
  c.executionCtx.waitUntil(
    c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'),
      c.env.DB.prepare('DELETE FROM password_resets WHERE expires_at < CURRENT_TIMESTAMP')
    ]).catch(err => console.error('GC Error:', err))
  )

  // 2. Batasi maksimal 5 sesi per user
  const activeSessions = await c.env.DB.prepare(
    'SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.id).all()

  const stmts = []
  if (activeSessions.results.length >= 5) {
    // Hapus sesi-sesi paling lawas, sisakan 4 agar yang ke-5 (baru) bisa dimasukkan
    const toDelete = activeSessions.results.slice(0, activeSessions.results.length - 4)
    toDelete.forEach((session: any) => {
      stmts.push(c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(session.id))
    })
  }

  // 3. Masukkan sesi baru
  stmts.push(c.env.DB.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
  `).bind(
    crypto.randomUUID(),
    user.id,
    hashedRefresh,
    c.req.header('User-Agent') || null,
    c.req.header('CF-Connecting-IP') || null
  ))

  await c.env.DB.batch(stmts)

  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  })

  // Refresh token HANYA di cookie HttpOnly, tidak di body response
  return c.json({ access_token: accessToken })
})

auth.post('/refresh', rateLimit(5, 60, 'refresh'), async (c) => {
  const refresh_token = getCookie(c, 'refresh_token')

  if (!refresh_token) {
    deleteCookie(c, 'refresh_token', { path: '/' })
    throw new HTTPException(401, { message: 'Sesi Anda telah berakhir, silakan login kembali.' })
  }

  // C3 FIX: Hash token dari cookie sebelum lookup di DB
  const hashedInput = await hashToken(refresh_token)

  const tokenRecord = await c.env.DB.prepare(
    'SELECT user_id FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")'
  ).bind(hashedInput).first()

  if (!tokenRecord) {
    deleteCookie(c, 'refresh_token', { path: '/' })
    throw new HTTPException(401, { message: 'Sesi Anda telah berakhir, silakan login kembali.' })
  }

  const payload = await verifyToken(refresh_token, c.env.JWT_SECRET) as any
  if (!payload) {
    deleteCookie(c, 'refresh_token', { path: '/' })
    throw new HTTPException(401, { message: 'Sesi Anda telah berakhir, silakan login kembali.' })
  }

  // M2 FIX: Pastikan ini refresh token, bukan access token
  if (payload.type !== 'refresh') {
    deleteCookie(c, 'refresh_token', { path: '/' })
    throw new HTTPException(401, { message: 'Sesi Anda telah berakhir, silakan login kembali.' })
  }

  // Verifikasi user masih aktif di database (kecuali super_admin)
  if (tokenRecord.user_id !== 'super_admin') {
    const activeUser = await c.env.DB.prepare(
      'SELECT is_active FROM users WHERE id = ?'
    ).bind(tokenRecord.user_id).first()

    if (!activeUser || !activeUser.is_active) {
      // Hapus semua refresh token user yang dinonaktifkan
      await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?')
        .bind(tokenRecord.user_id).run()
      throw new HTTPException(403, { message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' })
    }
  }

  // Hapus token lama (Rotation — single-use refresh token)
  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(hashedInput).run()

  // Re-fetch roles/permissions terbaru dari DB agar perubahan permission langsung berlaku
  let currentRole = payload.role as string
  let currentPermissions: string[] = payload.permissions || []

  if (tokenRecord.user_id !== 'super_admin') {
    const roleQuery = await c.env.DB.prepare(`
      SELECT r.name as role_name, p.name as permission_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ?
    `).bind(tokenRecord.user_id).all()

    currentPermissions = roleQuery.results.map(r => r.permission_name).filter(Boolean) as string[]
    const roles = [...new Set(roleQuery.results.map(r => r.role_name).filter(Boolean) as string[])]
    currentRole = roles.includes('Admin') ? 'Admin' : (roles.includes('Editor') ? 'Editor' : (roles.includes('Seller') ? 'seller' : (roles[0] || 'user')))
  } else {
    currentRole = 'super_admin'
  }

  // Refresh status seller real-time dari database D1
  let freshSellerStatus = payload.seller_status
  if (tokenRecord.user_id !== 'super_admin') {
    const userStatus = await c.env.DB.prepare('SELECT seller_status FROM users WHERE id = ?').bind(tokenRecord.user_id).first<{ seller_status: string }>()
    if (userStatus) {
      freshSellerStatus = userStatus.seller_status
    }
  }

  const newPayload = {
    id: payload.id as string,
    email: payload.email as string,
    role: currentRole,
    permissions: currentPermissions,
    seller_status: freshSellerStatus,
    jti: crypto.randomUUID()
  }

  const newAccessToken = await generateAccessToken(newPayload, c.env.JWT_SECRET)
  const newRefreshToken = await generateRefreshToken(newPayload, c.env.JWT_SECRET)
  const hashedNewRefresh = await hashToken(newRefreshToken)

  await c.env.DB.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
  `).bind(
    crypto.randomUUID(),
    tokenRecord.user_id,
    hashedNewRefresh,
    c.req.header('User-Agent') || null,
    c.req.header('CF-Connecting-IP') || null
  ).run()

  setCookie(c, 'refresh_token', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  })

  // Refresh token HANYA di cookie HttpOnly, tidak di body response
  return c.json({ access_token: newAccessToken })
})

auth.post('/logout', rateLimit(10, 60, 'logout'), authMiddleware, async (c) => {
  const user = c.get('user')
  if (user && user.jti) {
    await c.env.KV.put(`jwt:block:${user.jti}`, 'revoked', { expirationTtl: 900 })
  }

  const refreshToken = getCookie(c, 'refresh_token')
  if (refreshToken) {
    const hashedRefresh = await hashToken(refreshToken)
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(hashedRefresh).run()
  }

  deleteCookie(c, 'refresh_token', { path: '/' })

  return c.json({ message: 'Logout berhasil.' })
})

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid').max(254, 'Email maksimal 254 karakter').trim().toLowerCase(),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan').max(4096, 'Token Turnstile tidak valid')
})

auth.post('/forgot-password', rateLimit(3, 3600, 'forgot_pw'), zValidator('json', forgotPasswordSchema), async (c) => {
  const { email, 'cf-turnstile-response': turnstileToken } = c.req.valid('json')

  if (!c.env.TURNSTILE_SECRET || !c.env.TURNSTILE_HOSTNAMES) {
    throw new HTTPException(500, { message: 'Konfigurasi keamanan sistem belum lengkap. Hubungi administrator.' })
  }

  const isValidTurnstile = await verifyTurnstile(
    turnstileToken,
    c.env.TURNSTILE_SECRET,
    'forgot_password',
    c.env.TURNSTILE_HOSTNAMES,
    c.req.header('CF-Connecting-IP')
  )
  if (!isValidTurnstile) {
    throw new HTTPException(403, { message: 'Verifikasi keamanan gagal (CAPTCHA tidak valid).' })
  }

  const user = await c.env.DB.prepare(
    'SELECT id, name, email, is_active FROM users WHERE email = ?'
  ).bind(email).first<{id: string, name: string, email: string, is_active: number}>()

  if (user && user.is_active) {
    const token = crypto.randomUUID()
    const hashedToken = await hashToken(token)
    
    // Hapus token reset sebelumnya jika ada (mencegah penumpukan)
    await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id).run()

    await c.env.DB.prepare(`
      INSERT INTO password_resets (id, user_id, token, expires_at)
      VALUES (?, ?, ?, datetime('now', '+5 minutes'))
    `).bind(crypto.randomUUID(), user.id, hashedToken).run()

    if (c.env.BREVO_API_KEY) {
      const frontendUrl = getSafeFrontendUrl(c.env.FRONTEND_URL)
      const resetLink = `${frontendUrl}/?reset_token=${token}`

      try {
        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': c.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            templateId: 3,
            to: [{ email: user.email, name: user.name || 'User' }],
            params: {
              NAME: user.name || 'Pengguna',
              EMAIL: user.email,
              reset_link: resetLink
            }
          })
        })

        // SECURITY PATCH: Implement proper logging (agents.md).
        // fetch() tidak masuk ke blok catch() untuk error HTTP seperti 401/403.
        if (!brevoResponse.ok) {
          const errText = await brevoResponse.text()
          console.error('Brevo API ditolak (HTTP', brevoResponse.status, '):', errText)
        }
      } catch (error) {
        // SECURITY PATCH: Jangan bocorkan error API eksternal (Brevo) ke frontend
        // Cukup log di console/sistem internal
        console.error('Brevo Fetch Error:', error)
      }
    }
  }

  return c.json({ message: 'Jika email terdaftar, instruksi reset password telah dikirim.' })
})

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  new_password: z.string().min(6, 'Password minimal 6 karakter').max(128, 'Password maksimal 128 karakter'),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan').max(4096, 'Token Turnstile tidak valid')
})

auth.post('/reset-password', rateLimit(5, 3600, 'reset_pw'), zValidator('json', resetPasswordSchema), async (c) => {
  const { token, new_password, 'cf-turnstile-response': turnstileToken } = c.req.valid('json')

  if (!c.env.TURNSTILE_SECRET || !c.env.TURNSTILE_HOSTNAMES) {
    throw new HTTPException(500, { message: 'Konfigurasi keamanan sistem belum lengkap. Hubungi administrator.' })
  }

  const isValidTurnstile = await verifyTurnstile(
    turnstileToken,
    c.env.TURNSTILE_SECRET,
    'reset_password',
    c.env.TURNSTILE_HOSTNAMES,
    c.req.header('CF-Connecting-IP')
  )
  if (!isValidTurnstile) {
    throw new HTTPException(403, { message: 'Verifikasi keamanan gagal (CAPTCHA tidak valid).' })
  }

  const hashedInputToken = await hashToken(token)

  const resetRecord = await c.env.DB.prepare(
    'SELECT user_id FROM password_resets WHERE token = ? AND expires_at > datetime("now")'
  ).bind(hashedInputToken).first<{user_id: string}>()

  if (!resetRecord) {
    throw new HTTPException(400, { message: 'Token tidak valid atau sudah kadaluwarsa.' })
  }

  const hashedPassword = await hashPassword(new_password)

  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(hashedPassword, resetRecord.user_id).run()

  // CRITICAL FIX: Hapus semua sesi aktif pengguna karena password telah diubah
  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(resetRecord.user_id).run()

  await c.env.DB.prepare(
    'DELETE FROM password_resets WHERE token = ?'
  ).bind(hashedInputToken).run()

  return c.json({ message: 'Password berhasil diubah. Silakan login dengan password baru.' })
})

// --- SYARAT & KETENTUAN KEMITRAAN KREATOR & KEBIJAKAN PRIVASI ---
auth.get('/terms/seller', rateLimit(60, 60, 'terms_seller'), async (c) => {
  const cacheKey = 'cache:terms_seller'

  // 1. Coba baca dari Edge KV Cache untuk respons berkecepatan tinggi
  try {
    const cached = await c.env.KV.get(cacheKey, 'json')
    if (cached) {
      return c.json(cached, 200, {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      })
    }
  } catch (err) {
    console.error('KV cache read error:', err)
  }

  // 2. Jika cache miss, ambil dari D1 legal_documents
  try {
    const docs = await c.env.DB.prepare(
      "SELECT id, title, content, version, updated_at FROM legal_documents WHERE id IN ('seller_terms', 'seller_privacy') AND is_published = 1"
    ).all<{ id: string; title: string; content: string; version: number; updated_at: string }>()

    let termsDoc = (docs.results || []).find(d => d.id === 'seller_terms')
    let privacyDoc = (docs.results || []).find(d => d.id === 'seller_privacy')

    // Jika belum ter-seed di D1, lakukan auto-seed otomatis
    if (!termsDoc) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO legal_documents (id, title, content, version, is_published, updated_at)
        VALUES ('seller_terms', 'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru', ?, 1, 1, CURRENT_TIMESTAMP)
      `).bind(SELLER_TERMS_MARKDOWN).run()
      termsDoc = {
        id: 'seller_terms',
        title: 'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru',
        content: SELLER_TERMS_MARKDOWN,
        version: 1,
        updated_at: new Date().toISOString()
      }
    }

    if (!privacyDoc) {
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO legal_documents (id, title, content, version, is_published, updated_at)
        VALUES ('seller_privacy', 'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator', ?, 1, 1, CURRENT_TIMESTAMP)
      `).bind(SELLER_PRIVACY_MARKDOWN).run()
      privacyDoc = {
        id: 'seller_privacy',
        title: 'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator',
        content: SELLER_PRIVACY_MARKDOWN,
        version: 1,
        updated_at: new Date().toISOString()
      }
    }

    const payload = {
      title: termsDoc.title,
      markdown: termsDoc.content,
      terms_version: termsDoc.version,
      terms_updated_at: termsDoc.updated_at,
      privacy_title: privacyDoc.title,
      privacy_markdown: privacyDoc.content,
      privacy_version: privacyDoc.version,
      privacy_updated_at: privacyDoc.updated_at
    }

    // Simpan ke KV Cache dengan TTL 24 jam
    c.executionCtx.waitUntil(c.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 86400 }))

    return c.json(payload, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
  } catch (err) {
    console.error('Failed to load legal docs from D1, fallback to static:', err)
    // Fallback darurat jika ada kendala D1
    return c.json({
      title: 'Syarat dan Ketentuan Program Kemitraan Kreator Asisten Guru',
      markdown: SELLER_TERMS_MARKDOWN,
      privacy_title: 'Kebijakan Privasi & Perlindungan Data Sensitif Kemitraan Kreator',
      privacy_markdown: SELLER_PRIVACY_MARKDOWN
    })
  }
})

// --- SSO ASISTEN GURU (HUB IDENTITY PROVIDER) ---

auth.get('/sso/hub/init', rateLimit(10, 60, 'sso_hub_init'), async (c) => {
  const hubUrl = c.env.HUB_URL || 'https://asisten-guru.id'
  const appId = c.env.HUB_APP_ID || 'mitra-asisten-guru'
  const state = crypto.randomUUID()

  // ANTI-HIJACKING & ANTI-PHISHING: Strict Host Whitelist
  // Di server production, HANYA domain resmi ber-HTTPS yang diizinkan.
  // Localhost dan loopback 127.0.0.1 DILARANG KERAS di server production
  // guna mencegah Loopback Token Interception & Localhost Hijacking (RFC 8252).
  const isDevEnv = (c.env as any).ENVIRONMENT === 'development' || (c.env as any).ENVIRONMENT === 'local'

  const ALLOWED_MITRA_HOSTS = [
    'mitra.asisten-guru.id',
    'mitra.asisten-guru.my.id',
    'ui-mitra.pages.dev'
  ]

  if (isDevEnv) {
    ALLOWED_MITRA_HOSTS.push('localhost', '127.0.0.1')
  }

  const rawHostHeader = c.req.header('X-Forwarded-Host') || c.req.header('Host') || ''
  const hostnameOnly = rawHostHeader.split(':')[0].toLowerCase()

  let safeHost = 'mitra.asisten-guru.id'
  let safeProto = 'https'

  if (ALLOWED_MITRA_HOSTS.includes(hostnameOnly)) {
    if (isDevEnv && (hostnameOnly === 'localhost' || hostnameOnly === '127.0.0.1')) {
      safeHost = rawHostHeader // sertakan port pada local dev (misal localhost:5173)
      safeProto = (c.req.header('X-Forwarded-Proto') || 'http').toLowerCase()
    } else {
      safeHost = hostnameOnly
      safeProto = 'https'
    }
  }

  // Redirect ke root origin domain mitra yang sah karena App.tsx SPA menangani callback di root ('/')
  const callbackUrl = `${safeProto}://${safeHost}/`

  // Simpan state ke D1 dengan masa berlaku 10 menit
  await c.env.DB.prepare(`
    INSERT INTO oauth_states (state, redirect_uri, expires_at)
    VALUES (?, ?, datetime('now', '+10 minutes'))
  `).bind(state, callbackUrl).run()

  // Sesuai listener SSO Hub di asisten-guru hub:
  // Hub membaca params: sso_login=1, app_id, redirect_uri, state
  const authUrl = `${hubUrl}/?sso_login=1&app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`

  return c.json({
    url: authUrl,
    state,
    redirect_uri: callbackUrl
  })
})

const ssoCallbackSchema = z.object({
  token: z.string().min(1, 'Token SSO diperlukan'),
  state: z.string().min(1, 'State autentikasi diperlukan'),
  terms_accepted: z.boolean().optional()
})

auth.post('/sso/hub/callback', rateLimit(10, 60, 'sso_hub_callback'), zValidator('json', ssoCallbackSchema), async (c) => {
  const { token, state } = c.req.valid('json')

  // 1. Validasi & Konsumsi State CSRF secara Atomik (Cegah Race Condition & Replay Attack)
  const stateRecord = await c.env.DB.prepare(
    'DELETE FROM oauth_states WHERE state = ? AND expires_at > datetime("now") RETURNING state, redirect_uri'
  ).bind(state).first<{ state: string; redirect_uri: string }>()

  if (!stateRecord) {
    throw new HTTPException(400, { message: 'Sesi autentikasi telah berakhir atau tidak valid. Silakan ulangi proses masuk.' })
  }

  // 2. Verifikasi Token Asimetris RS256 dari Hub
  let hubPayload: any = null
  const expectedAppId = c.env.HUB_APP_ID || 'mitra-asisten-guru'

  if (c.env.HUB_PUBLIC_KEY) {
    hubPayload = await verifyHubJWT(token, c.env.HUB_PUBLIC_KEY, [expectedAppId, 'mitra-seller', 'mitra-asisten-guru'])
  } else {
    // Fallback development jika belum pasang public key
    hubPayload = await verifyToken(token, c.env.JWT_SECRET)
  }

  if (!hubPayload) {
    throw new HTTPException(401, { message: 'Autentikasi akun Asisten Guru tidak valid atau telah kedaluwarsa.' })
  }

  const hubAccountId = String(hubPayload.sub || hubPayload.hub_account_id || hubPayload.id || '')
  const email = (hubPayload.email || '').trim().toLowerCase()
  const name = hubPayload.name || 'Mitra Kreator'
  const avatarUrl = hubPayload.avatar_url || null
  const rawHubPhone = String(
    hubPayload.whatsapp || 
    hubPayload.phone_number || 
    hubPayload.phone || 
    hubPayload.no_hp || 
    ''
  ).trim()

  let cleanHubPhone: string | null = null
  if (rawHubPhone && rawHubPhone !== 'null' && rawHubPhone !== 'undefined' && rawHubPhone !== '-') {
    const hasPlus = rawHubPhone.startsWith('+')
    const digits = rawHubPhone.replace(/\D/g, '')
    let normalized = hasPlus ? `+${digits}` : digits
    if (normalized.startsWith('8')) normalized = '0' + normalized
    if (/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(normalized)) {
      cleanHubPhone = normalized
    }
  }

  if (!email) {
    throw new HTTPException(400, { message: 'Data akun Asisten Guru tidak memiliki alamat email yang valid.' })
  }

  // 3. Upsert User ke Database D1
  let user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, phone_number, is_active, seller_status FROM users WHERE hub_account_id = ? OR email = ?'
  ).bind(hubAccountId, email).first<any>()

  if (user) {
    // Cek apakah akun dinonaktifkan
    if (user.is_active === 0) {
      throw new HTTPException(403, { message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' })
    }

    // User sudah terdaftar
    const updates: string[] = []
    const bindings: any[] = []

    if (!user.seller_status) {
      updates.push("seller_status = 'none'")
      user.seller_status = 'none'
    }
    if (hubAccountId && !user.hub_account_id) {
      updates.push("hub_account_id = ?")
      bindings.push(hubAccountId)
    }
    if (avatarUrl && !user.avatar_url) {
      updates.push("avatar_url = ?")
      bindings.push(avatarUrl)
    }
    if (name && !user.name) {
      updates.push("name = ?")
      bindings.push(name)
      user.name = name
    }
    // Prefill nomor HP dari Hub jika user di Mitra belum mengaturnya
    if (cleanHubPhone && !user.phone_number) {
      updates.push("phone_number = ?")
      bindings.push(cleanHubPhone)
      user.phone_number = cleanHubPhone
    }

    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP")
      bindings.push(user.id)
      await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run()
    }

    // SECURITY HARDENING: Hanya sematkan role-seller jika status kemitraan sudah disetujui ('approved')
    // User dengan status 'none', 'pending', atau 'rejected' TIDAK diberikan hak akses seller produk
    if (user.seller_status === 'approved') {
      await c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role-seller')").bind(user.id).run()
    }
  } else {
    // Pengguna Baru: Daftarkan sebagai Seller baru dengan status 'none' (belum disetujui, belum memiliki role-seller)
    const newUserId = crypto.randomUUID()
    const randomPw = crypto.randomUUID() + crypto.randomUUID()
    const hashedPw = await hashPassword(randomPw)

    await c.env.DB.prepare(`
      INSERT INTO users (id, email, name, avatar_url, phone_number, hub_account_id, seller_status, is_active, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, 'none', 1, ?)
    `).bind(newUserId, email, name, avatarUrl, cleanHubPhone || null, hubAccountId || null, hashedPw).run()

    user = {
      id: newUserId,
      email,
      name,
      avatar_url: avatarUrl,
      phone_number: cleanHubPhone || null,
      is_active: 1,
      seller_status: 'none'
    }
  }

  // 4. Muat permissions & role dari database D1
  const roleQuery = await c.env.DB.prepare(`
    SELECT r.name as role_name, p.name as permission_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = ?
  `).bind(user.id).all()

  const permissions = roleQuery.results.map(r => r.permission_name).filter(Boolean) as string[]
  const roles = [...new Set(roleQuery.results.map(r => r.role_name).filter(Boolean) as string[])]
  let assignedRole = roles.includes('Admin') ? 'Admin' : (roles.includes('Editor') ? 'Editor' : (roles.includes('Seller') ? 'seller' : (roles[0] || 'user')))
  const role = user.id === 'super_admin' ? 'super_admin' : assignedRole

  // 5. Terbitkan Sesi Aman (JWT + HttpOnly Cookie Refresh Token)
  const sessionPayload = {
    id: user.id,
    email: user.email,
    role,
    permissions,
    seller_status: user.seller_status,
    jti: crypto.randomUUID()
  }

  const accessToken = await generateAccessToken(sessionPayload, c.env.JWT_SECRET)
  const refreshToken = await generateRefreshToken(sessionPayload, c.env.JWT_SECRET)
  const hashedRefresh = await hashToken(refreshToken)

  await c.env.DB.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, user_agent, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+7 days'))
  `).bind(
    crypto.randomUUID(),
    user.id,
    hashedRefresh,
    c.req.header('User-Agent') || null,
    c.req.header('CF-Connecting-IP') || null
  ).run()

  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  })

  return c.json({
    access_token: accessToken,
    seller_status: user.seller_status,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      phone_number: user.phone_number || null,
      seller_status: user.seller_status
    }
  })
})

export default auth
