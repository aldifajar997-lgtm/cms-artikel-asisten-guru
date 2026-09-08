import { SEOAnalysis, SEOCheckItem } from '../types';

export function calculateSEOAnalysis(
  title: string = '',
  content: string = '',
  focusKeyword: string = '',
  metaTitle: string = '',
  metaDescription: string = '',
  targetWords: number = 1000,
  featuredImage?: string,
  featuredImageAlt?: string
): SEOAnalysis {
  const cleanKeyword = (focusKeyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const safeTitle = (title || '').toLowerCase();
  const safeContent = (content || '');
  const safeMetaDesc = (metaDescription || '').trim();
  
  // Strip HTML tags and entities for word counting and keyword matching
  const plainText = safeContent
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ') // Normalize spaces so phrase matching works
    .trim();
  
  const textWords = plainText
    .replace(/[#*`_~>[\]()\-+!=]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = textWords.length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Count keyword occurrences (using clean text)
  let keywordCount = 0;
  if (cleanKeyword && wordCount > 0) {
    const rawText = plainText.toLowerCase();
    // match non-regex safe characters safely
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = rawText.match(regex);
    keywordCount = matches ? matches.length : 0;
  }

  const keywordDensity = wordCount > 0 ? Number(((keywordCount / wordCount) * 100).toFixed(2)) : 0;

  // Headings analysis (SunEditor outputs HTML, not markdown)
  const h2Matches = safeContent.match(/<h2[^>]*>.*?<\/h2>/gi) || [];
  const h3Matches = safeContent.match(/<h3[^>]*>.*?<\/h3>/gi) || [];
  const h2Count = h2Matches.length;
  const h3Count = h3Matches.length;

  const checks: SEOCheckItem[] = [];
  let earnedPoints = 0;
  const maxPoints = 100;

  // 1. Focus Keyword defined
  if (cleanKeyword.length > 0) {
    checks.push({
      id: 'kw-defined',
      label: 'Kata Kunci Utama Ditentukan',
      status: 'good',
      detail: `Target: "${focusKeyword}"`,
    });
    earnedPoints += 10;
  } else {
    checks.push({
      id: 'kw-defined',
      label: 'Kata Kunci Utama Ditentukan',
      status: 'bad',
      detail: 'Tentukan kata kunci utama untuk panduan optimasi.',
    });
  }

  // 2. Keyword in Title
  const titleLower = safeTitle;
  if (cleanKeyword && titleLower.includes(cleanKeyword)) {
    checks.push({
      id: 'kw-title',
      label: 'Kata Kunci di Judul (H1)',
      status: 'good',
      detail: 'Kata kunci utama terdapat dalam judul H1.',
    });
    earnedPoints += 15;
  } else {
    checks.push({
      id: 'kw-title',
      label: 'Kata Kunci di Judul (H1)',
      status: cleanKeyword ? 'bad' : 'warning',
      detail: 'Sertakan kata kunci utama dalam judul artikel Anda.',
    });
  }

  // 3. Keyword in First Paragraph (~first 100 words)
  const first100Words = textWords.slice(0, 100).join(' ').toLowerCase();
  if (cleanKeyword && first100Words.includes(cleanKeyword)) {
    checks.push({
      id: 'kw-intro',
      label: 'Kata Kunci di Paragraf Pembuka',
      status: 'good',
      detail: 'Kata kunci ditemukan di 100 kata pertama artikel.',
    });
    earnedPoints += 15;
  } else {
    checks.push({
      id: 'kw-intro',
      label: 'Kata Kunci di Paragraf Pembuka',
      status: 'warning',
      detail: 'Sebaiknya munculkan kata kunci di pengantar atau 100 kata awal.',
    });
  }

  // 4. Keyword Density (Ideal: 0.8% - 2.5%)
  if (!cleanKeyword) {
    checks.push({
      id: 'kw-density',
      label: 'Densitas Kata Kunci',
      status: 'warning',
      detail: 'Belum ada kata kunci utama.',
    });
  } else if (keywordDensity >= 0.8 && keywordDensity <= 2.5) {
    checks.push({
      id: 'kw-density',
      label: 'Densitas Kata Kunci Ideal',
      status: 'good',
      detail: `Densitas ${keywordDensity}% (${keywordCount}x muncul) — Sangat seimbang dan natural.`,
    });
    earnedPoints += 15;
  } else if (keywordDensity > 2.5) {
    checks.push({
      id: 'kw-density',
      label: 'Risiko Keyword Stuffing',
      status: 'bad',
      detail: `Densitas ${keywordDensity}% (${keywordCount}x). Kurangi pengulangan kata kunci agar terhindar dari penalti.`,
    });
    earnedPoints += 5;
  } else {
    checks.push({
      id: 'kw-density',
      label: 'Densitas Kata Kunci Rendah',
      status: 'warning',
      detail: `Densitas ${keywordDensity}% (${keywordCount}x). Disarankan muncul 1-2 kali lagi di sub-heading atau isi.`,
    });
    earnedPoints += 8;
  }

  // 5. Headings Structure (H2 / H3)
  if (h2Count >= 2) {
    checks.push({
      id: 'headings-ok',
      label: 'Struktur Sub-heading (H2/H3)',
      status: 'good',
      detail: `Memiliki ${h2Count} H2 dan ${h3Count} H3. Struktur hierarki konten baik.`,
    });
    earnedPoints += 15;
  } else if (h2Count === 1) {
    checks.push({
      id: 'headings-ok',
      label: 'Struktur Sub-heading Terbatas',
      status: 'warning',
      detail: 'Hanya ada 1 H2. Disarankan menambah setidaknya 2-3 H2 untuk memecah topik.',
    });
    earnedPoints += 8;
  } else {
    checks.push({
      id: 'headings-ok',
      label: 'Belum Ada Sub-heading H2',
      status: 'bad',
      detail: 'Gunakan format ## Judul H2 untuk memudahkan navigasi pembaca dan Google.',
    });
  }

  // 6. Content Length (Word Count)
  if (wordCount >= targetWords) {
    checks.push({
      id: 'word-count',
      label: 'Panjang Konten Memenuhi Target',
      status: 'good',
      detail: `${wordCount.toLocaleString('id-ID')} kata (Target minimal: ${targetWords.toLocaleString('id-ID')}).`,
    });
    earnedPoints += 15;
  } else if (wordCount >= Math.floor(targetWords * 0.6)) {
    checks.push({
      id: 'word-count',
      label: 'Panjang Konten Cukup',
      status: 'warning',
      detail: `${wordCount} kata. Tambah kedalaman pembahasan untuk mencapai target ${targetWords} kata.`,
    });
    earnedPoints += 8;
  } else {
    checks.push({
      id: 'word-count',
      label: 'Konten Terlalu Singkat (Thin Content)',
      status: 'bad',
      detail: `Baru ${wordCount} kata. Target minimal artikel SEO berkualitas adalah ${targetWords} kata.`,
    });
    earnedPoints += 3;
  }

  // 7. Meta Description
  const metaDescLen = safeMetaDesc.length;
  if (metaDescLen >= 110 && metaDescLen <= 160) {
    checks.push({
      id: 'meta-desc',
      label: 'Panjang Meta Description Optimal',
      status: 'good',
      detail: `${metaDescLen}/160 karakter — Sempurna untuk snippet Google SERP.`,
    });
    earnedPoints += 15;
  } else if (metaDescLen > 0 && metaDescLen < 110) {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Terlalu Pendek',
      status: 'warning',
      detail: `${metaDescLen} karakter (Ideal: 120-160 karakter).`,
    });
    earnedPoints += 7;
  } else if (metaDescLen > 160) {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Terpotong',
      status: 'warning',
      detail: `${metaDescLen} karakter. Teks akan terpotong (...) di hasil pencarian Google.`,
    });
    earnedPoints += 8;
  } else {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Kosong',
      status: 'bad',
      detail: 'Isi ringkasan meta description untuk meningkatkan Click-Through Rate (CTR).',
    });
  }

  // 8. Gambar Sampul (Featured Image) & Alt Text SEO
  if (featuredImage) {
    const alt = (featuredImageAlt || '').trim().toLowerCase();
    if (alt.length > 0 && cleanKeyword && alt.includes(cleanKeyword)) {
      checks.push({
        id: 'featured-image',
        label: 'Gambar Sampul & Alt Text Sempurna',
        status: 'good',
        detail: `Gambar sampul terpasang dengan Alt Text mengandung target keyword: "${featuredImageAlt}".`,
      });
      earnedPoints += 10;
    } else if (alt.length > 0) {
      checks.push({
        id: 'featured-image',
        label: 'Gambar Sampul Terpasang',
        status: 'good',
        detail: `Gambar sampul terpasang dengan Alt Text: "${featuredImageAlt}". Tambahkan kata kunci utama untuk hasil maksimal.`,
      });
      earnedPoints += 8;
    } else {
      checks.push({
        id: 'featured-image',
        label: 'Alt Text Gambar Sampul Belum Diisi',
        status: 'warning',
        detail: 'Gambar sampul sudah ada, namun belum memiliki Alt Text untuk optimasi Google Images.',
      });
      earnedPoints += 5;
    }
  } else {
    checks.push({
      id: 'featured-image',
      label: 'Belum Ada Gambar Sampul (Featured Image)',
      status: 'warning',
      detail: 'Tambahkan gambar sampul berkualitas tinggi untuk meningkatkan CTR artikel dan sinyal visual Google.',
    });
  }

  const score = Math.min(100, Math.max(0, earnedPoints));

  return {
    score,
    keywordDensity,
    keywordCount,
    wordCount,
    readingTime,
    h2Count,
    h3Count,
    checks,
  };
}

export function generateSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
