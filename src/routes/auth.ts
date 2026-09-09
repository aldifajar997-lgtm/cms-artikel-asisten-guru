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

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid').trim().toLowerCase(),
  password: z.string().min(1, 'Password tidak boleh kosong'),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan')
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
  const role = user.id === 'super_admin' ? 'super_admin' : ((roleQuery.results[0]?.role_name as string) || 'user')

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
    currentRole = (roleQuery.results[0]?.role_name as string) || 'user'
  } else {
    currentRole = 'super_admin'
  }

  const newPayload = {
    id: payload.id as string,
    email: payload.email as string,
    role: currentRole,
    permissions: currentPermissions,
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

auth.post('/logout', authMiddleware, async (c) => {
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
  email: z.string().email('Format email tidak valid').trim().toLowerCase(),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan')
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
  token: z.string(),
  new_password: z.string().min(6, 'Password minimal 6 karakter'),
  'cf-turnstile-response': z.string().min(1, 'Token Turnstile diperlukan')
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

export default auth
