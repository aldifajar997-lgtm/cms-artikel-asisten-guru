import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const getPagination = (c: Context, defaultLimit = 10, maxLimit = 100) => {
  const limitRaw = parseInt(c.req.query('limit') || String(defaultLimit))
  const limit = isNaN(limitRaw) || limitRaw < 1 ? defaultLimit : limitRaw
  if (limit > maxLimit) throw new HTTPException(400, { message: `Limit maksimal adalah ${maxLimit}.` })

  const offsetRaw = parseInt(c.req.query('offset') || '0')
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw
  if (offset > 10000) throw new HTTPException(400, { message: 'Offset terlalu besar.' })

  return { limit, offset }
}
