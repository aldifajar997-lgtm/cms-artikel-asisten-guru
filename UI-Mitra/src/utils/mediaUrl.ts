/**
 * Media URL Resolver Utility
 * Memastikan URL aset gambar dan avatar selalu valid baik di dev (localhost:8787) maupun production
 */

export const getMediaUrl = (keyOrUrl?: string | null): string => {
  if (!keyOrUrl) return '';

  const trimmed = keyOrUrl.trim();
  if (!trimmed) return '';

  // Cegah injeksi protokol berbahaya (XSS / DOM XSS)
  if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }

  // Jika sudah merupakan URL absolut http/https
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');
  const origin = baseUrl.startsWith('http') ? baseUrl.replace(/\/api\/?$/, '') : '';
  const clean = trimmed.replace(/^\/+/, '');

  if (clean.startsWith('api/media/')) {
    return origin ? `${origin}/${clean}` : `/${clean}`;
  }

  return `${baseUrl}/media/${clean}`;
};
