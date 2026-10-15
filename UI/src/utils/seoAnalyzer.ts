import { SEOAnalysis, SEOCheckItem } from '../types';

export function calculateSEOAnalysis(
  title: string = '',
  content: string = '',
  focusKeyword: string = '',
  metaTitle: string = '',
  metaDescription: string = '',
  targetWords: number = 1000,
  featuredImage?: string,
  featuredImageAlt?: string,
  secondaryKeywords: string[] = []
): SEOAnalysis {
  const cleanKeyword = (focusKeyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const safeTitle = (title || '').toLowerCase();
  const safeContent = (content || '');
  const safeMetaDesc = (metaDescription || '').trim();
  
  // Strip HTML tags and entities for word counting and keyword matching
  const plainText = safeContent
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
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
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = rawText.match(regex);
    keywordCount = matches ? matches.length : 0;
  }

  const keywordDensity = wordCount > 0 ? Number(((keywordCount / wordCount) * 100).toFixed(2)) : 0;

  // Headings analysis
  const h2Matches = safeContent.match(/<h2[^>]*>.*?<\/h2>/gi) || [];
  const h3Matches = safeContent.match(/<h3[^>]*>.*?<\/h3>/gi) || [];
  const h2Count = h2Matches.length;
  const h3Count = h3Matches.length;

  const checks: SEOCheckItem[] = [];
  let earnedPoints = 0;

  // 1. Kata Kunci Utama Ditentukan (10 Poin)
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
      detail: 'Tentukan kata kunci utama untuk memandu optimasi Google & intent pencarian.',
    });
  }

  // 2. Kata Kunci di Judul H1 (10 Poin)
  if (cleanKeyword && safeTitle.includes(cleanKeyword)) {
    checks.push({
      id: 'kw-title',
      label: 'Kata Kunci di Judul (H1)',
      status: 'good',
      detail: 'Kata kunci utama terdapat dalam judul artikel.',
    });
    earnedPoints += 10;
  } else {
    checks.push({
      id: 'kw-title',
      label: 'Kata Kunci di Judul (H1)',
      status: cleanKeyword ? 'bad' : 'warning',
      detail: 'Sertakan kata kunci utama dalam judul H1 artikel Anda.',
    });
  }

  // 3. Kata Kunci di Paragraf Pembuka (10 Poin)
  const first100Words = textWords.slice(0, 100).join(' ').toLowerCase();
  if (cleanKeyword && first100Words.includes(cleanKeyword)) {
    checks.push({
      id: 'kw-intro',
      label: 'Kata Kunci di Paragraf Pembuka',
      status: 'good',
      detail: 'Kata kunci ditemukan di 100 kata pertama artikel.',
    });
    earnedPoints += 10;
  } else {
    checks.push({
      id: 'kw-intro',
      label: 'Kata Kunci di Paragraf Pembuka',
      status: cleanKeyword ? 'warning' : 'warning',
      detail: 'Sebaiknya munculkan kata kunci di paragraf awal untuk memperjelas search intent.',
    });
  }

  // 4. Kata Kunci di Sub-heading H2 (10 Poin) — Modern SEO Factor!
  let kwInH2 = false;
  if (cleanKeyword && h2Matches.length > 0) {
    kwInH2 = h2Matches.some(h2 => h2.toLowerCase().includes(cleanKeyword));
  }
  if (kwInH2) {
    checks.push({
      id: 'kw-h2',
      label: 'Kata Kunci di Sub-heading (H2)',
      status: 'good',
      detail: 'Kata kunci utama ditemukan pada setidaknya satu sub-heading H2.',
    });
    earnedPoints += 10;
  } else {
    checks.push({
      id: 'kw-h2',
      label: 'Kata Kunci di Sub-heading (H2)',
      status: cleanKeyword && h2Matches.length > 0 ? 'warning' : 'warning',
      detail: 'Gunakan kata kunci utama atau variasinya pada setidaknya satu judul bagian (H2).',
    });
    if (h2Count >= 2) earnedPoints += 4;
  }

  // 5. Distribusi Alami & Anti-Keyword Stuffing (10 Poin) — Modernized!
  if (!cleanKeyword) {
    checks.push({
      id: 'kw-density',
      label: 'Sebaran Kata Kunci',
      status: 'warning',
      detail: 'Belum ada kata kunci utama.',
    });
  } else if (keywordDensity > 2.5) {
    checks.push({
      id: 'kw-density',
      label: 'Peringatan: Risiko Keyword Stuffing',
      status: 'bad',
      detail: `Densitas ${keywordDensity}% (${keywordCount}x muncul). Kurangi pengulangan kata kunci agar tidak terkena penalti spam Google.`,
    });
  } else if (keywordCount >= 2 && keywordDensity <= 2.5) {
    checks.push({
      id: 'kw-density',
      label: 'Distribusi Kata Kunci Natural',
      status: 'good',
      detail: `Muncul ${keywordCount}x (${keywordDensity}%) — Alami, terbaca luwes, dan aman dari over-optimasi.`,
    });
    earnedPoints += 10;
  } else if (keywordCount === 1) {
    checks.push({
      id: 'kw-density',
      label: 'Sebaran Kata Kunci Minimal',
      status: 'warning',
      detail: `Kata kunci baru muncul 1x (${keywordDensity}%). Disarankan muncul 1-2 kali lagi secara kontekstual di badan artikel.`,
    });
    earnedPoints += 6;
  } else {
    checks.push({
      id: 'kw-density',
      label: 'Kata Kunci Belum Ada di Konten',
      status: 'bad',
      detail: 'Kata kunci utama belum muncul di dalam isi artikel.',
    });
  }

  // 6. LSI / Secondary Keywords Semantik (10 Poin)
  if (secondaryKeywords && secondaryKeywords.length > 0) {
    let foundLsiCount = 0;
    const rawText = plainText.toLowerCase();
    secondaryKeywords.forEach((lsi) => {
      const cleanLsi = lsi.trim().toLowerCase();
      if (cleanLsi) {
        const escaped = cleanLsi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        if (regex.test(rawText)) {
          foundLsiCount++;
        }
      }
    });

    const lsiPercentage = (foundLsiCount / secondaryKeywords.length) * 100;
    if (lsiPercentage === 100) {
      checks.push({
        id: 'kw-lsi',
        label: 'Optimasi LSI (Kata Kunci Turunan)',
        status: 'good',
        detail: `Sempurna! Semua ${foundLsiCount} dari ${secondaryKeywords.length} LSI keyword ditemukan dalam artikel.`,
      });
      earnedPoints += 10;
    } else if (lsiPercentage >= 50) {
      checks.push({
        id: 'kw-lsi',
        label: 'LSI Keyword Cukup Memadai',
        status: 'good',
        detail: `${foundLsiCount} dari ${secondaryKeywords.length} LSI keyword ditemukan dalam konten.`,
      });
      earnedPoints += 8;
    } else if (foundLsiCount > 0) {
      checks.push({
        id: 'kw-lsi',
        label: 'Kurang Menggunakan LSI Keyword',
        status: 'warning',
        detail: `Hanya ${foundLsiCount} dari ${secondaryKeywords.length} LSI digunakan. Selipkan sisanya secara natural.`,
      });
      earnedPoints += 5;
    } else {
      checks.push({
        id: 'kw-lsi',
        label: 'LSI Keyword Belum Muncul',
        status: 'bad',
        detail: 'LSI keyword telah ditambahkan, namun belum ada yang masuk ke dalam artikel.',
      });
    }
  } else {
    checks.push({
      id: 'kw-lsi',
      label: 'Belum Ada LSI Keyword',
      status: 'warning',
      detail: 'Tambahkan beberapa kata kunci turunan/sinonim untuk memperkaya relevansi topik.',
    });
  }

  // 7. Struktur Heading H2 & H3 (10 Poin)
  if (h2Count >= 2) {
    checks.push({
      id: 'headings-ok',
      label: 'Struktur Sub-heading (H2/H3)',
      status: 'good',
      detail: `Memiliki ${h2Count} H2 dan ${h3Count} H3. Struktur hierarki konten baik.`,
    });
    earnedPoints += 10;
  } else if (h2Count === 1) {
    checks.push({
      id: 'headings-ok',
      label: 'Struktur Sub-heading Terbatas',
      status: 'warning',
      detail: 'Hanya ada 1 H2. Disarankan menambah setidaknya 2 H2 untuk memecah sub-topik.',
    });
    earnedPoints += 5;
  } else {
    checks.push({
      id: 'headings-ok',
      label: 'Belum Ada Sub-heading H2',
      status: 'bad',
      detail: 'Gunakan format Heading 2 (H2) untuk memudahkan navigasi pembaca dan Google.',
    });
  }

  // 8. Tautan Internal (Internal Links) (10 Poin) — Modern Internal Linking!
  const internalLinksRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(?:\/|http[s]?:\/\/(?:www\.)?asisten-guru\.id)[^"']*\1/gi;
  const internalLinksMatch = safeContent.match(internalLinksRegex) || [];
  const internalLinksCount = internalLinksMatch.length;
  if (internalLinksCount >= 2) {
    checks.push({
      id: 'internal-links',
      label: 'Tautan Internal (Internal Link)',
      status: 'good',
      detail: `Ditemukan ${internalLinksCount} tautan internal ke artikel/halaman lain. Sinyal SEO internal kuat.`,
    });
    earnedPoints += 10;
  } else if (internalLinksCount === 1) {
    checks.push({
      id: 'internal-links',
      label: 'Tautan Internal Masih Sedikit',
      status: 'warning',
      detail: 'Baru 1 tautan internal. Disarankan minimal 2 tautan untuk mendistribusikan link equity.',
    });
    earnedPoints += 6;
  } else {
    checks.push({
      id: 'internal-links',
      label: 'Belum Ada Tautan Internal',
      status: 'bad',
      detail: 'Tambahkan tautan internal ke artikel atau layanan terkait untuk memperkuat relevansi situs.',
    });
  }

  // 9. Media & Alt Text Komprehensif (10 Poin) — Mengaudit Featured Image & Gambar Body Konten!
  const contentImages = safeContent.match(/<img[^>]*>/gi) || [];
  let allContentImagesHaveAlt = true;
  let missingAltCount = 0;
  contentImages.forEach(imgTag => {
    const hasAlt = /alt=(["'])(?!\s*\1)[^"']+\1/i.test(imgTag);
    if (!hasAlt) {
      allContentImagesHaveAlt = false;
      missingAltCount++;
    }
  });

  if (featuredImage && (!featuredImageAlt || featuredImageAlt.trim() === '')) {
    checks.push({
      id: 'images-alt',
      label: 'Alt Text Gambar Sampul Belum Diisi',
      status: 'warning',
      detail: 'Gambar sampul terpasang namun belum memiliki Alt Text untuk optimasi Google Images.',
    });
    earnedPoints += 4;
  } else if (featuredImage && !allContentImagesHaveAlt) {
    checks.push({
      id: 'images-alt',
      label: 'Gambar Konten Tanpa Alt Text',
      status: 'warning',
      detail: `Ada ${missingAltCount} gambar di dalam konten yang belum memiliki Alt Text.`,
    });
    earnedPoints += 6;
  } else if (featuredImage && featuredImageAlt) {
    checks.push({
      id: 'images-alt',
      label: 'Gambar & Alt Text Lengkap',
      status: 'good',
      detail: `Gambar sampul & ${contentImages.length} gambar konten telah dilengkapi Alt Text yang baik.`,
    });
    earnedPoints += 10;
  } else {
    checks.push({
      id: 'images-alt',
      label: 'Belum Ada Gambar Sampul',
      status: 'warning',
      detail: 'Tambahkan gambar sampul berkualitas tinggi untuk meningkatkan CTR dan sinyal visual Google.',
    });
  }

  // 10. Meta Description (10 Poin)
  const metaDescLen = safeMetaDesc.length;
  if (metaDescLen >= 110 && metaDescLen <= 160) {
    checks.push({
      id: 'meta-desc',
      label: 'Panjang Meta Description Optimal',
      status: 'good',
      detail: `${metaDescLen}/160 karakter — Sempurna untuk snippet Google SERP.`,
    });
    earnedPoints += 10;
  } else if (metaDescLen > 0 && metaDescLen < 110) {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Terlalu Pendek',
      status: 'warning',
      detail: `${metaDescLen} karakter (Ideal: 120-160 karakter).`,
    });
    earnedPoints += 5;
  } else if (metaDescLen > 160) {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Terpotong',
      status: 'warning',
      detail: `${metaDescLen} karakter. Teks akan terpotong (...) di hasil pencarian Google.`,
    });
    earnedPoints += 5;
  } else {
    checks.push({
      id: 'meta-desc',
      label: 'Meta Description Kosong',
      status: 'bad',
      detail: 'Isi ringkasan meta description untuk meningkatkan Click-Through Rate (CTR).',
    });
  }

  // 11. Panjang & Kedalaman Konten (10 Poin)
  if (wordCount >= targetWords) {
    checks.push({
      id: 'word-count',
      label: 'Panjang Konten Memenuhi Target',
      status: 'good',
      detail: `${wordCount.toLocaleString('id-ID')} kata (Target: ${targetWords.toLocaleString('id-ID')}).`,
    });
    earnedPoints += 10;
  } else if (wordCount >= Math.floor(targetWords * 0.6)) {
    checks.push({
      id: 'word-count',
      label: 'Panjang Konten Cukup',
      status: 'warning',
      detail: `${wordCount} kata. Tambah kedalaman pembahasan untuk mencapai target ${targetWords} kata.`,
    });
    earnedPoints += 6;
  } else {
    checks.push({
      id: 'word-count',
      label: 'Konten Terlalu Singkat (Thin Content)',
      status: 'bad',
      detail: `Baru ${wordCount} kata. Target minimal artikel berkualitas adalah ${targetWords} kata.`,
    });
    earnedPoints += 2;
  }

  const score = Math.round(Math.min(100, Math.max(0, earnedPoints)));

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
