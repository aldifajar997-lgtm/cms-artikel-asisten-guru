/**
 * Safe URL validation and sanitization utility for UI-Mitra
 * Prevents DOM XSS via dangerous schemes like javascript:, data:, vbscript:
 */

const DANGEROUS_PROTOCOL_REGEX = /^\s*(javascript|data|vbscript):/i;

/**
 * Returns safe URL for href attributes in <a> tags.
 * If the URL is dangerous or invalid, returns '#' or a specified fallback.
 */
export const getSafeUrl = (url?: string | null, fallback: string = '#'): string => {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  if (DANGEROUS_PROTOCOL_REGEX.test(trimmed)) {
    return fallback;
  }

  // Relative URLs starting with / (excluding //)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
      return trimmed;
    }
  } catch {
    // Relative link without protocol
    if (!trimmed.includes(':')) {
      return trimmed;
    }
  }

  return fallback;
};

/**
 * Checks whether an URL is safe to open as an external link (http or https only)
 */
export const isSafeExternalUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOL_REGEX.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates that an SSO or external redirect target is safe (HTTPS and belongs to trusted domains)
 */
export const isSafeRedirectUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOL_REGEX.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isDev && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }

    if (parsed.protocol !== 'https:') return false;

    const allowedHostnames = [
      'asisten-guru.id',
      'asisten-guru.my.id',
      'mitra.asisten-guru.id',
      'mitra.asisten-guru.my.id',
      'ui-mitra.pages.dev'
    ];

    return allowedHostnames.some(domain => 
      parsed.hostname.toLowerCase() === domain || 
      parsed.hostname.toLowerCase().endsWith('.' + domain)
    );
  } catch {
    return false;
  }
};
