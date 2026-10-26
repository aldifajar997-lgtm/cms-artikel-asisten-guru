import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseShortLinkOptions {
  sellerId: string;
  storeName?: string;
  storeSlug?: string | null;
  autoFetch?: boolean;
}

const shortLinkMemoryCache = new Map<string, string>();

export function useShortLink({ sellerId, storeName, storeSlug, autoFetch = true }: UseShortLinkOptions) {
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanSlug = storeSlug ? storeSlug.trim() : '';
  const vanityUrl = cleanSlug ? `https://asisten-guru.id/${encodeURIComponent(cleanSlug)}` : null;
  const canonicalUrl = `https://asisten-guru.id/toko/penjual/${encodeURIComponent(sellerId)}`;

  const fetchShortLink = useCallback(async (): Promise<string> => {
    if (!sellerId) return canonicalUrl;

    const cacheKey = `seller:${sellerId}`;
    if (shortLinkMemoryCache.has(cacheKey)) {
      const cached = shortLinkMemoryCache.get(cacheKey)!;
      setShortUrl(cached);
      return cached;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('https://asisten-guru.id/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'seller',
          id: sellerId,
        }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success && json?.data?.short_url) {
        const url = json.data.short_url as string;
        shortLinkMemoryCache.set(cacheKey, url);
        setShortUrl(url);
        return url;
      }

      // Fallback jika API Hub mengembalikan respon non-200
      setShortUrl(canonicalUrl);
      return canonicalUrl;
    } catch (err: any) {
      if (err.name === 'AbortError') return canonicalUrl;
      console.warn('[useShortLink] Hub shortener unreachable, fallback ke canonical URL:', err);
      setShortUrl(canonicalUrl);
      return canonicalUrl;
    } finally {
      setIsLoading(false);
    }
  }, [sellerId, canonicalUrl]);

  useEffect(() => {
    if (autoFetch && sellerId) {
      fetchShortLink();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoFetch, sellerId, fetchShortLink]);

  // Prioritas activeUrl:
  // 1. vanityUrl (https://asisten-guru.id/:storeSlug) jika mitra memiliki custom slug resmi
  // 2. shortUrl (https://asisten-guru.id/s/:code) dari shortener Hub
  // 3. canonicalUrl (https://asisten-guru.id/toko/penjual/:sellerId) sebagai fallback
  const activeUrl = vanityUrl || shortUrl || canonicalUrl;

  const buildShareUrl = (source: string) => {
    const base = activeUrl;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}utm_source=${source}&utm_medium=social_share`;
  };

  const shareText = `Halo Rekan Guru! Kunjungi etalase resmi modul ajar dan media pembelajaran digital ${storeName ? `"${storeName}"` : 'saya'} di Asisten Guru:\n${buildShareUrl('whatsapp')}`;

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(buildShareUrl('telegram'))}&text=${encodeURIComponent(`Etalase Toko Digital ${storeName || ''} - Asisten Guru`)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(buildShareUrl('twitter'))}&text=${encodeURIComponent(`Kunjungi etalase modul ajar dan karya edukasi digital saya di @asisten_guru24:`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildShareUrl('facebook'))}`,
  };

  return {
    shortUrl,
    canonicalUrl,
    vanityUrl,
    activeUrl,
    isLoading,
    error,
    shareText,
    shareLinks,
    refetch: fetchShortLink,
  };
}
