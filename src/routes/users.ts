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
import { invalidateProductCaches } from './products'
import { validateStoreSlug, RESERVED_STORE_SLUGS, slugify, checkHubAppConflict } from '../utils/slug'
import { verifyToken } from '../utils/jwt'

const cleanText = (val: string) => xss(val, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] })

const toAbsoluteMediaUrl = (origin: string, url: unknown): string | null => {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`
}

export const invalidateAuthorCache = (env: Bindings, executionCtx: { waitUntil: (p: Promise<any>) => void }, userId: string, storeSlug?: string | null) => {
  if (env.KV) {
    executionCtx.waitUntil(
      Promise.all([
        env.KV.delete(`cache:author:${userId}`).catch(() => {}),
        env.KV.delete(`cache:store:${userId}`).catch(() => {}),
        storeSlug ? env.KV.delete(`cache:store:${storeSlug}`).catch(() => {}) : Promise.resolve()
      ])
    )
  }
}

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const DEFAULT_STORE_APPEARANCE = {
  preset: 'emerald-scholar' as const,
  background: {
    type: 'color' as const,
    value: '#f5f5f4',
    imageUrl: null as string | null
  },
  button: {
    style: 'fill' as const,
    radius: 'rounded' as const,
    bgColor: '#0D5B52',
    textColor: '#ffffff',
    borderColor: null as string | null
  },
  typography: {
    fontFamily: 'Plus Jakarta Sans' as const,
    headingColor: '#1c1917',
    bioColor: '#57534e',
    cardStyle: 'none' as const,
    cardBgColor: '#ffffff',
    cardOpacity: 85,
    cardBlur: 'md' as const,
    textShadow: 'none' as const
  },
  catalogLayout: 'grid' as const,
  socialLinksStyle: 'colored' as const,
  sectionsOrder: [
    'profile',
    'social_links',
    'video_teaser',
    'featured_product',
    'catalog',
    'faq'
  ],
  socialLinks: {
    enabled: true,
    style: 'colored' as const,
    whatsapp: null as string | null,
    instagram: null as string | null,
    tiktok: null as string | null,
    youtube: null as string | null,
    linkedin: null as string | null,
    facebook: null as string | null
  },
  videoTeaser: {
    enabled: false,
    title: null as string | null,
    videoUrl: null as string | null,
    aspectRatio: '16:9' as const
  },
  featuredProduct: {
    enabled: false,
    productId: null as string | null,
    badgeText: 'UNGGULAN',
    animationStyle: 'pulse' as const
  },
  faq: {
    enabled: false,
    title: 'Pertanyaan yang Sering Diajukan (FAQ)',
    items: [] as Array<{ id: string; question: string; answer: string }>
  }
}

export function mergeStoreAppearance(parsed: any, authorFallback?: {
  social_instagram?: string | null;
  social_tiktok?: string | null;
  social_youtube?: string | null;
  social_linkedin?: string | null;
  social_facebook?: string | null;
}) {
  if (!parsed || typeof parsed !== 'object') {
    parsed = {}
  }

  // Rekonsiliasi sectionsOrder: Profile wajib paling depan, catalog wajib ada, tanpa duplikasi
  let mergedSections: string[] = [...DEFAULT_STORE_APPEARANCE.sectionsOrder]
  if (Array.isArray(parsed.sectionsOrder)) {
    const validSections: string[] = parsed.sectionsOrder.filter((s: unknown): s is string => typeof s === 'string' && DEFAULT_STORE_APPEARANCE.sectionsOrder.includes(s as any))
    const uniqueValid: string[] = Array.from(new Set<string>(validSections))
    const missingSections: string[] = DEFAULT_STORE_APPEARANCE.sectionsOrder.filter(s => !uniqueValid.includes(s))
    const withoutProfile: string[] = [...uniqueValid, ...missingSections].filter(s => s !== 'profile')
    mergedSections = ['profile', ...withoutProfile]
  }

  const rawSocial = parsed.socialLinks || {}

  return {
    ...DEFAULT_STORE_APPEARANCE,
    ...parsed,
    background: {
      ...DEFAULT_STORE_APPEARANCE.background,
      ...(parsed.background || {})
    },
    button: {
      ...DEFAULT_STORE_APPEARANCE.button,
      ...(parsed.button || {})
    },
    typography: {
      ...DEFAULT_STORE_APPEARANCE.typography,
      ...(parsed.typography || {})
    },
    sectionsOrder: mergedSections,
    socialLinks: {
      ...DEFAULT_STORE_APPEARANCE.socialLinks,
      ...rawSocial,
      instagram: rawSocial.instagram ?? authorFallback?.social_instagram ?? null,
      tiktok: rawSocial.tiktok ?? authorFallback?.social_tiktok ?? null,
      youtube: rawSocial.youtube ?? (authorFallback as any)?.social_youtube ?? null,
      linkedin: rawSocial.linkedin ?? authorFallback?.social_linkedin ?? null,
      facebook: rawSocial.facebook ?? authorFallback?.social_facebook ?? null
    },
    videoTeaser: {
      ...DEFAULT_STORE_APPEARANCE.videoTeaser,
      ...(parsed.videoTeaser || {})
    },
    featuredProduct: {
      ...DEFAULT_STORE_APPEARANCE.featuredProduct,
      ...(parsed.featuredProduct || {})
    },
    faq: {
      ...DEFAULT_STORE_APPEARANCE.faq,
      ...(parsed.faq || {}),
      items: Array.isArray(parsed.faq?.items) ? parsed.faq.items : []
    }
  }
}

const users = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// --- PUBLIC AUTHOR PROFILE ---
users.get('/author/:id', async (c) => {
  const targetId = c.req.param('id')
  const cacheKey = `cache:author:${targetId}`

  if (c.env.KV) {
    const cached = await c.env.KV.get(cacheKey, 'json')
    if (cached) {
      return c.json(cached, 200, {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      })
    }
  }
  
  // Hanya menyeleksi field yang aman untuk publik, dan memastikan user aktif serta tidak disuspend jika seller
  const author = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.avatar_url, u.cover_url, u.bio, u.portfolio_url, u.primary_niche,
           u.social_linkedin, u.social_twitter, u.social_instagram, u.social_facebook, u.social_tiktok,
           u.store_name, u.store_description, u.store_appearance, u.store_slug,
           u.created_at as joined_at,
           (SELECT COUNT(*) FROM products p WHERE p.author_id = u.id AND p.status = 'published') as total_products,
           (SELECT COALESCE(SUM(p.sales_count), 0) FROM products p WHERE p.author_id = u.id AND p.status = 'published') as total_sales,
           (SELECT COUNT(*) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.author_id = u.id) as total_reviews,
           (SELECT ROUND(COALESCE(AVG(pr.rating), 0), 1) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.author_id = u.id) as average_rating
    FROM users u
    WHERE (u.id = ? OR LOWER(u.store_slug) = LOWER(?)) 
      AND u.is_active = 1
      AND (u.seller_status IS NULL OR u.seller_status = 'approved' OR u.id = 'super_admin')
  `).bind(targetId, targetId).first<any>()

  if (!author) {
    throw new HTTPException(404, { message: 'Penulis tidak ditemukan atau tidak aktif.' })
  }

  let parsedAppearance = { ...DEFAULT_STORE_APPEARANCE }
  if (author.store_appearance) {
    try {
      const raw = typeof author.store_appearance === 'string' ? JSON.parse(author.store_appearance as string) : author.store_appearance
      parsedAppearance = mergeStoreAppearance(raw, author)
    } catch {}
  } else {
    parsedAppearance = mergeStoreAppearance({}, author)
  }

  const origin = new URL(c.req.url).origin;

  // Konversi URL gambar latar toko menjadi URL absolut untuk konsumen eksternal (Hub Asisten Guru / buyer)
  if (parsedAppearance && typeof parsedAppearance === 'object' && parsedAppearance.background) {
    if (parsedAppearance.background.imageUrl) {
      parsedAppearance.background.imageUrl = toAbsoluteMediaUrl(origin, parsedAppearance.background.imageUrl)
    }
  }

  // Resolusi Produk Unggulan: Sertakan metadata resmi modul dan cegah kartu rusak jika produk sudah diarsipkan/dihapus
  if (parsedAppearance.featuredProduct?.enabled && parsedAppearance.featuredProduct?.productId) {
    const featuredProd = await c.env.DB.prepare(`
      SELECT id, title, slug, price, original_price, cover_image_key, average_rating, sales_count
      FROM products
      WHERE id = ? AND author_id = ? AND status = 'published'
    `).bind(parsedAppearance.featuredProduct.productId, author.id).first<any>()

    if (featuredProd) {
      (parsedAppearance.featuredProduct as any).productDetails = {
        id: featuredProd.id,
        title: featuredProd.title,
        slug: featuredProd.slug,
        price: featuredProd.price,
        original_price: featuredProd.original_price,
        cover_url: featuredProd.cover_image_key ? toAbsoluteMediaUrl(origin, `/api/media/${featuredProd.cover_image_key}`) : null,
        rating: featuredProd.average_rating,
        sales_count: featuredProd.sales_count
      }
    } else {
      parsedAppearance.featuredProduct.enabled = false
      parsedAppearance.featuredProduct.productId = null
      ;(parsedAppearance.featuredProduct as any).productDetails = null
    }
  }

  const mappedAuthor = {
    ...author,
    store_appearance: parsedAppearance,
    avatar_url: toAbsoluteMediaUrl(origin, author.avatar_url),
    cover_url: toAbsoluteMediaUrl(origin, author.cover_url)
  }

  if (c.env.KV) {
    c.executionCtx.waitUntil(
      c.env.KV.put(cacheKey, JSON.stringify(mappedAuthor), { expirationTtl: 300 }).catch(() => {})
    )
  }

  return c.json(mappedAuthor, 200, {
    'X-Cache': 'MISS',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
  })
})

