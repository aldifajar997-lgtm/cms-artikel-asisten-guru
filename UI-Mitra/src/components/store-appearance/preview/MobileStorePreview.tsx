import React, { useMemo } from 'react';
import {
  Smartphone, CreditCard, ShieldCheck, Share2, MessageCircle, Instagram,
  Youtube, Linkedin, Facebook, Video, Play, Flame, Sparkles,
  ArrowUpRight, ShoppingBag, Search, RefreshCw, Star, ChevronDown,
  HelpCircle, Link as LinkIcon
} from 'lucide-react';
import { UserProfile, Product, StoreAppearanceConfig, SectionBlockType } from '../../../types';
import { getMediaUrl } from '../../../utils/mediaUrl';
import { getSafeYouTubeEmbedUrl } from '../../../utils/videoParser';
import {
  getProfileCardStyle, getTextShadowStyle, getCleanWhatsAppUrl,
  resolveSocialUrl, getFeaturedAnimationClass, getButtonRadiusClass,
  getButtonStyleProps
} from '../utils';

export interface MobileStorePreviewProps {
  appearance: StoreAppearanceConfig;
  profile: UserProfile;
  publishedProducts: Product[];
  totalProducts: number;
  isLoadingProducts: boolean;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  displayLimit: number;
  setDisplayLimit: React.Dispatch<React.SetStateAction<number>>;
  openFaqId: string | null;
  setOpenFaqId: (id: string | null) => void;
  isPlayingVideoPreview: boolean;
  setIsPlayingVideoPreview: (val: boolean) => void;
  youtubeVideoId: string | null;
  isLightStoreTheme: boolean;
  onNavigateToProducts?: () => void;
}

