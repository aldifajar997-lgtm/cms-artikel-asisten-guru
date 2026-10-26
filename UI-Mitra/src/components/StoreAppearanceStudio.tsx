import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles, Check, ExternalLink, Share2, QrCode, RefreshCw,
  Undo2, CheckCircle2, MessageCircle, Copy
} from 'lucide-react';
import { UserProfile, Product, StoreAppearanceConfig, SectionBlockType, FaqItem } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useShortLink } from '../hooks/useShortLink';
import { extractYouTubeId } from '../utils/videoParser';
import { DEFAULT_TEACHER_FAQ_TEMPLATES } from '../constants/faqTemplates';
import { FontCategory, loadGoogleFont } from '../constants/fonts';

// Konstanta & Utilitas
import { PRESET_THEMES } from './store-appearance/constants';
import { calculateContrastTextColor, isColorLight } from './store-appearance/utils';

// Sub-Komponen Editor
import { StoreSlugSection } from './store-appearance/editor/StoreSlugSection';
import { ThemePresetSection } from './store-appearance/editor/ThemePresetSection';
import { BackgroundSection } from './store-appearance/editor/BackgroundSection';
import { ButtonSection } from './store-appearance/editor/ButtonSection';
import { TypographySection } from './store-appearance/editor/TypographySection';
import { SectionManagerSection } from './store-appearance/editor/SectionManagerSection';
import { SocialLinksSection } from './store-appearance/editor/SocialLinksSection';
import { VideoTeaserSection } from './store-appearance/editor/VideoTeaserSection';
import { FeaturedProductSection } from './store-appearance/editor/FeaturedProductSection';
import { FaqSection } from './store-appearance/editor/FaqSection';

// Sub-Komponen Preview
import { MobileStorePreview } from './store-appearance/preview/MobileStorePreview';

// Sub-Komponen Modal
import { ConfirmSlugModal } from './store-appearance/modals/ConfirmSlugModal';
import { StoreQrModal } from './store-appearance/modals/StoreQrModal';
import { FontExplorerModal } from './store-appearance/modals/FontExplorerModal';

export interface StoreAppearanceStudioProps {
  profile: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  onNavigateToProducts?: () => void;
}