// --- PUBLIC STORE PROFILE (LOOKUP BY SLUG DENGAN FALLBACK ID) ---
users.get('/store/:slug', async (c) => {
  const slugOrId = c.req.param('slug').toLowerCase().trim()
  const cacheKey = `cache:store:${slugOrId}`

  if (c.env.KV) {
    const cached = await c.env.KV.get(cacheKey, 'json')
    if (cached) {
      return c.json(cached, 200, {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      })
    }
  }

  const author = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.avatar_url, u.cover_url, u.bio, u.portfolio_url, u.primary_niche,
           u.social_linkedin, u.social_twitter, u.social_instagram, u.social_facebook, u.social_tiktok,
           u.store_name, u.store_description, u.store_appearance, u.store_slug,
           u.created_at as joined_at,
           (SELECT COUNT(*) FROM products p WHERE p.author_id = u.id AND p.status = 'published') as total_products,
           (SELECT COALESCE(SUM(p.sales_count), 0) FROM products p WHERE p.author_id = u.id AND p.status = 'published') as total_sales,
           (SELECT COUNT(*) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.author_id = u.id) as total_reviews,
           (SELECT ROUND(COALESCE(AVG(pr.rating), 0), 1) FROM product_reviews pr JOIN products p ON pr.product_id = p.id WHERE p.author_id = u.id) as average_rating
    FROM users u
    WHERE (u.store_slug = ? OR u.id = ?) 
      AND u.is_active = 1
      AND (u.seller_status IS NULL OR u.seller_status = 'approved' OR u.id = 'super_admin')
  `).bind(slugOrId, slugOrId).first<any>()

  if (!author) {
    throw new HTTPException(404, { message: 'Toko mitra tidak ditemukan atau sedang tidak aktif.' })
  }

  let parsedAppearance = { ...DEFAULT_STORE_APPEARANCE }
  if (author.store_appearance) {
    try {
      const raw = typeof author.store_appearance === 'string' ? JSON.parse(author.store_appearance as string) : author.store_appearance
      parsedAppearance = mergeStoreAppearance(raw, author)
    } catch {}
  } else {
    parsedAppearance = mergeStoreAppearance({}, author)
  }

  const origin = new URL(c.req.url).origin

  if (parsedAppearance && typeof parsedAppearance === 'object' && parsedAppearance.background) {
    if (parsedAppearance.background.imageUrl) {
      parsedAppearance.background.imageUrl = toAbsoluteMediaUrl(origin, parsedAppearance.background.imageUrl)
    }
  }

  if (parsedAppearance.featuredProduct?.enabled && parsedAppearance.featuredProduct?.productId) {
    const featuredProd = await c.env.DB.prepare(`
      SELECT id, title, slug, price, original_price, cover_image_key, average_rating, sales_count
      FROM products
      WHERE id = ? AND author_id = ? AND status = 'published'
    `).bind(parsedAppearance.featuredProduct.productId, author.id).first<any>()

    if (featuredProd) {
      (parsedAppearance.featuredProduct as any).productDetails = {
        id: featuredProd.id,
        title: featuredProd.title,
        slug: featuredProd.slug,
        price: featuredProd.price,
        original_price: featuredProd.original_price,
        cover_url: featuredProd.cover_image_key ? toAbsoluteMediaUrl(origin, `/api/media/${featuredProd.cover_image_key}`) : null,
        rating: featuredProd.average_rating,
        sales_count: featuredProd.sales_count
      }
    } else {
      parsedAppearance.featuredProduct.enabled = false
      parsedAppearance.featuredProduct.productId = null
      ;(parsedAppearance.featuredProduct as any).productDetails = null
    }
  }

  const mappedAuthor = {
    ...author,
    store_appearance: parsedAppearance,
    avatar_url: toAbsoluteMediaUrl(origin, author.avatar_url),
    cover_url: toAbsoluteMediaUrl(origin, author.cover_url)
  }

  if (c.env.KV) {
    c.executionCtx.waitUntil(
      c.env.KV.put(cacheKey, JSON.stringify(mappedAuthor), { expirationTtl: 300 }).catch(() => {})
    )
  }

  return c.json(mappedAuthor, 200, {
    'X-Cache': 'MISS',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
  })
})

// --- VALIDASI REAL-TIME KETERSEDIAAN STORE SLUG ---
users.get('/check-slug', rateLimit(100, 60, 'check_slug'), async (c) => {
  const slug = c.req.query('slug')
  if (!slug) {
    return c.json({ available: false, reason: 'Tautan toko tidak boleh kosong.' }, 400)
  }

  const validation = validateStoreSlug(slug)
  if (!validation.valid) {
    return c.json({ available: false, reason: validation.error, isReserved: true }, 200)
  }

  const cleanSlug = slug.trim().toLowerCase()

  // 1. Cek tabrakan dengan rute aplikasi resmi ekosistem Asisten Guru di Hub
  const hubConflict = await checkHubAppConflict(cleanSlug, c.env.HUB_URL, c.env.KV)
  if (hubConflict.conflict) {
    return c.json({
      available: false,
      reason: `Tautan "${cleanSlug}" tidak dapat digunakan karena merupakan rute aplikasi resmi (${hubConflict.appTitle || 'Ekosistem Asisten Guru'}).`,
      isHubApp: true
    }, 200)
  }

  // Cek apakah ada token otentikasi opsional untuk mengenali kepemilikan user saat ini
  let currentUserId: string | null = null
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = await verifyToken(authHeader.split(' ')[1], c.env.JWT_SECRET)
      if (payload && (payload as any).type === 'access') {
        currentUserId = (payload as any).id
      }
    } catch {}
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE store_slug = ?'
  ).bind(cleanSlug).first<{ id: string }>()

  if (existing) {
    if (currentUserId && existing.id === currentUserId) {
      return c.json({ available: true, isCurrent: true, message: 'Ini adalah tautan toko Anda saat ini.' }, 200)
    }
    return c.json({ available: false, reason: 'Tautan toko ini sudah digunakan oleh mitra guru lain.' }, 200)
  }

  return c.json({ available: true, message: 'Tautan toko tersedia dan dapat digunakan.' }, 200)
})

// Semua endpoint di bawah ini membutuhkan autentikasi
users.use('*', authMiddleware)

// --- PROFIL SENDIRI ---

users.get('/me', rateLimit(500, 60, 'get_me'), async (c) => {
  const user = c.get('user')
  
  const dbUser = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.is_active, u.created_at, GROUP_CONCAT(r.name, ', ') as role,
           u.bio, u.portfolio_url, u.target_min_words, u.target_keyword_density, 
           u.preferred_tone, u.main_language, u.monthly_article_goal, u.monthly_word_goal, u.primary_niche,
           u.social_linkedin, u.social_twitter, u.social_instagram, u.social_facebook, u.social_tiktok,
           u.cover_url,
           u.seller_status, u.seller_applied_at, u.seller_approved_at, u.seller_rejection_reason,
           u.bank_name, u.bank_account_number, u.bank_account_holder, u.hub_account_id,
           u.seller_sample_photos,
           u.personal_address, u.gender, u.birth_date, u.store_name, u.store_description, u.store_address,
           u.store_appearance, u.store_slug, u.phone_number
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.id = ?
    GROUP BY u.id
  `).bind(user.id).first()

  if (dbUser) {
    if (dbUser.id === 'super_admin') {
      dbUser.role = 'super_admin'
      // If email is missing, fallback to env variable if possible, though it shouldn't be missing now
    }
    let samplePhotos: string[] = []
    if (dbUser.seller_sample_photos) {
      try {
        const parsed = JSON.parse(dbUser.seller_sample_photos as string)
        if (Array.isArray(parsed)) samplePhotos = parsed
      } catch {}
    }
    (dbUser as any).seller_sample_photos = samplePhotos

    let appearance = { ...DEFAULT_STORE_APPEARANCE }
    if (dbUser.store_appearance) {
      try {
        const raw = typeof dbUser.store_appearance === 'string' ? JSON.parse(dbUser.store_appearance as string) : dbUser.store_appearance
        appearance = mergeStoreAppearance(raw)
      } catch {}
    }
    (dbUser as any).store_appearance = appearance

    return c.json(dbUser)
  }

  if (user.role === 'super_admin') {
    return c.json({
      id: 'super_admin', email: user.email, name: 'Super Admin', role: 'super_admin',
      avatar_url: null, bio: null, portfolio_url: null, primary_niche: null,
      target_min_words: null, target_keyword_density: null,
      preferred_tone: null, main_language: null,
      monthly_article_goal: null, monthly_word_goal: null,
      social_linkedin: null, social_twitter: null, social_instagram: null,
      social_facebook: null, social_tiktok: null, cover_url: null, phone_number: null,
      is_active: 1, created_at: new Date().toISOString()
    })
  }
  
  throw new HTTPException(404, { message: 'User tidak ditemukan' })
})

const updateMeSchema = z.object({
  name: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  avatar_url: z.union([
    z.string().regex(/^\/api\/media\/avatars\/[A-Za-z0-9._-]+$/, 'Foto avatar tidak valid.'),
    z.string().url('URL avatar tidak valid.').refine(v => !/^\s*(javascript|data|vbscript):/i.test(v), 'URL avatar tidak aman.'),
    z.literal('')
  ]).nullable().optional(),
  // Hanya path sampul hasil upload sendiri (divalidasi lagi terhadap user.id di handler), atau kosong untuk menghapus
  cover_url: z.union([z.string().regex(/^\/api\/media\/covers\/[A-Za-z0-9._-]+$/, 'Foto sampul tidak valid.'), z.literal('')]).nullable().optional(),
  bio: z.string().max(500, 'Bio maksimal 500 karakter').nullable().optional().transform(v => v ? cleanText(v) : v),
  portfolioUrl: z.union([z.string().max(300).refine(v => !/^\s*(javascript|data|vbscript):/i.test(v), 'URL portfolio tidak valid.'), z.literal('')]).nullable().optional(),
  targetMinWords: z.number().min(0).nullable().optional(),
  targetKeywordDensity: z.number().min(0).max(10).nullable().optional(),
  preferredTone: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  mainLanguage: z.string().max(50).nullable().optional().transform(v => v ? cleanText(v) : v),
  monthlyArticleGoal: z.number().min(0).nullable().optional(),
  monthlyWordGoal: z.number().min(0).nullable().optional(),
  primaryNiche: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  primary_niche: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  socialLinkedin: z.union([z.string().max(100, 'Username LinkedIn terlalu panjang').transform(v => cleanText(v.replace(/^@/, ''))), z.literal('')]).nullable().optional().transform(v => v === '' ? null : v),
  socialTwitter: z.union([z.string().max(100, 'Username Twitter terlalu panjang').transform(v => cleanText(v.replace(/^@/, ''))), z.literal('')]).nullable().optional().transform(v => v === '' ? null : v),
  socialInstagram: z.union([z.string().max(100, 'Username Instagram terlalu panjang').transform(v => cleanText(v.replace(/^@/, ''))), z.literal('')]).nullable().optional().transform(v => v === '' ? null : v),
  socialFacebook: z.union([z.string().max(100, 'Username Facebook terlalu panjang').transform(v => cleanText(v.replace(/^@/, ''))), z.literal('')]).nullable().optional().transform(v => v === '' ? null : v),
  socialTiktok: z.union([z.string().max(100, 'Username TikTok terlalu panjang').transform(v => cleanText(v.replace(/^@/, ''))), z.literal('')]).nullable().optional().transform(v => v === '' ? null : v),
  bank_name: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  bank_account_number: z.string().max(50).nullable().optional().transform(v => v ? cleanText(v) : v),
  bank_account_holder: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  personal_address: z.string().max(500).nullable().optional().transform(v => v ? cleanText(v) : v),
  gender: z.string().max(20).nullable().optional().transform(v => v ? cleanText(v) : v),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid (YYYY-MM-DD)').nullable().optional(),
  store_name: z.string().max(100).nullable().optional().transform(v => v ? cleanText(v) : v),
  store_description: z.string().max(1000).nullable().optional().transform(v => v ? cleanText(v) : v),
  store_address: z.string().max(500).nullable().optional().transform(v => v ? cleanText(v) : v),
  store_slug: z.string().max(30).nullable().optional().transform(v => v ? v.trim().toLowerCase() : v),
  phone_number: z.string().max(25, 'Nomor WhatsApp / HP maksimal 25 karakter').nullable().optional().transform(v => {
    if (!v) return null;
    let clean = cleanText(v.replace(/[^\d+]/g, ''));
    if (clean.startsWith('8')) clean = '0' + clean;
    return clean || null;
  }).refine(v => !v || /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(v), {
    message: 'Format nomor WhatsApp / HP tidak valid (contoh: 081234567890 atau +6281234567890).'
  })
})

