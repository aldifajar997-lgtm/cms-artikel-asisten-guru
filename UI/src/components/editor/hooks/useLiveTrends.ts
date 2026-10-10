import { useState, useEffect } from 'react';
import api from '../../../utils/api';

export const useLiveTrends = (focusKeyword: string) => {
  const [lsiKeywords, setLsiKeywords] = useState<string[]>([]);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [trendStatus, setTrendStatus] = useState<'idle' | 'trending' | 'niche' | 'error'>('idle');

  useEffect(() => {
    const abortController = new AbortController();

    const fetchTrends = async () => {
      if (!focusKeyword.trim()) {
        setLsiKeywords([]);
        setTrendStatus('idle');
        return;
      }

      setIsTrendLoading(true);
      try {
        const response = await api.get(`/trends/suggest?keyword=${encodeURIComponent(focusKeyword)}`, {
          signal: abortController.signal
        });
        const trends = response.data.trends || [];
        setLsiKeywords(trends);
        
        if (trends.length > 0) {
          // If the exact focus keyword is in the top 3 suggestions, it's trending highly
          const isTopMatch = trends.slice(0, 3).some((t: string) => t.toLowerCase() === focusKeyword.toLowerCase());
          setTrendStatus(isTopMatch || trends.length >= 8 ? 'trending' : 'niche');
        } else {
          setTrendStatus('niche');
        }
      } catch (error: any) {
        if (error.name === 'CanceledError' || error.message?.includes('canceled')) {
          // Ignore if it's aborted
          return;
        }
        console.error('Failed to fetch trends:', error);
        setTrendStatus('error');
        setLsiKeywords([]);
      } finally {
        setIsTrendLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchTrends, 800);
    return () => {
      clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [focusKeyword]);

  return { lsiKeywords, isTrendLoading, trendStatus };
};
