import api from './api';

/**
 * Media URL Resolver Utility
 * Memastikan URL aset gambar, foto contoh produk, dan avatar selalu valid baik di dev (localhost:8787) maupun production
 */
export const getMediaUrl = (keyOrUrl?: string | null): string => {
  if (!keyOrUrl) return '';

  const trimmed = keyOrUrl.trim();
  if (!trimmed) return '';

  // Jika sudah merupakan URL absolut http/https atau data: URL
  if (/^(?:https?:|\/\/|data:)/i.test(trimmed)) {
    return trimmed;
  }

  const baseUrl = api.defaults.baseURL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');
  const origin = baseUrl.startsWith('http') ? baseUrl.replace(/\/api\/?$/, '') : '';
  const clean = trimmed.replace(/^\/+/, '');

  if (clean.startsWith('api/media/')) {
    return origin ? `${origin}/${clean}` : `/${clean}`;
  }

  return `${baseUrl}/media/${clean}`;
};