users.put('/me', rateLimit(10, 60, 'update_me'), zValidator('json', updateMeSchema), async (c) => {
  const user = c.get('user')

  const { 
    name, avatar_url, cover_url, bio, portfolioUrl, targetMinWords, targetKeywordDensity, 
    preferredTone, mainLanguage, monthlyArticleGoal, monthlyWordGoal, primaryNiche, primary_niche,
    socialLinkedin, socialTwitter, socialInstagram, socialFacebook, socialTiktok,
    bank_name, bank_account_number, bank_account_holder,
    personal_address, gender, birth_date,
    store_name, store_description, store_address, store_slug, phone_number
  } = c.req.valid('json')

  const selectedNiche = primaryNiche || primary_niche

  // Validasi usia 18+ jika tanggal lahir diperbarui (Aturan Wajib Hukum Kemitraan)
  if (birth_date) {
    const birth = new Date(birth_date)
    if (isNaN(birth.getTime())) {
      throw new HTTPException(400, { message: 'Tanggal lahir yang dimasukkan tidak valid.' })
    }
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    if (age < 18) {
      throw new HTTPException(400, { message: 'Pengaturan tanggal lahir mewajibkan usia minimal 18 tahun.' })
    }
  }

  const prevUser = await c.env.DB.prepare(
    'SELECT store_slug, seller_status, is_active FROM users WHERE id = ?'
  ).bind(user.id).first<{ store_slug: string | null; seller_status: string | null; is_active: number }>()

  // Validasi dan proteksi permanen store_slug (1 Kali Seumur Hidup & Khusus Mitra Approved)
  let finalStoreSlug: string | null = undefined as any
  if (store_slug !== undefined) {
    const existingSlug = prevUser?.store_slug

    if (existingSlug) {
      // ATURAN PERMANEN SEUMUR HIDUP: Jika slug sudah ada, tidak boleh diubah atau dihapus
      if (store_slug === '' || store_slug === null) {
        throw new HTTPException(400, {
          message: 'Tautan toko Anda telah aktif permanen seumur hidup dan tidak dapat dihapus.'
        })
      }
      if (store_slug !== existingSlug) {
        throw new HTTPException(400, {
          message: `Tautan toko Anda (asisten-guru.id/${existingSlug}) bersifat permanen seumur hidup dan tidak dapat diubah kembali.`
        })
      }
      // Nilai sama persis: pertahankan
      finalStoreSlug = existingSlug
    } else {
      // Toko belum memiliki slug: proses pembuatan perdana
      if (store_slug === '' || store_slug === null) {
        finalStoreSlug = null
      } else {
        // ATURAN STATUS MITRA: Hanya mitra yang sudah disetujui (approved) atau super_admin yang berhak membuat slug
        const isApprovedSeller = prevUser?.seller_status === 'approved' || user.role === 'super_admin'
        if (!isApprovedSeller) {
          throw new HTTPException(403, {
            message: 'Pembuatan tautan toko khusus hanya dapat dilakukan setelah status kemitraan Anda resmi disetujui oleh tim kurator.'
          })
        }

        const val = validateStoreSlug(store_slug)
        if (!val.valid) {
          throw new HTTPException(400, { message: val.error })
        }

        // Cek tabrakan dengan rute aplikasi ekosistem Hub
        const hubConflict = await checkHubAppConflict(store_slug, c.env.HUB_URL, c.env.KV)
        if (hubConflict.conflict) {
          throw new HTTPException(400, {
            message: `Tautan "${store_slug}" tidak dapat digunakan karena merupakan rute aplikasi resmi (${hubConflict.appTitle || 'Ekosistem Asisten Guru'}).`
          })
        }

        const conflict = await c.env.DB.prepare(
          'SELECT id FROM users WHERE store_slug = ? AND id != ?'
        ).bind(store_slug, user.id).first()
        if (conflict) {
          throw new HTTPException(400, { message: 'Tautan toko ini sudah digunakan oleh mitra guru lain.' })
        }
        finalStoreSlug = store_slug
      }
    }
  }

  // Cegah user memasang file sampul milik user lain
  if (cover_url && !cover_url.startsWith(`/api/media/covers/${user.id}-`)) {
    throw new HTTPException(400, { message: 'Foto sampul tidak valid. Silakan unggah ulang.' })
  }

  // SECURITY HARDENING (Point #2): Cegah user memasang atau menghapus file avatar milik user lain
  if (avatar_url && avatar_url.startsWith('/api/media/avatars/') && !avatar_url.startsWith(`/api/media/avatars/${user.id}-`)) {
    throw new HTTPException(400, { message: 'Foto avatar tidak valid. Silakan unggah ulang.' })
  }

  // Validasi kategori niche resmi yang diatur admin (seller tidak bisa buat kategori sendiri)
  if (selectedNiche) {
    const validCat = await c.env.DB.prepare(
      "SELECT id FROM categories WHERE name = ? AND (type = 'product' OR type IS NULL)"
    ).bind(selectedNiche).first()
    if (!validCat) {
      throw new HTTPException(400, { message: 'Kategori utama yang dipilih tidak valid atau belum terdaftar dalam pengaturan admin.' })
    }
  }
  
  // Allow clearing avatar_url or name by transforming empty string to null
  const finalName = name === '' || name === undefined ? null : name;
  const finalAvatar = avatar_url === '' ? null : (avatar_url || undefined);
  const finalPortfolio = portfolioUrl === '' || portfolioUrl === undefined ? null : portfolioUrl;
  const finalBio = bio === '' || bio === undefined ? null : bio;

  const finalCover = cover_url === '' ? null : (cover_url || undefined);

  // Cek apakah ada avatar lama yang dihapus/diganti, HANYA jika avatar_url dikirim secara eksplisit oleh klien
  const dbUser = await c.env.DB.prepare('SELECT avatar_url, cover_url FROM users WHERE id = ?').bind(user.id).first();
  if (dbUser && dbUser.avatar_url && avatar_url !== undefined && dbUser.avatar_url !== finalAvatar) {
    const oldUrl = dbUser.avatar_url as string;
    const match = oldUrl.match(/\/api\/media\/avatars\/(.+)$/);
    // Pastikan avatar lama yang dihapus dari R2 dan media benar-benar milik user ini (prefix user.id-)
    if (match && match[1] && match[1].startsWith(`${user.id}-`)) {
      const oldKey = `avatars/${match[1]}`;
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus avatar lama dari R2 di PUT /me', oldKey));
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ? AND (uploaded_by = ? OR uploaded_by IS NULL)').bind(oldKey, user.id).run();
    }
  }

  // Cek apakah ada cover lama yang dihapus/diganti, jika ya, hapus dari R2 untuk mencegah storage leak
  if (dbUser && dbUser.cover_url && cover_url !== undefined && dbUser.cover_url !== finalCover) {
    const oldUrl = dbUser.cover_url as string;
    const match = oldUrl.match(/\/api\/media\/covers\/(.+)$/);
    if (match && match[1] && match[1].startsWith(`${user.id}-`)) {
      const oldKey = `covers/${match[1]}`;
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus cover lama dari R2 di PUT /me', oldKey));
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ? AND (uploaded_by = ? OR uploaded_by IS NULL)').bind(oldKey, user.id).run();
    }
  }

  const result = await c.env.DB.prepare(`
    UPDATE users 
    SET name = ?, 
        avatar_url = (CASE WHEN ? = 1 THEN ? ELSE avatar_url END),
        bio = ?, portfolio_url = ?, target_min_words = ?, target_keyword_density = ?,
        preferred_tone = ?, main_language = ?, monthly_article_goal = ?, monthly_word_goal = ?, primary_niche = ?, 
        social_linkedin = ?, social_twitter = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?,
        cover_url = (CASE WHEN ? = 1 THEN ? ELSE cover_url END),
        bank_name = (CASE WHEN ? = 1 THEN ? ELSE bank_name END), 
        bank_account_number = (CASE WHEN ? = 1 THEN ? ELSE bank_account_number END), 
        bank_account_holder = (CASE WHEN ? = 1 THEN ? ELSE bank_account_holder END),
        personal_address = (CASE WHEN ? = 1 THEN ? ELSE personal_address END),
        gender = (CASE WHEN ? = 1 THEN ? ELSE gender END),
        birth_date = (CASE WHEN ? = 1 THEN ? ELSE birth_date END),
        store_name = (CASE WHEN ? = 1 THEN ? ELSE store_name END),
        store_description = (CASE WHEN ? = 1 THEN ? ELSE store_description END),
        store_address = (CASE WHEN ? = 1 THEN ? ELSE store_address END),
        store_slug = (CASE WHEN ? = 1 THEN ? ELSE store_slug END),
        phone_number = (CASE WHEN ? = 1 THEN ? ELSE phone_number END),
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(
    finalName, 
    avatar_url !== undefined ? 1 : 0, finalAvatar ?? null,
    finalBio, finalPortfolio, 
    targetMinWords ?? null, 
    targetKeywordDensity ?? null,
    preferredTone || null, mainLanguage || null, 
    monthlyArticleGoal ?? null, 
    monthlyWordGoal ?? null, 
    selectedNiche || null,
    socialLinkedin ?? null, socialTwitter ?? null, socialInstagram ?? null, socialFacebook ?? null, socialTiktok ?? null,
    cover_url !== undefined ? 1 : 0, finalCover ?? null,
    bank_name !== undefined ? 1 : 0, bank_name ?? null,
    bank_account_number !== undefined ? 1 : 0, bank_account_number ?? null,
    bank_account_holder !== undefined ? 1 : 0, bank_account_holder ?? null,
    personal_address !== undefined ? 1 : 0, personal_address ?? null,
    gender !== undefined ? 1 : 0, gender ?? null,
    birth_date !== undefined ? 1 : 0, birth_date ?? null,
    store_name !== undefined ? 1 : 0, store_name ?? null,
    store_description !== undefined ? 1 : 0, store_description ?? null,
    store_address !== undefined ? 1 : 0, store_address ?? null,
    store_slug !== undefined ? 1 : 0, finalStoreSlug ?? null,
    phone_number !== undefined ? 1 : 0, phone_number ?? null,
    user.id
  ).run()

  // FIX: Jika user adalah super_admin tapi belum ada di tabel users (karena session lama), insert record-nya
  if (result.meta.changes === 0 && user.role === 'super_admin') {
    const safePasswordHash = c.env.SUPER_ADMIN_PASSWORD_HASH
    if (!safePasswordHash) {
      throw new HTTPException(500, { message: 'Konfigurasi sistem belum lengkap. Hubungi administrator.' })
    }
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, name, avatar_url, password_hash, is_active, bio, portfolio_url, target_min_words, target_keyword_density, preferred_tone, main_language, monthly_article_goal, monthly_word_goal, primary_niche, social_linkedin, social_twitter, social_instagram, social_facebook, social_tiktok, personal_address, gender, birth_date, store_name, store_description, store_address, store_slug, phone_number)
      VALUES ('super_admin', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.email || c.env.SUPER_ADMIN_EMAIL || 'admin@admin.com', finalName || 'Super Admin', finalAvatar, safePasswordHash,
      finalBio, finalPortfolio, 
      targetMinWords ?? null, 
      targetKeywordDensity ?? null, 
      preferredTone || null, mainLanguage || null, 
      monthlyArticleGoal ?? null, 
      monthlyWordGoal ?? null, 
      selectedNiche || null,
      socialLinkedin ?? null, socialTwitter ?? null, socialInstagram ?? null, socialFacebook ?? null, socialTiktok ?? null,
      personal_address ?? null, gender ?? null, birth_date ?? null, store_name ?? null, store_description ?? null, store_address ?? null, finalStoreSlug ?? null, phone_number ?? null
    ).run()
  }

  // Sampul: hanya diproses bila field dikirim (klien lama yang tidak mengirim cover_url tidak menghapus sampul)
  if (cover_url !== undefined) {
    const finalCover = cover_url === '' || cover_url === null ? null : cover_url
    const coverRow = await c.env.DB.prepare('SELECT cover_url FROM users WHERE id = ?').bind(user.id).first()
    if (coverRow && coverRow.cover_url && coverRow.cover_url !== finalCover) {
      const match = (coverRow.cover_url as string).match(/\/api\/media\/covers\/(.+)$/)
      if (match && match[1] && match[1].startsWith(`${user.id}-`)) {
        const oldKey = `covers/${match[1]}`
        await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus sampul lama dari R2 di PUT /me', oldKey))
        await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ? AND (uploaded_by = ? OR uploaded_by IS NULL)').bind(oldKey, user.id).run()
      }
    }
    await c.env.DB.prepare('UPDATE users SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(finalCover, user.id).run()
  }

  const oldSlug = prevUser?.store_slug
  invalidateAuthorCache(c.env, c.executionCtx, user.id, finalStoreSlug || oldSlug)
  if (oldSlug && oldSlug !== finalStoreSlug && c.env.KV) {
    c.executionCtx.waitUntil(c.env.KV.delete(`cache:store:${oldSlug}`).catch(() => {}))
  }

  return c.json({ message: 'Profil berhasil diperbarui.' })
})

// --- REGISTRASI MITRA SELLER BARU (FORMULIR ONBOARDING KHUSUS) ---
const registerSellerSchema = z.object({
  // Biodata Diri
  name: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100, 'Nama terlalu panjang').transform(cleanText),
  personal_address: z.string().min(5, 'Alamat domisili minimal 5 karakter').max(500, 'Alamat domisili maksimal 500 karakter').transform(cleanText),
  phone_number: z.string().min(8, 'Nomor WhatsApp / HP aktif minimal 9 digit').max(25, 'Nomor WhatsApp / HP maksimal 25 karakter').transform(v => {
    let clean = cleanText(v.replace(/[^\d+]/g, ''));
    if (clean.startsWith('8')) clean = '0' + clean;
    return clean;
  }).refine(v => /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(v), {
    message: 'Format nomor WhatsApp / HP tidak valid. Gunakan format nomor aktif Indonesia (contoh: 081234567890 atau +6281234567890).'
  }),
  gender: z.union([z.literal('Laki-laki'), z.literal('Perempuan')]),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid (YYYY-MM-DD)'),
  
  // Biodata Toko
  store_name: z.string().min(3, 'Nama toko minimal 3 karakter').max(100, 'Nama toko maksimal 100 karakter').transform(cleanText),
  store_description: z.string().min(10, 'Deskripsi toko minimal 10 karakter').max(1000, 'Deskripsi toko maksimal 1000 karakter').transform(cleanText),
  store_address: z.string().min(5, 'Alamat toko minimal 5 karakter').max(500, 'Alamat toko maksimal 500 karakter').transform(cleanText),
  
  // Contoh Foto Produk Kurasi (Wajib diunggah calon seller untuk kurasi awal)
  seller_sample_photos: z.array(z.string().max(300)).min(1, 'Unggah minimal 1 foto contoh produk untuk kurasi mutu').max(5, 'Maksimal 5 foto contoh produk'),
  
  // Kategori / Niche & Rekening
  primary_niche: z.string().max(100).optional().nullable().transform(v => v ? cleanText(v) : null),
  bank_name: z.string().max(100).optional().nullable().transform(v => v ? cleanText(v) : null),
  bank_account_number: z.string().max(50).optional().nullable().transform(v => v ? cleanText(v) : null),
  bank_account_holder: z.string().max(100).optional().nullable().transform(v => v ? cleanText(v) : null),
  
  // Halaman Legal (Wajib disetujui setelah membaca)
  terms_accepted: z.boolean().refine(v => v === true, {
    message: 'Anda wajib membaca dan menyetujui Syarat & Ketentuan Kemitraan'
  }),
  privacy_accepted: z.boolean().refine(v => v === true, {
    message: 'Anda wajib membaca dan menyetujui Kebijakan Privasi'
  })
})

users.post('/me/register-seller', rateLimit(5, 60, 'register_seller'), zValidator('json', registerSellerSchema), async (c) => {
  const user = c.get('user')

  const {
    name, personal_address, phone_number, gender, birth_date,
    store_name, store_description, store_address,
    seller_sample_photos, primary_niche,
    bank_name, bank_account_number, bank_account_holder
  } = c.req.valid('json')

  // 1. Verifikasi batas usia 18+ tahun (Aturan Wajib Hukum Kemitraan)
  const birth = new Date(birth_date)
  if (isNaN(birth.getTime())) {
    throw new HTTPException(400, { message: 'Tanggal lahir yang dimasukkan tidak valid.' })
  }
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  if (age < 18) {
    throw new HTTPException(400, { message: 'Pendaftaran kemitraan mewajibkan usia minimal 18 tahun.' })
  }

  // 2. Verifikasi kepemilikan dan keberadaan berkas foto contoh produk di media penyimpanan
  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')
  const normalizedPhotos: string[] = []

  for (const p of seller_sample_photos) {
    let cleanPath = p
    try {
      if (p.startsWith('http://') || p.startsWith('https://')) {
        cleanPath = new URL(p).pathname
      }
    } catch {}

    if (!cleanPath.startsWith(`/api/media/sample-products/${safeUserId}-`)) {
      throw new HTTPException(400, { message: 'Berkas foto contoh produk tidak valid atau bukan milik akun Anda.' })
    }
    const cleanFileName = cleanPath.replace('/api/media/sample-products/', '')
    const targetKey = `sample-products/${cleanFileName}`
    const mediaRecord = await c.env.DB.prepare(
      'SELECT id FROM media WHERE r2_key = ? AND (uploaded_by = ? OR uploaded_by IS NULL)'
    ).bind(targetKey, user.id).first()
    if (!mediaRecord) {
      throw new HTTPException(400, { message: 'Satu atau lebih berkas foto contoh produk tidak ditemukan di sistem penyimpanan.' })
    }
    normalizedPhotos.push(cleanPath)
  }

  // 3. Cek status saat ini di DB
  const dbUser = await c.env.DB.prepare('SELECT id, is_active, seller_status FROM users WHERE id = ?').bind(user.id).first<{ id: string; is_active: number; seller_status: string }>()
  if (!dbUser || dbUser.is_active === 0) {
    throw new HTTPException(403, { message: 'Akun Anda dinonaktifkan atau tidak ditemukan.' })
  }
  if (dbUser.seller_status === 'approved') {
    return c.json({ message: 'Akun Anda sudah terverifikasi sebagai Mitra resmi.', seller_status: 'approved' })
  }

  // Validasi kategori utama resmi yang telah diatur oleh admin (seller tidak bisa membuat kategori sendiri)
  if (primary_niche) {
    const validCat = await c.env.DB.prepare(
      "SELECT id FROM categories WHERE name = ? AND (type = 'product' OR type IS NULL)"
    ).bind(primary_niche).first()
    if (!validCat) {
      throw new HTTPException(400, { message: 'Kategori utama yang dipilih tidak valid atau belum terdaftar dalam sistem admin.' })
    }
  }

  // 4. Update data pendaftaran mitra ke D1
  const photosJson = JSON.stringify(normalizedPhotos.slice(0, 5))
  await c.env.DB.prepare(`
    UPDATE users 
    SET name = ?,
        personal_address = ?,
        phone_number = ?,
        gender = ?,
        birth_date = ?,
        store_name = ?,
        store_description = ?,
        store_address = ?,
        seller_sample_photos = ?,
        primary_niche = COALESCE(?, primary_niche),
        bank_name = COALESCE(?, bank_name),
        bank_account_number = COALESCE(?, bank_account_number),
        bank_account_holder = COALESCE(?, bank_account_holder),
        seller_status = 'pending',
        seller_applied_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    name,
    personal_address,
    phone_number,
    gender,
    birth_date,
    store_name,
    store_description,
    store_address,
    photosJson,
    primary_niche || null,
    bank_name || null,
    bank_account_number || null,
    bank_account_holder || null,
    user.id
  ).run()

  // Role 'role-seller' akan disematkan secara resmi oleh super admin saat pengajuan disetujui (PUT /api/users/sellers/:id/approve)

  return c.json({
    message: 'Data pendaftaran berhasil dikirim. Pengajuan kemitraan Anda akan diverifikasi dalam maksimal 3x24 jam kerja (07.00 - 15.00 WIB).',
    seller_status: 'pending'
  })
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

  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format pengunggahan foto avatar tidak valid atau transmisi terputus.' })
  }
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
  
  await c.env.DB.prepare('INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(mediaId, objectPath, fileName, detectedContentType, file.size, user.id === 'super_admin' ? null : user.id).run()
  
  const updateResult = await c.env.DB.prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newAvatarUrl, user.id).run()

  // FIX Bug #2: Jika super_admin belum ada record di tabel users, INSERT baru
  if (updateResult.meta.changes === 0 && user.role === 'super_admin') {
    const safePasswordHash = c.env.SUPER_ADMIN_PASSWORD_HASH
    if (!safePasswordHash) {
      throw new HTTPException(500, { message: 'Konfigurasi sistem belum lengkap. Hubungi administrator.' })
    }
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, name, avatar_url, password_hash, is_active)
      VALUES ('super_admin', ?, 'Super Admin', ?, ?, 1)
    `).bind(
      user.email || c.env.SUPER_ADMIN_EMAIL || 'admin@admin.com',
      newAvatarUrl,
      safePasswordHash
    ).run()
  }

  invalidateAuthorCache(c.env, c.executionCtx, user.id)

  return c.json({ message: 'Avatar berhasil diunggah.', avatar_url: newAvatarUrl })
})

// --- UPLOAD FOTO SAMPUL TOKO ---
// File diunggah ke R2, cover lama dibersihkan, dan cover_url langsung disimpan ke tabel users
users.post('/me/cover', rateLimit(5, 60, 'cover_upload'), async (c) => {
  const user = c.get('user')

  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format pengunggahan foto sampul tidak valid atau transmisi terputus.' })
  }
  const file = body['cover']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File foto sampul tidak ditemukan.' })
  }

  const MAX_SIZE = 3 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: 'Ukuran foto sampul melebihi batas (Max 3MB).' })
  }

  const arrayBuffer = await file.arrayBuffer()
  const detectedContentType = isSafeImage(arrayBuffer) ? getContentTypeFromMagicBytes(arrayBuffer) : null
  if (!detectedContentType) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, WEBP yang diterima.' })
  }

  let ext = 'jpg'
  if (detectedContentType === 'image/png') ext = 'png'
  if (detectedContentType === 'image/webp') ext = 'webp'

  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')
  const fileName = `${safeUserId}-${Date.now()}.${ext}`
  const objectPath = `covers/${fileName}`

  // 1. Cari cover lama dan hapus dari R2 untuk mencegah penumpukan berkas sampah
  const dbUser = await c.env.DB.prepare('SELECT cover_url FROM users WHERE id = ?').bind(user.id).first()
  if (dbUser && dbUser.cover_url) {
    const oldUrl = dbUser.cover_url as string
    const match = oldUrl.match(/\/api\/media\/covers\/(.+)$/)
    if (match && match[1]) {
      const oldKey = `covers/${match[1]}`
      await c.env.R2.delete(oldKey).catch(() => console.error('Gagal menghapus cover lama dari R2', oldKey))
      await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(oldKey).run()
    }
  }

  // 2. Upload file baru ke R2
  await c.env.R2.put(objectPath, arrayBuffer, {
    httpMetadata: { contentType: detectedContentType }
  })

  // 3. Catat di tabel media
  await c.env.DB.prepare('INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), objectPath, fileName, detectedContentType, file.size, user.id === 'super_admin' ? null : user.id).run()

  // 4. Update langsung kolom users.cover_url di D1
  const coverUrl = `/api/media/covers/${fileName}`
  await c.env.DB.prepare('UPDATE users SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(coverUrl, user.id).run()

  invalidateAuthorCache(c.env, c.executionCtx, user.id)

  return c.json({ message: 'Foto sampul berhasil diunggah.', cover_url: coverUrl })
})

// --- UPLOAD CONTOH FOTO PRODUK (Untuk Kurasi Seller Admin) ---
// Maksimal 5 foto dan ukuran file maksimal 1 MB per foto
users.post('/me/sample-photos', rateLimit(30, 60, 'sample_photos_upload'), async (c) => {
  const user = c.get('user')

  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format berkas foto contoh produk tidak valid atau transmisi terputus.' })
  }
  const file = body['photo'] || body['file']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'File foto contoh produk tidak ditemukan.' })
  }

  // 1. Batas ukuran maksimal 1 MB per foto
  const MAX_SIZE = 1 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: 'Ukuran foto melebihi batas (Maksimal 1 MB per file foto).' })
  }

  // 2. Validasi format gambar aman (Magic Bytes)
  const arrayBuffer = await file.arrayBuffer()
  const detectedContentType = isSafeImage(arrayBuffer) ? getContentTypeFromMagicBytes(arrayBuffer) : null
  if (!detectedContentType) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, dan WEBP yang diterima.' })
  }

  // 3. Cek kuota maksimal 5 foto yang aktif diunggah oleh user
  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')
  // Gunakan instr untuk pencocokan prefix key tanpa terkena limit 50-byte D1 SQLite LIKE pattern
  const existingMedia = await c.env.DB.prepare(`
    SELECT id, r2_key FROM media 
    WHERE (uploaded_by = ? OR (uploaded_by IS NULL AND instr(r2_key, ?) = 1)) AND r2_key LIKE 'sample-products/%'
    ORDER BY created_at ASC
  `).bind(user.id, `sample-products/${safeUserId}-`).all<{ id: string; r2_key: string }>()

  const totalCount = existingMedia.results ? existingMedia.results.length : 0

  if (totalCount >= 5) {
    // Cek apakah ada foto yang merupakan draft lama (tidak tercatat di users.seller_sample_photos)
    const dbUser = await c.env.DB.prepare('SELECT seller_sample_photos FROM users WHERE id = ?').bind(user.id).first<{ seller_sample_photos: string | null }>()
    let activeUrls: string[] = []
    if (dbUser && dbUser.seller_sample_photos) {
      try {
        const parsed = JSON.parse(dbUser.seller_sample_photos)
        if (Array.isArray(parsed)) activeUrls = parsed
      } catch {}
    }

    const orphaned = (existingMedia.results || []).filter(m => {
      const url = `/api/media/${m.r2_key}`
      return !activeUrls.includes(url)
    })

    if (orphaned.length > 0) {
      // Hapus orphaned upload tertua agar slot foto tersedia dan pendaftar tidak terkunci
      const toDelete = orphaned[0]
      await c.env.R2.delete(toDelete.r2_key).catch(() => {})
      await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(toDelete.id).run()
    } else {
      throw new HTTPException(400, { message: 'Batas maksimal 5 contoh foto produk telah tercapai. Hapus foto lama untuk mengunggah yang baru.' })
    }
  }

  let ext = 'jpg'
  if (detectedContentType === 'image/png') ext = 'png'
  if (detectedContentType === 'image/webp') ext = 'webp'

  const randomSuffix = crypto.randomUUID().slice(0, 8)
  const fileName = `${safeUserId}-${Date.now()}-${randomSuffix}.${ext}`
  const objectPath = `sample-products/${fileName}`

  await c.env.R2.put(objectPath, arrayBuffer, {
    httpMetadata: { contentType: detectedContentType }
  })

  await c.env.DB.prepare('INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), objectPath, fileName, detectedContentType, file.size, user.id === 'super_admin' ? null : user.id).run()

  const photoUrl = `/api/media/sample-products/${fileName}`

  return c.json({
    message: 'Foto contoh produk berhasil diunggah.',
    photo_url: photoUrl,
    file_name: fileName
  })
})

// --- HAPUS CONTOH FOTO PRODUK ---
users.delete('/me/sample-photos/:fileName', rateLimit(20, 60, 'sample_photos_delete'), async (c) => {
  const user = c.get('user')
  const fileName = c.req.param('fileName')
  if (!fileName) {
    throw new HTTPException(400, { message: 'Nama file foto tidak valid.' })
  }
  const safeKey = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '')

  // Verifikasi kepemilikan file
  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')
  if (!safeKey.startsWith(`${safeUserId}-`)) {
    throw new HTTPException(403, { message: 'Anda tidak memiliki hak akses untuk menghapus foto ini.' })
  }

  const objectPath = `sample-products/${safeKey}`
  await c.env.R2.delete(objectPath).catch(() => console.error('Gagal menghapus foto sampel dari R2:', objectPath))

  await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ? AND (uploaded_by = ? OR (uploaded_by IS NULL AND ? = \'super_admin\'))')
    .bind(objectPath, user.id, user.id).run()

  // Update daftar foto di database jika sudah tersimpan
  const photoUrl = `/api/media/sample-products/${safeKey}`
  const dbUser = await c.env.DB.prepare('SELECT seller_sample_photos FROM users WHERE id = ?').bind(user.id).first()
  if (dbUser && dbUser.seller_sample_photos) {
    try {
      const list = JSON.parse(dbUser.seller_sample_photos as string)
      if (Array.isArray(list)) {
        const updatedList = list.filter((url: string) => url !== photoUrl)
        const newJson = updatedList.length > 0 ? JSON.stringify(updatedList) : null
        await c.env.DB.prepare('UPDATE users SET seller_sample_photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newJson, user.id).run()
      }
    } catch {}
  }

  return c.json({ message: 'Foto contoh produk berhasil dihapus.' })
})

// --- MANAJEMEN TAMPILAN & TEMA TOKO MITRA (APPEARANCE STUDIO) ---

const sectionBlockSchema = z.enum([
  'profile',
  'social_links',
  'video_teaser',
  'featured_product',
  'catalog',
  'faq'
])

export const storeAppearanceSchema = z.object({
  preset: z.enum(['emerald-scholar', 'academic-navy', 'warm-terracotta', 'minimal-slate', 'pastel-mint', 'custom']).default('emerald-scholar'),
  background: z.object({
    type: z.enum(['color', 'gradient', 'image']).default('gradient'),
    value: z.string().max(250).refine(v => {
      const clean = v.trim()
      // Tolak karakter berbahaya untuk mencegah CSS injection (semicolons, braces, quotes, angle brackets, backslash)
      if (/[;"'{}<>\\]/.test(clean)) return false
      // Tolak pemanggilan fungsi berisiko atau eksekusi url/script
      if (/(url|javascript|expression|behavior|import)/i.test(clean)) return false
      return true
    }, 'Nilai latar belakang tidak valid atau mengandung karakter yang dilarang.').default('#f5f5f4'),
    imageUrl: z.union([
      z.string().regex(/^(https?:\/\/[^/]+)?\/api\/media\/store-backgrounds\/bg-[A-Za-z0-9_-]+-[0-9]+\.(jpg|jpeg|png|webp)$/, 'URL gambar latar belakang tidak valid.'),
      z.literal('')
    ]).nullable().optional()
  }).refine(bg => {
    if (bg.type === 'color') {
      return hexColorRegex.test(bg.value)
    }
    if (bg.type === 'gradient') {
      return /^linear-gradient\([a-zA-Z0-9#,\s.%-]+\)$/i.test(bg.value)
    }
    return true
  }, {
    message: 'Format nilai latar belakang tidak valid untuk jenis yang dipilih.',
    path: ['value']
  }).default({
    type: 'color',
    value: '#f5f5f4',
    imageUrl: null
  }),
  button: z.object({
    style: z.enum(['fill', 'outline', 'shadow-soft', 'shadow-hard', 'glassmorphism']).default('fill'),
    radius: z.enum(['sharp', 'rounded', 'pill']).default('rounded'),
    bgColor: z.string().regex(hexColorRegex, 'Format warna tombol tidak valid (harus kode hex #xxxxxx)').default('#0D5B52'),
    textColor: z.string().regex(hexColorRegex, 'Format warna teks tombol tidak valid (harus kode hex #xxxxxx)').default('#ffffff'),
    borderColor: z.union([z.string().regex(hexColorRegex, 'Format warna batas tombol tidak valid'), z.literal('')]).optional().nullable()
  }).default({
    style: 'fill',
    radius: 'rounded',
    bgColor: '#0D5B52',
    textColor: '#ffffff'
  }),
  typography: z.object({
    fontFamily: z.string().min(1).max(60).default('Plus Jakarta Sans'),
    headingColor: z.string().regex(hexColorRegex, 'Format warna judul tidak valid').default('#1c1917'),
    bioColor: z.string().regex(hexColorRegex, 'Format warna deskripsi tidak valid').default('#57534e'),
    cardStyle: z.enum(['none', 'glass', 'solid', 'soft']).default('none'),
    cardBgColor: z.string().regex(hexColorRegex, 'Format warna wadah tidak valid').default('#ffffff'),
    cardOpacity: z.number().min(0).max(100).default(85),
    cardBlur: z.enum(['none', 'sm', 'md', 'lg']).default('md'),
    textShadow: z.enum(['none', 'soft', 'glow']).default('none')
  }).default({
    fontFamily: 'Plus Jakarta Sans',
    headingColor: '#1c1917',
    bioColor: '#57534e',
    cardStyle: 'none',
    cardBgColor: '#ffffff',
    cardOpacity: 85,
    cardBlur: 'md',
    textShadow: 'none'
  }),
  catalogLayout: z.enum(['grid', 'list', 'compact']).default('grid'),
  socialLinksStyle: z.enum(['colored', 'monochrome', 'pill']).default('colored'),

  // Ekstensi Blok Modular (Urutan bebas 6 blok seksi)
  sectionsOrder: z.array(sectionBlockSchema)
    .refine(arr => arr.includes('profile') && arr.includes('catalog'), {
      message: 'Susunan blok seksi wajib menyertakan profil toko dan katalog produk.'
    })
    .refine(arr => new Set(arr).size === arr.length, {
      message: 'Susunan blok seksi tidak boleh memiliki duplikasi seksi.'
    })
    .refine(arr => arr[0] === 'profile', {
      message: 'Blok profil toko wajib berada di posisi teratas sebagai identitas toko.'
    })
    .default([
      'profile',
      'social_links',
      'video_teaser',
      'featured_product',
      'catalog',
      'faq'
    ]),

  // Ekstensi Ikon Media Sosial & Kontak Guru (Dengan Validasi Anti-Phishing)
  socialLinks: z.object({
    enabled: z.boolean().default(true),
    style: z.enum(['colored', 'monochrome', 'pill']).default('colored'),
    whatsapp: z.string().max(30).nullable().optional()
      .refine(v => !v || !v.trim() || /^[+]?[0-9\s-]{8,20}$/.test(v.trim()), 'Nomor WhatsApp hanya boleh berisi angka dan kode negara')
      .transform(v => (v && v.trim().length > 0 ? v.replace(/[^0-9]/g, '') : null)),
    instagram: z.string().max(100).nullable().optional()
      .refine(v => !v || !v.trim() || /^(?:https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+|@?[a-zA-Z0-9_.]+)$/i.test(v.trim()), 'Format akun Instagram tidak valid')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    tiktok: z.string().max(100).nullable().optional()
      .refine(v => !v || !v.trim() || /^(?:https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+|@?[a-zA-Z0-9_.]+)$/i.test(v.trim()), 'Format akun TikTok tidak valid')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    youtube: z.string().max(150).nullable().optional()
      .refine(v => !v || !v.trim() || /^(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@|c\/|channel\/)?[a-zA-Z0-9_.-]+|youtu\.be\/[a-zA-Z0-9_-]+)|@?[a-zA-Z0-9_.-]+)$/i.test(v.trim()), 'Format akun/kanal YouTube tidak valid')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    linkedin: z.string().max(150).nullable().optional()
      .refine(v => !v || !v.trim() || /^(?:https?:\/\/(?:www\.)?linkedin\.com\/(?:in\/)?[a-zA-Z0-9_.-]+|in\/[a-zA-Z0-9_.-]+|@?[a-zA-Z0-9_.-]+)$/i.test(v.trim()), 'Format akun LinkedIn tidak valid')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    facebook: z.string().max(150).nullable().optional()
      .refine(v => !v || !v.trim() || /^(?:https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+|@?[a-zA-Z0-9_.-]+)$/i.test(v.trim()), 'Format akun Facebook tidak valid')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null))
  }).default({
    enabled: true,
    style: 'colored',
    whatsapp: null,
    instagram: null,
    tiktok: null,
    youtube: null,
    linkedin: null,
    facebook: null
  }),

  // Ekstensi Video Pengantar / Teaser YouTube
  videoTeaser: z.object({
    enabled: z.boolean().default(false),
    title: z.string().max(100).nullable().optional().transform(v => (v && v.trim().length > 0 ? cleanText(v.trim()) : null)),
    videoUrl: z.string().max(300).nullable().optional()
      .refine(v => !v || !v.trim() || /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/|^)[a-zA-Z0-9_-]{11}/i.test(v.trim()), 'URL video harus berupa tautan YouTube resmi (watch, youtu.be, shorts, embed)')
      .transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    aspectRatio: z.enum(['16:9', '9:16']).default('16:9')
  }).default({
    enabled: false,
    title: null,
    videoUrl: null,
    aspectRatio: '16:9'
  }),

  // Ekstensi Sorotan Produk Unggulan & Efek Animasi
  featuredProduct: z.object({
    enabled: z.boolean().default(false),
    productId: z.string().max(100).nullable().optional().transform(v => (v && v.trim().length > 0 ? v.trim() : null)),
    badgeText: z.string().max(30).default('UNGGULAN'),
    animationStyle: z.enum(['none', 'pulse', 'glow', 'jiggle']).default('pulse')
  }).default({
    enabled: false,
    productId: null,
    badgeText: 'UNGGULAN',
    animationStyle: 'pulse'
  }),

  // Ekstensi Tanya Jawab (FAQ Accordion)
  faq: z.object({
    enabled: z.boolean().default(false),
    title: z.string().max(80).default('Pertanyaan yang Sering Diajukan (FAQ)').transform(cleanText),
    items: z.array(z.object({
      id: z.string(),
      question: z.string().max(200, 'Pertanyaan maksimal 200 karakter').transform(cleanText),
      answer: z.string().max(800, 'Jawaban maksimal 800 karakter').transform(cleanText)
    }))
    .transform(items => items.filter(i => i.question.trim().length > 0 && i.answer.trim().length > 0))
    .refine(items => items.length <= 10, 'Maksimal 10 pertanyaan FAQ')
    .default([])
  }).default({
    enabled: false,
    title: 'Pertanyaan yang Sering Diajukan (FAQ)',
    items: []
  })
})

// 1. Ambil preferensi tampilan toko mitra
users.get('/me/appearance', rateLimit(120, 60, 'get_appearance'), async (c) => {
  const user = c.get('user')
  const dbUser = await c.env.DB.prepare('SELECT id, is_active, seller_status, store_appearance FROM users WHERE id = ?').bind(user.id).first<{ id: string; is_active: number; seller_status: string; store_appearance: string | null }>()

  if (!dbUser || dbUser.is_active === 0) {
    throw new HTTPException(403, { message: 'Akun Anda dinonaktifkan atau tidak ditemukan.' })
  }
  if (dbUser.seller_status === 'suspended') {
    throw new HTTPException(403, { message: 'Akses ditolak. Status kemitraan toko Anda sedang ditangguhkan.' })
  }

  let appearance = DEFAULT_STORE_APPEARANCE
  if (dbUser.store_appearance) {
    try {
      const parsed = typeof dbUser.store_appearance === 'string' ? JSON.parse(dbUser.store_appearance as string) : dbUser.store_appearance
      appearance = mergeStoreAppearance(parsed)
    } catch {}
  }

  return c.json({ success: true, data: appearance })
})

// 2. Simpan preferensi tampilan toko mitra
users.put('/me/appearance', rateLimit(30, 60, 'update_appearance'), zValidator('json', storeAppearanceSchema), async (c) => {
  const user = c.get('user')
  const payload = c.req.valid('json')

  const dbUser = await c.env.DB.prepare('SELECT id, is_active, seller_status, store_appearance, store_slug FROM users WHERE id = ?').bind(user.id).first<{ id: string; is_active: number; seller_status: string; store_appearance: string | null; store_slug: string | null }>()
  if (!dbUser || dbUser.is_active === 0) {
    throw new HTTPException(403, { message: 'Akun Anda dinonaktifkan atau tidak ditemukan.' })
  }
  if (dbUser.seller_status === 'suspended') {
    throw new HTTPException(403, { message: 'Akses ditolak. Status kemitraan toko Anda sedang ditangguhkan.' })
  }
  if (dbUser.seller_status !== 'approved' && user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Kustomisasi tampilan etalase toko hanya dapat disimpan setelah status kemitraan Anda resmi disetujui oleh tim kurator.' })
  }

  // Verifikasi Produk Unggulan: Pastikan produk yang disorot adalah produk terpublikasi milik user sendiri
  if (payload.featuredProduct?.enabled && payload.featuredProduct?.productId) {
    const featuredProd = await c.env.DB.prepare(
      'SELECT id FROM products WHERE id = ? AND author_id = ? AND status = "published"'
    ).bind(payload.featuredProduct.productId, user.id).first()

    if (!featuredProd) {
      throw new HTTPException(400, {
        message: 'Produk unggulan yang dipilih tidak ditemukan atau belum berstatus terpublikasi resmi.'
      })
    }
  }

  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')

  // Verifikasi IDOR: Cegah pengguna menetapkan gambar latar belakang milik pengguna lain
  if (payload.background?.imageUrl) {
    const cleanUrl = payload.background.imageUrl.replace(/^https?:\/\/[^/]+/, '')
    const expectedPrefix = `/api/media/store-backgrounds/bg-${safeUserId}-`
    if (!cleanUrl.startsWith(expectedPrefix)) {
      throw new HTTPException(403, { message: 'Berkas gambar latar belakang yang dipilih bukan milik akun Anda.' })
    }
    // Simpan dalam format path relatif kanonikal agar konsisten di DB
    payload.background.imageUrl = cleanUrl
  }

  // Storage Leak Prevention: Jika seller beralih dari wallpaper kustom ke warna/gradien (imageUrl menjadi null),
  // atau memilih gambar baru, hapus berkas wallpaper lama dari R2 dan tabel media
  let oldImageUrl: string | null = null
  if (dbUser.store_appearance) {
    try {
      const oldParsed = JSON.parse(dbUser.store_appearance as string)
      oldImageUrl = oldParsed?.background?.imageUrl || null
    } catch {}
  }

  const batchStatements: any[] = []
  const newImageUrl = payload.background?.imageUrl || null
  const oldMatch = oldImageUrl ? oldImageUrl.match(/\/api\/media\/store-backgrounds\/(bg-[A-Za-z0-9_-]+-[0-9]+\.(jpg|jpeg|png|webp))$/i) : null
  const newMatch = newImageUrl ? newImageUrl.match(/\/api\/media\/store-backgrounds\/(bg-[A-Za-z0-9_-]+-[0-9]+\.(jpg|jpeg|png|webp))$/i) : null

  if (oldMatch && (!newMatch || oldMatch[1] !== newMatch[1])) {
    if (oldMatch[1].startsWith(`bg-${safeUserId}-`)) {
      const oldKey = `store-backgrounds/${oldMatch[1]}`
      await c.env.R2.delete(oldKey).catch(() => {})
      batchStatements.push(
        c.env.DB.prepare('DELETE FROM media WHERE r2_key = ? AND (uploaded_by = ? OR uploaded_by IS NULL)').bind(oldKey, user.id)
      )
    }
  }

  const jsonStr = JSON.stringify(payload)
  batchStatements.push(
    c.env.DB.prepare('UPDATE users SET store_appearance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(jsonStr, user.id)
  )

  await c.env.DB.batch(batchStatements)

  invalidateAuthorCache(c.env, c.executionCtx, user.id, dbUser.store_slug)

  return c.json({
    success: true,
    message: 'Pengaturan tampilan etalase toko berhasil disimpan.',
    data: payload
  })
})

// 3. Upload gambar latar belakang khusus untuk etalase toko
users.post('/me/appearance/background', rateLimit(15, 60, 'appearance_bg_upload'), async (c) => {
  const user = c.get('user')

  const dbUser = await c.env.DB.prepare('SELECT id, is_active, seller_status, store_appearance, store_slug FROM users WHERE id = ?').bind(user.id).first<{ id: string; is_active: number; seller_status: string; store_appearance: string | null; store_slug: string | null }>()
  if (!dbUser || dbUser.is_active === 0) {
    throw new HTTPException(403, { message: 'Akun Anda dinonaktifkan atau tidak ditemukan.' })
  }
  if (dbUser.seller_status === 'suspended') {
    throw new HTTPException(403, { message: 'Akses ditolak. Status kemitraan toko Anda sedang ditangguhkan.' })
  }
  if (dbUser.seller_status !== 'approved' && user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Pengunggahan latar belakang toko hanya dapat dilakukan setelah status kemitraan Anda resmi disetujui oleh tim kurator.' })
  }

  let body: any
  try {
    body = await c.req.parseBody()
  } catch (err) {
    throw new HTTPException(400, { message: 'Format pengunggahan gambar latar belakang tidak valid atau transmisi terputus.' })
  }
  const file = body['background'] || body['file']

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'Berkas gambar latar belakang tidak ditemukan.' })
  }

  const MAX_SIZE = 3 * 1024 * 1024 // 3MB
  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: 'Ukuran gambar latar melebihi batas (Maksimal 3MB).' })
  }

  const arrayBuffer = await file.arrayBuffer()
  const detectedContentType = isSafeImage(arrayBuffer) ? getContentTypeFromMagicBytes(arrayBuffer) : null
  if (!detectedContentType) {
    throw new HTTPException(400, { message: 'Format file tidak diizinkan. Hanya JPG, PNG, WEBP yang diterima.' })
  }

  let ext = 'jpg'
  if (detectedContentType === 'image/png') ext = 'png'
  if (detectedContentType === 'image/webp') ext = 'webp'

  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')
  const fileName = `bg-${safeUserId}-${Date.now()}.${ext}`
  const objectPath = `store-backgrounds/${fileName}`

  // Pembersihan Berkas Lama & Orphan Prevention:
  // Hapus berkas store-background sebelumnya milik seller ini dari R2 dan media
  const oldKeysToDelete: string[] = []

  if (dbUser.store_appearance) {
    try {
      const parsed = JSON.parse(dbUser.store_appearance as string)
      const oldBg = parsed?.background?.imageUrl
      if (typeof oldBg === 'string') {
        const match = oldBg.match(/\/api\/media\/store-backgrounds\/(.+)$/)
        if (match && match[1] && match[1].startsWith(`bg-${safeUserId}-`)) {
          oldKeysToDelete.push(`store-backgrounds/${match[1]}`)
        }
      }
    } catch {}
  }

  if (user.id !== 'super_admin') {
    const oldMedia = await c.env.DB.prepare(
      "SELECT r2_key FROM media WHERE uploaded_by = ? AND r2_key LIKE 'store-backgrounds/%'"
    ).bind(user.id).all<{ r2_key: string }>()

    if (oldMedia.results && oldMedia.results.length > 0) {
      for (const m of oldMedia.results) {
        if (!oldKeysToDelete.includes(m.r2_key)) {
          oldKeysToDelete.push(m.r2_key)
        }
      }
    }
  }

  for (const key of oldKeysToDelete) {
    await c.env.R2.delete(key).catch(() => {})
    await c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(key).run().catch(() => {})
  }

  // Upload ke R2
  await c.env.R2.put(objectPath, arrayBuffer, {
    httpMetadata: { contentType: detectedContentType }
  })

  const bgUrl = `/api/media/store-backgrounds/${fileName}`

  // SINKRONISASI DATABASE LANGSUNG (Mencegah dangling pointer jika seller refresh/keluar sebelum save)
  let updatedAppearance = {
    ...DEFAULT_STORE_APPEARANCE,
    preset: 'custom' as const,
    background: {
      ...DEFAULT_STORE_APPEARANCE.background,
      type: 'image' as const,
      imageUrl: bgUrl
    }
  }

  if (dbUser.store_appearance) {
    try {
      const parsed = JSON.parse(dbUser.store_appearance as string)
      if (parsed && typeof parsed === 'object') {
        updatedAppearance = mergeStoreAppearance({
          ...parsed,
          preset: 'custom',
          background: {
            ...(parsed.background || {}),
            type: 'image',
            imageUrl: bgUrl
          }
        })
      }
    } catch {}
  }

  // Operasi Database Atomik: Catat di tabel media & update users appearance dalam 1 transaksi D1 batch
  const mediaStmt = c.env.DB.prepare('INSERT INTO media (id, r2_key, file_name, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), objectPath, fileName, detectedContentType, file.size, user.id === 'super_admin' ? null : user.id)

  const appearanceStmt = c.env.DB.prepare('UPDATE users SET store_appearance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(JSON.stringify(updatedAppearance), user.id)

  await c.env.DB.batch([mediaStmt, appearanceStmt])

  invalidateAuthorCache(c.env, c.executionCtx, user.id, dbUser.store_slug)

  return c.json({
    success: true,
    message: 'Gambar latar belakang etalase berhasil diunggah dan disimpan.',
    image_url: bgUrl,
    appearance: updatedAppearance
  })
})

// 4. Hapus gambar latar belakang etalase toko
users.delete('/me/appearance/background', rateLimit(20, 60, 'appearance_bg_delete'), async (c) => {
  const user = c.get('user')
  const safeUserId = String(user.id).replace(/[^A-Za-z0-9_-]/g, '')

  const dbUser = await c.env.DB.prepare('SELECT id, is_active, seller_status, store_appearance, store_slug FROM users WHERE id = ?').bind(user.id).first<{ id: string; is_active: number; seller_status: string; store_appearance: string | null; store_slug: string | null }>()
  if (!dbUser || dbUser.is_active === 0) {
    throw new HTTPException(403, { message: 'Akun Anda dinonaktifkan atau tidak ditemukan.' })
  }
  if (dbUser.seller_status === 'suspended') {
    throw new HTTPException(403, { message: 'Akses ditolak. Status kemitraan toko Anda sedang ditangguhkan.' })
  }
  if (dbUser.seller_status !== 'approved' && user.role !== 'super_admin') {
    throw new HTTPException(403, { message: 'Aksi ini hanya dapat dilakukan setelah status kemitraan Anda resmi disetujui oleh tim kurator.' })
  }

  // Hapus semua berkas store-background milik seller ini dari R2 & media
  const oldKeysToDelete: string[] = []

  if (dbUser.store_appearance) {
    try {
      const parsed = JSON.parse(dbUser.store_appearance as string)
      const oldBg = parsed?.background?.imageUrl
      if (typeof oldBg === 'string') {
        const match = oldBg.match(/\/api\/media\/store-backgrounds\/(.+)$/)
        if (match && match[1] && match[1].startsWith(`bg-${safeUserId}-`)) {
          oldKeysToDelete.push(`store-backgrounds/${match[1]}`)
        }
      }
    } catch {}
  }

  if (user.id !== 'super_admin') {
    const oldMedia = await c.env.DB.prepare(
      "SELECT r2_key FROM media WHERE uploaded_by = ? AND r2_key LIKE 'store-backgrounds/%'"
    ).bind(user.id).all<{ r2_key: string }>()

    if (oldMedia.results && oldMedia.results.length > 0) {
      for (const m of oldMedia.results) {
        if (!oldKeysToDelete.includes(m.r2_key)) {
          oldKeysToDelete.push(m.r2_key)
        }
      }
    }
  }

  const batchStatements: any[] = []
  for (const key of oldKeysToDelete) {
    await c.env.R2.delete(key).catch(() => {})
    batchStatements.push(c.env.DB.prepare('DELETE FROM media WHERE r2_key = ?').bind(key))
  }

  let updatedAppearance = {
    ...DEFAULT_STORE_APPEARANCE,
    background: {
      type: 'color' as const,
      value: '#f5f5f4',
      imageUrl: null
    }
  }

  if (dbUser.store_appearance) {
    try {
      const parsed = JSON.parse(dbUser.store_appearance as string)
      if (parsed && typeof parsed === 'object') {
        const bg = { ...(parsed.background || {}) }
        bg.imageUrl = null
        if (bg.type === 'image') {
          bg.type = 'color'
          bg.value = '#f5f5f4'
        }
        updatedAppearance = mergeStoreAppearance({
          ...parsed,
          background: bg
        })
      }
    } catch {}
  }

  batchStatements.push(
    c.env.DB.prepare('UPDATE users SET store_appearance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(JSON.stringify(updatedAppearance), user.id)
  )

  await c.env.DB.batch(batchStatements)

  invalidateAuthorCache(c.env, c.executionCtx, user.id, dbUser.store_slug)

  return c.json({
    success: true,
    message: 'Gambar latar belakang etalase berhasil dihapus.',
    appearance: updatedAppearance
  })
})

// --- MANAJEMEN USER (Oleh Admin) ---

const createUserSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  name: z.string().max(100).optional().transform(v => v ? cleanText(v) : v),
  role_names: z.array(z.string()).default(['Writer'])
})

users.post('/', rateLimit(10, 60, 'create_user'), zValidator('json', createUserSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat melakukan aksi ini.' })

  const { email, name, role_names } = c.req.valid('json')

  // SECURITY PATCH: Cegah DoS pada Super Admin dengan memblokir invitation ke email sistem
  if (c.env.SUPER_ADMIN_EMAIL && email === c.env.SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new HTTPException(400, { message: 'Email ini dikhususkan untuk sistem (Reserved) dan tidak dapat diundang.' })
  }

  const exists = await c.env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(email).first()
  
  let userId = ''
  let userName = name

  // Mengambil role ID berdasarkan input multiple
  const placeholders = role_names.map(() => '?').join(',')
  const targetRoles = await c.env.DB.prepare(`SELECT id, name FROM roles WHERE name IN (${placeholders})`).bind(...role_names).all()
  if (targetRoles.results.length !== role_names.length) throw new HTTPException(400, { message: 'Satu atau lebih Role tidak ditemukan.' })

  if (exists) {
    userId = exists.id as string
    userName = (exists.name as string) || name
    // User sudah ada — JANGAN ubah rolenya. Hanya kirim ulang email setup password.
  } else {
    userId = crypto.randomUUID()
    // Default ke random string kuat karena password di-set melalui email setup
    const randomTempPassword = crypto.randomUUID() + crypto.randomUUID()
    const hashed = await hashPassword(randomTempPassword)

    const isStaffWithProductPerms = role_names.includes('Admin') || role_names.includes('Editor')
    const initialSellerStatus = isStaffWithProductPerms ? 'approved' : 'none'
    const initialApprovedAt = isStaffWithProductPerms ? new Date().toISOString() : null

    const stmts: any[] = [
      c.env.DB.prepare('INSERT INTO users (id, email, password_hash, name, seller_status, seller_approved_at) VALUES (?, ?, ?, ?, ?, ?)').bind(userId, email, hashed, name || null, initialSellerStatus, initialApprovedAt)
    ]
    targetRoles.results.forEach((r: any) => {
      stmts.push(c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, r.id))
    })

    await c.env.DB.batch(stmts)
  }

  // --- EMAIL UNDANGAN / RESEND UNDANGAN (fix C4: kirim link setup) ---
  // Buat token setup password (agar user bisa set password sendiri)
  const setupToken = crypto.randomUUID()
  const hashedSetupToken = await hashToken(setupToken)
  
  // Hapus token reset sebelumnya agar tidak duplikat/menumpuk
  await c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(userId).run()

  await c.env.DB.prepare(`
    INSERT INTO password_resets (id, user_id, token, expires_at)
    VALUES (?, ?, ?, datetime('now', '+24 hours'))
  `).bind(crypto.randomUUID(), userId, hashedSetupToken).run()

  if (c.env.BREVO_API_KEY) {
    try {
      const frontendUrl = getSafeFrontendUrl(c.env.FRONTEND_URL)
      // Link email tetap menggunakan plaintext token
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
          to: [{ email: email, name: userName || 'Bapak/Ibu' }],
          params: {
            NAME: userName || 'Bapak/Ibu',
            EMAIL: email,
            SETUP_LINK: setupLink,
            ROLE: role_names.join(', ')
          }
        })
      })

      if (!brevoResponse.ok) {
        const errText = await brevoResponse.text()
        console.error('Brevo API Invitation gagal (HTTP', brevoResponse.status, '):', errText)
        return c.json({ message: exists ? 'User sudah terdaftar, tetapi email undangan ulang gagal terkirim. Silakan reset sandi secara manual via ikon gembok.' : 'User berhasil dibuat, tetapi email gagal terkirim. Silakan reset sandi secara manual via ikon gembok.', id: userId })
      }
    } catch (error) {
      console.error('Brevo Fetch Error (Invitation):', error)
      return c.json({ message: exists ? 'User sudah terdaftar, tetapi sistem gagal mengirim email undangan ulang. Silakan reset sandi secara manual via ikon gembok.' : 'User berhasil dibuat, tetapi sistem gagal mengirim email. Silakan reset sandi secara manual via ikon gembok.', id: userId })
    }
  } else {
    return c.json({ message: exists ? 'User sudah terdaftar, namun Brevo API belum disetel (email tidak terkirim). Silakan reset sandi secara manual.' : 'User berhasil dibuat, namun Brevo API belum disetel (email tidak terkirim). Silakan reset sandi secara manual.', id: userId })
  }

  return c.json({ message: exists ? 'Email undangan ulang berhasil dikirim ke user yang sudah ada.' : 'User berhasil dibuat dan undangan telah dikirim ke email.', id: userId })
})

users.get('/', rateLimit(500, 60, 'public_users_list'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat melihat daftar pengguna.' })

  const { limit, offset } = getPagination(c, 50, 100)

  const list = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.phone_number, u.is_active, u.created_at, GROUP_CONCAT(r.name, ', ') as role
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    GROUP BY u.id
    ORDER BY u.created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all()
  
  return c.json({ data: list.results, limit, offset })
})

const resetPasswordSchema = z.object({
  new_password: z.string().min(6)
})

users.put('/:id/reset-password', rateLimit(30, 60, 'reset_password'), zValidator('json', resetPasswordSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mereset password.' })

  const targetId = c.req.param('id')
  if (targetId === 'super_admin') {
    throw new HTTPException(403, { message: 'Password Super Admin sistem tidak dapat diubah melalui endpoint ini.' })
  }
  const { new_password } = c.req.valid('json')

  const hashed = await hashPassword(new_password)
  const result = await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(hashed, targetId).run()

  if (result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'User tidak ditemukan.' })
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(targetId),
    c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(targetId)
  ])

  return c.json({ message: 'Password user berhasil direset.' })
})

// --- RBAC: Roles & Permissions ---

users.get('/roles/list', rateLimit(500, 60, 'roles_list'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const roles = await c.env.DB.prepare("SELECT id, name, description FROM roles WHERE name != 'Super Admin'").all()
  return c.json(roles.results)
})

const assignRoleSchema = z.object({
  role_id: z.string().optional(),
  role_ids: z.array(z.string()).optional()
}).refine(data => data.role_id || (data.role_ids && data.role_ids.length > 0), {
  message: "Minimal satu role_id harus diberikan."
})

users.put('/:id/role', rateLimit(30, 60, 'assign_role'), zValidator('json', assignRoleSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mengubah role.' })

  const targetId = c.req.param('id')
  if (targetId === 'super_admin') {
    throw new HTTPException(403, { message: 'Role Super Admin sistem tidak dapat diubah.' })
  }
  const { role_id, role_ids } = c.req.valid('json')
  const finalRoleIds = role_ids || (role_id ? [role_id] : [])

  // Validasi user target
  const userExists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first()
  if (!userExists) {
    throw new HTTPException(404, { message: 'Pengguna tidak ditemukan.' })
  }

  // Validasi semua role yang di-assign benar-benar ada di database
  const placeholders = finalRoleIds.map(() => '?').join(',')
  const roleExistsQuery = await c.env.DB.prepare(`SELECT id, name FROM roles WHERE id IN (${placeholders})`).bind(...finalRoleIds).all()
  
  if (roleExistsQuery.results.length !== finalRoleIds.length) {
    throw new HTTPException(400, { message: 'Satu atau lebih Role tidak ditemukan.' })
  }
  
  const hasSuperAdmin = roleExistsQuery.results.some((r: any) => r.name === 'Super Admin')
  if (hasSuperAdmin) {
    throw new HTTPException(403, { message: 'Role Super Admin hanya boleh dimiliki oleh 1 akun sistem utama.' })
  }

  const stmts = [
    c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(targetId)
  ]
  finalRoleIds.forEach(id => {
    stmts.push(c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(targetId, id))
  })

  // Jika role baru memiliki hak Admin atau Editor, pastikan seller_status diset 'approved' agar user dapat mengelola produk di CMS
  const hasStaffRole = roleExistsQuery.results.some((r: any) => r.name === 'Admin' || r.name === 'Editor')
  if (hasStaffRole) {
    stmts.push(
      c.env.DB.prepare("UPDATE users SET seller_status = 'approved', seller_approved_at = COALESCE(seller_approved_at, CURRENT_TIMESTAMP) WHERE id = ? AND (seller_status IS NULL OR seller_status = 'none')").bind(targetId)
    )
  }

  await c.env.DB.batch(stmts)

  return c.json({ message: 'Role berhasil diperbarui.' })
})

const updateStatusSchema = z.object({
  is_active: z.boolean()
})

users.put('/:id/status', rateLimit(30, 60, 'update_status'), zValidator('json', updateStatusSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat mengubah status.' })

  const targetId = c.req.param('id')
  if (targetId === 'super_admin') {
    throw new HTTPException(403, { message: 'Status Super Admin sistem tidak dapat diubah.' })
  }
  const { is_active } = c.req.valid('json')
  const isActiveInt = is_active ? 1 : 0

  const targetUser = await c.env.DB.prepare('SELECT id, seller_status FROM users WHERE id = ?').bind(targetId).first<{ id: string; seller_status: string | null }>()
  if (!targetUser) {
    throw new HTTPException(404, { message: 'User tidak ditemukan.' })
  }

  const batchStmts = [
    c.env.DB.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(isActiveInt, targetId)
  ]

  // Jika di-nonaktifkan:
  if (!is_active) {
    // 1. Cabut semua refresh token agar user langsung ter-logout
    batchStmts.push(c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(targetId))

    // 2. Nonaktifkan seluruh produk milik user/seller ini (ubah status ke 'archived')
    // CATATAN PENTING: Berkas di R2 TIDAK BOLEH DIHAPUS agar pembeli yang telah membeli sebelumnya tetap dapat mengunduh
    batchStmts.push(
      c.env.DB.prepare(`
        UPDATE products 
        SET status = 'archived', 
            updated_at = CURRENT_TIMESTAMP 
        WHERE author_id = ? AND status IN ('published', 'pending_review')
      `).bind(targetId)
    )

    // 3. Jika user adalah seller yang disetujui, bekukan status sellernya
    if (targetUser.seller_status === 'approved') {
      batchStmts.push(
        c.env.DB.prepare(`
          UPDATE users 
          SET seller_status = 'suspended', 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(targetId)
      )
    }
  }

  await c.env.DB.batch(batchStmts)

  if (!is_active) {
    c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV))
  }

  return c.json({ 
    message: is_active 
      ? 'User berhasil diaktifkan.' 
      : 'User berhasil dinonaktifkan. Semua produk seller telah dinonaktifkan dari etalase Hub (file di R2 tetap aman untuk pembeli).' 
  })
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

  // Nonaktifkan produk milik user (set status = 'archived') sebelum user dihapus
  // Berkas R2 produk TIDAK dihapus agar pembeli terdahulu tetap dapat mengunduh berkasnya
  await c.env.DB.prepare(`
    UPDATE products 
    SET status = 'archived', 
        updated_at = CURRENT_TIMESTAMP 
    WHERE author_id = ? AND status IN ('published', 'pending_review')
  `).bind(targetId).run()

  // Hapus user (akan cascade ke refresh_tokens, user_roles, password_resets)
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run()

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV))

  return c.json({ message: 'User berhasil dihapus secara permanen. Produk telah diarsipkan dan berkas R2 aman untuk pembeli.' })
})

