/**
 * Utilitas untuk mengekstrak YouTube Video ID secara aman.
 * Menolak skrip/HTML berbahaya dan hanya mengambil ID alfanumerik 11 karakter resmi.
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Jika guru langsung memasukkan 11 karakter ID video YouTube resmi (misal: dQw4w9WgXcQ)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Mendukung:
  // - https://www.youtube.com/watch?v=dQw4w9WgXcQ
  // - https://youtu.be/dQw4w9WgXcQ
  // - https://www.youtube.com/embed/dQw4w9WgXcQ
  // - https://www.youtube.com/shorts/dQw4w9WgXcQ
  const regExp = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const match = trimmed.match(regExp);
  return match && match[1] && match[1].length === 11 ? match[1] : null;
}

/**
 * Menghasilkan URL embed YouTube aman dengan domain privacy-enhanced (youtube-nocookie).
 */
export function getSafeYouTubeEmbedUrl(videoId: string): string {
  const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://www.youtube-nocookie.com/embed/${cleanId}?rel=0&modestbranding=1`;
}
