/**
 * Utilitas dan Proteksi Slug Etalase Toko Mitra (asisten-guru.id/:slug)
 */

export const RESERVED_STORE_SLUGS = new Set([
  // Core System & Auth
  'api', 'admin', 'auth', 'login', 'register', 'logout', 'dashboard', 'settings', 'account', 'profile',
  // E-Commerce & Marketplace Hub
  'toko', 'produk', 'product', 'products', 'item', 'items', 'cart', 'keranjang',
  'checkout', 'order', 'orders', 'transaksi', 'transaction', 'payment', 'bayar',
  'payment-success', 'payment-pending', 'payment-error', 'payment-unauthorized',
  'invoice', 'katalog', 'catalog', 'cari', 'search', 'download', 'unduh', 'verify', 'kurasi',
  // Content & Media
  'blog', 'artikel', 'post', 'posts', 'kategori', 'category', 'tag', 'tags',
  'author', 'penulis', 'user', 'users', 'seller', 'mitra', 'guru',
  'media', 'image', 'images', 'assets', 'static', 'public', 'uploads',
  // SEO & Technical
  'sitemap', 'robots', 'favicon', 'manifest', 'feed', 'rss', 's', 'sso', 'sso-redirect',
  // Static Pages & Legal
  'privacy', 'kebijakan-privasi', 'terms', 'syarat-ketentuan',
  'bantuan', 'faq', 'help', 'contact', 'kontak', 'about', 'tentang', 'harga',
  // Aplikasi Ekosistem Asisten Guru & Layanan
  'sma', 'papantulis', 'ujian', 'jadwal', 'kelompok', 'tools-ujian', 'cbt',
  'apps', 'analytics', 'flyer', 'internal', 'comments', 'marketplace'
]);

export const STORE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MIN_STORE_SLUG_LENGTH = 3;
export const MAX_STORE_SLUG_LENGTH = 30;

/**
 * Mengubah teks judul/nama menjadi format slug URL standar.
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Ganti karakter non-alfanumerik dengan tanda hubung
    .replace(/[^a-z0-9]+/g, '-')
    // Hilangkan tanda hubung beruntun
    .replace(/-+/g, '-')
    // Hilangkan tanda hubung di awal dan akhir
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_STORE_SLUG_LENGTH);
}

/**
 * Validasi ketat format dan ketersediaan kata terlarang untuk slug toko.
 */
export function validateStoreSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Tautan toko wajib diisi.' };
  }

  const cleanSlug = slug.trim().toLowerCase();

  if (cleanSlug.length < MIN_STORE_SLUG_LENGTH) {
    return { valid: false, error: `Tautan toko minimal terdiri dari ${MIN_STORE_SLUG_LENGTH} karakter.` };
  }

  if (cleanSlug.length > MAX_STORE_SLUG_LENGTH) {
    return { valid: false, error: `Tautan toko maksimal terdiri dari ${MAX_STORE_SLUG_LENGTH} karakter.` };
  }

  if (!STORE_SLUG_REGEX.test(cleanSlug)) {
    return {
      valid: false,
      error: 'Tautan toko hanya boleh memuat huruf kecil (a-z), angka (0-9), dan tanda hubung (-).'
    };
  }

  if (RESERVED_STORE_SLUGS.has(cleanSlug)) {
    return {
      valid: false,
      error: 'Tautan ini merupakan kata khusus sistem dan tidak dapat digunakan sebagai nama toko.'
    };
  }

  return { valid: true };
}

/**
 * Cek tabrakan slug toko dengan rute aplikasi ekosistem di Asisten Guru Hub.
 * Menggunakan KV cache (TTL 300 detik) untuk menjaga latensi < 15ms.
 */
export async function checkHubAppConflict(
  slug: string,
  hubUrl?: string,
  kv?: KVNamespace
): Promise<{ conflict: boolean; appTitle?: string }> {
  const cleanSlug = slug.trim().toLowerCase();

  // 1. Cek cache KV daftar path aplikasi Hub
  if (kv) {
    try {
      const cached = await kv.get<Array<{ path: string; id: string; title: string }>>('cache:hub:app_paths', 'json');
      if (cached && Array.isArray(cached)) {
        const found = cached.find(a => (a.path && a.path.toLowerCase() === cleanSlug) || (a.id && a.id.toLowerCase() === cleanSlug));
        if (found) {
          return { conflict: true, appTitle: found.title };
        }
        return { conflict: false };
      }
    } catch {}
  }

  // 2. Jika KV miss atau belum ada cache, query endpoint publik Hub
  const targetHubUrl = hubUrl || 'https://asisten-guru.id';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${targetHubUrl}/api/applications`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json: any = await res.json().catch(() => null);
      if (json && json.success && Array.isArray(json.data)) {
        const appsList = json.data.map((app: any) => ({
          path: String(app.path || app.id || '').toLowerCase(),
          id: String(app.id || '').toLowerCase(),
          title: String(app.title || '')
        }));

        if (kv) {
          await kv.put('cache:hub:app_paths', JSON.stringify(appsList), { expirationTtl: 300 }).catch(() => {});
        }

        const found = appsList.find((a: any) => a.path === cleanSlug || a.id === cleanSlug);
        if (found) {
          return { conflict: true, appTitle: found.title };
        }
      }
    }
  } catch (e) {
    // Log kegagalan non-fatal agar sistem tetap toleran
    console.warn('[checkHubAppConflict] Gagal memeriksa aplikasi Hub:', e);
  }

  return { conflict: false };
}