export const MobileStorePreview: React.FC<MobileStorePreviewProps> = ({
  appearance,
  profile,
  publishedProducts,
  totalProducts,
  isLoadingProducts,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  displayLimit,
  setDisplayLimit,
  openFaqId,
  setOpenFaqId,
  isPlayingVideoPreview,
  setIsPlayingVideoPreview,
  youtubeVideoId,
  isLightStoreTheme,
  onNavigateToProducts
}) => {
  // Ekstrak Kategori Unik dari Produk Penjual
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    publishedProducts.forEach(p => {
      if ((p as any).category_name) cats.add((p as any).category_name);
    });
    return Array.from(cats);
  }, [publishedProducts]);

  // Filter Produk Berdasarkan Pencarian & Kategori
  const filteredProducts = useMemo(() => {
    return publishedProducts.filter(p => {
      const matchesSearch = !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCat = selectedCategory === 'all' || (p as any).category_name === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [publishedProducts, searchQuery, selectedCategory]);

  // Paginasi / Limit Produk yang Tampil di Simulasi HP
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  // Produk Unggulan yang Dipilih
  const featuredProductItem = useMemo(() => {
    if (!appearance.featuredProduct.enabled || !appearance.featuredProduct.productId) return null;
    return publishedProducts.find(p => p.id === appearance.featuredProduct.productId) || null;
  }, [appearance.featuredProduct, publishedProducts]);

  // Cek Status Aktif Seksi
  const isSectionEnabled = (section: SectionBlockType) => {
    if (section === 'profile' || section === 'catalog') return true;
    if (section === 'social_links') return appearance.socialLinks.enabled;
    if (section === 'video_teaser') return appearance.videoTeaser.enabled;
    if (section === 'featured_product') return appearance.featuredProduct.enabled;
    if (section === 'faq') return appearance.faq.enabled;
    return true;
  };

  return (
    <div className="lg:col-span-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto scrollbar-none flex flex-col items-center pb-6">
      
      <div className="text-center mb-2">
        <span className="text-xs font-bold text-stone-500 flex items-center justify-center gap-1.5">
          <Smartphone className="w-4 h-4 text-brand-teal" />
          <span>Simulasi Layar Smartphone Pembeli</span>
        </span>
      </div>

      {/* Callout Fitur Direct Hub Checkout */}
      <div className="w-[340px] sm:w-[360px] mb-3.5 p-3 bg-teal-50/80 border border-teal-200/90 rounded-2xl flex items-start gap-2.5 text-left shadow-xs">
        <div className="w-7 h-7 rounded-xl bg-teal-100/80 text-brand-teal flex items-center justify-center shrink-0">
          <CreditCard className="w-4 h-4" />
        </div>
        <div className="text-[11px] leading-snug">
          <span className="font-bold text-stone-900 block">Direct Hub Checkout Terintegrasi</span>
          <span className="text-stone-600">
            Setiap klik produk atau tombol Beli mengarahkan pembeli langsung ke halaman Product Detail di Asisten Guru Hub (<code className="font-mono text-brand-teal font-bold">/toko?item=...</code>) untuk transaksi instan.
          </span>
        </div>
      </div>

      {/* BINGKAI SMARTPHONE (REALISTIC IPHONE FRAME) */}
      <div className="w-[340px] sm:w-[360px] h-[680px] bg-stone-900 p-3 rounded-[48px] shadow-2xl border-4 border-stone-800 ring-1 ring-black/40 relative flex flex-col overflow-hidden">
        
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-end px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-800/80 border border-stone-700" />
        </div>

        {/* SCREEN CANVAS (DENGAN TEMA DINAMIS) */}
        <div className={`w-full h-full rounded-[38px] bg-stone-100 overflow-hidden relative flex flex-col ${isLightStoreTheme ? 'text-stone-900' : 'text-white'}`}>
          {/* FIXED WALLPAPER BACKGROUND LAYER (Anti-Tiling & Anti-Tear saat scroll katalog panjang) */}
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-300"
            style={{
              backgroundImage: appearance.background.type === 'image' && appearance.background.imageUrl
                ? `linear-gradient(to bottom, rgba(15, 23, 42, 0.20) 0%, rgba(15, 23, 42, 0.50) 100%), url("${getMediaUrl(appearance.background.imageUrl)}")`
                : appearance.background.type === 'gradient'
                ? appearance.background.value
                : 'none',
              backgroundColor: appearance.background.type === 'color'
                ? appearance.background.value
                : '#f8fafc',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />

          {/* SCROLLABLE INNER STORE CONTAINER */}
          <div 
            className="w-full h-full overflow-y-auto overflow-x-hidden relative z-10 flex flex-col scrollbar-none transition-all duration-300"
            style={{
              fontFamily: appearance.typography.fontFamily
            }}
          >
            {/* Status Bar */}
            <div 
              className="h-10 pt-2 px-6 flex items-center justify-between text-[11px] font-bold shrink-0 z-20"
              style={{ color: appearance.typography.headingColor }}
            >
              <span>09:41</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px]">5G</span>
                <div className="w-5 h-2.5 rounded-sm border p-0.5 flex items-center" style={{ borderColor: `${appearance.typography.headingColor}99` }}>
                  <div className="w-full h-full rounded-xs" style={{ backgroundColor: appearance.typography.headingColor }} />
                </div>
              </div>
            </div>

            {/* Top Minimal Action Bar (1:1 Hub) */}
            <div className="flex items-center justify-between py-2 px-4 mb-1 z-20 shrink-0">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/10 text-white/90 text-[10px] font-semibold">
                <ShieldCheck className="w-3 h-3 text-teal-400" />
                <span>Etalase Resmi</span>
              </div>
              <div
                className="p-1.5 rounded-full bg-black/35 backdrop-blur-md border border-white/10 text-white shadow-xs"
                title="Bagikan Tautan Toko Ini"
              >
                <Share2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* KONTEN DINAMIS TOKO DI DALAM MOCKUP (MODULAR BLOCKS ENGINE) */}
            <div className="px-4 pb-8 space-y-4 relative z-10 flex-1">

              {appearance.sectionsOrder.map((sectionId) => {
                if (!isSectionEnabled(sectionId)) return null;

                // 1. BLOK PROFIL & IDENTITAS TOKO (1:1 DENGAN ASISTEN-GURU HUB)
                if (sectionId === 'profile') {
                  const hasCard = appearance.typography.cardStyle && appearance.typography.cardStyle !== 'none';
                  const hasCover = Boolean(profile.coverUrl);
                  const storeDisplayName = profile.store_name || profile.name || 'Toko Digital Mitra';
                  const storeDisplayBio = profile.store_description || profile.bio;

                  return (
                    <div key="profile" className="w-full flex flex-col items-center">
                      {/* Banner / Cover Toko di dalam section profile (1:1 Hub) */}
                      {hasCover && (
                        <div className="w-full h-28 sm:h-32 rounded-2xl overflow-hidden shadow-md border border-white/15 relative z-0">
                          <img
                            src={getMediaUrl(profile.coverUrl!)}
                            alt="Banner Toko"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Avatar Box jika ADA Cover: Mengambang di atas perbatasan batas bawah cover (-mt-10 mb-[-20px]) */}
                      {hasCover && (
                        <div className={`w-18 h-18 rounded-2xl bg-white p-1 shadow-2xl overflow-hidden border-2 relative z-30 shrink-0 -mt-9 mb-[-20px] ${
                          isLightStoreTheme ? 'border-stone-200' : 'border-white/90'
                        }`}>
                          {profile.avatarUrl ? (
                            <img
                              src={getMediaUrl(profile.avatarUrl)}
                              alt={storeDisplayName}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-full h-full rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-2xl">
                              {storeDisplayName.charAt(0)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Wadah Profil (Kartu Glass / Soft / Solid / None) */}
                      <div
                        className={`flex flex-col items-center text-center transition-all duration-300 w-full relative z-10 ${
                          hasCover ? 'pt-7 mt-0' : 'mt-0'
                        } ${
                          hasCard ? 'px-4 pb-5 rounded-3xl' : ''
                        }`}
                        style={getProfileCardStyle(appearance.typography)}
                      >
                        {/* Avatar Box jika TIDAK ADA Cover: Berada di dalam kartu seperti biasa */}
                        {!hasCover && (
                          <div className={`w-18 h-18 rounded-2xl bg-white p-1 shadow-md overflow-hidden border-2 ${
                            isLightStoreTheme ? 'border-stone-200' : 'border-white/80'
                          } shrink-0`}>
                            {profile.avatarUrl ? (
                              <img
                                src={getMediaUrl(profile.avatarUrl)}
                                alt={storeDisplayName}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <div className="w-full h-full rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-2xl">
                                {storeDisplayName.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Judul Toko */}
                        <h3
                          className="mt-2.5 text-base sm:text-lg font-extrabold tracking-tight leading-tight"
                          style={{
                            color: appearance.typography.headingColor,
                            ...getTextShadowStyle(appearance.typography.textShadow, appearance.typography.headingColor)
                          }}
                        >
                          {storeDisplayName}
                        </h3>

                        {/* Lencana Mitra Terverifikasi Resmi */}
                        <div className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isLightStoreTheme
                            ? 'bg-teal-50 text-brand-teal border border-teal-200/80'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                        }`}>
                          <ShieldCheck className="w-3 h-3 text-teal-500" />
                          <span>Mitra Terverifikasi</span>
                        </div>

                        {/* Subtitle / Pemilik jika nama berbeda (1:1 Hub) */}
                        {profile.store_name && profile.store_name !== profile.name && profile.name && (
                          <p
                            className="text-[10px] font-semibold opacity-85 mt-1"
                            style={{
                              color: appearance.typography.bioColor,
                              ...getTextShadowStyle(appearance.typography.textShadow, appearance.typography.bioColor)
                            }}
                          >
                            Karya & Kurasi oleh <strong className="underline underline-offset-2">{profile.name}</strong>
                          </p>
                        )}

                        {/* Deskripsi / Bio */}
                        {storeDisplayBio ? (
                          <p
                            className="mt-2 text-[11px] leading-relaxed max-w-[260px] line-clamp-3"
                            style={{
                              color: appearance.typography.bioColor,
                              ...getTextShadowStyle(appearance.typography.textShadow, appearance.typography.bioColor)
                            }}
                          >
                            {storeDisplayBio}
                          </p>
                        ) : (
                          <p
                            className="mt-2 text-[11px] leading-relaxed max-w-[260px] opacity-85"
                            style={{
                              color: appearance.typography.bioColor,
                              ...getTextShadowStyle(appearance.typography.textShadow, appearance.typography.bioColor)
                            }}
                          >
                            Menyediakan modul ajar, perangkat kurikulum, dan media edukasi digital berkualitas.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // 2. BLOK MEDIA SOSIAL & KONTAK GURU
                if (sectionId === 'social_links') {
                  const links = appearance.socialLinks;
                  const waUrl = getCleanWhatsAppUrl(links.whatsapp, profile.store_name || profile.name || 'Guru');
                  const igUrl = resolveSocialUrl('instagram', links.instagram);
                  const ttUrl = resolveSocialUrl('tiktok', links.tiktok);
                  const ytUrl = resolveSocialUrl('youtube', links.youtube);
                  const liUrl = resolveSocialUrl('linkedin', links.linkedin);
                  const fbUrl = resolveSocialUrl('facebook', links.facebook);
                  const hasAnySocial = igUrl || ttUrl || ytUrl || liUrl || fbUrl;
                  const style = links.style;

                  return (
                    <div key="social_links" className="space-y-2.5 text-center">
                      {/* Tombol Utama Chat WhatsApp Guru (1:1 Hub) */}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition transform hover:-translate-y-0.5 no-underline cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat / Tanya via WhatsApp</span>
                        </a>
                      )}

                      {/* Deretan Ikon Akun Media Sosial (1:1 Hub) */}
                      {hasAnySocial && (
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                          {igUrl && (
                            <a
                              href={igUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-pink-400 hover:text-white transition shadow-xs"
                              title="Instagram"
                            >
                              <Instagram className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {ttUrl && (
                            <a
                              href={ttUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-white transition shadow-xs font-bold text-[10px]"
                              title="TikTok"
                            >
                              <span>TT</span>
                            </a>
                          )}

                          {ytUrl && (
                            <a
                              href={ytUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-red-500 hover:text-white transition shadow-xs"
                              title="YouTube"
                            >
                              <Youtube className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {liUrl && (
                            <a
                              href={liUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-sky-400 hover:text-white transition shadow-xs"
                              title="LinkedIn"
                            >
                              <Linkedin className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {fbUrl && (
                            <a
                              href={fbUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-blue-400 hover:text-white transition shadow-xs"
                              title="Facebook"
                            >
                              <Facebook className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {profile.portfolioUrl && (
                            <a
                              href={profile.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-teal-400 hover:text-white transition shadow-xs"
                              title="Website Resmi"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // 3. BLOK VIDEO PENGANTAR / TEASER YOUTUBE
                if (sectionId === 'video_teaser') {
                  return (
                    <div key="video_teaser" className="space-y-1.5 pt-1">
                      {appearance.videoTeaser.title && (
                        <div 
                          className="text-xs font-bold leading-tight flex items-center gap-1.5"
                          style={{ color: appearance.typography.headingColor }}
                        >
                          <Video className="w-3.5 h-3.5 text-teal-400" />
                          <span>{appearance.videoTeaser.title}</span>
                        </div>
                      )}

                      {youtubeVideoId ? (
                        <div className={`rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-black relative group ${
                          appearance.videoTeaser.aspectRatio === '9:16' ? 'w-[190px] aspect-[9/16] mx-auto' : 'w-full aspect-video'
                        }`}>
                          <iframe
                            src={getSafeYouTubeEmbedUrl(youtubeVideoId)}
                            title="Video Pengantar Toko"
                            className={`w-full h-full border-0 ${isPlayingVideoPreview ? '' : 'pointer-events-none'}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                          {!isPlayingVideoPreview && (
                            <button
                              type="button"
                              onClick={() => setIsPlayingVideoPreview(true)}
                              className="absolute inset-0 bg-black/30 hover:bg-black/20 flex flex-col items-center justify-center gap-1.5 text-white transition cursor-pointer backdrop-blur-2xs"
                              title="Klik untuk Menguji Putar Video"
                            >
                              <div className="w-10 h-10 rounded-full bg-red-600/90 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                                <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                              </div>
                              <span className="text-[10px] font-bold bg-black/60 px-2.5 py-0.5 rounded-full border border-white/20">
                                Uji Putar Video
                              </span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="w-full p-4 rounded-2xl bg-black/40 border border-dashed border-white/20 text-center text-white/50 space-y-1">
                          <Play className="w-5 h-5 mx-auto text-white/30" />
                          <span className="text-[10px] block">Video pengantar belum disematkan</span>
                        </div>
                      )}
                    </div>
                  );
                }

                // 4. PRODUK UNGGULAN (FEATURED PRODUCT - 1:1 DENGAN ASISTEN-GURU HUB)
                if (sectionId === 'featured_product') {
                  if (!featuredProductItem) {
                    if (isLoadingProducts && appearance.featuredProduct.productId) {
                      return (
                        <div key="featured_product" className="p-3 rounded-2xl bg-black/40 border border-white/10 animate-pulse flex items-center gap-3">
                          <div className="w-16 h-16 bg-stone-800 rounded-xl shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-stone-800 rounded-sm w-3/4" />
                            <div className="h-3 bg-stone-800 rounded-sm w-1/2" />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key="featured_product" className={`p-3 rounded-2xl ${isLightStoreTheme ? 'bg-white/80 border-stone-200 text-stone-500' : 'bg-black/40 border-white/20 text-white/50'} border border-dashed text-center`}>
                        <Flame className={`w-4 h-4 mx-auto ${isLightStoreTheme ? 'text-amber-500' : 'text-amber-400/50'} mb-1`} />
                        <span className="text-[10px] block">Pilih produk unggulan di panel kiri</span>
                      </div>
                    );
                  }

                  const coverUrl = featuredProductItem.cover_image_key ? `/api/media/${featuredProductItem.cover_image_key}` : null;
                  const detailUrl = `https://asisten-guru.id/toko?item=${encodeURIComponent(featuredProductItem.slug || featuredProductItem.id)}`;

                  return (
                    <div key="featured_product" className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-400 text-stone-950 shadow-xs">
                          <Flame className="w-3 h-3 fill-amber-950 text-amber-950" />
                          <span>{appearance.featuredProduct.badgeText || 'UNGGULAN'}</span>
                        </span>
                      </div>

                      <div className="bg-black/40 backdrop-blur-xl border border-amber-400/60 rounded-2xl p-3 shadow-xl flex items-center gap-3">
                        {coverUrl && (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-white/10">
                            <img src={getMediaUrl(coverUrl)} alt={featuredProductItem.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                            {featuredProductItem.title}
                          </h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-black text-amber-300">
                              Rp {featuredProductItem.price.toLocaleString('id-ID')}
                            </span>
                            {featuredProductItem.original_price && featuredProductItem.original_price > featuredProductItem.price && (
                              <span className="text-[10px] text-stone-400 line-through">
                                Rp {featuredProductItem.original_price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                          <a
                            href={detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-[11px] uppercase tracking-wider transition shadow-xs cursor-pointer no-underline"
                          >
                            <span>Beli Modul Ini</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 5. BLOK KATALOG PRODUK RESMI
                if (sectionId === 'catalog') {
                  return (
                    <div key="catalog" className="space-y-3 pt-2">
                      <div className={`flex items-center justify-between border-b ${isLightStoreTheme ? 'border-stone-200/80' : 'border-white/10'} pb-2`}>
                        <span 
                          className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5"
                          style={{ 
                            color: appearance.typography.headingColor,
                            ...getTextShadowStyle(appearance.typography.textShadow, appearance.typography.headingColor)
                          }}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Karya Terpublikasi ({totalProducts || publishedProducts.length})</span>
                        </span>
                        <span className={`text-[10px] ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'} font-bold`}>Terverifikasi</span>
                      </div>

                      {/* Search Bar Real-Time */}
                      {!isLoadingProducts && publishedProducts.length > 2 && (
                        <div className="relative">
                          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLightStoreTheme ? 'text-stone-400' : 'text-white/50'} pointer-events-none`} />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value.slice(0, 50))}
                            maxLength={50}
                            placeholder="Cari materi / modul..."
                            className={`w-full ${isLightStoreTheme ? 'bg-white/95 border-stone-200/90 text-stone-900 placeholder-stone-400 focus:border-brand-teal' : 'bg-black/40 border-white/20 text-white placeholder-white/40 focus:border-teal-400/80'} border rounded-xl pl-8 pr-3 py-1.5 text-[11px] focus:outline-none backdrop-blur-md`}
                          />
                        </div>
                      )}

                      {/* Filter Kategori Chips */}
                      {!isLoadingProducts && productCategories.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-bold shrink-0 transition ${
                              selectedCategory === 'all'
                                ? 'bg-brand-teal text-white shadow-xs'
                                : isLightStoreTheme 
                                  ? 'bg-white/90 text-stone-600 hover:text-stone-900 border border-stone-200/80' 
                                  : 'bg-black/40 text-white/70 hover:text-white border border-white/10'
                            }`}
                          >
                            Semua ({publishedProducts.length})
                          </button>
                          {productCategories.map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-bold shrink-0 transition ${
                                selectedCategory === cat
                                  ? 'bg-brand-teal text-white shadow-xs'
                                  : isLightStoreTheme 
                                    ? 'bg-white/90 text-stone-600 hover:text-stone-900 border border-stone-200/80' 
                                    : 'bg-black/40 text-white/70 hover:text-white border border-white/10'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Loading State */}
                      {isLoadingProducts && (
                        <div className={`py-8 text-center ${isLightStoreTheme ? 'text-stone-500' : 'text-white/50'} text-xs`}>
                          <RefreshCw className={`w-4 h-4 animate-spin mx-auto mb-1 ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'}`} />
                          <span>Memuat katalog terpublikasi...</span>
                        </div>
                      )}

                      {/* Hasil Kosong */}
                      {!isLoadingProducts && publishedProducts.length > 0 && filteredProducts.length === 0 && (
                        <div className={`py-6 text-center ${isLightStoreTheme ? 'bg-white/90 border-stone-200/80 text-stone-600' : 'bg-black/40 border-white/10 text-white/70'} text-xs rounded-2xl border p-4`}>
                          <p className={`font-semibold ${isLightStoreTheme ? 'text-stone-900' : 'text-white'}`}>Tidak ada materi ditemukan</p>
                          <p className={`text-[10px] mt-1 ${isLightStoreTheme ? 'text-stone-500' : 'text-white/60'}`}>Coba kata kunci atau kategori lain.</p>
                        </div>
                      )}

                      {/* Daftar Produk */}
                      {!isLoadingProducts && displayedProducts.length > 0 && (
                        <div className={
                          appearance.catalogLayout === 'grid' 
                            ? 'grid grid-cols-2 gap-2.5' 
                            : appearance.catalogLayout === 'compact'
                            ? 'space-y-1.5'
                            : 'space-y-2.5'
                        }>
                          {displayedProducts.map((p) => {
                            const coverUrl = p.cover_image_key ? `/api/media/${p.cover_image_key}` : null;
                            const productDetailUrl = `https://asisten-guru.id/toko?item=${encodeURIComponent(p.slug || p.id)}`;
                            
                            if (appearance.catalogLayout === 'grid') {
                              return (
                                <a 
                                  key={p.id}
                                  href={productDetailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${isLightStoreTheme ? 'bg-white/95 hover:bg-white border-stone-200/80 hover:border-brand-teal/50 shadow-xs hover:shadow-md' : 'bg-black/40 hover:bg-black/60 border-white/15 hover:border-teal-400/50'} backdrop-blur-md rounded-2xl overflow-hidden border p-2 flex flex-col justify-between group transition-all transform hover:-translate-y-0.5 no-underline cursor-pointer`}
                                  title={`Buka detail & checkout: ${p.title}`}
                                >
                                  <div>
                                    <div className={`h-20 ${isLightStoreTheme ? 'bg-stone-100' : 'bg-stone-800'} rounded-xl overflow-hidden mb-2 relative`}>
                                      {coverUrl ? (
                                        <img src={getMediaUrl(coverUrl)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                      ) : (
                                        <div className={`w-full h-full flex items-center justify-center ${isLightStoreTheme ? 'text-stone-400' : 'text-white/30'} text-[9px]`}>
                                          No Image
                                        </div>
                                      )}
                                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md ${isLightStoreTheme ? 'bg-white/90 text-stone-800 border border-stone-200/60 shadow-xs' : 'bg-black/70 backdrop-blur-xs text-amber-300'} text-[9px] font-bold flex items-center gap-0.5`}>
                                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                        <span>5.0</span>
                                      </div>
                                    </div>
                                    <h4 className={`text-[11px] font-bold leading-tight line-clamp-2 ${isLightStoreTheme ? 'text-stone-900 group-hover:text-brand-teal' : 'text-white group-hover:text-teal-200'} transition-colors`}>
                                      {p.title}
                                    </h4>
                                  </div>

                                  <div className={`mt-2.5 pt-2 border-t ${isLightStoreTheme ? 'border-stone-100' : 'border-white/10'} space-y-1.5`}>
                                    <span className={`text-xs font-extrabold ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'} block`}>
                                      Rp {p.price.toLocaleString('id-ID')}
                                    </span>
                                    <div
                                      className={`w-full py-1.5 text-[10px] font-bold transition flex items-center justify-center gap-1 group-hover:brightness-110 shadow-xs ${getButtonRadiusClass(appearance.button.radius)}`}
                                      style={getButtonStyleProps(appearance.button)}
                                    >
                                      <span>Beli Sekarang</span>
                                      <ArrowUpRight className="w-2.5 h-2.5" />
                                    </div>
                                  </div>
                                </a>
                              );
                            }

                            // Mode Compact (Link-in-Bio Minimalis Cepat)
                            if (appearance.catalogLayout === 'compact') {
                              return (
                                <a 
                                  key={p.id}
                                  href={productDetailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${isLightStoreTheme ? 'bg-white/95 hover:bg-white border-stone-200/80 hover:border-brand-teal/50 shadow-xs' : 'bg-black/45 hover:bg-black/65 border-white/15 hover:border-teal-400/50'} backdrop-blur-md rounded-xl overflow-hidden border px-2.5 py-1.5 flex items-center justify-between gap-2.5 group transition-all transform hover:-translate-y-0.5 no-underline cursor-pointer`}
                                  title={`Buka detail & checkout: ${p.title}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-8 h-8 ${isLightStoreTheme ? 'bg-stone-100 border-stone-200/80' : 'bg-stone-800 border-white/10'} rounded-lg overflow-hidden shrink-0 border relative`}>
                                      {coverUrl ? (
                                        <img src={getMediaUrl(coverUrl)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                      ) : (
                                        <div className={`w-full h-full flex items-center justify-center ${isLightStoreTheme ? 'text-stone-400' : 'text-white/30'} text-[7px]`}>Doc</div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className={`text-[11px] font-bold leading-tight truncate ${isLightStoreTheme ? 'text-stone-900 group-hover:text-brand-teal' : 'text-white group-hover:text-teal-200'} transition-colors`}>
                                        {p.title}
                                      </h4>
                                      <span className={`text-[10px] font-extrabold ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'} block`}>
                                        Rp {p.price.toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    className={`py-1 px-2.5 text-[9px] font-extrabold shrink-0 transition flex items-center gap-1 group-hover:brightness-110 shadow-xs ${getButtonRadiusClass(appearance.button.radius)}`}
                                    style={getButtonStyleProps(appearance.button)}
                                  >
                                    <span>Beli</span>
                                    <ArrowUpRight className="w-2.5 h-2.5" />
                                  </div>
                                </a>
                              );
                            }

                            // Mode List
                            return (
                              <a 
                                key={p.id}
                                href={productDetailUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${isLightStoreTheme ? 'bg-white/95 hover:bg-white border-stone-200/80 hover:border-brand-teal/50 shadow-xs hover:shadow-md' : 'bg-black/40 hover:bg-black/60 border-white/15 hover:border-teal-400/50'} backdrop-blur-md rounded-2xl overflow-hidden border p-2.5 flex items-center justify-between gap-3 group transition-all transform hover:-translate-y-0.5 no-underline cursor-pointer`}
                                title={`Buka detail & checkout: ${p.title}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-12 h-12 ${isLightStoreTheme ? 'bg-stone-100 border-stone-200/80' : 'bg-stone-800 border-white/10'} rounded-xl overflow-hidden shrink-0 border relative`}>
                                    {coverUrl ? (
                                      <img src={getMediaUrl(coverUrl)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    ) : (
                                      <div className={`w-full h-full flex items-center justify-center ${isLightStoreTheme ? 'text-stone-400' : 'text-white/30'} text-[8px]`}>
                                        Cover
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className={`text-[11px] font-bold leading-tight truncate ${isLightStoreTheme ? 'text-stone-900 group-hover:text-brand-teal' : 'text-white group-hover:text-teal-200'} transition-colors`}>
                                      {p.title}
                                    </h4>
                                    <span className={`text-[11px] font-extrabold ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'} block mt-0.5`}>
                                      Rp {p.price.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className={`py-1.5 px-3 text-[10px] font-bold shrink-0 transition flex items-center gap-1 group-hover:brightness-110 shadow-xs ${getButtonRadiusClass(appearance.button.radius)}`}
                                  style={getButtonStyleProps(appearance.button)}
                                >
                                  <span>Beli</span>
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* Muat Lebih Banyak */}
                      {filteredProducts.length > displayedProducts.length && (
                        <div className="pt-1 text-center">
                          <button
                            type="button"
                            onClick={() => setDisplayLimit(prev => prev + 10)}
                            className={`w-full py-2 rounded-xl ${isLightStoreTheme ? 'bg-white/90 hover:bg-white text-stone-700 border-stone-200 shadow-xs' : 'bg-white/15 hover:bg-white/25 text-white border-white/20'} text-[10px] font-bold border transition cursor-pointer flex items-center justify-center gap-1`}
                          >
                            <span>Tampilkan {filteredProducts.length - displayedProducts.length} Produk Lainnya</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Kosong Zero-Junk */}
                      {!isLoadingProducts && publishedProducts.length === 0 && (
                        <div className={`${isLightStoreTheme ? 'bg-white/90 border-dashed border-stone-300' : 'bg-black/40 border-dashed border-white/20'} backdrop-blur-md rounded-2xl p-4 border text-center space-y-2`}>
                          <ShoppingBag className={`w-6 h-6 ${isLightStoreTheme ? 'text-brand-teal/70' : 'text-teal-300/60'} mx-auto`} />
                          <span className={`text-xs font-bold ${isLightStoreTheme ? 'text-stone-900' : 'text-white'} block`}>
                            Belum Ada Produk Terpublikasi
                          </span>
                          <p className={`text-[10px] ${isLightStoreTheme ? 'text-stone-500' : 'text-white/60'} leading-relaxed`}>
                            Etalase toko otomatis menyinkronkan produk yang telah lolos kurasi. Produk draf atau dalam peninjauan tidak akan muncul di sini.
                          </p>
                          {onNavigateToProducts && (
                            <button
                              type="button"
                              onClick={onNavigateToProducts}
                              className={`mt-2 py-1.5 px-3 rounded-xl ${isLightStoreTheme ? 'bg-teal-50 hover:bg-teal-100 text-brand-teal border-teal-200' : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30'} text-[10px] font-bold transition border cursor-pointer`}
                            >
                              Kelola & Ajukan Produk →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // 6. BLOK TANYA JAWAB (FAQ ACCORDION)
                if (sectionId === 'faq') {
                  if (appearance.faq.items.length === 0) {
                    return (
                      <div key="faq" className={`p-3.5 rounded-2xl ${isLightStoreTheme ? 'bg-white/80 border-stone-200 text-stone-500' : 'bg-black/40 border-white/20 text-white/50'} border border-dashed text-center`}>
                        <HelpCircle className={`w-4 h-4 mx-auto ${isLightStoreTheme ? 'text-brand-teal/70' : 'text-teal-300/60'} mb-1`} />
                        <span className="text-[10px] block">Belum ada tanya jawab FAQ</span>
                      </div>
                    );
                  }

                  return (
                    <div key="faq" className="space-y-2 pt-2">
                      <h4 
                        className="text-xs font-bold leading-tight flex items-center gap-1.5"
                        style={{ color: appearance.typography.headingColor }}
                      >
                        <HelpCircle className={`w-3.5 h-3.5 ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-400'}`} />
                        <span>{appearance.faq.title || 'Tanya Jawab (FAQ)'}</span>
                      </h4>

                      <div className="space-y-1.5">
                        {appearance.faq.items.map(item => {
                          const isOpen = openFaqId === item.id;
                          return (
                            <div key={item.id} className={`${isLightStoreTheme ? 'bg-white/95 border-stone-200/80 shadow-xs' : 'bg-black/40 border-white/15'} backdrop-blur-md rounded-xl border overflow-hidden transition`}>
                              <button
                                type="button"
                                onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                                className={`w-full px-3 py-2 text-left text-[11px] font-bold ${isLightStoreTheme ? 'text-stone-900' : 'text-white'} flex items-center justify-between gap-2 cursor-pointer`}
                              >
                                <span>{item.question || 'Pertanyaan Baru'}</span>
                                <ChevronDown className={`w-3.5 h-3.5 ${isLightStoreTheme ? 'text-brand-teal' : 'text-teal-300'} shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {isOpen && (
                                <div className={`px-3 pb-2.5 pt-0.5 text-[10px] ${isLightStoreTheme ? 'text-stone-600 border-stone-100' : 'text-white/80 border-white/10'} leading-relaxed border-t`}>
                                  {item.answer || 'Belum ada jawaban.'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return null;
              })}

              {/* Footer Etalase Mikro */}
              <div className={`mt-8 pt-5 pb-2 text-center space-y-2.5 border-t ${isLightStoreTheme ? 'border-stone-200/80' : 'border-white/10'}`}>
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-teal-500">
                  <ShieldCheck className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>Etalase Digital Resmi Terverifikasi</span>
                </div>

                <p className={`text-[9px] ${isLightStoreTheme ? 'text-stone-500' : 'text-white/50'}`}>
                  &copy; {new Date().getFullYear()} {profile.store_name || profile.name || 'Toko Digital Mitra'}. Hak cipta dilindungi.
                </p>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-teal-500/25 text-teal-300 flex items-center justify-center font-extrabold text-[8px] ring-1 ring-teal-400/40">
                      AG
                    </div>
                    <span className="text-[10px] font-medium tracking-wide text-white/90">
                      Ditenagai oleh <strong className="font-bold text-teal-300">asisten-guru.id</strong>
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* End of SCROLLABLE INNER STORE CONTAINER */}
          </div>

          {/* End of SCREEN CANVAS */}
        </div>
      </div>

      {/* Indikator Status Sinkronisasi Real-Time */}
      <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold border border-stone-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Katalog Otomatis: {publishedProducts.length} Produk Resmi Lolos Kurasi</span>
      </div>

    </div>
  );
};
