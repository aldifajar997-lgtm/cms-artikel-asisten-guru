/**
 * Verifikasi token RS256 yang diterbitkan oleh Hub Asisten Guru (asisten-guru.id).
 * Menggunakan Web Crypto API native (RSASSA-PKCS1-v1_5 + SHA-256).
 */

function base64urlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Import public key PEM (format SPKI: -----BEGIN PUBLIC KEY-----...)
 */
async function importHubPublicKey(pem: string): Promise<CryptoKey | null> {
  if (!pem || typeof pem !== 'string') return null;
  try {
    const clean = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s+/g, '');
    const binary = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'spki',
      binary.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  } catch (err) {
    console.error('[importHubPublicKey] Error importing public key:', err);
    return null;
  }
}

export interface HubJwtPayload {
  iss?: string;
  sub: string;
  account_id: string;
  email: string;
  name: string;
  sekolah?: string;
  kota?: string;
  whatsapp?: string;
  phone_number?: string;
  phone?: string;
  no_hp?: string;
  app_id: string;
  subscription_status?: 'active' | 'inactive' | 'expired' | 'cancelled' | 'pending';
  plan?: string;
  subscription_type?: string;
  quota_balance?: number;
  started_at?: string | null;
  expires_at?: string | null;
  iat: number;
  exp: number;
}

/**
 * Verifikasi signature RS256 dan klaim keamanan JWT Hub Asisten Guru.
 * 
 * @param token JWT string dari Hub
 * @param hubPublicKeyPem Public key SPKI PEM dari env var HUB_PUBLIC_KEY
 * @param expectedAppId app_id yang diharapkan (misal 'mitra-asisten-guru' atau ['mitra-asisten-guru', 'mitra-seller'])
 */
export async function verifyHubJWT(
  token: string,
  hubPublicKeyPem: string,
  expectedAppId?: string | string[]
): Promise<HubJwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.warn('[verifyHubJWT] Token format invalid, parts !== 3');
    return null;
  }

  const [headerB64, payloadB64, sigB64] = parts;

  // 1. Import Public Key
  const key = await importHubPublicKey(hubPublicKeyPem);
  if (!key) {
    console.warn('[verifyHubJWT] Gagal mengimpor HUB_PUBLIC_KEY');
    return null;
  }

  // 2. Verifikasi Signature RS256
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let signature: Uint8Array;
  let payload: HubJwtPayload;

  try {
    const headerStr = new TextDecoder().decode(base64urlDecode(headerB64));
    const header = JSON.parse(headerStr);
    // ANTI-SPOOFING: Pastikan algoritma token adalah RS256 resmi, tolak token 'none' atau algoritma lain
    if (!header || header.alg !== 'RS256') {
      console.warn('[verifyHubJWT] Algoritma token tidak sah, wajib RS256:', header?.alg);
      return null;
    }
    signature = base64urlDecode(sigB64);
    const decodedPayloadStr = new TextDecoder().decode(base64urlDecode(payloadB64));
    payload = JSON.parse(decodedPayloadStr) as HubJwtPayload;
  } catch (err) {
    console.warn('[verifyHubJWT] Gagal decode base64 / parse JSON payload');
    return null;
  }

  const isValid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    signature,
    data
  );

  if (!isValid) {
    console.warn('[verifyHubJWT] Signature verifikasi RS256 tidak valid');
    return null;
  }

  // 3. Verifikasi Waktu (exp dan iat)
  const nowSec = Math.floor(Date.now() / 1000);

  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp < nowSec) {
    console.warn('[verifyHubJWT] Token telah kedaluwarsa');
    return null;
  }

  if (!payload.iat || typeof payload.iat !== 'number') {
    console.warn('[verifyHubJWT] Token iat tidak valid');
    return null;
  }

  // Perlindungan token replay yang terlalu lama (maksimal 24 jam)
  if (nowSec - payload.iat > 86400) {
    console.warn('[verifyHubJWT] Token lebih tua dari 24 jam');
    return null;
  }

  // 4. Verifikasi app_id (Anti cross-app token substitution)
  if (expectedAppId) {
    if (Array.isArray(expectedAppId)) {
      if (!expectedAppId.includes(payload.app_id)) {
        console.warn(`[verifyHubJWT] Mismatch app_id: ${payload.app_id} not in [${expectedAppId.join(', ')}]`);
        return null;
      }
    } else if (payload.app_id !== expectedAppId) {
      console.warn(`[verifyHubJWT] Mismatch app_id: ${payload.app_id} !== ${expectedAppId}`);
      return null;
    }
  }

  return payload;
}
