export type FontCategory = 'all' | 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';

export interface FontOption {
  family: string;
  label: string;
  category: Exclude<FontCategory, 'all'>;
  badge: string;
  sampleText: string;
  googleFontQuery: string;
}

export const FONT_CATEGORIES: { id: FontCategory; label: string; count?: number }[] = [
  { id: 'all', label: 'Semua Font' },
  { id: 'sans', label: 'Modern Sans' },
  { id: 'serif', label: 'Elegan Serif' },
  { id: 'display', label: 'Ceria & Edukatif' },
  { id: 'handwriting', label: 'Tulisan Tangan' },
  { id: 'mono', label: 'Teknis & Modernis' }
];

export const CURATED_FONTS: FontOption[] = [
  // --- 1. MODERN & CLEAN (SANS-SERIF) ---
  {
    family: 'Plus Jakarta Sans',
    label: 'Plus Jakarta Sans',
    category: 'sans',
    badge: 'Standar Resmi',
    sampleText: 'Modul Ajar Kurikulum Merdeka',
    googleFontQuery: 'Plus+Jakarta+Sans:wght@400;500;600;700;800'
  },
  {
    family: 'Inter',
    label: 'Inter',
    category: 'sans',
    badge: 'Netral & Tajam',
    sampleText: 'Perangkat Administrasi Guru Digital',
    googleFontQuery: 'Inter:wght@400;500;600;700'
  },
  {
    family: 'Outfit',
    label: 'Outfit',
    category: 'sans',
    badge: 'Geometris Modern',
    sampleText: 'Materi Pembelajaran Interaktif',
    googleFontQuery: 'Outfit:wght@400;500;600;700;800'
  },
  {
    family: 'Poppins',
    label: 'Poppins',
    category: 'sans',
    badge: 'Populer & Ramah',
    sampleText: 'Media Presentasi & Lembar Kerja',
    googleFontQuery: 'Poppins:wght@400;500;600;700'
  },
  {
    family: 'Montserrat',
    label: 'Montserrat',
    category: 'sans',
    badge: 'Tegas & Luas',
    sampleText: 'Bank Soal Asesmen Sumatif',
    googleFontQuery: 'Montserrat:wght@400;600;700;800'
  },
  {
    family: 'Nunito',
    label: 'Nunito',
    category: 'sans',
    badge: 'Bulat Lembut',
    sampleText: 'Bahan Ajar Tematik Terpadu',
    googleFontQuery: 'Nunito:wght@400;600;700;800'
  },
  {
    family: 'Quicksand',
    label: 'Quicksand',
    category: 'sans',
    badge: 'Bersahabat & Ringan',
    sampleText: 'Rubrik Penilaian & Portofolio',
    googleFontQuery: 'Quicksand:wght@400;600;700'
  },
  {
    family: 'DM Sans',
    label: 'DM Sans',
    category: 'sans',
    badge: 'Minimalis Elegan',
    sampleText: 'E-Book Panduan Guru Penggerak',
    googleFontQuery: 'DM+Sans:wght@400;500;700'
  },
  {
    family: 'Raleway',
    label: 'Raleway',
    category: 'sans',
    badge: 'Artistik Tipis',
    sampleText: 'Silabus & Capaian Pembelajaran',
    googleFontQuery: 'Raleway:wght@400;600;700'
  },
  {
    family: 'Work Sans',
    label: 'Work Sans',
    category: 'sans',
    badge: 'Presisi Editorial',
    sampleText: 'Perencanaan Berbasis Data Sekolah',
    googleFontQuery: 'Work+Sans:wght@400;500;600;700'
  },
  {
    family: 'Rubik',
    label: 'Rubik',
    category: 'sans',
    badge: 'Kompak & Tegas',
    sampleText: 'Panduan Praktik Kerja Lapangan',
    googleFontQuery: 'Rubik:wght@400;500;600;700'
  },
  {
    family: 'Sora',
    label: 'Sora',
    category: 'sans',
    badge: 'Futuristik',
    sampleText: 'Inovasi Pembelajaran Abad 21',
    googleFontQuery: 'Sora:wght@400;600;700'
  },

  // --- 2. ELEGAN & KLASIK (SERIF) ---
  {
    family: 'Merriweather',
    label: 'Merriweather',
    category: 'serif',
    badge: 'Akademis Nyaman',
    sampleText: 'Jurnal Refleksi Tindakan Kelas',
    googleFontQuery: 'Merriweather:ital,wght@0,400;0,700;1,400'
  },
  {
    family: 'Playfair Display',
    label: 'Playfair Display',
    category: 'serif',
    badge: 'Mewah & Berkelas',
    sampleText: 'Karya Tulis Ilmiah & Best Practice',
    googleFontQuery: 'Playfair+Display:ital,wght@0,600;0,700;1,400'
  },
  {
    family: 'Lora',
    label: 'Lora',
    category: 'serif',
    badge: 'Puitis Sastra',
    sampleText: 'Antologi Karya Puisi Siswa',
    googleFontQuery: 'Lora:ital,wght@0,500;0,600;1,400'
  },
  {
    family: 'Cinzel',
    label: 'Cinzel',
    category: 'serif',
    badge: 'Klasik Monumen',
    sampleText: 'Piagam Penghargaan Prestasi',
    googleFontQuery: 'Cinzel:wght@500;700;800'
  },
  {
    family: 'Cormorant Garamond',
    label: 'Cormorant Garamond',
    category: 'serif',
    badge: 'Filosofis Mulia',
    sampleText: 'Filsafat Pendidikan Ki Hajar Dewantara',
    googleFontQuery: 'Cormorant+Garamond:ital,wght@0,600;0,700;1,400'
  },
  {
    family: 'Bitter',
    label: 'Bitter',
    category: 'serif',
    badge: 'Slab Serif Kontras',
    sampleText: 'Catatan Pengamatan Perkembangan',
    googleFontQuery: 'Bitter:wght@400;600;700'
  },
  {
    family: 'PT Serif',
    label: 'PT Serif',
    category: 'serif',
    badge: 'Buku Teks Resmi',
    sampleText: 'Diktat Pembelajaran Tematik',
    googleFontQuery: 'PT+Serif:ital,wght@0,400;0,700;1,400'
  },
  {
    family: 'Bodoni Moda',
    label: 'Bodoni Moda',
    category: 'serif',
    badge: 'Editorial Majalah',
    sampleText: 'Buletin Literasi Sekolah Maju',
    googleFontQuery: 'Bodoni+Moda:ital,wght@0,600;0,800;1,400'
  },

  // --- 3. CERIA & EDUKATIF (DISPLAY / RAMAH ANAK) ---
  {
    family: 'Fredoka',
    label: 'Fredoka',
    category: 'display',
    badge: 'Favorit PAUD & SD',
    sampleText: 'Kartu Huruf & Lembar Mewarnai',
    googleFontQuery: 'Fredoka:wght@400;600;700'
  },
  {
    family: 'Baloo 2',
    label: 'Baloo 2',
    category: 'display',
    badge: 'Ceria & Lembut',
    sampleText: 'Dongeng & Cerita Bergambar Anak',
    googleFontQuery: 'Baloo+2:wght@500;600;700;800'
  },
  {
    family: 'Comic Neue',
    label: 'Comic Neue',
    category: 'display',
    badge: 'Komik Edukasi',
    sampleText: 'Komik Pembelajaran Sains Seru',
    googleFontQuery: 'Comic+Neue:wght@400;700'
  },
  {
    family: 'Comfortaa',
    label: 'Comfortaa',
    category: 'display',
    badge: 'Unik Bulat',
    sampleText: 'Media Ajar Berbasis Visual Lucu',
    googleFontQuery: 'Comfortaa:wght@500;600;700'
  },
  {
    family: 'Righteous',
    label: 'Righteous',
    category: 'display',
    badge: 'Retro Enerjik',
    sampleText: 'Kuis Cerdas Cermat Interaktif',
    googleFontQuery: 'Righteous'
  },
  {
    family: 'Itim',
    label: 'Itim',
    category: 'display',
    badge: 'Ramah Kartun',
    sampleText: 'Lembar Aktivitas Motorik Halus',
    googleFontQuery: 'Itim'
  },
  {
    family: 'Mali',
    label: 'Mali',
    category: 'display',
    badge: 'Coretan Sekolah',
    sampleText: 'Jadwal Pelajaran Kelas Menyenangkan',
    googleFontQuery: 'Mali:wght@400;600;700'
  },

  // --- 4. TULISAN TANGAN & PERSONAL (HANDWRITING) ---
  {
    family: 'Caveat',
    label: 'Caveat',
    category: 'handwriting',
    badge: 'Catatan Guru',
    sampleText: 'Umpan Balik Positif untuk Siswa Hebat',
    googleFontQuery: 'Caveat:wght@500;600;700'
  },
  {
    family: 'Dancing Script',
    label: 'Dancing Script',
    category: 'handwriting',
    badge: 'Kaligrafi Dinamis',
    sampleText: 'Sertifikat Kelulusan Apresiasi Guru',
    googleFontQuery: 'Dancing+Script:wght@600;700'
  },
  {
    family: 'Pacifico',
    label: 'Pacifico',
    category: 'handwriting',
    badge: 'Spidol Lembut',
    sampleText: 'Selamat Datang di Toko Belajar Kami',
    googleFontQuery: 'Pacifico'
  },
  {
    family: 'Kalam',
    label: 'Kalam',
    category: 'handwriting',
    badge: 'Goresan Pena',
    sampleText: 'Rangkuman Materi & Mind Mapping',
    googleFontQuery: 'Kalam:wght@400;700'
  },
  {
    family: 'Satisfy',
    label: 'Satisfy',
    category: 'handwriting',
    badge: 'Tanda Tangan Kuas',
    sampleText: 'Dedikasi Terbaik untuk Pendidikan',
    googleFontQuery: 'Satisfy'
  },

  // --- 5. TEKNIS & MODERNIS (MONOSPACE / NEO-GROTESQUE) ---
  {
    family: 'Space Grotesk',
    label: 'Space Grotesk',
    category: 'mono',
    badge: 'Futuristik Tech',
    sampleText: 'Modul Coding & Kecerdasan Buatan',
    googleFontQuery: 'Space+Grotesk:wght@500;600;700'
  },
  {
    family: 'JetBrains Mono',
    label: 'JetBrains Mono',
    category: 'mono',
    badge: 'Kode Komputer',
    sampleText: 'Laboratorium Komputasi & Logika',
    googleFontQuery: 'JetBrains+Mono:wght@400;600;700'
  },
  {
    family: 'Syne',
    label: 'Syne',
    category: 'mono',
    badge: 'Modernis Avant-Garde',
    sampleText: 'Desain Komunikasi Visual & Kreatif',
    googleFontQuery: 'Syne:wght@600;700;800'
  },
  {
    family: 'Fira Code',
    label: 'Fira Code',
    category: 'mono',
    badge: 'Teknik Vokasi',
    sampleText: 'Modul Praktikum Rekayasa Perangkat Lunak',
    googleFontQuery: 'Fira+Code:wght@500;600;700'
  }
];

// Helper: Memuat Google Font ke DOM secara asinkron (on-demand loader)
const loadedFontsSet = new Set<string>();

export function loadGoogleFont(fontFamily: string): void {
  if (typeof document === 'undefined') return;
  if (!fontFamily) return;

  const font = CURATED_FONTS.find(f => f.family.toLowerCase() === fontFamily.toLowerCase());
  const query = font ? font.googleFontQuery : fontFamily.replace(/\s+/g, '+') + ':wght@400;600;700';

  const linkId = `google-font-${fontFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (document.getElementById(linkId) || loadedFontsSet.has(fontFamily)) {
    return;
  }

  try {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
    document.head.appendChild(link);
    loadedFontsSet.add(fontFamily);
  } catch (err) {
    console.warn(`Gagal memuat font Google: ${fontFamily}`, err);
  }
}
