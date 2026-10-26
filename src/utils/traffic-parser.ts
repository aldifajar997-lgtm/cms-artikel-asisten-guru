export type TrafficSource = 
  | 'whatsapp' 
  | 'instagram' 
  | 'tiktok' 
  | 'facebook' 
  | 'twitter'
  | 'telegram' 
  | 'youtube'
  | 'linkedin'
  | 'threads'
  | 'google' 
  | 'direct' 
  | 'other';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface TrafficInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  ref?: string | null;
  source?: string | null;
  referrer?: string | null;
  url?: string | null;
}

/**
 * Ekstrak parameter UTM atau Ref dari URL lengkap jika ada
 */
export function extractParamsFromUrl(rawUrl?: string | null): { utmSource?: string; ref?: string; source?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') return {};
  try {
    const parsed = new URL(rawUrl, 'https://asistenguru.id');
    return {
      utmSource: parsed.searchParams.get('utm_source') || undefined,
      ref: parsed.searchParams.get('ref') || undefined,
      source: parsed.searchParams.get('source') || undefined
    };
  } catch {
    return {};
  }
}

/**
 * Normalisasi token sumber untuk menghindari false-positive substring.
 * Contoh: "twitter" TIDAK boleh mencocokkan "tt" (TikTok).
 * Contoh: "forward" TIDAK boleh mencocokkan "wa" (WhatsApp).
 */
function matchToken(val: string, tokens: string[]): boolean {
  // 1. Exact match
  if (tokens.includes(val)) return true;
  // 2. Prefix with separator (misal wa_share, wa-group, ig_bio)
  return tokens.some(t => val.startsWith(`${t}_`) || val.startsWith(`${t}-`) || val.startsWith(`${t}.`));
}

/**
 * Mengurai sumber trafik pengunjung dengan strategi hybrid:
 * Prioritas 1: Parameter UTM (utm_source / ref / source eksplisit)
 * Prioritas 2: Ekstraksi dari URL halaman (jika utm_source belum dipisah)
 * Prioritas 3: HTTP Document Referrer / Native In-App Browser URL
 * Prioritas 4: Direct Navigation
 */
