export type Bindings = {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  JWT_SECRET: string
  SUPER_ADMIN_EMAIL?: string
  SUPER_ADMIN_PASSWORD_HASH?: string
  FRONTEND_URL?: string
  BREVO_API_KEY?: string
  ALLOWED_ORIGINS?: string // Daftar origin yang diizinkan, dipisah koma
  TURNSTILE_SECRET?: string
  TURNSTILE_HOSTNAMES?: string
}

export interface JWTPayload {
  id: string
  email: string
  role: string
  permissions?: string[]
  jti: string
}

export type Variables = {
  user: JWTPayload
}
