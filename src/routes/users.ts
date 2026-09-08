import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Bindings, Variables } from '../types'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { hashPassword, comparePassword, hashToken } from '../utils/hash'
import { HTTPException } from 'hono/http-exception'
import { getCookie } from 'hono/cookie'
import { isSafeImage, getContentTypeFromMagicBytes } from '../utils/magic-bytes'
import { rateLimit } from '../middlewares/rate-limit'
import { getPagination } from '../utils/pagination'
import { getSafeFrontendUrl } from '../utils/url'
import xss from 'xss'

const cleanText = (val: string) => xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// --- PUBLIC AUTHOR PROFILE ---
// Endpoint ini diletakkan SEBELUM authMiddleware agar bisa diakses pembaca (publik) tanpa login
users.get('/author/:id', rateLimit(500, 60, 'public_author'), async (c) => {
  const targetId = c.req.param('id')
  
  // Hanya menyeleksi field yang aman untuk publik, dan memastikan user aktif
  const author = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.avatar_url, u.bio, u.portfolio_url, u.primary_niche
    FROM users u
    WHERE u.id = ? AND u.is_active = 1
  `).bind(targetId).first()

  if (!author) {
    throw new HTTPException(404, { message: 'Penulis tidak ditemukan atau tidak aktif.' })
  }

  return c.json(author)
})

// Semua endpoint di bawah ini membutuhkan autentikasi
users.use('*', authMiddleware)

// --- PROFIL SENDIRI ---

users.get('/me', async (c) => {
  const user = c.get('user')
  
  const dbUser = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.is_active, u.created_at, r.name as role,
           u.bio, u.portfolio_url, u.target_min_words, u.target_keyword_density, 
           u.preferred_tone, u.main_language, u.monthly_article_goal, u.monthly_word_goal, u.primary_niche
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.id = ?
  `).bind(user.id).first()

  if (dbUser) {
    if (dbUser.id === 'super_admin') {
      dbUser.role = 'super_admin'
    }
    return c.json(dbUser)
  }

  if (user.role === 'super_admin') {
    return c.json({ id: 'super_admin', email: user.email, name: 'Super Admin', role: 'super_admin' })
  }
  
  throw new HTTPException(404, { message: 'User tidak ditemukan' })
})

const updateMeSchema = z.object({
  name: z.string().max(100).optional().transform(v => v ? cleanText(v) : v),
  avatar_url: z.string().url().or(z.literal('')).optional(),
  bio: z.string().max(500, 'Bio maksimal 500 karakter').optional().transform(v => v ? cleanText(v) : v),
  portfolioUrl: z.string().url().or(z.literal('')).optional(),
  targetMinWords: z.number().min(0).optional(),
  targetKeywordDensity: z.number().min(0).max(10).optional(),
  preferredTone: z.string().max(100).optional().transform(v => v ? cleanText(v) : v),
  mainLanguage: z.string().max(50).optional().transform(v => v ? cleanText(v) : v),
  monthlyArticleGoal: z.number().min(0).optional(),
  monthlyWordGoal: z.number().min(0).optional(),
  primaryNiche: z.string().max(100).optional().transform(v => v ? cleanText(v) : v)
})

