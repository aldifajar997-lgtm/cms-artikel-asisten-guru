import { sign, verify } from 'hono/jwt'

export const generateAccessToken = async (payload: object, secret: string) => {
  return await sign({ ...payload, type: 'access', exp: Math.floor(Date.now() / 1000) + 15 * 60 }, secret) // 15 menit
}

export const generateRefreshToken = async (payload: object, secret: string) => {
  return await sign({ ...payload, type: 'refresh', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 }, secret) // 7 hari
}

export const verifyToken = async (token: string, secret: string) => {
  try {
    return await verify(token, secret, 'HS256')
  } catch (e) {
    return null
  }
}