export const StoreAppearanceStudio: React.FC<StoreAppearanceStudioProps> = ({
  profile,
  onUpdateProfile,
  onNavigateToProducts
}) => {
  const { success, error: showError, showToast } = useToast();

  // Integrasi Hook Shortlink Resmi Hub Asisten Guru (Mendukung Vanity URL Personal)
  const { canonicalUrl, vanityUrl, activeUrl, isLoading: isLoadingShort, shareLinks } = useShortLink({
    sellerId: profile.id || '',
    storeName: profile.store_name || profile.name,
    storeSlug: profile.store_slug
  });

  // --- State Vanity URL Toko (asisten-guru.id/:namatoko) ---
  const isApprovedSeller = profile.seller_status === 'approved' || profile.role === 'super_admin';
  const hasPermanentSlug = Boolean(profile.store_slug);

  const [storeSlugInput, setStoreSlugInput] = useState(profile.store_slug || '');
  const [slugValidation, setSlugValidation] = useState<{
    checking: boolean;
    available?: boolean;
    isCurrent?: boolean;
    message?: string;
  }>({
    checking: false,
    available: Boolean(profile.store_slug),
    isCurrent: true,
    message: profile.store_slug ? 'Tautan toko Anda aktif.' : undefined
  });
  const [slugDisclaimerAgreed, setSlugDisclaimerAgreed] = useState(false);
  const [showConfirmSlugModal, setShowConfirmSlugModal] = useState(false);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const checkSlugDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setStoreSlugInput(profile.store_slug || '');
  }, [profile.store_slug]);

  useEffect(() => {
    if (hasPermanentSlug) return; // Tidak perlu pengecekan jika slug sudah terkunci permanen

    const raw = storeSlugInput.trim().toLowerCase();
    if (!raw) {
      setSlugValidation({ checking: false, available: false, message: 'Masukkan nama tautan toko unik Anda.' });
      return;
    }

    if (raw.length < 3) {
      setSlugValidation({ checking: false, available: false, message: 'Tautan toko minimal 3 karakter.' });
      return;
    }

    if (checkSlugDebounceRef.current) clearTimeout(checkSlugDebounceRef.current);

    setSlugValidation({ checking: true });

    checkSlugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/check-slug', { params: { slug: raw } });
        if (res.data?.available) {
          setSlugValidation({ checking: false, available: true, message: res.data.message || 'Tautan tersedia dan dapat digunakan!' });
        } else {
          setSlugValidation({ checking: false, available: false, message: res.data?.reason || 'Tautan tidak tersedia.' });
        }
      } catch {
        setSlugValidation({ checking: false, available: false, message: 'Gagal memeriksa ketersediaan tautan.' });
      }
    }, 400);

    return () => {
      if (checkSlugDebounceRef.current) clearTimeout(checkSlugDebounceRef.current);
    };
  }, [storeSlugInput, hasPermanentSlug]);

  const handleOpenConfirmSlug = () => {
    if (hasPermanentSlug) {
      showError('Tautan toko Anda sudah aktif permanen seumur hidup dan tidak dapat diubah.');
      return;
    }
    if (!isApprovedSeller) {
      showError('Pembuatan tautan toko khusus hanya dapat dilakukan setelah status kemitraan Anda resmi disetujui oleh tim kurator.');
      return;
    }
    const clean = storeSlugInput.trim().toLowerCase();
    if (!clean) {
      showError('Tautan toko tidak boleh kosong.');
      return;
    }
    if (!slugValidation.available) {
      showError(slugValidation.message || 'Tautan toko belum valid atau tidak tersedia.');
      return;
    }
    if (!slugDisclaimerAgreed) {
      showError('Anda wajib mencentang persetujuan bahwa tautan toko ini bersifat permanen seumur hidup.');
      return;
    }
    setShowConfirmSlugModal(true);
  };

  const handleConfirmPermanentSlug = async () => {
    setShowConfirmSlugModal(false);
    const clean = storeSlugInput.trim().toLowerCase();
    setIsSavingSlug(true);
    try {
      await api.put('/users/me', { store_slug: clean });
      success(`Selamat! Tautan toko permanen Anda resmi aktif di asisten-guru.id/${clean}`);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          store_slug: clean
        });
      }
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setIsSavingSlug(false);
    }
  };

  // URL QR Code Real-Time Toko (Di-memoize aman untuk unduhan & modal)
  const qrCodeUrl = useMemo(() => {
    if (!activeUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(activeUrl)}&margin=10`;
  }, [activeUrl]);

  // State Konfigurasi Tema (Deep Merge dengan Fallback & Rekonsiliasi Seksi Lengkap)
  const initialConfig: StoreAppearanceConfig = useMemo(() => {
    const base = PRESET_THEMES['emerald-scholar'].config;
    const raw = profile.store_appearance || ({} as any);

    // Rekonsiliasi sectionsOrder: Profile selalu wajib di urutan teratas (index 0)
    let reconciledSections: SectionBlockType[] = [...base.sectionsOrder];
    if (Array.isArray(raw.sectionsOrder)) {
      const validSections: SectionBlockType[] = raw.sectionsOrder.filter((s: unknown): s is SectionBlockType => 
        typeof s === 'string' && base.sectionsOrder.includes(s as SectionBlockType)
      );
      const uniqueValid: SectionBlockType[] = Array.from(new Set<SectionBlockType>(validSections));
      const missingSections: SectionBlockType[] = base.sectionsOrder.filter((s: SectionBlockType) => !uniqueValid.includes(s));
      const withoutProfile: SectionBlockType[] = [...uniqueValid, ...missingSections].filter((s: SectionBlockType) => s !== 'profile');
      reconciledSections = ['profile', ...withoutProfile];
    }

    // Pre-populasi otomatis akun media sosial dari Pengaturan Profil jika belum ada di tampilan toko
    const rawSocial = raw.socialLinks || {};
    const mergedSocialLinks = {
      ...base.socialLinks,
      ...rawSocial,
      instagram: rawSocial.instagram ?? profile.socialInstagram ?? (profile as any).social_instagram ?? null,
      tiktok: rawSocial.tiktok ?? profile.socialTiktok ?? (profile as any).social_tiktok ?? null,
      youtube: rawSocial.youtube ?? (profile as any).socialYoutube ?? (profile as any).social_youtube ?? null,
      linkedin: rawSocial.linkedin ?? profile.socialLinkedin ?? (profile as any).social_linkedin ?? null,
      facebook: rawSocial.facebook ?? profile.socialFacebook ?? (profile as any).social_facebook ?? null,
      whatsapp: rawSocial.whatsapp ?? profile.phone_number ?? null
    };

    // Migrasi otomatis jika konfigurasi seller masih memakai gradien gelap default lama
    const rawBg = raw.background ? { ...raw.background } : undefined;
    const rawTypo = raw.typography ? { ...raw.typography } : undefined;
    if (rawBg?.value === 'linear-gradient(145deg, #064e3b 0%, #0f172a 100%)') {
      rawBg.value = base.background.value;
      if (rawBg.type !== 'image') {
        rawBg.type = base.background.type;
      }
      if (rawTypo?.headingColor === '#ffffff') {
        rawTypo.headingColor = base.typography.headingColor;
        rawTypo.bioColor = base.typography.bioColor;
      }
    }

    return {
      ...base,
      ...raw,
      background: { ...base.background, ...(rawBg || {}) },
      button: { ...base.button, ...(raw.button || {}) },
      typography: { ...base.typography, ...(rawTypo || {}) },
      sectionsOrder: reconciledSections,
      socialLinks: mergedSocialLinks,
      videoTeaser: { ...base.videoTeaser, ...(raw.videoTeaser || {}) },
      featuredProduct: { ...base.featuredProduct, ...(raw.featuredProduct || {}) },
      faq: {
        ...base.faq,
        ...(raw.faq || {}),
        items: Array.isArray(raw.faq?.items) ? raw.faq.items : []
      }
    };
  }, [profile]);

  const [appearance, setAppearance] = useState<StoreAppearanceConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [isPlayingVideoPreview, setIsPlayingVideoPreview] = useState(false);

  // State Modal Eksplorasi Puluhan Font Google
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [selectedFontCategory, setSelectedFontCategory] = useState<FontCategory>('all');

  // Muat Google Font aktif secara dinamis ke DOM browser
  useEffect(() => {
    if (appearance.typography?.fontFamily) {
      loadGoogleFont(appearance.typography.fontFamily);
    }
  }, [appearance.typography?.fontFamily]);

  // Deteksi Perubahan yang Belum Disimpan (Unsaved Changes Detection)
  const isDirty = useMemo(() => {
    return JSON.stringify(appearance) !== JSON.stringify(initialConfig);
  }, [appearance, initialConfig]);

  // Sinkronisasi state appearance bila profil baru selesai dimuat dari backend
  useEffect(() => {
    if (profile.store_appearance && !isDirty) {
      setAppearance(initialConfig);
    }
  }, [initialConfig, isDirty, profile.store_appearance]);

  // Background Image Upload & Delete State (Double-Click Prevention)
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // State Produk Terpublikasi (Sinkronisasi Otomatis)
  const [publishedProducts, setPublishedProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Search & Filter State untuk Meng-cover Puluhan Produk di Etalase
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [displayLimit, setDisplayLimit] = useState(10);

  // Ambil Data Produk Terpublikasi Resmi Milik Penjual (Hingga 50 item per query)
  useEffect(() => {
    let isMounted = true;
    const fetchPublishedProducts = async () => {
      const sellerId = profile.id;
      if (!sellerId) {
        setIsLoadingProducts(false);
        return;
      }

      setIsLoadingProducts(true);
      try {
        const res = await api.get(`/products/public?seller_id=${encodeURIComponent(sellerId)}&limit=50`);
        const list: Product[] = res.data?.data || [];
        const total: number = res.data?.total || list.length;
        if (isMounted) {
          setPublishedProducts(list);
          setTotalProducts(total);
        }
      } catch (err) {
        console.warn('Gagal memuat katalog terpublikasi untuk etalase:', err);
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    };

    fetchPublishedProducts();
    return () => { isMounted = false; };
  }, [profile.id]);

  // Handler Pilih Preset: Hanya menerapkan visual styling, menjaga data konten guru tetap aman
  const handleSelectPreset = (key: string) => {
    if (PRESET_THEMES[key]) {
      const presetConfig = PRESET_THEMES[key].config;
      setAppearance(prev => ({
        ...prev,
        preset: presetConfig.preset,
        background: { ...presetConfig.background },
        button: { ...presetConfig.button },
        typography: { ...presetConfig.typography },
        catalogLayout: presetConfig.catalogLayout,
        socialLinks: {
          ...prev.socialLinks,
          style: presetConfig.socialLinks?.style || 'colored'
        }
      }));
    }
  };

  // Handler Ganti Warna Background Solid dengan Auto Contrast Teks
  const handleSolidBgChange = (color: string) => {
    const isLightBg = calculateContrastTextColor(color) === '#0f172a';
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      background: { ...prev.background, type: 'color', value: color },
      typography: {
        ...prev.typography,
        headingColor: isLightBg ? '#0f172a' : '#ffffff',
        bioColor: isLightBg ? '#475569' : '#cbd5e1'
      }
    }));
  };

  // Handler Update Tombol dengan Smart Contrast Guard
  const handleButtonColorChange = (color: string) => {
    const textColor = calculateContrastTextColor(color);
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      button: {
        ...prev.button,
        bgColor: color,
        textColor: textColor
      }
    }));
  };

  // Handler Pindah Urutan Blok Seksi (Naik / Turun)
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (appearance.sectionsOrder[index] === 'profile') return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex <= 0 || targetIndex >= appearance.sectionsOrder.length) return;
    const newOrder = [...appearance.sectionsOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      sectionsOrder: newOrder
    }));
  };

  // Handler Toggle Aktif/Nonaktif Seksi
  const handleToggleSectionEnabled = (section: SectionBlockType) => {
    setAppearance(prev => {
      const updated = { ...prev, preset: 'custom' as const };
      if (section === 'social_links') {
        updated.socialLinks = { ...updated.socialLinks, enabled: !updated.socialLinks?.enabled };
      } else if (section === 'video_teaser') {
        updated.videoTeaser = { ...updated.videoTeaser, enabled: !updated.videoTeaser?.enabled };
      } else if (section === 'featured_product') {
        updated.featuredProduct = { ...updated.featuredProduct, enabled: !updated.featuredProduct?.enabled };
      } else if (section === 'faq') {
        updated.faq = { ...updated.faq, enabled: !updated.faq?.enabled };
      }
      return updated;
    });
  };

  // Cek Status Aktif Seksi
  const isSectionEnabled = (section: SectionBlockType) => {
    if (section === 'profile' || section === 'catalog') return true;
    if (section === 'social_links') return appearance.socialLinks.enabled;
    if (section === 'video_teaser') return appearance.videoTeaser.enabled;
    if (section === 'featured_product') return appearance.featuredProduct.enabled;
    if (section === 'faq') return appearance.faq.enabled;
    return true;
  };

  // Handler Tambah Pertanyaan FAQ
  const handleAddFaqItem = () => {
    if (appearance.faq.items.length >= 10) {
      showError('Maksimal 10 pertanyaan FAQ telah tercapai.');
      return;
    }
    const newItem: FaqItem = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: ''
    };
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      faq: {
        ...prev.faq,
        enabled: true,
        items: [...prev.faq.items, newItem]
      }
    }));
  };

  // Handler Perbarui Pertanyaan/Jawaban FAQ
  const handleUpdateFaqItem = (id: string, field: 'question' | 'answer', value: string) => {
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      faq: {
        ...prev.faq,
        items: prev.faq.items.map(item => item.id === id ? { ...item, [field]: value } : item)
      }
    }));
  };

  // Handler Hapus Pertanyaan FAQ
  const handleRemoveFaqItem = (id: string) => {
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      faq: {
        ...prev.faq,
        items: prev.faq.items.filter(item => item.id !== id)
      }
    }));
  };

  // Handler Terapkan Template FAQ Guru
  const handleLoadFaqTemplate = () => {
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      faq: {
        ...prev.faq,
        enabled: true,
        items: [...DEFAULT_TEACHER_FAQ_TEMPLATES]
      }
    }));
    success('Template FAQ kurikulum guru berhasil diterapkan!');
  };

  // Deteksi jika modul unggulan yang tersimpan sudah tidak ada atau dihapus dari katalog terpublikasi
  const isFeaturedProductStale = useMemo(() => {
    if (!appearance.featuredProduct.enabled || !appearance.featuredProduct.productId) return false;
    if (isLoadingProducts) return false;
    return !publishedProducts.some(p => p.id === appearance.featuredProduct.productId);
  }, [appearance.featuredProduct, isLoadingProducts, publishedProducts]);

  // Ekstraksi ID YouTube
  const youtubeVideoId = useMemo(() => {
    return extractYouTubeId(appearance.videoTeaser.videoUrl);
  }, [appearance.videoTeaser.videoUrl]);

  // Handler Unduh QR Code Resmi Toko
  const handleDownloadQr = async () => {
    if (!activeUrl || !qrCodeUrl) return;
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `qrcode-toko-${(profile.store_name || profile.name || 'mitra').toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      success('QR Code toko berhasil diunduh.');
    } catch {
      window.open(qrCodeUrl, '_blank');
    }
  };

  // Handler Salin Link
  const handleCopyLink = () => {
    if (!activeUrl) return;
    navigator.clipboard.writeText(activeUrl);
    setCopiedLink(true);
    success('Tautan resmi toko berhasil disalin!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handler Upload Background Kustom
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (isUploadingBg) return;
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showError('Ukuran gambar latar belakang maksimal 3MB.');
      if (bgInputRef.current) bgInputRef.current.value = '';
      return;
    }

    setIsUploadingBg(true);
    const formData = new FormData();
    formData.append('background', file);

    try {
      const res = await api.post('/users/me/appearance/background', formData);
      if (res.data?.image_url) {
        const updatedConfig: StoreAppearanceConfig = {
          ...appearance,
          preset: 'custom',
          background: {
            ...appearance.background,
            type: 'image',
            imageUrl: res.data.image_url
          }
        };
        setAppearance(updatedConfig);
        if (onUpdateProfile) {
          onUpdateProfile({
            ...profile,
            store_appearance: updatedConfig
          });
        }
        success('Gambar latar belakang berhasil diperbarui.');
      }
    } catch (err) {
      console.error('Upload background error:', err);
      showError(handleApiError(err));
    } finally {
      setIsUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  // Handler Hapus Background Kustom
  const handleRemoveBgImage = async () => {
    try {
      await api.delete('/users/me/appearance/background');
      const updatedConfig: StoreAppearanceConfig = {
        ...appearance,
        preset: 'custom',
        background: {
          ...appearance.background,
          type: appearance.background.type === 'image' ? 'gradient' : appearance.background.type,
          value: appearance.background.value.startsWith('linear-gradient')
            ? appearance.background.value
            : 'linear-gradient(180deg, #f0fdf9 0%, #f5f5f4 100%)',
          imageUrl: null
        }
      };
      setAppearance(updatedConfig);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          store_appearance: updatedConfig
        });
      }
      success('Gambar latar belakang kustom dihapus.');
    } catch (err) {
      showError(handleApiError(err));
    }
  };

  // Handler Simpan Konfigurasi ke Server
  const handleSaveAppearance = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const sanitizedFaqItems = (appearance.faq?.items || [])
        .filter(item => item.question && item.question.trim().length > 0 && item.answer && item.answer.trim().length > 0)
        .map(item => ({
          ...item,
          question: item.question.trim(),
          answer: item.answer.trim()
        }));

      let sanitizedFeaturedProduct = { ...appearance.featuredProduct };
      if (sanitizedFeaturedProduct.enabled) {
        if (!sanitizedFeaturedProduct.productId || !sanitizedFeaturedProduct.productId.trim()) {
          sanitizedFeaturedProduct.enabled = false;
          sanitizedFeaturedProduct.productId = null;
        } else {
          const productExists = publishedProducts.some(p => p.id === sanitizedFeaturedProduct.productId);
          if (!productExists && !isLoadingProducts) {
            sanitizedFeaturedProduct = {
              ...sanitizedFeaturedProduct,
              productId: null,
              enabled: false
            };
          }
        }
      }

      const sanitizedSocialLinks = {
        ...appearance.socialLinks,
        whatsapp: appearance.socialLinks.whatsapp?.trim() || null,
        instagram: appearance.socialLinks.instagram?.trim() || null,
        tiktok: appearance.socialLinks.tiktok?.trim() || null,
        youtube: appearance.socialLinks.youtube?.trim() || null,
        linkedin: appearance.socialLinks.linkedin?.trim() || null,
        facebook: appearance.socialLinks.facebook?.trim() || null
      };

      const sanitizedVideoTeaser = {
        ...appearance.videoTeaser,
        title: appearance.videoTeaser.title?.trim() || null,
        videoUrl: appearance.videoTeaser.videoUrl?.trim() || null
      };

      const payloadToSave: StoreAppearanceConfig = {
        ...appearance,
        socialLinks: sanitizedSocialLinks,
        videoTeaser: sanitizedVideoTeaser,
        featuredProduct: sanitizedFeaturedProduct,
        faq: {
          ...appearance.faq,
          title: appearance.faq.title?.trim() || 'Pertanyaan yang Sering Diajukan (FAQ)',
          items: sanitizedFaqItems
        }
      };

      const res = await api.put('/users/me/appearance', payloadToSave);
      if (res.data?.success) {
        setAppearance(payloadToSave);
        success('Tampilan etalase toko berhasil disimpan!');
        if (onUpdateProfile) {
          onUpdateProfile({
            ...profile,
            store_appearance: payloadToSave
          });
        }
      }
    } catch (err) {
      console.error('Simpan tampilan toko error:', err);
      showError(handleApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Handler: 1-Klik Optimalkan Keterbacaan saat wallpaper bergambar dipakai
  const handleAutoOptimizeReadability = () => {
    setAppearance(prev => ({
      ...prev,
      preset: 'custom',
      typography: {
        ...prev.typography,
        cardStyle: 'glass',
        cardBgColor: '#ffffff',
        cardOpacity: 85,
        cardBlur: 'md',
        headingColor: '#0f172a',
        bioColor: '#475569',
        textShadow: 'none'
      }
    }));
    showToast('Keterbacaan profil berhasil dioptimalkan dengan Wadah Kaca Transparan & warna kontras tinggi!', 'success');
  };

  // Deteksi apakah tema etalase saat ini bernuansa terang
  const isLightStoreTheme = useMemo(() => {
    return !isColorLight(appearance.typography.headingColor || '#ffffff');
  }, [appearance.typography.headingColor]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER SECTION: Judul & Bar Bagikan Toko Resmi */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/80 card-shadow relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-brand-teal border border-teal-200/70 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
              <span>Tampilan Toko • Khusus Mitra Penjual</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-stone-900 font-sans">
              Tampilan & Etalase Toko Digital
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 max-w-2xl leading-relaxed">
              Personalisasi estetika halaman etalase mikro Anda layaknya landing page profesional. Produk yang telah terverifikasi kurasi akan otomatis tampil di etalase Anda.
            </p>
          </div>

          {/* Bar Tautan Pendek Sinkron dengan Hub */}
          <div className="bg-stone-50/90 p-4 rounded-2xl border border-stone-200/90 space-y-3 min-w-[320px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-brand-teal" />
                <span>Tautan Resmi Toko Anda</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200/70">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                {profile.store_slug ? 'Vanity URL Aktif' : 'Hub Shortlink Aktif'}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs font-mono shadow-2xs">
              <span className="truncate flex-1 text-stone-800 font-medium">
                {isLoadingShort ? 'Menyiapkan tautan...' : activeUrl}
              </span>
              <button
                onClick={handleCopyLink}
                title="Salin Tautan Pendek"
                className="p-1.5 rounded-lg bg-brand-teal hover:bg-brand-teal-light text-white transition cursor-pointer shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <button
                onClick={() => setIsQrModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold transition border border-stone-200 shadow-2xs cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-stone-600" />
                <span>QR Code</span>
              </button>

              <a
                href={vanityUrl || activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 transition border border-stone-200 shadow-2xs cursor-pointer"
                title="Buka Toko di Tab Baru"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* GRID UTAMA: KOLOM KIRI (KONTROL PENGATURAN) & KOLOM KANAN (LIVE MOBILE MOCKUP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================================================== */}
        {/* KOLOM KIRI: PANEL KONTROL PENGATURAN ESTETIKA (7/12)           */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SEKSI 0: TAUTAN TOKO PERSONAL (VANITY STORE SLUG) */}
          <StoreSlugSection
            profile={profile}
            hasPermanentSlug={hasPermanentSlug}
            isApprovedSeller={isApprovedSeller}
            storeSlugInput={storeSlugInput}
            slugValidation={slugValidation}
            slugDisclaimerAgreed={slugDisclaimerAgreed}
            isSavingSlug={isSavingSlug}
            setStoreSlugInput={setStoreSlugInput}
            setSlugDisclaimerAgreed={setSlugDisclaimerAgreed}
            onOpenConfirmSlug={handleOpenConfirmSlug}
            onCopySuccess={(msg) => success(msg)}
          />

          {/* SEKSI 1: PRESET TEMA EDUKATIF */}
          <ThemePresetSection
            currentPreset={appearance.preset}
            onSelectPreset={handleSelectPreset}
          />

          {/* SEKSI 2: LATAR BELAKANG */}
          <BackgroundSection
            background={appearance.background}
            isUploadingBg={isUploadingBg}
            bgInputRef={bgInputRef}
            setAppearance={setAppearance}
            onSolidBgChange={handleSolidBgChange}
            onBgUpload={handleBgUpload}
            onRemoveBgImage={handleRemoveBgImage}
          />

          {/* SEKSI 3: GAYA TOMBOL & KARTU */}
          <ButtonSection
            button={appearance.button}
            setAppearance={setAppearance}
            onButtonColorChange={handleButtonColorChange}
          />

          {/* SEKSI 4: TIPOGRAFI & KETERBACAAN TEKS */}
          <TypographySection
            typography={appearance.typography}
            catalogLayout={appearance.catalogLayout}
            backgroundType={appearance.background.type}
            setAppearance={setAppearance}
            onOpenFontModal={() => setIsFontModalOpen(true)}
            onAutoOptimizeReadability={handleAutoOptimizeReadability}
          />

          {/* SEKSI 5: URUTAN BLOK HALAMAN */}
          <SectionManagerSection
            sectionsOrder={appearance.sectionsOrder}
            isSectionEnabled={isSectionEnabled}
            onToggleSectionEnabled={handleToggleSectionEnabled}
            onMoveSection={handleMoveSection}
          />

          {/* SEKSI 6: MEDIA SOSIAL & KONTAK GURU */}
          <SocialLinksSection
            socialLinks={appearance.socialLinks}
            setAppearance={setAppearance}
          />

          {/* SEKSI 7: VIDEO PENGANTAR / TEASER */}
          <VideoTeaserSection
            videoTeaser={appearance.videoTeaser}
            youtubeVideoId={youtubeVideoId}
            setAppearance={setAppearance}
          />

          {/* SEKSI 8: SOROT PRODUK UNGGULAN & ANIMASI */}
          <FeaturedProductSection
            featuredProduct={appearance.featuredProduct}
            publishedProducts={publishedProducts}
            isLoadingProducts={isLoadingProducts}
            isFeaturedProductStale={isFeaturedProductStale}
            setAppearance={setAppearance}
          />

          {/* SEKSI 9: TANYA JAWAB (FAQ) */}
          <FaqSection
            faq={appearance.faq}
            setAppearance={setAppearance}
            onLoadFaqTemplate={handleLoadFaqTemplate}
            onAddFaqItem={handleAddFaqItem}
            onRemoveFaqItem={handleRemoveFaqItem}
            onUpdateFaqItem={handleUpdateFaqItem}
          />

          {/* FLOATING ACTION BAR: SIMPAN & RESET */}
          <div className="sticky bottom-6 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-stone-200/90 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectPreset('emerald-scholar')}
                className="py-2.5 px-3.5 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
                title="Terapkan kembali tema standar Emerald Scholar"
              >
                Reset Bawaan
              </button>

              {isDirty && (
                <button
                  type="button"
                  onClick={() => setAppearance(initialConfig)}
                  className="py-2 px-3 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer flex items-center gap-1.5"
                  title="Batalkan perubahan yang belum disimpan dan kembali ke pengaturan tersimpan"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Batalkan</span>
                </button>
              )}

              {isDirty && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Belum Disimpan
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveAppearance}
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-8 rounded-xl bg-brand-teal hover:bg-brand-teal-light text-white text-xs font-extrabold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSaving ? 'Menyimpan Tampilan...' : 'Simpan Perubahan Tampilan'}</span>
            </button>
          </div>

        </div>

        {/* ============================================================== */}
        {/* KOLOM KANAN: LIVE MOBILE MOCKUP INTERAKTIF (5/12)              */}
        {/* ============================================================== */}
        <MobileStorePreview
          appearance={appearance}
          profile={profile}
          publishedProducts={publishedProducts}
          totalProducts={totalProducts}
          isLoadingProducts={isLoadingProducts}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          displayLimit={displayLimit}
          setDisplayLimit={setDisplayLimit}
          openFaqId={openFaqId}
          setOpenFaqId={setOpenFaqId}
          isPlayingVideoPreview={isPlayingVideoPreview}
          setIsPlayingVideoPreview={setIsPlayingVideoPreview}
          youtubeVideoId={youtubeVideoId}
          isLightStoreTheme={isLightStoreTheme}
          onNavigateToProducts={onNavigateToProducts}
        />

      </div>

      {/* ============================================================== */}
      {/* MODAL QR CODE RESMI TOKO                                       */}
      {/* ============================================================== */}
      <StoreQrModal
        isOpen={isQrModalOpen}
        qrCodeUrl={qrCodeUrl}
        activeUrl={activeUrl}
        onClose={() => setIsQrModalOpen(false)}
        onDownloadQr={handleDownloadQr}
        onCopyLink={handleCopyLink}
      />

      {/* ============================================================== */}
      {/* MODAL KONFIRMASI SLUG TOKO PERMANEN SEUMUR HIDUP               */}
      {/* ============================================================== */}
      <ConfirmSlugModal
        isOpen={showConfirmSlugModal}
        storeSlugInput={storeSlugInput}
        isSavingSlug={isSavingSlug}
        onClose={() => setShowConfirmSlugModal(false)}
        onConfirm={handleConfirmPermanentSlug}
      />

      {/* ============================================================== */}
      {/* MODAL JELAJAHI PULUHAN FONT GOOGLE TERKURASI (36 FONT)         */}
      {/* ============================================================== */}
      <FontExplorerModal
        isOpen={isFontModalOpen}
        currentFontFamily={appearance.typography.fontFamily}
        fontSearch={fontSearch}
        selectedFontCategory={selectedFontCategory}
        onClose={() => setIsFontModalOpen(false)}
        onSearchChange={setFontSearch}
        onCategoryChange={setSelectedFontCategory}
        onSelectFont={(fontFamily) => {
          setAppearance(prev => ({
            ...prev,
            preset: 'custom',
            typography: { ...prev.typography, fontFamily }
          }));
          setIsFontModalOpen(false);
        }}
      />

    </div>
  );
};
