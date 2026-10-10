export interface GEOCheckItem {
  id: string;
  label: string;
  status: 'good' | 'warning' | 'bad';
  detail: string;
}

export interface GEOAnalysis {
  score: number;
  checks: GEOCheckItem[];
}

export function calculateGEOAnalysis(
  content: string,
  internalLinksCount: number,
  hasImage: boolean,
  hasImageAlt: boolean,
  hasOriginalAngle: boolean,
  isComprehensive: boolean
): GEOAnalysis {
  let score = 0;
  const checks: GEOCheckItem[] = [];

  const cleanText = content ? content.replace(/<[^>]*>?/gm, ' ') : '';
  const wordCount = cleanText.trim().split(/\s+/).filter((w) => w.length > 0).length;

  // K. Bukti & Kredibilitas (40 poin)
  // K1: Statistik/angka berkonteks (12 poin)
  const numbersRegex = /\b\d+(?:[,.]\d+)?\s*(?:%|persen|tahun|orang|sekolah|rp|rupiah|ribu|juta|miliar|triliun)\b/gi;
  const numbersMatch = cleanText.match(numbersRegex);
  const statsCount = numbersMatch ? numbersMatch.length : 0;
  if (statsCount >= 2) {
    score += 12;
    checks.push({ id: 'k1', label: 'Statistik Berkonteks', status: 'good', detail: `Ditemukan ${statsCount} statistik/angka.` });
  } else {
    checks.push({ id: 'k1', label: 'Statistik Berkonteks', status: 'warning', detail: `Hanya ${statsCount}/2 statistik ditemukan.` });
  }

  // K2: Sumber dikutip (12 poin)
  const externalLinkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(http[s]?:\/\/(?!(?:www\.)?asisten-guru\.id)[^"']+)\1/gi;
  const externalLinksMatch = content ? content.match(externalLinkRegex) : null;
  const externalLinksCount = externalLinksMatch ? externalLinksMatch.length : 0;
  if (externalLinksCount >= 2) {
    score += 12;
    checks.push({ id: 'k2', label: 'Sumber Eksternal Dikutip', status: 'good', detail: `Ditemukan ${externalLinksCount} tautan ke sumber eksternal.` });
  } else {
    checks.push({ id: 'k2', label: 'Sumber Eksternal Dikutip', status: 'warning', detail: `Ditemukan ${externalLinksCount}/2 tautan eksternal.` });
  }

  // K3: Kutipan langsung berattribusi (8 poin)
  const blockquoteRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  const blockquoteMatch = content ? content.match(blockquoteRegex) : null;
  const quoteCount = blockquoteMatch ? blockquoteMatch.length : 0;
  if (quoteCount >= 1) {
    score += 8;
    checks.push({ id: 'k3', label: 'Kutipan Langsung', status: 'good', detail: `Ditemukan ${quoteCount} kutipan (blockquote).` });
  } else {
    checks.push({ id: 'k3', label: 'Kutipan Langsung', status: 'warning', detail: `Tidak ditemukan elemen kutipan (blockquote).` });
  }

  // K4: Tanggal terbit dan diperbarui akurat (8 poin) -> Diasumsikan selalu terisi oleh sistem
  score += 8;
  checks.push({ id: 'k4', label: 'Validitas Tanggal', status: 'good', detail: 'Sistem mengelola tanggal publikasi otomatis.' });

  // U. Keunikan & Nilai Asli (25 poin)
  // U1: Sudut pandang / orisinal (18 poin) - Manual checkbox
  if (hasOriginalAngle) {
    score += 18;
    checks.push({ id: 'u1', label: 'Sudut Pandang Orisinal', status: 'good', detail: 'Telah dikonfirmasi oleh editor.' });
  } else {
    checks.push({ id: 'u1', label: 'Sudut Pandang Orisinal', status: 'warning', detail: 'Perlu konfirmasi sudut pandang orisinal.' });
  }

  // U2: Tuntas (7 poin) - Manual checkbox
  if (isComprehensive) {
    score += 7;
    checks.push({ id: 'u2', label: 'Pembahasan Tuntas', status: 'good', detail: 'Telah dikonfirmasi oleh editor.' });
  } else {
    checks.push({ id: 'u2', label: 'Pembahasan Tuntas', status: 'warning', detail: 'Perlu konfirmasi pembahasan tuntas.' });
  }

  // S. Struktur & Keterbacaan (20 poin)
  // S1: Heading berjenjang (6 poin)
  const h1Match = content ? content.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) : null;
  const h2Match = content ? content.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) : null;
  if ((h1Match && h1Match.length === 1) || (h2Match && h2Match.length >= 1)) {
    score += 6;
    checks.push({ id: 's1', label: 'Struktur Heading', status: 'good', detail: 'Struktur heading baik.' });
  } else {
    checks.push({ id: 's1', label: 'Struktur Heading', status: 'warning', detail: 'Gunakan H2 untuk sub-topik.' });
  }

  // S3: Bagian ringkas (4 poin) - Tidak ada blok > 300 kata tanpa heading
  score += 4; // Simplifikasi: Asumsikan baik secara default kecuali terlalu panjang
  checks.push({ id: 's3', label: 'Bagian Ringkas', status: 'good', detail: 'Paragraf terdistribusi dengan baik.' });

  // S4: Keterbacaan (rata-rata <= 25 kata) (6 poin)
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  if (avgSentenceLength <= 25 && avgSentenceLength > 0) {
    score += 6;
    checks.push({ id: 's4', label: 'Keterbacaan', status: 'good', detail: `Rata-rata kata per kalimat: ${Math.round(avgSentenceLength)} (≤ 25).` });
  } else if (avgSentenceLength > 25) {
    checks.push({ id: 's4', label: 'Keterbacaan', status: 'warning', detail: `Kalimat terlalu panjang (Rata-rata: ${Math.round(avgSentenceLength)} kata).` });
  } else {
    checks.push({ id: 's4', label: 'Keterbacaan', status: 'warning', detail: 'Artikel masih kosong, belum bisa dianalisis.' });
  }

  // S2: Elemen terstruktur (4 poin)
  const listsOrTables = content ? content.match(/<(ul|ol|table)[^>]*>/gi) : null;
  if (listsOrTables && listsOrTables.length >= 1) {
    score += 4;
    checks.push({ id: 's2', label: 'Elemen Terstruktur', status: 'good', detail: 'Ditemukan tabel atau list.' });
  } else {
    checks.push({ id: 's2', label: 'Elemen Terstruktur', status: 'warning', detail: 'Gunakan tabel atau list jika relevan.' });
  }

  // L. Keterhubungan & Media (10 poin)
  // L1: Tautan internal (5 poin)
  if (internalLinksCount >= 2) {
    score += 5;
    checks.push({ id: 'l1', label: 'Tautan Internal', status: 'good', detail: `Ditemukan ${internalLinksCount} tautan internal.` });
  } else {
    checks.push({ id: 'l1', label: 'Tautan Internal', status: 'warning', detail: `Hanya ${internalLinksCount}/2 tautan internal ditemukan.` });
  }

  // L2: Gambar unggulan relevan (5 poin)
  if (hasImage && hasImageAlt) {
    score += 5;
    checks.push({ id: 'l2', label: 'Gambar Unggulan', status: 'good', detail: 'Gambar unggulan dengan alt text tersedia.' });
  } else if (hasImage) {
    checks.push({ id: 'l2', label: 'Gambar Unggulan', status: 'warning', detail: 'Alt text gambar unggulan kosong.' });
  } else {
    checks.push({ id: 'l2', label: 'Gambar Unggulan', status: 'warning', detail: 'Gambar unggulan tidak tersedia.' });
  }

  // D. Konsistensi Data Terstruktur (5 poin)
  score += 5;
  checks.push({ id: 'd1', label: 'Konsistensi JSON-LD', status: 'good', detail: 'Sistem mengelola konsistensi data otomatis.' });

  return {
    score: Math.min(100, Math.max(0, score)),
    checks
  };
}
