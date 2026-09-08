import { Context, Next } from 'hono'
import { verifyToken } from '../utils/jwt'
import { Bindings, Variables, JWTPayload } from '../types'
import { HTTPException } from 'hono/http-exception'

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const authMiddleware = async (c: AppContext, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Akses ditolak. Silakan login terlebih dahulu.' })
  }

  const token = authHeader.split(' ')[1]
  const payload = await verifyToken(token, c.env.JWT_SECRET)

  if (!payload) {
    throw new HTTPException(401, { message: 'Sesi telah berakhir, silakan login kembali.' })
  }

  // M2 FIX: Pastikan ini access token, bukan refresh token yang disalahgunakan
  if ((payload as any).type !== 'access') {
    throw new HTTPException(401, { message: 'Sesi telah berakhir, silakan login kembali.' })
  }

  // Cek apakah token sudah di-revoke (blocklist di KV)
  if ((payload as any).jti) {
    const isBlocklisted = await c.env.KV.get(`jwt:block:${(payload as any).jti}`)
    if (isBlocklisted) {
      throw new HTTPException(401, { message: 'Sesi telah berakhir, silakan login kembali.' })
    }
  }

  // CRITICAL FIX: Real-time active status check
  if ((payload as any).id !== 'super_admin') {
    const userInDb = await c.env.DB.prepare('SELECT is_active FROM users WHERE id = ?').bind((payload as any).id).first<{is_active: number}>()
    if (!userInDb || userInDb.is_active === 0) {
      throw new HTTPException(401, { message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' })
    }
  }

  c.set('user', payload as unknown as JWTPayload)
  await next()
}

export const requirePermission = (requiredPermission: string) => {
  return async (c: AppContext, next: Next) => {
    const user = c.get('user')
    if (!user) {
      throw new HTTPException(401, { message: 'Sesi telah berakhir.' })
    }
    if (user.role === 'super_admin') {
      await next()
      return
    }

    const permissions = user.permissions || []
    if (!permissions.includes(requiredPermission)) {
      throw new HTTPException(403, { message: 'Anda tidak memiliki hak akses untuk fitur ini.' })
    }
    await next()
  }
}