users.put('/me', rateLimit(10, 60, 'update_me'), zValidator('json', updateMeSchema), async (c) => {
  const user = c.get('user')

  const { 
    name, avatar_url, bio, portfolioUrl, targetMinWords, targetKeywordDensity, 
    preferredTone, mainLanguage, monthlyArticleGoal, monthlyWordGoal, primaryNiche
  } = c.req.valid('json')
  
  // Allow clearing avatar_url or name by transforming empty string to null
  const finalName = name === '' || name === undefined ? null : name;
  const finalAvatar = avatar_url === '' || avatar_url === undefined ? null : avatar_url;
  const finalPortfolio = portfolioUrl === '' || portfolioUrl === undefined ? null : portfolioUrl;

  // Cek apakah ada avatar lama yang dihapus/diganti, jika ya, hapus dari R2 untuk mencegah storage leak
  const dbUser = await c.env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?').bind(user.id).first();
  if (dbUser && dbUser.avatar_url && dbUser.avatar_url !== finalAvatar) {
    const oldUrl = dbUser.avatar_url as string;
    const match = oldUrl.match(/\/api\/media\/avatars\/(.+)$/);
    if (match && match[1]) {
      const oldKey = `avatars/${match[1]}`;
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus avatar lama dari R2 di PUT /me', oldKey));
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(oldKey).run();
    }
  }

  await c.env.DB.prepare(`
    UPDATE users 
    SET name = ?, avatar_url = ?, bio = ?, portfolio_url = ?, target_min_words = ?, target_keyword_density = ?,
        preferred_tone = ?, main_language = ?, monthly_article_goal = ?, monthly_word_goal = ?, primary_niche = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(
    finalName, finalAvatar, bio || null, finalPortfolio, 
    targetMinWords !== undefined ? targetMinWords : null, 
    targetKeywordDensity !== undefined ? targetKeywordDensity : null,
    preferredTone || null, mainLanguage || null, 
    monthlyArticleGoal !== undefined ? monthlyArticleGoal : null, 
    monthlyWordGoal !== undefined ? monthlyWordGoal : null, 
    primaryNiche || null,
    user.id
  ).run()

  return c.json({ message: 'Profil berhasil diperbarui.' })
})

const updatePasswordSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6, 'Password baru minimal 6 karakter')
})

users.put('/me/password', rateLimit(5, 3600, 'update_pw'), zValidator('json', updatePasswordSchema), async (c) => {
  const user = c.get('user')
  if (user.role === 'super_admin') throw new HTTPException(403, { message: 'Super admin tidak bisa mengubah password via UI. Silakan ubah melalui environment variables.' })

  const { old_password, new_password } = c.req.valid('json')
  const dbUser = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first()

  if (!dbUser || !(await comparePassword(old_password, dbUser.password_hash as string))) {
    throw new HTTPException(400, { message: 'Password lama salah.' })
  }

  const newHash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(newHash, user.id).run()

  // Hapus semua refresh token KECUALI token milik sesi saat ini agar tidak ter-logout
  const currentToken = getCookie(c, 'refresh_token')
  
  if (currentToken) {
    const hashedCurrent = await hashToken(currentToken)
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND token != ?').bind(user.id, hashedCurrent).run()
  } else {
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(user.id).run()
  }

  return c.json({ message: 'Password berhasil diperbarui. Sesi di perangkat lain telah diakhiri.' })
})

// --- UPLOAD AVATAR (fix L4: tambah rate limit) ---
users.post('/me/avatar', rateLimit(5, 60, 'avatar_upload'), async (c) => {
  const user = c.get('user')

  const body = await c.req.parseBody()
  const file = body['avatar']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File avatar tidak ditemukan dalam request.' })
  }

  // 1. Validasi Ukuran (Max 2MB)
  const MAX_SIZE = 2 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: 'Ukuran file melebihi batas (Max 2MB).' })
  }

  // 2. Validasi Magic Bytes (Keamanan)
  const arrayBuffer = await file.arrayBuffer()
  if (!isSafeImage(arrayBuffer)) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, WEBP yang diterima.' })
  }

  const detectedContentType = getContentTypeFromMagicBytes(arrayBuffer)
  if (!detectedContentType) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, WEBP yang diterima.' })
  }

  // 3. Ekstensi file
  let ext = 'jpg'
  if (detectedContentType === 'image/png') ext = 'png'
  if (detectedContentType === 'image/webp') ext = 'webp'

  const timestamp = Date.now()
  const fileName = `${user.id}-${timestamp}.${ext}`
  const objectPath = `avatars/${fileName}`

  // 4. Cari avatar lama dan hapus dari R2
  const dbUser = await c.env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?').bind(user.id).first()
  if (dbUser && dbUser.avatar_url) {
    const oldUrl = dbUser.avatar_url as string
    // Jika oldUrl mengandung /api/media/avatars/
    const match = oldUrl.match(/\/api\/media\/avatars\/(.+)$/)
    if (match && match[1]) {
      const oldKey = `avatars/${match[1]}`
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus avatar lama dari R2', oldKey))
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(oldKey).run()
    }
  }

  // 5. Upload ke R2
  await c.env.R2.put(objectPath, arrayBuffer, {
    httpMetadata: { contentType: detectedContentType }
  })

  // 6. Update Database
  const newAvatarUrl = `/api/media/avatars/${fileName}`
  const mediaId = crypto.randomUUID()
  
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)').bind(mediaId, objectPath, fileName, detectedContentType, file.size, user.id),
    c.env.DB.prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newAvatarUrl, user.id)
  ])

  return c.json({ message: 'Avatar berhasil diunggah.', avatar_url: newAvatarUrl })
})

// --- MANAJEMEN USER (Oleh Admin) ---

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().max(100).optional().transform(v => v ? cleanText(v) : v)
})

users.post('/', rateLimit(10, 60, 'create_user'), zValidator('json', createUserSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat melakukan aksi ini.' })

  const { email, password, name } = c.req.valid('json')

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (exists) {
    throw new HTTPException(400, { message: 'Email sudah terdaftar.' })
  }

  const id = crypto.randomUUID()
  const hashed = await hashPassword(password)

  // Default role 'Writer'
  const defaultRole = await c.env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind('Writer').first()
  if (!defaultRole) throw new HTTPException(500, { message: 'Terjadi kendala pada konfigurasi sistem. Hubungi administrator.' })

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').bind(id, email, hashed, name || null),
    c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, defaultRole.id)
  ])

  // --- EMAIL UNDANGAN (fix C4: kirim link setup, bukan password plaintext) ---
  if (c.env.BREVO_API_KEY) {
    try {
      // Buat token setup password (agar user bisa set password sendiri)
      const setupToken = crypto.randomUUID()
      await c.env.DB.prepare(`
        INSERT INTO password_resets (id, user_id, token, expires_at)
        VALUES (?, ?, ?, datetime('now', '+24 hours'))
      `).bind(crypto.randomUUID(), id, setupToken).run()

      const frontendUrl = getSafeFrontendUrl(c.env.FRONTEND_URL)
      const setupLink = `${frontendUrl}/?reset_token=${setupToken}`

      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': c.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          templateId: 4,
          to: [{ email: email, name: name || 'Bapak/Ibu' }],
          params: {
            NAME: name || 'Bapak/Ibu',
            EMAIL: email,
            SETUP_LINK: setupLink
          }
        })
      })

      if (!brevoResponse.ok) {
        const errText = await brevoResponse.text()
        console.error('Brevo API Invitation gagal (HTTP', brevoResponse.status, '):', errText)
      }
    } catch (error) {
      console.error('Brevo Fetch Error (Invitation):', error)
    }
  }

  return c.json({ message: 'User berhasil dibuat dan undangan telah dikirim.', id })
})

users.get('/', rateLimit(500, 60, 'public_users_list'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat melihat daftar pengguna.' })

  const { limit, offset } = getPagination(c, 50, 100)

  const list = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.is_active, u.created_at, r.name as role
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    ORDER BY u.created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all()
  
  return c.json({ data: list.results, limit, offset })
})

const resetPasswordSchema = z.object({
  new_password: z.string().min(6)
})

users.put('/:id/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mereset password.' })

  const targetId = c.req.param('id')
  const { new_password } = c.req.valid('json')

  const hashed = await hashPassword(new_password)
  const result = await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(hashed, targetId).run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'User tidak ditemukan.' })
  }

  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(targetId).run()

  return c.json({ message: 'Password user berhasil direset.' })
})

// --- RBAC: Roles & Permissions ---

users.get('/roles/list', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const roles = await c.env.DB.prepare('SELECT id, name, description FROM roles').all()
  return c.json(roles.results)
})

const assignRoleSchema = z.object({
  role_id: z.string()
})

users.put('/:id/role', rateLimit(30, 60, 'assign_role'), zValidator('json', assignRoleSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mengubah role.' })

  const targetId = c.req.param('id')
  const { role_id } = c.req.valid('json')

  // Validasi role yang di-assign benar-benar ada di database
  const roleExists = await c.env.DB.prepare('SELECT id FROM roles WHERE id = ?').bind(role_id).first()
  if (!roleExists) {
    throw new HTTPException(400, { message: 'Role tidak ditemukan.' })
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetId),
    c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(targetId, role_id)
  ])

  return c.json({ message: 'Role berhasil diperbarui.' })
})

const updateStatusSchema = z.object({
  is_active: z.boolean()
})

users.put('/:id/status', rateLimit(30, 60, 'update_status'), zValidator('json', updateStatusSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mengubah status.' })

  const targetId = c.req.param('id')
  const { is_active } = c.req.valid('json')
  const isActiveInt = is_active ? 1 : 0

  const result = await c.env.DB.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(isActiveInt, targetId).run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'User tidak ditemukan.' })
  }

  // Jika di-nonaktifkan, hapus semua refresh token agar user langsung ter-logout
  if (!is_active) {
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(targetId).run()
  }

  return c.json({ message: `User berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}.` })
})

users.delete('/:id', rateLimit(30, 60, 'delete_user'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat menghapus pengguna.' })

  const targetId = c.req.param('id')
  if (targetId === user.id) {
    throw new HTTPException(400, { message: 'Anda tidak dapat menghapus akun Anda sendiri.' })
  }

  // Cari avatar lama dan hapus dari R2 & media
  const dbUser = await c.env.DB.prepare('SELECT avatar_url FROM users WHERE id = ?').bind(targetId).first()
  if (!dbUser) {
    throw new HTTPException(404, { message: 'User tidak ditemukan.' })
  }

  if (dbUser.avatar_url) {
    const oldUrl = dbUser.avatar_url as string
    const match = oldUrl.match(/\/api\/media\/avatars\/(.+)$/)
    if (match && match[1]) {
      const oldKey = `avatars/${match[1]}`
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus avatar dari R2 saat delete user', oldKey))
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(oldKey).run()
    }
  }

  // Hapus user (akan cascade ke refresh_tokens, user_roles, password_resets)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()

  return c.json({ message: 'User berhasil dihapus secara permanen.' })
})

export default users
