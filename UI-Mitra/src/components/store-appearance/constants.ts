import { Eye, MessageCircle, Video, Flame, ShoppingBag, HelpCircle } from 'lucide-react';
import { StoreAppearanceConfig, SectionBlockType, FaqItem } from '../../types';

// Nilai dasar ekstensi modular etalase toko digital
export const BASE_EXTENSIONS = {
  sectionsOrder: [
    'profile',
    'social_links',
    'video_teaser',
    'featured_product',
    'catalog',
    'faq'
  ] as SectionBlockType[],
  socialLinks: {
    enabled: true,
    style: 'colored' as const,
    whatsapp: null as string | null,
    instagram: null as string | null,
    tiktok: null as string | null,
    youtube: null as string | null,
    linkedin: null as string | null,
    facebook: null as string | null
  },
  videoTeaser: {
    enabled: false,
    title: null as string | null,
    videoUrl: null as string | null,
    aspectRatio: '16:9' as const
  },
  featuredProduct: {
    enabled: false,
    productId: null as string | null,
    badgeText: 'UNGGULAN',
    animationStyle: 'pulse' as const
  },
  faq: {
    enabled: false,
    title: 'Pertanyaan yang Sering Diajukan (FAQ)',
    items: [] as FaqItem[]
  }
};

// Metadata seksi untuk kontrol blok modular
export const SECTION_METADATA: Record<SectionBlockType, { name: string; description: string; canDisable: boolean; icon: any }> = {
  profile: { name: 'Profil & Bio Toko', description: 'Avatar, nama toko, lencana terverifikasi & bio guru', canDisable: false, icon: Eye },
  social_links: { name: 'Ikon Media Sosial', description: 'Baris akun medsos resmi & tombol chat WhatsApp', canDisable: true, icon: MessageCircle },
  video_teaser: { name: 'Video Pengantar / Teaser', description: 'Video YouTube pengantar modul atau profil guru', canDisable: true, icon: Video },
  featured_product: { name: 'Sorot Produk Unggulan', description: 'Kartu modul pilihan dengan animasi penarik perhatian', canDisable: true, icon: Flame },
  catalog: { name: 'Katalog Produk Resmi', description: 'Pencarian & grid/list seluruh modul lolos kurasi', canDisable: false, icon: ShoppingBag },
  faq: { name: 'Tanya Jawab (FAQ)', description: 'Accordion pertanyaan seputar modul ajar & lisensi Canva', canDisable: true, icon: HelpCircle }
};