// --- MANAJEMEN & PERSETUJUAN SELLER (SUPER ADMIN) ---

// 1. Ambil pendaftar seller yang statusnya 'pending'
users.get('/sellers/pending', rateLimit(60, 60, 'sellers_pending'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const list = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.primary_niche, u.bio, u.portfolio_url,
           u.bank_name, u.bank_account_number, u.bank_account_holder,
           u.seller_status, u.seller_applied_at, u.created_at, u.hub_account_id,
           u.seller_sample_photos,
           u.personal_address, u.phone_number, u.gender, u.birth_date, u.store_name, u.store_description, u.store_address
    FROM users u
    WHERE u.seller_status = 'pending'
    ORDER BY u.seller_applied_at DESC
  `).all()

  const origin = new URL(c.req.url).origin
  const mapped = list.results.map((row: any) => {
    let photos: string[] = []
    if (row.seller_sample_photos) {
      try {
        const parsed = JSON.parse(row.seller_sample_photos)
        if (Array.isArray(parsed)) photos = parsed
      } catch {}
    }
    return {
      ...row,
      avatar_url: toAbsoluteMediaUrl(origin, row.avatar_url),
      seller_sample_photos: photos.map((p: string) => toAbsoluteMediaUrl(origin, p) || p)
    }
  })

  return c.json({ data: mapped })
})

// 2. Ambil seluruh seller dengan filter status
users.get('/sellers', rateLimit(60, 60, 'sellers_list'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Akses ditolak.' })

  const status = c.req.query('status') || 'all'
  const { limit, offset } = getPagination(c, 50, 100)

  let query = `
    SELECT u.id, u.email, u.name, u.avatar_url, u.primary_niche, u.bio, u.portfolio_url,
           u.bank_name, u.bank_account_number, u.bank_account_holder,
           u.seller_status, u.seller_applied_at, u.seller_approved_at, u.seller_rejection_reason,
           u.is_active, u.created_at, u.hub_account_id,
           u.seller_sample_photos,
           u.personal_address, u.phone_number, u.gender, u.birth_date, u.store_name, u.store_description, u.store_address
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'Seller'
  `
  const params: any[] = []

  if (status !== 'all') {
    query += ' AND u.seller_status = ?'
    params.push(status)
  }

  query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const list = await c.env.DB.prepare(query).bind(...params).all()
  const origin = new URL(c.req.url).origin
  const mapped = list.results.map((row: any) => {
    let photos: string[] = []
    if (row.seller_sample_photos) {
      try {
        const parsed = JSON.parse(row.seller_sample_photos)
        if (Array.isArray(parsed)) photos = parsed
      } catch {}
    }
    return {
      ...row,
      avatar_url: toAbsoluteMediaUrl(origin, row.avatar_url),
      seller_sample_photos: photos.map((p: string) => toAbsoluteMediaUrl(origin, p) || p)
    }
  })
  return c.json({ data: mapped, limit, offset })
})

// 3. Setujui seller
users.put('/sellers/:id/approve', rateLimit(30, 60, 'approve_seller'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat menyetujui kemitraan seller.' })

  const targetId = c.req.param('id')
  const seller = await c.env.DB.prepare('SELECT id, email, seller_status FROM users WHERE id = ?').bind(targetId).first()
  if (!seller) throw new HTTPException(404, { message: 'Calon seller tidak ditemukan.' })

  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE users 
      SET seller_status = 'approved', 
          seller_approved_at = CURRENT_TIMESTAMP, 
          seller_approved_by = ?,
          seller_rejection_reason = NULL,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id, targetId),
    c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'role-seller')").bind(targetId)
  ])

  return c.json({ message: 'Kemitraan seller berhasil disetujui. Seller kini dapat mengunggah produk.' })
})

// 4. Tolak seller
const rejectSellerSchema = z.object({
  rejection_reason: z.string().min(5, 'Alasan penolakan minimal 5 karakter').optional(),
  reason: z.string().min(5, 'Alasan penolakan minimal 5 karakter').optional()
}).refine(data => data.rejection_reason || data.reason, {
  message: 'Alasan penolakan minimal 5 karakter wajib disertakan.'
}).transform(data => ({
  rejection_reason: cleanText((data.rejection_reason || data.reason)!)
}))

users.put('/sellers/:id/reject', rateLimit(30, 60, 'reject_seller'), zValidator('json', rejectSellerSchema), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat menolak pendaftaran seller.' })

  const targetId = c.req.param('id')
  const { rejection_reason } = c.req.valid('json')

  const seller = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first()
  if (!seller) throw new HTTPException(404, { message: 'Calon seller tidak ditemukan.' })

  // Tolak seller dan nonaktifkan seluruh produknya jika ada (arsip) tanpa menghapus file di R2
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE users 
      SET seller_status = 'rejected', 
          seller_rejection_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(rejection_reason, targetId),
    c.env.DB.prepare(`
      UPDATE products 
      SET status = 'archived', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE author_id = ? AND status IN ('published', 'pending_review')
    `).bind(targetId)
  ])

  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV))

  return c.json({ message: 'Pendaftaran seller berhasil ditolak dan seluruh produk telah dinonaktifkan dari etalase.' })
})

// 5. Suspend / Bekukan seller
users.put('/sellers/:id/suspend', rateLimit(30, 60, 'suspend_seller'), async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') throw new HTTPException(403, { message: 'Hanya super admin yang dapat menangguhkan kemitraan seller.' })

  const targetId = c.req.param('id')
  const seller = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first()
  if (!seller) throw new HTTPException(404, { message: 'Seller tidak ditemukan.' })

  // 1. Bekukan status seller dan cabut seluruh refresh token login
  // 2. Nonaktifkan seluruh produk seller dari etalase publik (ubah status menjadi 'archived')
  // CATATAN KRUSIAL: Berkas di R2 TIDAK DIHAPUS untuk menjamin buyer yang telah membeli produk sebelumnya tetap dapat mengunduh berkas
  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE users 
      SET seller_status = 'suspended', 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(targetId),
    c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(targetId),
    c.env.DB.prepare(`
      UPDATE products 
      SET status = 'archived', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE author_id = ? AND status IN ('published', 'pending_review')
    `).bind(targetId)
  ])

  // Invalidate cache etalase produk di KV agar perubahan langsung efektif di Frontend Hub
  c.executionCtx.waitUntil(invalidateProductCaches(c.env.KV))

  return c.json({ message: 'Kemitraan seller berhasil dibekukan. Semua produk telah dinonaktifkan dari etalase Frontend Hub, dan berkas digital tetap aman di penyimpanan untuk pembeli sebelumnya.' })
})

export default users