export function parseTrafficSource(
  utmSourceOrInput?: string | TrafficInput | null,
  rawReferrer?: string | null
): TrafficSource {
  let utmSource: string | null = null;
  let refParam: string | null = null;
  let sourceParam: string | null = null;
  let referrer: string | null = rawReferrer || null;
  let fullUrl: string | null = null;

  if (typeof utmSourceOrInput === 'object' && utmSourceOrInput !== null) {
    utmSource = utmSourceOrInput.utmSource || null;
    refParam = utmSourceOrInput.ref || null;
    sourceParam = utmSourceOrInput.source || null;
    referrer = utmSourceOrInput.referrer || rawReferrer || null;
    fullUrl = utmSourceOrInput.url || null;
  } else if (typeof utmSourceOrInput === 'string') {
    utmSource = utmSourceOrInput;
  }

  // Jika utmSource belum ada namun URL lengkap diberikan, ekstrak otomatis
  if (!utmSource && !refParam && !sourceParam && fullUrl) {
    const extracted = extractParamsFromUrl(fullUrl);
    utmSource = extracted.utmSource || null;
    refParam = extracted.ref || null;
    sourceParam = extracted.source || null;
  }

  const primarySource = (utmSource || refParam || sourceParam || '').toLowerCase().trim();

  // --- PRIORITAS 1: PARAMETER UTM / REF / SOURCE ---
  if (primarySource) {
    // WhatsApp (wa, whatsapp, wasap)
    if (primarySource === 'wa' || primarySource === 'whatsapp' || primarySource === 'wasap' || matchToken(primarySource, ['wa', 'whatsapp'])) {
      return 'whatsapp';
    }
    // Telegram (tg, telegram)
    if (primarySource === 'tg' || primarySource === 'telegram' || matchToken(primarySource, ['tg', 'telegram'])) {
      return 'telegram';
    }
    // Instagram (ig, insta, instagram)
    if (primarySource === 'ig' || primarySource === 'instagram' || primarySource === 'insta' || matchToken(primarySource, ['ig', 'instagram', 'insta'])) {
      return 'instagram';
    }
    // Threads (threads, threadsapp)
    if (primarySource === 'threads' || primarySource === 'threadsapp' || matchToken(primarySource, ['threads'])) {
      return 'threads';
    }
    // Twitter / X (twitter, x, tweet) - Diuji SEBELUM TikTok agar 'twitter' tidak kena 'tt'!
    if (primarySource === 'twitter' || primarySource === 'x' || primarySource === 'twt' || matchToken(primarySource, ['twitter', 'x', 'twt'])) {
      return 'twitter';
    }
    // TikTok (tt, tiktok, vt, fyp)
    if (primarySource === 'tiktok' || primarySource === 'tt' || matchToken(primarySource, ['tt', 'tiktok'])) {
      return 'tiktok';
    }
    // Facebook (fb, facebook)
    if (primarySource === 'fb' || primarySource === 'facebook' || matchToken(primarySource, ['fb', 'facebook'])) {
      return 'facebook';
    }
    // YouTube (yt, youtube, shorts)
    if (primarySource === 'yt' || primarySource === 'youtube' || matchToken(primarySource, ['yt', 'youtube', 'shorts'])) {
      return 'youtube';
    }
    // LinkedIn (linkedin, lnkd)
    if (primarySource === 'linkedin' || primarySource === 'lnkd' || matchToken(primarySource, ['linkedin', 'lnkd'])) {
      return 'linkedin';
    }
    // Google Organic / CPC / Discovery
    if (primarySource === 'google' || primarySource === 'organic' || primarySource === 'gads' || primarySource === 'search') {
      return 'google';
    }
    if (primarySource === 'direct' || primarySource === 'none') {
      return 'direct';
    }
    return 'other';
  }

  // --- PRIORITAS 2: HTTP DOCUMENT REFERRER / IN-APP BROWSER ---
  if (referrer) {
    const ref = referrer.toLowerCase().trim();

    // 1. WhatsApp Web / Android Intent
    if (ref.includes('whatsapp') || ref.includes('wa.me') || ref.includes('api.whatsapp.com') || ref.includes('com.whatsapp')) {
      return 'whatsapp';
    }
    // 2. Telegram Web & App
    if (ref.includes('t.me') || ref.includes('telegram.org') || ref.includes('org.telegram.messenger')) {
      return 'telegram';
    }
    // 3. Instagram Web & In-App Browser (l.instagram.com, com.instagram.android)
    if (ref.includes('instagram.com') || ref.includes('com.instagram.android')) {
      return 'instagram';
    }
    // 4. Threads (threads.net)
    if (ref.includes('threads.net')) {
      return 'threads';
    }
    // 5. Twitter / X (t.co shortener, x.com, twitter.com, com.twitter.android)
    if (ref.includes('t.co') || ref.includes('x.com') || ref.includes('twitter.com') || ref.includes('com.twitter.android')) {
      return 'twitter';
    }
    // 6. TikTok Web & In-App Browser
    if (ref.includes('tiktok.com') || ref.includes('zhiliaoapp.musically') || ref.includes('ss.android.ugc.trill')) {
      return 'tiktok';
    }
    // 7. Facebook Web & App (l.facebook.com, lm.facebook.com, m.facebook.com, fb.com, com.facebook.katana)
    if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('com.facebook.katana')) {
      return 'facebook';
    }
    // 8. YouTube (youtube.com, youtu.be, com.google.android.youtube)
    if (ref.includes('youtube.com') || ref.includes('youtu.be') || ref.includes('google.android.youtube')) {
      return 'youtube';
    }
    // 9. LinkedIn (linkedin.com, lnkd.in, com.linkedin.android)
    if (ref.includes('linkedin.com') || ref.includes('lnkd.in')) {
      return 'linkedin';
    }
    // 10. Search Engines (Google, Bing, Yahoo)
    if (ref.includes('google.co') || ref.includes('google.com') || ref.includes('bing.com') || ref.includes('yahoo.com')) {
      return 'google';
    }
    // 11. Internal Domain Navigation (Bukan External Traffic)
    if (ref.includes('asisten-guru.id') || ref.includes('asistenguru.id') || ref.includes('localhost')) {
      return 'direct';
    }

    return 'other';
  }

  // --- PRIORITAS 3: DIRECT (Bookmark / Ketik URL Langsung) ---
  return 'direct';
}

/**
 * Mengurai kategori perangkat berdasarkan User-Agent
 */
export function parseDeviceType(userAgent?: string | null): DeviceType {
  if (!userAgent) return 'mobile';
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('ipad') || ua.includes('tablet') || ua.includes('silk') || ua.includes('playbook')) {
    return 'tablet';
  }
  
  if (
    ua.includes('mobi') || 
    ua.includes('android') || 
    ua.includes('iphone') || 
    ua.includes('ipod') || 
    ua.includes('blackberry') || 
    ua.includes('windows phone')
  ) {
    return 'mobile';
  }
  
  return 'desktop';
}

/**
 * Format nama display, warna representatif, dan ikon untuk kanal sumber trafik
 */
export function getTrafficSourceMeta(source: string): { label: string; color: string; icon: string } {
  switch (source.toLowerCase()) {
    case 'whatsapp':
      return { label: 'WhatsApp', color: '#25D366', icon: 'whatsapp' };
    case 'instagram':
      return { label: 'Instagram', color: '#E4405F', icon: 'instagram' };
    case 'tiktok':
      return { label: 'TikTok', color: '#000000', icon: 'tiktok' };
    case 'facebook':
      return { label: 'Facebook', color: '#1877F2', icon: 'facebook' };
    case 'twitter':
      return { label: 'X (Twitter)', color: '#0F1419', icon: 'twitter' };
    case 'telegram':
      return { label: 'Telegram', color: '#229ED9', icon: 'telegram' };
    case 'youtube':
      return { label: 'YouTube', color: '#FF0000', icon: 'youtube' };
    case 'linkedin':
      return { label: 'LinkedIn', color: '#0A66C2', icon: 'linkedin' };
    case 'threads':
      return { label: 'Threads', color: '#101010', icon: 'threads' };
    case 'google':
      return { label: 'Google Search', color: '#4285F4', icon: 'google' };
    case 'direct':
      return { label: 'Langsung / Direct', color: '#0D5B52', icon: 'direct' };
    default:
      return { label: 'Lainnya / Web', color: '#78716C', icon: 'web' };
  }
}