// 5 Preset Tema Edukatif yang Seamless & Nyaman Sesuai Standar UI Asisten Guru
export const PRESET_THEMES: Record<string, {
  name: string;
  description: string;
  badge: string;
  config: StoreAppearanceConfig;
}> = {
  'emerald-scholar': {
    name: 'Asisten Guru Emerald',
    description: 'Estetika resmi Asisten Guru: bersih, menenangkan, elegan dengan aksen teal',
    badge: 'Resmi',
    config: {
      preset: 'emerald-scholar',
      background: {
        type: 'color',
        value: '#f5f5f4',
        imageUrl: null
      },
      button: {
        style: 'fill',
        radius: 'rounded',
        bgColor: '#0D5B52',
        textColor: '#ffffff',
        borderColor: null
      },
      typography: {
        fontFamily: 'Plus Jakarta Sans',
        headingColor: '#1c1917',
        bioColor: '#57534e'
      },
      catalogLayout: 'grid',
      socialLinksStyle: 'colored',
      ...BASE_EXTENSIONS
    }
  },
  'minimal-slate': {
    name: 'Minimalist Clean White',
    description: 'Kanvas putih bersih & modern layaknya galeri karya profesional',
    badge: 'Minimalis',
    config: {
      preset: 'minimal-slate',
      background: {
        type: 'color',
        value: '#ffffff',
        imageUrl: null
      },
      button: {
        style: 'fill',
        radius: 'rounded',
        bgColor: '#1c1917',
        textColor: '#ffffff',
        borderColor: null
      },
      typography: {
        fontFamily: 'Plus Jakarta Sans',
        headingColor: '#0f172a',
        bioColor: '#64748b'
      },
      catalogLayout: 'list',
      socialLinksStyle: 'monochrome',
      ...BASE_EXTENSIONS
    }
  },
  'pastel-mint': {
    name: 'Soft Sage & Mint',
    description: 'Nuansa gradien sage lembut yang menenangkan & ramah bagi siswa',
    badge: 'Lembut',
    config: {
      preset: 'pastel-mint',
      background: {
        type: 'gradient',
        value: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%)',
        imageUrl: null
      },
      button: {
        style: 'fill',
        radius: 'pill',
        bgColor: '#0D5B52',
        textColor: '#ffffff',
        borderColor: null
      },
      typography: {
        fontFamily: 'Outfit',
        headingColor: '#064e3b',
        bioColor: '#047857'
      },
      catalogLayout: 'grid',
      socialLinksStyle: 'colored',
      ...BASE_EXTENSIONS
    }
  },
  'academic-navy': {
    name: 'Academic Soft Blue',
    description: 'Gradien biru es halus yang formal & kredibel untuk institusi pendidikan',
    badge: 'Formal',
    config: {
      preset: 'academic-navy',
      background: {
        type: 'gradient',
        value: 'linear-gradient(180deg, #f0f7ff 0%, #f8fafc 100%)',
        imageUrl: null
      },
      button: {
        style: 'fill',
        radius: 'pill',
        bgColor: '#1e40af',
        textColor: '#ffffff',
        borderColor: null
      },
      typography: {
        fontFamily: 'Inter',
        headingColor: '#1e3a8a',
        bioColor: '#2563eb'
      },
      catalogLayout: 'grid',
      socialLinksStyle: 'pill',
      ...BASE_EXTENSIONS
    }
  },
  'warm-terracotta': {
    name: 'Warm Ivory & Sand',
    description: 'Nuansa krem hangat bersahabat, cocok untuk modul ajar PAUD/SD & materi kreatif',
    badge: 'Hangat',
    config: {
      preset: 'warm-terracotta',
      background: {
        type: 'gradient',
        value: 'linear-gradient(180deg, #fdfbf7 0%, #f9f6f0 100%)',
        imageUrl: null
      },
      button: {
        style: 'shadow-soft',
        radius: 'rounded',
        bgColor: '#c2410c',
        textColor: '#ffffff',
        borderColor: null
      },
      typography: {
        fontFamily: 'Outfit',
        headingColor: '#451a03',
        bioColor: '#78350f'
      },
      catalogLayout: 'grid',
      socialLinksStyle: 'colored',
      ...BASE_EXTENSIONS
    }
  }
};

export const GRADIENT_OPTIONS = [
  { label: 'Asisten Guru Mint', value: 'linear-gradient(180deg, #f0fdf9 0%, #f5f5f4 100%)', isDark: false },
  { label: 'Airy Sage', value: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%)', isDark: false },
  { label: 'Warm Sand', value: 'linear-gradient(180deg, #fdfbf7 0%, #f9f6f0 100%)', isDark: false },
  { label: 'Academic Soft Blue', value: 'linear-gradient(180deg, #f0f7ff 0%, #f8fafc 100%)', isDark: false },
  { label: 'Clean Slate Fog', value: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', isDark: false },
  { label: 'Executive Deep Teal', value: 'linear-gradient(180deg, #073832 0%, #0d5b52 100%)', isDark: true }
];

export const SOLID_OPTIONS = [
  { label: 'Stone Light (Asisten Guru)', value: '#f5f5f4' },
  { label: 'Pure White', value: '#ffffff' },
  { label: 'Soft Ivory', value: '#fdfbf7' },
  { label: 'Soft Sage', value: '#f0fdf4' },
  { label: 'Deep Brand Teal', value: '#073832' },
  { label: 'Minimal Dark', value: '#0f172a' }
];

export const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
