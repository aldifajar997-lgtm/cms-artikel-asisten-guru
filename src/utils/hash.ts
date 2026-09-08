import bcrypt from 'bcryptjs'

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

/**
 * Hash token menggunakan SHA-256 untuk penyimpanan di database.
 * Berbeda dari password hashing (bcrypt), ini cukup menggunakan SHA-256
 * karena token sudah merupakan string random dengan entropy tinggi.
 * SHA-256 deterministik: input sama → output sama → bisa digunakan untuk lookup.
 */
export const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
