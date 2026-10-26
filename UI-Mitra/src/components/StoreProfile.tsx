import React, { useState, useRef, useEffect } from 'react';
import { 
  Store, User, Mail, Shield, Camera, Image as ImageIcon, 
  Landmark, Save, Loader2, CheckCircle2, Lock, Globe, 
  Instagram, Twitter, Linkedin, AlertCircle, ShieldCheck, MapPin, Calendar, Copy,
  ExternalLink, FileText, HelpCircle, Headphones, MessageCircle, Palette, Phone
} from 'lucide-react';
import { UserProfile, Category, FeePolicy } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getMediaUrl } from '../utils/mediaUrl';
import { SellerTermsModal } from './SellerTermsModal';

interface StoreProfileProps {
  profile: UserProfile;
  initialCategories?: Category[];
  onUpdateProfile: (updated: UserProfile) => void;
  onNavigateToAppearance?: () => void;
}

export const StoreProfile: React.FC<StoreProfileProps> = ({ profile, initialCategories, onUpdateProfile, onNavigateToAppearance }) => {
  const { success, error: showError, warning } = useToast();
  
  // Biodata Diri Mitra
  const [name, setName] = useState(profile.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '');
  const [personalAddress, setPersonalAddress] = useState(profile.personal_address || '');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan' | ''>(
    profile.gender === 'Laki-laki' || profile.gender === 'Perempuan' ? profile.gender : ''
  );
  const [birthDate, setBirthDate] = useState(profile.birth_date || '');

  // Kategori Produk dari Pengaturan Admin
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [isLoadingCategories, setIsLoadingCategories] = useState(!initialCategories || initialCategories.length === 0);

  // Biodata Toko
  const [storeName, setStoreName] = useState(profile.store_name || profile.name || '');
  const [storeDescription, setStoreDescription] = useState(profile.store_description || profile.bio || '');
  const [storeAddress, setStoreAddress] = useState(profile.store_address || '');
  const [primaryNiche, setPrimaryNiche] = useState(profile.primaryNiche || '');
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl || '');
  
  // Rekening Bank
  const [bankName, setBankName] = useState(profile.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(profile.bank_account_number || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(profile.bank_account_holder || '');

  // Media Sosial
  const [socialInstagram, setSocialInstagram] = useState(profile.socialInstagram || '');
  const [socialLinkedin, setSocialLinkedin] = useState(profile.socialLinkedin || '');
  const [socialTwitter, setSocialTwitter] = useState(profile.socialTwitter || '');
  const [socialTiktok, setSocialTiktok] = useState(profile.socialTiktok || '');

  // Modal Dokumen Legalitas
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');

  // Kebijakan Bagi Hasil & Legalitas Resmi dari Super Admin
  const [feePolicy, setFeePolicy] = useState<FeePolicy | null>(null);
  const [termsVersion, setTermsVersion] = useState<number | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Sinkronisasi data profil dari server / props ke state lokal secara menyeluruh & reaktif
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhoneNumber(profile.phone_number || '');
      setPersonalAddress(profile.personal_address || '');
      setGender(
        profile.gender === 'Laki-laki' || profile.gender === 'Perempuan' ? profile.gender : ''
      );
      setBirthDate(profile.birth_date || '');
      setStoreName(profile.store_name || profile.name || '');
      setStoreDescription(profile.store_description || profile.bio || '');
      setStoreAddress(profile.store_address || '');
      setPrimaryNiche(profile.primaryNiche || '');
      setPortfolioUrl(profile.portfolioUrl || '');
      setAvatarUrl(profile.avatarUrl || '');
      setCoverUrl(profile.coverUrl || '');
      setBankName(profile.bank_name || '');
      setBankAccountNumber(profile.bank_account_number || '');
      setBankAccountHolder(profile.bank_account_holder || '');
      setSocialInstagram(profile.socialInstagram || '');
      setSocialLinkedin(profile.socialLinkedin || '');
      setSocialTwitter(profile.socialTwitter || '');
      setSocialTiktok(profile.socialTiktok || '');
    }
  }, [profile]);

  // Load Kategori Produk Resmi dari Pengaturan Admin
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const res = await api.get('/categories?type=product&limit=100');
        const fetched: Category[] = (res.data?.data || []).filter((c: Category) => !c.type || c.type === 'product');
        if (isMounted && fetched.length > 0) {
          setCategories(fetched);
          setPrimaryNiche(prev => {
            if (prev && fetched.some(c => c.name === prev)) return prev;
            return fetched[0].name;
          });
        }
      } catch (err) {
        console.error('Failed to load categories in store profile', err);
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };
    fetchCategories();
    return () => { isMounted = false; };
  }, []);

  // Sinkronisasi Kebijakan Bagi Hasil & Versi Legalitas dari Super Admin
  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      api.get('/earnings/policy'),
      api.get('/auth/terms/seller', { params: { _t: Date.now() } })
    ]).then(([policyRes, termsRes]) => {
      if (!isMounted) return;
      if (policyRes.status === 'fulfilled' && policyRes.value.data?.policy) {
        setFeePolicy(policyRes.value.data.policy);
      }
      if (termsRes.status === 'fulfilled' && termsRes.value.data?.terms_version) {
        setTermsVersion(termsRes.value.data.terms_version);
      }
    }).catch(err => {
      console.warn('Gagal memuat kebijakan royalti dinamis di StoreProfile:', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showError('Ukuran file logo/avatar maksimal 2MB.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.post('/users/me/avatar', formData);
      if (res.data?.avatar_url) {
        setAvatarUrl(res.data.avatar_url);
        onUpdateProfile({ ...profile, avatarUrl: res.data.avatar_url });
        success('Logo toko berhasil diperbarui.');
      }
    } catch (err) {
      console.error('Avatar upload error', err);
      showError(handleApiError(err));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showError('Ukuran banner etalase maksimal 3MB.');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }

    setUploadingCover(true);
    const formData = new FormData();
    formData.append('cover', file);

    try {
      const res = await api.post('/users/me/cover', formData);
      if (res.data?.cover_url) {
        setCoverUrl(res.data.cover_url);
        onUpdateProfile({ ...profile, coverUrl: res.data.cover_url });
        success('Banner etalase toko berhasil diperbarui.');
      }
    } catch (err) {
      console.error('Cover upload error', err);
      showError(handleApiError(err));
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      let cleanPhone = phoneNumber ? phoneNumber.replace(/[^\d+]/g, '') : '';
      if (cleanPhone.startsWith('8')) cleanPhone = '0' + cleanPhone;
      if (cleanPhone && !/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(cleanPhone)) {
        showError('Format nomor WhatsApp / HP tidak valid. Gunakan format nomor aktif Indonesia (contoh: 081234567890).');
        setSavingProfile(false);
        return;
      }

      const payload: any = {
        name: name.trim() || undefined,
        phone_number: cleanPhone || null,
        personal_address: personalAddress.trim() || undefined,
        gender: gender || undefined,
        birth_date: birthDate || undefined,
        store_name: storeName.trim() || undefined,
        store_description: storeDescription.trim() || undefined,
        store_address: storeAddress.trim() || undefined,
        bio: storeDescription.trim() || undefined,
        primaryNiche: primaryNiche.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        cover_url: coverUrl || undefined,
        bank_name: bankName.trim() || undefined,
        bank_account_number: bankAccountNumber.trim() || undefined,
        bank_account_holder: bankAccountHolder.trim() || undefined,
        socialInstagram: socialInstagram.trim() || undefined,
        socialLinkedin: socialLinkedin.trim() || undefined,
        socialTwitter: socialTwitter.trim() || undefined,
        socialTiktok: socialTiktok.trim() || undefined,
      };

      await api.put('/users/me', payload);

      const legacyFormat = bankName ? `${bankName} ${bankAccountNumber} a.n. ${bankAccountHolder}` : '';
      if (legacyFormat.trim()) {
        localStorage.setItem('seller_default_bank_details', legacyFormat.trim());
      }

      const updated: UserProfile = {
        ...profile,
        name: payload.name || profile.name,
        phone_number: cleanPhone || profile.phone_number,
        personal_address: payload.personal_address || profile.personal_address,
        gender: payload.gender || profile.gender,
        birth_date: payload.birth_date || profile.birth_date,
        store_name: payload.store_name || profile.store_name,
        store_description: payload.store_description || profile.store_description,
        store_address: payload.store_address || profile.store_address,
        bio: payload.bio || profile.bio,
        primaryNiche: payload.primaryNiche || profile.primaryNiche,
        portfolioUrl: payload.portfolioUrl || profile.portfolioUrl,
        avatarUrl: payload.avatar_url || profile.avatarUrl,
        coverUrl: payload.cover_url || profile.coverUrl,
        bank_name: payload.bank_name || profile.bank_name,
        bank_account_number: payload.bank_account_number || profile.bank_account_number,
        bank_account_holder: payload.bank_account_holder || profile.bank_account_holder,
        socialInstagram: payload.socialInstagram || profile.socialInstagram,
        socialLinkedin: payload.socialLinkedin || profile.socialLinkedin,
        socialTwitter: payload.socialTwitter || profile.socialTwitter,
        socialTiktok: payload.socialTiktok || profile.socialTiktok,
        bankDetails: legacyFormat.trim() || undefined,
      };

      onUpdateProfile(updated);
      success('Profil toko & informasi kemitraan berhasil disimpan!');
    } catch (err) {
      console.error('Update profile error', err);
      showError(handleApiError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight font-sans">
          Profil Toko
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Kelola informasi etalase toko, biodata pemilik mitra, rekening pencairan hasil penjualan, dan tautan sosial media.
        </p>
      </div>

      {/* Banner Pintasan ke Tampilan Toko */}
      {onNavigateToAppearance && (
        <div 
          onClick={onNavigateToAppearance}
          className="bg-gradient-to-r from-teal-950 via-stone-900 to-stone-900 p-4 sm:p-5 rounded-3xl text-white flex items-center justify-between gap-4 cursor-pointer hover:shadow-lg transition group border border-teal-800/40"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shrink-0 group-hover:scale-105 transition-transform">
              <Palette className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Kustomisasi Desain & Tampilan Toko
                </h3>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
                  Baru
                </span>
              </div>
              <p className="text-[11px] text-stone-300 mt-0.5">
                Ubah palet warna, gaya tombol, dan wallpaper etalase dengan live preview smartphone interaktif.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-teal-300 group-hover:translate-x-1 transition-transform shrink-0">
            <span>Buka Tampilan Toko</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Kolom Kiri: Form Utama Profil Toko */}
        <div className="lg:col-span-2 space-y-6">
          
          <form onSubmit={handleSaveProfile} className="space-y-6">
            
            {/* Banner Cover & Logo Toko */}
            <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                className="hidden"
                accept="image/*"
                disabled={uploadingCover}
              />
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                className="hidden"
                accept="image/*"
                disabled={uploadingAvatar}
              />

              {/* Cover Banner */}
              <div 
                onClick={() => !uploadingCover && coverInputRef.current?.click()}
                className={`h-36 sm:h-44 bg-gradient-to-r from-teal-900 to-stone-900 relative ${uploadingCover ? 'cursor-wait pointer-events-none' : 'cursor-pointer'} group flex items-center justify-center overflow-hidden`}
              >
                {coverUrl ? (
                  <img src={getMediaUrl(coverUrl)} alt="Cover Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-white/50 text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    <span>Klik untuk mengunggah banner etalase toko</span>
                  </div>
                )}
                {uploadingCover ? (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-semibold gap-2 z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                    <span>Mengunggah Banner Toko...</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>Ubah Banner Toko</span>
                  </div>
                )}
              </div>

              {/* Avatar / Logo Toko */}
              <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-12">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div 
                    onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                    className={`w-24 h-24 rounded-3xl bg-white p-1 border-2 border-stone-200/80 card-shadow overflow-hidden ${uploadingAvatar ? 'cursor-wait pointer-events-none' : 'cursor-pointer'} group relative shrink-0`}
                  >
                    {avatarUrl ? (
                      <img src={getMediaUrl(avatarUrl)} alt="Logo Toko" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="w-full h-full bg-teal-50 text-brand-teal flex items-center justify-center rounded-2xl">
                        <Store className="w-8 h-8" />
                      </div>
                    )}
                    {uploadingAvatar ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-2xl flex items-center justify-center text-white z-10">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-stone-900">
                      {storeName || name || 'Toko Mitra Anda'}
                    </h2>
                    <p className="text-xs text-stone-500">{profile.email}</p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                      <ShieldCheck className="w-3 h-3" /> Mitra Terverifikasi
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>

            </div>

            {/* SEKSI 1: BIODATA TOKO */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Store className="w-4 h-4 text-brand-teal" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Informasi Toko & Etalase Digital
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nama Toko / Brand Edukasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: Media Belajar Pintar"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-800">
                      Kategori / Niche Utama <span className="text-rose-500">*</span>
                    </label>
                    {isLoadingCategories && (
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin text-brand-teal" />
                        Memuat...
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={primaryNiche}
                    onChange={(e) => setPrimaryNiche(e.target.value)}
                    disabled={isLoadingCategories && categories.length === 0}
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white cursor-pointer disabled:opacity-60"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <option value={primaryNiche || 'Administrasi Guru'}>
                        {primaryNiche || 'Administrasi Guru'}
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Deskripsi Toko / Slogan Etalase
                </label>
                <textarea
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder="Ceritakan tentang toko atau produk digital edukasi Anda..."
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-800">
                    Alamat Operasional Toko
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!personalAddress) {
                        warning('Alamat tempat tinggal belum terisi.');
                        return;
                      }
                      setStoreAddress(personalAddress);
                      success('Alamat toko disinkronkan dengan alamat domisili.');
                    }}
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-teal hover:underline cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Sinkronkan dengan Alamat Diri</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Alamat operasional atau studio toko Anda..."
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Tautan Portofolio / Website Eksternal (Opsional)
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://portofolio-anda.com"
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* SEKSI 2: BIODATA DIRI MITRA */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <User className="w-4 h-4 text-brand-teal" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Biodata Diri Pemilik Akun (Mitra)
                </h3>
              </div>

              {/* Banner Peringatan Jika Nomor HP Belum Diisi */}
              {!profile.phone_number && (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Nomor WhatsApp belum terdaftar:</span> Mohon lengkapi nomor WhatsApp / HP aktif Anda di bawah ini agar tim kurator dan administrator dapat menghubungi Anda dengan cepat terkait kurasi produk dan transaksi toko.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nama Lengkap Pemilik Akun <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-800">
                      Nomor WhatsApp / HP Aktif
                    </label>
                    {profile.phone_number && (
                      <span className="text-[10px] text-teal-600 font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" /> Terdaftar
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Contoh: 081234567890 atau +6281234567890"
                      className="w-full pl-9 pr-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white font-mono"
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">Kontak resmi admin & kurator</span>
                    {phoneNumber && (
                      /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(phoneNumber.replace(/[\s\-()]/g, '')) ? (
                        <span className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">
                          Format valid
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Contoh: 0812xxxxxxxx</span>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  >
                    <option value="">Pilih Jenis Kelamin</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white font-sans"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Alamat Email Akun
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-100 text-stone-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Alamat Tempat Tinggal (Domisili Lengkap)
                </label>
                <textarea
                  rows={2}
                  value={personalAddress}
                  onChange={(e) => setPersonalAddress(e.target.value)}
                  placeholder="Alamat domisili lengkap Anda..."
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white resize-none"
                />
              </div>
            </div>

            {/* SEKSI 3: REKENING PENCAIRAN HASIL PENJUALAN */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Landmark className="w-4 h-4 text-brand-teal" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Rekening Pencairan Royalti Hasil Penjualan
                </h3>
              </div>

              <div className="flex items-start gap-2.5 p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-2xl text-[11px] text-teal-950 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Perlindungan Data Finansial (UU PDP No. 27/2022): </span>
                  Nomor rekening dan identitas perbankan Anda dienkripsi untuk keperluan transfer royalti penjualan produk dan tidak akan dibagikan kepada pembeli atau pihak luar.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nama Bank
                  </label>
                  <input
                    type="text"
                    list="profile-bank-list"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="BCA, Mandiri, BRI, dll"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                  <datalist id="profile-bank-list">
                    <option value="BCA" />
                    <option value="BRI" />
                    <option value="Bank Mandiri" />
                    <option value="BNI" />
                    <option value="BSI (Bank Syariah Indonesia)" />
                    <option value="Bank Jago" />
                    <option value="CIMB Niaga" />
                    <option value="Bank Permata" />
                    <option value="Bank Danamon" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Contoh: 1234567890"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nama Pemilik Rekening
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="Sesuai buku rekening"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* SEKSI 4: MEDIA SOSIAL TOKO */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Media Sosial Toko
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="@namatoko"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">TikTok</label>
                  <input
                    type="text"
                    value={socialTiktok}
                    onChange={(e) => setSocialTiktok(e.target.value)}
                    placeholder="@namatoko"
                    className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

          </form>

        </div>

        {/* Kolom Kanan: Keamanan Akun SSO, Dokumen Legalitas, & Layanan Mitra */}
        <div className="space-y-6">
          
          {/* KARTU 1: Keamanan & Autentikasi Terpadu SSO Hub */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-teal" />
                <span>Keamanan Akun Terpadu</span>
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-brand-teal text-[10px] font-bold border border-teal-100">
                <Lock className="w-2.5 h-2.5" />
                SSO Aktif
              </span>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Akun Anda terhubung langsung dengan sistem otentikasi pusat <strong>Asisten Guru Hub</strong>. Sandi, verifikasi keamanan, dan sesi login Anda dikelola secara terpusat demi perlindungan maksimal.
            </p>

            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 text-[11px]">Email Akun Hub:</span>
                <span className="font-semibold text-stone-800 text-[11px] truncate max-w-[160px]" title={profile.email}>
                  {profile.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 text-[11px]">Metode Masuk:</span>
                <span className="font-semibold text-stone-800 text-[11px]">Single Sign-On (SSO)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 text-[11px]">Status Kredensial:</span>
                <span className="font-bold text-teal-700 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                  Terproteksi Enkripsi
                </span>
              </div>
            </div>

            <a
              href="https://asisten-guru.id"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition cursor-pointer border border-stone-200/80 group"
            >
              <span>Kelola Keamanan & Sandi di Hub</span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-500 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          {/* KARTU 2: Status Kemitraan & Akses Dokumen Legal */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-brand-teal" />
                <span>Dokumen Hukum & Legalitas</span>
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-bold border border-stone-200">
                Resmi Mengikat{termsVersion ? ` • v${termsVersion}` : ''}
              </span>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Sebagai mitra resmi, karya edukasi Anda dilindungi oleh undang-undang hak cipta dan perjanjian kemitraan transparan.
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-2xl bg-teal-50/50 border border-teal-100/70 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-stone-900 block">
                      Bagi Hasil Royalti {feePolicy?.creator_share_percent || '85%'} / {feePolicy?.fee_percent || '15%'}
                    </span>
                    {feePolicy && (
                      <span className="text-[9px] font-bold text-brand-teal bg-teal-100/70 px-1.5 py-0.5 rounded shrink-0">
                        Resmi
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 leading-snug block">
                    {feePolicy?.creator_share_percent || '85%'} bersih untuk Mitra Kreator, {feePolicy?.fee_percent || '15%'} biaya operasional platform.
                  </span>
                  {feePolicy && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-stone-400 font-medium">
                      <span>Min. Produk: Rp {feePolicy.min_product_price?.toLocaleString('id-ID') || '10.000'}</span>
                      <span>•</span>
                      <span>Min. Penarikan: Rp {feePolicy.min_withdrawal_amount?.toLocaleString('id-ID') || '50.000'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-teal-50/50 border border-teal-100/70 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold text-stone-900 block">UU Hak Cipta No. 28/2014</span>
                  <span className="text-[10px] text-stone-500 leading-snug">Hak kekayaan intelektual mutlak milik Anda sebagai kreator orisinil.</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-teal-50/50 border border-teal-100/70 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-bold text-stone-900 block">UU PDP No. 27/2022</span>
                  <span className="text-[10px] text-stone-500 leading-snug">Data pribadi, KTP, dan nomor rekening terlindungi standar privasi tinggi.</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href="/tos"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-brand-teal text-xs font-bold transition text-center cursor-pointer border border-teal-100 flex items-center justify-center gap-1.5"
                title="Buka halaman resmi Syarat & Ketentuan Kemitraan di tab baru"
              >
                <span>Tinjau S&K</span>
                <ExternalLink className="w-3 h-3 text-brand-teal" />
              </a>
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold transition text-center cursor-pointer border border-stone-200 flex items-center justify-center gap-1.5"
                title="Buka halaman resmi Kebijakan Privasi di tab baru"
              >
                <span>Kebijakan Privasi</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
            </div>
          </div>

          {/* KARTU 3: Pusat Bantuan & Kontak Layanan Mitra */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-brand-teal" />
              <span>Bantuan & Layanan Mitra</span>
            </h3>

            <p className="text-xs text-stone-500 leading-relaxed">
              Perlu bantuan kurasi materi, perubahan data rekening pencairan, atau laporan hak cipta? Layanan bantuan resmi Asisten Guru Hub siap mendampingi Anda:
            </p>

            <div className="space-y-2.5">
              {/* WhatsApp Hotline Resmi Hub */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">WhatsApp Hotline</span>
                    <a
                      href="https://wa.me/6283191854066?text=Halo%20Admin%20Asisten%20Guru%2C%20saya%20Mitra%20Kreator%20butuh%20bantuan%20mengenai%20toko%20saya"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-900 font-extrabold text-xs hover:text-emerald-700 transition font-mono truncate block"
                    >
                      +62 831-9185-4066
                    </a>
                  </div>
                </div>
                <a
                  href="https://wa.me/6283191854066?text=Halo%20Admin%20Asisten%20Guru%2C%20saya%20Mitra%20Kreator%20butuh%20bantuan%20mengenai%20toko%20saya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <span>Chat</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Email Administrator Resmi Hub */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">Email Administrator</span>
                    <a
                      href="mailto:admin@asisten-guru.id?subject=Bantuan%20Mitra%20Kreator%20Asisten%20Guru"
                      className="text-stone-900 font-bold text-xs hover:text-brand-teal transition truncate block"
                    >
                      admin@asisten-guru.id
                    </a>
                  </div>
                </div>
                <a
                  href="mailto:admin@asisten-guru.id?subject=Bantuan%20Mitra%20Kreator%20Asisten%20Guru"
                  className="px-3 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Kirim</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-stone-400 text-center">
              Jam Layanan: Senin – Jumat (08.00 – 17.00 WIB)
            </div>
          </div>

        </div>

      </div>

      {/* Modal Dokumen Legalitas */}
      <SellerTermsModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

    </div>
  );
};
