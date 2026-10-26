/**
 * Membuat slug URL yang bersih dari judul
 */
export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Ganti spasi dengan -
    .replace(/[^\w\-]+/g, '')       // Hapus semua karakter non-word
    .replace(/\-\-+/g, '-')         // Ganti dash ganda dengan dash tunggal
    .replace(/^-+/, '')             // Hapus dash di awal
    .replace(/-+$/, '');            // Hapus dash di akhir
};
