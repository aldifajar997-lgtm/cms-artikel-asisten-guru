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

  const safeContent = content || '';
  const cleanText = safeContent.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ==========================================
  // 1. BUKTI & KREDIBILITAS (35 POIN)
  // ==========================================

  // K1: Data & Statistik Berkonteks (15 Poin)
  const numbersRegex = /\b\d+(?:[,.]\d+)?\s*(?:%|persen|tahun|orang|sekolah|siswa|guru|peserta|rp|rupiah|ribu|juta|miliar|triliun)\b/gi;
  const numbersMatch = cleanText.match(numbersRegex);
  const statsCount = numbersMatch ? numbersMatch.length : 0;
  if (statsCount >= 2) {
    score += 15;
    checks.push({ 
      id: 'k1', 
      label: 'Statistik & Angka Berkonteks', 
      status: 'good', 
      detail: `Ditemukan ${statsCount} data angka/kuantitatif. AI memprioritaskan konten berbasis data riil.` 
    });
  } else if (statsCount === 1) {
    score += 8;
    checks.push({ 
      id: 'k1', 
      label: 'Statistik Masih Minim', 
      status: 'warning', 
      detail: 'Baru 1 data angka/statistik. Tambahkan minimal 1 data kuantitatif lagi untuk meningkatkan otoritas.' 
    });
  } else {
    checks.push({ 
      id: 'k1', 
      label: 'Belum Ada Data Statistik', 
      status: 'bad', 
      detail: 'Sertakan data angka, persentase, atau statistik terukur agar AI menganggap artikel bernilai rujukan.' 
    });
  }

  // K2: Sumber Eksternal Otoritatif Dikutip (10 Poin)
  const externalLinkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(http[s]?:\/\/(?!(?:www\.)?asisten-guru\.id)[^"']+)\1/gi;
  const externalLinksMatch = safeContent.match(externalLinkRegex);
  const externalLinksCount = externalLinksMatch ? externalLinksMatch.length : 0;
  if (externalLinksCount >= 2) {
    score += 10;
    checks.push({ 
      id: 'k2', 
      label: 'Sumber Eksternal Terpercaya Dikutip', 
      status: 'good', 
      detail: `Ditemukan ${externalLinksCount} tautan rujukan eksternal. Sinyal sitasi kuat untuk RAG.` 
    });
  } else if (externalLinksCount === 1) {
    score += 5;
    checks.push({ 
      id: 'k2', 
      label: 'Rujukan Eksternal Terbatas', 
      status: 'warning', 
      detail: 'Ditemukan 1 tautan luar. Tambahkan setidaknya 1 rujukan otoritatif lagi (jurnal, regulasi, riset).' 
    });
  } else {
    checks.push({ 
      id: 'k2', 
      label: 'Belum Ada Rujukan Eksternal', 
      status: 'warning', 
      detail: 'Tautkan sumber primer (situs resmi/studi) agar jawaban AI menyertakan domain Anda sebagai sitasi.' 
    });
  }

  // K3: Kutipan Langsung / Pernyataan Ahli (10 Poin)
  const blockquoteRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
  const blockquoteMatch = safeContent.match(blockquoteRegex);
  const quoteCount = blockquoteMatch ? blockquoteMatch.length : 0;
  if (quoteCount >= 1) {
    score += 10;
    checks.push({ 
      id: 'k3', 
      label: 'Kutipan Langsung (Blockquote)', 
      status: 'good', 
      detail: `Ditemukan ${quoteCount} elemen kutipan. Format ini mempermudah ekstraksi kutipan langsung oleh LLM.` 
    });
  } else {
    checks.push({ 
      id: 'k3', 
      label: 'Belum Ada Kutipan Langsung', 
      status: 'warning', 
      detail: 'Gunakan elemen blockquote (kutipan ahli, pejabat, atau hasil wawancara) untuk nilai E-E-A-T.' 
    });
  }

  // ==========================================
  // 2. KETERBACAAN MESIN AI & STRUKTUR (35 POIN)
  // ==========================================

  // S1: Pola Tanya-Jawab / FAQ Sub-heading (10 Poin) — BARU: Kunci AI Overview & Perplexity!
  const questionHeadingRegex = /<h[23][^>]*>(?:[^<]*\?|(?:apa|bagaimana|mengapa|kapan|siapa|dimana|berapa|kenapa|apakah)\b[^<]*)<\/h[23]>/gi;
  const questionHeadingMatch = safeContent.match(questionHeadingRegex);
  const qHeadingCount = questionHeadingMatch ? questionHeadingMatch.length : 0;
  if (qHeadingCount >= 1) {
    score += 10;
    checks.push({ 
      id: 's1-qa', 
      label: 'Sub-heading Pola Q&A / FAQ', 
      status: 'good', 
      detail: `Ditemukan ${qHeadingCount} sub-heading berpola pertanyaan. Sangat diutamakan oleh AI Overviews & Perplexity.` 
    });
  } else {
    checks.push({ 
      id: 's1-qa', 
      label: 'Sub-heading Pola Tanya-Jawab Belum Ada', 
      status: 'warning', 
      detail: 'Buat setidaknya satu judul bagian berbentuk pertanyaan (misal: "Bagaimana cara...", "Apa faktor...") untuk menjawab query pengguna.' 
    });
  }

  // S2: Elemen Terstruktur (Tabel Komparasi / Lists) (10 Poin) — UPGRADED: Cek Tabel Riil!
  const hasTable = /<table[^>]*>/i.test(safeContent);
  const hasList = /<(ul|ol)[^>]*>/i.test(safeContent);
  if (hasTable) {
    score += 10;
    checks.push({ 
      id: 's2-struct', 
      label: 'Tabel Data Terstruktur Terpasang', 
      status: 'good', 
      detail: 'Memiliki elemen tabel. Format tabel adalah format yang paling disukai LLM untuk data perbandingan.' 
    });
  } else if (hasList) {
    score += 8;
    checks.push({ 
      id: 's2-struct', 
      label: 'Daftar Poin (List) Tersedia', 
      status: 'good', 
      detail: 'Ditemukan format bullet/numbered list. Tambahkan tabel komparasi jika ada perbandingan data.' 
    });
  } else {
    checks.push({ 
      id: 's2-struct', 
      label: 'Belum Ada Tabel atau List', 
      status: 'bad', 
      detail: 'Gunakan tabel data atau daftar poin terstruktur agar LLM mudah mengekstrak informasi ringkas.' 
    });
  }

  // S3: Bebas Dinding Teks / Paragraf Ringkas (10 Poin) — MENGGANTIKAN DUMMY LAMA!
  const pMatches = safeContent.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  let hasWallOfText = false;
  let maxWordsInP = 0;
  pMatches.forEach(pTag => {
    const pText = pTag.replace(/<[^>]*>?/gm, ' ').trim();
    const count = pText.split(/\s+/).filter(Boolean).length;
    if (count > maxWordsInP) maxWordsInP = count;
    if (count > 100) hasWallOfText = true;
  });

  if (wordCount >= 100 && !hasWallOfText) {
    score += 10;
    checks.push({ 
      id: 's3-chunking', 
      label: 'Bebas Dinding Teks (Paragraf Ringkas)', 
      status: 'good', 
      detail: `Paragraf terdistribusi ideal (terpanjang: ${maxWordsInP} kata, aman < 100). Sangat optimal untuk AI chunking.` 
    });
  } else if (hasWallOfText) {
    score += 4;
    checks.push({ 
      id: 's3-chunking', 
      label: 'Peringatan: Dinding Teks Terdeteksi', 
      status: 'warning', 
      detail: `Ada paragraf dengan ${maxWordsInP} kata. Pecah menjadi paragraf yang lebih pendek (maksimal 80-100 kata) agar tidak melelahkan pembaca & AI.` 
    });
  } else {
    checks.push({ 
      id: 's3-chunking', 
      label: 'Paragraf Terlalu Sedikit', 
      status: 'warning', 
      detail: 'Konten masih kosong atau belum memiliki paragraf yang memadai.' 
    });
  }

  // S4: Keterbacaan Kalimat (5 Poin)
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  if (avgSentenceLength > 0 && avgSentenceLength <= 25) {
    score += 5;
    checks.push({ 
      id: 's4-readability', 
      label: 'Keterbacaan Kalimat Ideal', 
      status: 'good', 
      detail: `Rata-rata ${Math.round(avgSentenceLength)} kata per kalimat (≤ 25 kata). Mudah dipahami manusia dan model bahasa.` 
    });
  } else if (avgSentenceLength > 25) {
    checks.push({ 
      id: 's4-readability', 
      label: 'Kalimat Terlalu Panjang', 
      status: 'warning', 
      detail: `Rata-rata ${Math.round(avgSentenceLength)} kata per kalimat. Gunakan kalimat yang lebih ringkas dan lugas.` 
    });
  } else {
    checks.push({ 
      id: 's4-readability', 
      label: 'Keterbacaan Belum Terukur', 
      status: 'warning', 
      detail: 'Ketik minimal 1 kalimat lengkap untuk mengukur keterbacaan.' 
    });
  }

  // ==========================================
  // 3. KEUNIKAN & HUMAN VALUE (30 POIN)
  // ==========================================

  // U1: Sudut Pandang Orisinal / Pengalaman Lapangan (15 Poin)
  if (hasOriginalAngle) {
    score += 15;
    checks.push({ 
      id: 'u1', 
      label: 'Sudut Pandang Orisinal (E-E-A-T)', 
      status: 'good', 
      detail: 'Dikonfirmasi memiliki analisis mandiri/pengalaman lapangan langsung.' 
    });
  } else {
    checks.push({ 
      id: 'u1', 
      label: 'Perlu Konfirmasi Sudut Pandang Orisinal', 
      status: 'warning', 
      detail: 'Centang evaluasi manual jika artikel memuat insight unik atau data primer yang tidak ada di situs lain.' 
    });
  }

  // U2: Pembahasan Tuntas (10 Poin)
  if (isComprehensive) {
    score += 10;
    checks.push({ 
      id: 'u2', 
      label: 'Pembahasan Menyeluruh & Tuntas', 
      status: 'good', 
      detail: 'Dikonfirmasi menjawab topik inti secara tuntas tanpa menyisakan pertanyaan pembaca.' 
    });
  } else {
    checks.push({ 
      id: 'u2', 
      label: 'Perlu Konfirmasi Pembahasan Tuntas', 
      status: 'warning', 
      detail: 'Centang evaluasi manual jika artikel memberikan jawaban komprehensif.' 
    });
  }

  // L1: Tautan Internal Kontekstual (5 Poin)
  if (internalLinksCount >= 2) {
    score += 5;
    checks.push({ 
      id: 'l1', 
      label: 'Tautan Internal Relevan', 
      status: 'good', 
      detail: `Ditemukan ${internalLinksCount} tautan ke ekosistem artikel asisten-guru.id.` 
    });
  } else if (internalLinksCount === 1) {
    score += 2;
    checks.push({ 
      id: 'l1', 
      label: 'Tautan Internal Terbatas', 
      status: 'warning', 
      detail: 'Baru 1 tautan internal. Tambahkan 1 lagi untuk menghubungkan topik terkait.' 
    });
  } else {
    checks.push({ 
      id: 'l1', 
      label: 'Belum Ada Tautan Internal', 
      status: 'warning', 
      detail: 'Sematkan tautan internal untuk memandu pembaca & AI memahami konteks situs.' 
    });
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    checks
  };
}
