import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ShieldCheck, Store, User, MapPin, Calendar, Upload, 
  Trash2, FileText, CheckCircle2, AlertCircle, Loader2, 
  ExternalLink, ArrowRight, RefreshCw, Copy, Check, Clock, GraduationCap, LogOut,
  Phone, MessageCircle
} from 'lucide-react';
import { UserProfile, Category } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { getSafeUrl } from '../utils/safeUrl';
import { compressImage } from '../utils/imageCompressor';

interface MitraOnboardingFormProps {
  profile: UserProfile;
  initialCategories?: Category[];
  onRegistrationSuccess: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
}

export const MitraOnboardingForm: React.FC<MitraOnboardingFormProps> = ({
  profile,
  initialCategories,
  onRegistrationSuccess,
  onLogout
}) => {
  const { success, error: showError, warning } = useToast();

  // Biodata Diri Mitra
  const [name, setName] = useState(profile.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '');
  const isPrefilledPhone = Boolean(profile.phone_number);
  const [personalAddress, setPersonalAddress] = useState(profile.personal_address || '');
  const [gender, setGender] = useState<'Laki-laki' | 'Perempuan' | ''>(
    profile.gender === 'Laki-laki' || profile.gender === 'Perempuan' ? profile.gender : ''
  );
  const [birthDate, setBirthDate] = useState(profile.birth_date || '');

  // Kategori Produk dari Pengaturan Admin
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [isLoadingCategories, setIsLoadingCategories] = useState(!initialCategories || initialCategories.length === 0);

  // Biodata Toko
  const [storeName, setStoreName] = useState(profile.store_name || '');
  const [storeDescription, setStoreDescription] = useState(profile.store_description || profile.bio || '');
  const [storeAddress, setStoreAddress] = useState(profile.store_address || '');
  const [primaryNiche, setPrimaryNiche] = useState(profile.primaryNiche || '');
  const [isSameAddress, setIsSameAddress] = useState(false);

  // Rekening Bank (Opsional)
  const [bankName, setBankName] = useState(profile.bank_name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(profile.bank_account_number || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(profile.bank_account_holder || profile.name || '');

  // Foto Contoh Produk (Wajib 1 - 5 foto, Maks 1 MB per file)
  const [samplePhotos, setSamplePhotos] = useState<string[]>(profile.seller_sample_photos || []);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dokumen Legal (S&K & Kebijakan Privasi)
  const [termsMarkdown, setTermsMarkdown] = useState<string>('');
  const [privacyMarkdown, setPrivacyMarkdown] = useState<string>('');
  const [isLoadingLegal, setIsLoadingLegal] = useState(true);

  // Scroll & Agreement States
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasScrolledPrivacy, setHasScrolledPrivacy] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Active Legal Tab for View/Scroll
  const [activeLegalTab, setActiveLegalTab] = useState<'terms' | 'privacy'>('terms');

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccessModal, setSubmittedSuccessModal] = useState(false);

  // Refs for scroll elements
  const termsScrollRef = useRef<HTMLDivElement>(null);
  const privacyScrollRef = useRef<HTMLDivElement>(null);

  // Sinkronisasi data profil dari server / props ke form onboarding secara reaktif
  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.phone_number) setPhoneNumber(profile.phone_number);
      if (profile.personal_address) setPersonalAddress(profile.personal_address);
      if (profile.gender === 'Laki-laki' || profile.gender === 'Perempuan') {
        setGender(profile.gender);
      }
      if (profile.birth_date) setBirthDate(profile.birth_date);
      if (profile.store_name) setStoreName(profile.store_name);
      if (profile.store_description || profile.bio) {
        setStoreDescription(profile.store_description || profile.bio || '');
      }
      if (profile.store_address) setStoreAddress(profile.store_address);
      if (profile.primaryNiche) setPrimaryNiche(profile.primaryNiche);
      if (profile.bank_name) setBankName(profile.bank_name);
      if (profile.bank_account_number) setBankAccountNumber(profile.bank_account_number);
      if (profile.bank_account_holder) {
        setBankAccountHolder(profile.bank_account_holder);
      } else if (profile.name) {
        setBankAccountHolder(prev => prev || profile.name);
      }
      if (profile.seller_sample_photos && profile.seller_sample_photos.length > 0) {
        setSamplePhotos(profile.seller_sample_photos);
      }
    }
  }, [profile]);

  // Load S&K & Privacy Markdown from Backend
  useEffect(() => {
    const fetchLegalDocs = async () => {
      try {
        const res = await api.get('/auth/terms/seller', { params: { _t: Date.now() } });
        setTermsMarkdown(res.data?.markdown || '');
        setPrivacyMarkdown(res.data?.privacy_markdown || '');
      } catch (err) {
        console.error('Failed to load legal documents', err);
      } finally {
        setIsLoadingLegal(false);
      }
    };
    fetchLegalDocs();
  }, []);

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
        console.error('Failed to load categories in onboarding form', err);
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };
    fetchCategories();
    return () => { isMounted = false; };
  }, []);

  // Hitung Usia Mitra dari Tanggal Lahir
  const calculateAge = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculatedAge = calculateAge(birthDate);
  const isAgeValid = calculatedAge !== null && calculatedAge >= 18;

  // Sinkronisasi Alamat Tempat Tinggal ke Alamat Toko
  const handleToggleSameAddress = (checked: boolean) => {
    setIsSameAddress(checked);
    if (checked) {
      setStoreAddress(personalAddress);
    }
  };

  // Upload Foto Sampel Produk (Max 1MB)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (samplePhotos.length >= 5) {
      showError('Batas maksimal adalah 5 foto contoh produk.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const availableSlots = 5 - samplePhotos.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);

    setIsUploadingPhoto(true);
    const updatedPhotos = [...samplePhotos];

    try {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const validFiles = filesToUpload.filter(file => {
        if (!allowedTypes.includes(file.type)) {
          showError(`Format file "${file.name}" tidak didukung. Harap gunakan format JPG, PNG, atau WEBP.`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Kompresi di browser (memangkas ukuran 3-10MB menjadi ~100KB) dan upload paralel via Promise.all
      const uploadTasks = validFiles.map(async (rawFile) => {
        try {
          const processedFile = await compressImage(rawFile, { maxWidth: 1280, maxHeight: 1280, quality: 0.85 });

          if (processedFile.size > 1 * 1024 * 1024) {
            showError(`File "${rawFile.name}" melebihi batas 1 MB.`);
            return null;
          }

          const formData = new FormData();
          formData.append('photo', processedFile);

          const res = await api.post('/users/me/sample-photos', formData);
          return res.data?.photo_url as string | undefined;
        } catch (singleErr) {
          console.error(`Gagal mengunggah foto "${rawFile.name}":`, singleErr);
          showError(handleApiError(singleErr));
          return null;
        }
      });

      const uploadedUrls = (await Promise.all(uploadTasks)).filter((url): url is string => Boolean(url));

      if (uploadedUrls.length > 0) {
        const finalPhotos = [...updatedPhotos, ...uploadedUrls].slice(0, 5);
        setSamplePhotos(finalPhotos);
        success(`${uploadedUrls.length} foto contoh produk berhasil diunggah.`);
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Hapus Foto Sampel Produk
  const handleRemovePhoto = async (photoUrl: string) => {
    const match = photoUrl.match(/\/api\/media\/sample-products\/(.+)$/);
    if (!match || !match[1]) {
      setSamplePhotos(prev => prev.filter(p => p !== photoUrl));
      return;
    }

    const fileName = match[1];
    try {
      await api.delete(`/users/me/sample-photos/${fileName}`);
      setSamplePhotos(prev => prev.filter(p => p !== photoUrl));
      success('Foto contoh produk berhasil dihapus.');
    } catch (err) {
      console.error('Failed to delete photo', err);
      showError(handleApiError(err));
    }
  };

  // Scroll Listener untuk Syarat & Ketentuan
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (!hasScrolledTerms) {
        setHasScrolledTerms(true);
      }
    }
  };

  // Scroll Listener untuk Kebijakan Privasi
  const handlePrivacyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      if (!hasScrolledPrivacy) {
        setHasScrolledPrivacy(true);
      }
    }
  };

  // Submit Formulir Onboarding Mitra
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showError('Nama lengkap wajib diisi.');
      return;
    }
    let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('8')) cleanPhone = '0' + cleanPhone;
    if (!cleanPhone) {
      showError('Nomor WhatsApp / HP aktif wajib diisi.');
      return;
    }
    if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(cleanPhone)) {
      showError('Format nomor WhatsApp / HP tidak valid. Gunakan format nomor aktif Indonesia (contoh: 081234567890 atau +6281234567890).');
      return;
    }
    if (!personalAddress.trim()) {
      showError('Alamat tempat tinggal lengkap wajib diisi.');
      return;
    }
    if (!gender) {
      showError('Silakan pilih jenis kelamin Anda.');
      return;
    }
    if (!birthDate) {
      showError('Tanggal lahir wajib diisi.');
      return;
    }
    if (!isAgeValid) {
      showError('Pendaftaran mitra penjual mewajibkan usia minimal 18 tahun.');
      return;
    }
    if (!storeName.trim()) {
      showError('Nama toko wajib diisi.');
      return;
    }
    if (!storeDescription.trim()) {
      showError('Deskripsi toko wajib diisi (minimal 10 karakter).');
      return;
    }
    if (!storeAddress.trim()) {
      showError('Alamat toko wajib diisi.');
      return;
    }
    if (samplePhotos.length === 0) {
      showError('Silakan unggah minimal 1 foto contoh produk untuk kurasi awal mutu produk.');
      return;
    }
    if (!termsAccepted) {
      showError('Anda wajib membuka dan menyetujui Syarat & Ketentuan Kemitraan.');
      return;
    }
    if (!privacyAccepted) {
      showError('Anda wajib membuka dan menyetujui Kebijakan Privasi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        personal_address: personalAddress.trim(),
        phone_number: cleanPhone,
        gender,
        birth_date: birthDate,
        store_name: storeName.trim(),
        store_description: storeDescription.trim(),
        store_address: storeAddress.trim(),
        seller_sample_photos: samplePhotos,
        primary_niche: primaryNiche,
        bank_name: bankName.trim() || null,
        bank_account_number: bankAccountNumber.trim() || null,
        bank_account_holder: bankAccountHolder.trim() || null,
        terms_accepted: true,
        privacy_accepted: true
      };

      const res = await api.post('/users/me/register-seller', payload);

      setSubmittedSuccessModal(true);

      const updated: UserProfile = {
        ...profile,
        name: payload.name,
        personal_address: payload.personal_address,
        phone_number: payload.phone_number,
        gender: payload.gender,
        birth_date: payload.birth_date,
        store_name: payload.store_name,
        store_description: payload.store_description,
        store_address: payload.store_address,
        seller_sample_photos: payload.seller_sample_photos,
        primaryNiche: payload.primary_niche || '',
        bank_name: payload.bank_name || '',
        bank_account_number: payload.bank_account_number || '',
        bank_account_holder: payload.bank_account_holder || '',
        seller_status: 'pending',
        seller_applied_at: new Date().toISOString()
      };

      setTimeout(() => {
        onRegistrationSuccess(updated);
      }, 3000);

    } catch (err) {
      console.error('Submit onboarding error', err);
      showError(handleApiError(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-50 font-sans text-stone-900 pb-16">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center p-1.5 shadow-xs">
              <img src="/logo.svg" alt="Asisten Guru" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-brand-teal block leading-none font-sans">
                Asisten Guru
              </span>
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                Registrasi Calon Mitra
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        
        {/* Banner Sambutan & Prosedur */}
        <div className="bg-gradient-to-br from-teal-900 to-stone-900 rounded-3xl p-6 sm:p-8 text-white card-shadow mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-extrabold border border-teal-400/30 mb-3">
              <GraduationCap className="w-3.5 h-3.5 text-teal-300" />
              <span>Langkah Awal Kemitraan Kreator</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Lengkapi Formulir Registrasi Mitra Penjual
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-2 leading-relaxed">
              Selamat datang! Untuk menjaga keamanan ekosistem, mutu produk edukasi, serta kepatuhan hukum transaksi digital, silakan isi data diri, biodata toko, dan unggah foto contoh karya Anda.
            </p>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-teal-200 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>Verifikasi kurasi maksimal 3x24 jam kerja (07.00 - 15.00 WIB)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Data terlindungi & terenkripsi aman</span>
              </span>
            </div>
          </div>
        </div>

        {/* Form Pendaftaran */}
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SEKSI 1: BIODATA DIRI */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 card-shadow">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-stone-900 tracking-tight font-sans">
                  1. Biodata Diri Mitra (Kreator)
                </h2>
                <p className="text-xs text-stone-500">
                  Data identitas pribadi pemilik akun sesuai ketentuan hukum kemitraan
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Banner Peringatan Jika Nomor Belum Diatur di Akun Hub */}
              {!isPrefilledPhone && (
                <div className="sm:col-span-2 p-3.5 bg-amber-50 rounded-2xl border border-amber-200/90 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Nomor WhatsApp belum terhubung dari Hub:</span> Akun Asisten Guru Anda belum mengatur nomor WhatsApp. Mohon masukkan nomor aktif Anda di bawah ini dengan cermat agar admin/kurator dapat menghubungi Anda untuk proses kurasi kemitraan.
                  </div>
                </div>
              )}

              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, M.Pd."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                />
              </div>

              {/* Nomor WhatsApp / HP Aktif */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-800">
                    Nomor WhatsApp / HP Aktif <span className="text-rose-500">*</span>
                  </label>
                  {isPrefilledPhone && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      <span>Terisi dari Hub (Bisa diedit)</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                    <Phone className="w-4 h-4 text-stone-400" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Contoh: 081234567890 atau +6281234567890"
                    className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition font-mono"
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Digunakan admin untuk verifikasi seller & koordinasi</span>
                  {phoneNumber && (
                    /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(phoneNumber.replace(/[\s\-()]/g, '')) ? (
                      <span className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Format valid
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Contoh: 0812xxxxxxxx</span>
                    )
                  )}
                </div>
              </div>

              {/* Jenis Kelamin */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Jenis Kelamin <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGender('Laki-laki')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      gender === 'Laki-laki'
                        ? 'border-brand-teal bg-teal-50 text-brand-teal shadow-xs'
                        : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>Laki-laki</span>
                    {gender === 'Laki-laki' && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('Perempuan')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      gender === 'Perempuan'
                        ? 'border-brand-teal bg-teal-50 text-brand-teal shadow-xs'
                        : 'border-stone-200 bg-stone-50/50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>Perempuan</span>
                    {gender === 'Perempuan' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Tanggal Lahir (Wajib 18+) */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Tanggal Lahir (Wajib 18+) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition font-sans"
                  />
                </div>

                {/* Indikator Validasi Usia */}
                {birthDate && (
                  <div className="mt-1.5">
                    {isAgeValid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Usia memenuhi syarat ({calculatedAge} tahun)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>Wajib berusia minimal 18 tahun ({calculatedAge ?? 0} tahun)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Alamat Domisili / Tempat Tinggal */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Alamat Tempat Tinggal (Domisili Lengkap) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={personalAddress}
                  onChange={(e) => {
                    setPersonalAddress(e.target.value);
                    if (isSameAddress) {
                      setStoreAddress(e.target.value);
                    }
                  }}
                  placeholder="Nama jalan, RT/RW, nomor rumah, kelurahan, kecamatan, kota/kabupaten, provinsi, kode pos"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition resize-none"
                />
              </div>

            </div>
          </section>

          {/* SEKSI 2: BIODATA TOKO & ETALASE */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 card-shadow">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-stone-900 tracking-tight font-sans">
                  2. Biodata Toko & Etalase Digital
                </h2>
                <p className="text-xs text-stone-500">
                  Identitas toko yang akan tampil di halaman etalase dan kurasi pembeli
                </p>
              </div>
            </div>

            <div className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Nama Toko */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Nama Toko / Brand Edukasi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: Media Belajar Kreatif"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                  />
                </div>

                {/* Kategori / Niche Produk (Dinamis sesuai pengaturan Admin) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-800">
                      Fokus Kategori Produk Utama <span className="text-rose-500">*</span>
                    </label>
                    {isLoadingCategories && (
                      <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin text-brand-teal" />
                        Memuat kategori...
                      </span>
                    )}
                  </div>
                  <select
                    required
                    value={primaryNiche}
                    onChange={(e) => setPrimaryNiche(e.target.value)}
                    disabled={isLoadingCategories && categories.length === 0}
                    className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition font-sans disabled:opacity-60 cursor-pointer"
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

              {/* Deskripsi Toko */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Deskripsi Toko & Profil Kreator <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  placeholder="Ceritakan latar belakang Anda dan jenis produk digital edukasi yang Anda ciptakan untuk guru dan siswa..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition resize-none"
                />
              </div>

              {/* Alamat Toko dengan Fitur Sinkronisasi */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-800">
                    Alamat Operasional Toko <span className="text-rose-500">*</span>
                  </label>
                  
                  {/* Tombol Sinkronisasi Cepat */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!personalAddress) {
                        warning('Harap isi Alamat Tempat Tinggal terlebih dahulu untuk disinkronkan.');
                        return;
                      }
                      setStoreAddress(personalAddress);
                      setIsSameAddress(true);
                      success('Alamat toko berhasil disinkronkan dengan alamat tempat tinggal.');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-teal hover:text-brand-teal-dark cursor-pointer bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Sinkronkan dengan Alamat Diri</span>
                  </button>
                </div>

                <textarea
                  required
                  rows={3}
                  value={storeAddress}
                  onChange={(e) => {
                    setStoreAddress(e.target.value);
                    if (isSameAddress && e.target.value !== personalAddress) {
                      setIsSameAddress(false);
                    }
                  }}
                  placeholder="Alamat operasional atau studio toko Anda..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition resize-none"
                />

                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSameAddress}
                    onChange={(e) => handleToggleSameAddress(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-stone-300 accent-teal-600 cursor-pointer"
                  />
                  <span className="text-xs text-stone-600 font-medium">
                    Alamat toko sama dengan alamat domisili pribadi
                  </span>
                </label>
              </div>

              {/* Upload Foto Contoh Produk Kurasi (Max 1MB per file) */}
              <div className="pt-3 border-t border-stone-100">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-800">
                      Upload Foto Contoh Produk (Wajib Kurasi) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Unggah 1 s/d 5 contoh tangkapan layar / foto preview karya edukasi Anda (Format JPG, PNG, WEBP, <strong>maksimal 1 MB per file</strong>).
                    </p>
                  </div>

                  <span className="text-xs font-bold text-stone-400 shrink-0">
                    {samplePhotos.length}/5 Foto
                  </span>
                </div>

                {/* Upload Button & Trigger */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                />

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                  {/* Foto yang sudah terunggah */}
                  {samplePhotos.map((url, idx) => (
                    <div key={idx} className="relative group rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 aspect-square shadow-xs">
                      <img
                        src={getSafeUrl(url)}
                        alt={`Contoh Produk ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center p-2">
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(url)}
                          className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition cursor-pointer"
                          title="Hapus foto ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}

                  {/* Slot Tambah Foto */}
                  {samplePhotos.length < 5 && (
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-300 hover:border-brand-teal rounded-2xl aspect-square flex flex-col items-center justify-center p-3 text-center transition bg-stone-50 hover:bg-teal-50/50 group cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-5 h-5 text-brand-teal animate-spin mb-1" />
                          <span className="text-[11px] text-stone-500 font-bold">Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-stone-400 group-hover:text-brand-teal mb-1 transition-colors" />
                          <span className="text-xs font-bold text-stone-700 group-hover:text-brand-teal transition-colors">
                            Tambah Foto
                          </span>
                          <span className="text-[10px] text-stone-400 mt-0.5">Maks 1 MB</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {samplePhotos.length === 0 && (
                  <p className="text-[11px] text-amber-700 font-medium bg-amber-50 py-1.5 px-3 rounded-xl border border-amber-200 mt-3 inline-flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Wajib mengunggah minimal 1 foto contoh produk untuk kurasi kualitas Super Admin.</span>
                  </p>
                )}
              </div>

            </div>
          </section>

          {/* SEKSI 3: REKENING PENCAIRAN (OPSIONAL) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 card-shadow">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-stone-900 tracking-tight font-sans">
                  3. Rekening Pencairan Royalti (Opsional)
                </h2>
                <p className="text-xs text-stone-500">
                  Rekening untuk menerima pembayaran hasil penjualan karya Anda (dapat diubah nanti di Profil Toko)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nama Bank
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="BCA / Mandiri / BNI / BRI"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Contoh: 1234567890"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Nama Pemilik Rekening
                </label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="Nama sesuai buku tabungan"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                />
              </div>
            </div>
          </section>

          {/* SEKSI 4: HALAMAN LEGAL (S&K & PRIVASI - WAJIB DIBUKA & DI-SCROLL) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 card-shadow">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-stone-100">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-stone-900 tracking-tight font-sans">
                  4. Halaman Legal: Syarat, Ketentuan & Kebijakan Privasi
                </h2>
                <p className="text-xs text-stone-500">
                  Wajib membuka dan menggulir (scroll) setiap dokumen legal hingga baris terakhir sebelum mencentang persetujuan
                </p>
              </div>
            </div>

            {/* Tab Selector Dokumen */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setActiveLegalTab('terms')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeLegalTab === 'terms'
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>1. Syarat & Ketentuan Kemitraan</span>
                {hasScrolledTerms ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveLegalTab('privacy')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeLegalTab === 'privacy'
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>2. Kebijakan Privasi</span>
                {hasScrolledPrivacy ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                )}
              </button>

              <a
                href={activeLegalTab === 'terms' ? '/tos' : '/privacy'}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-teal hover:bg-teal-50 rounded-lg transition"
                title="Buka dokumen resmi di halaman penuh (tab baru)"
              >
                <span>Buka di Halaman Penuh</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Kotak Dokumen Scrollable */}
            <div className="relative border border-stone-200 rounded-2xl bg-stone-50/60 overflow-hidden mb-4">
              
              {/* Petunjuk Scroll jika belum scroll ke bawah */}
              {((activeLegalTab === 'terms' && !hasScrolledTerms) || (activeLegalTab === 'privacy' && !hasScrolledPrivacy)) && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] font-bold text-amber-800 flex items-center justify-between">
                  <span>Gulir (scroll) ke bawah hingga akhir isi dokumen untuk mengaktifkan kotak persetujuan.</span>
                  <span className="animate-bounce">↓</span>
                </div>
              )}

              {/* Status jika sudah scroll */}
              {((activeLegalTab === 'terms' && hasScrolledTerms) || (activeLegalTab === 'privacy' && hasScrolledPrivacy)) && (
                <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dokumen telah selesai dibaca. Kotak centang persetujuan terbuka.</span>
                </div>
              )}

              {/* Kontainer Isi Dokumen */}
              <div
                ref={activeLegalTab === 'terms' ? termsScrollRef : privacyScrollRef}
                onScroll={activeLegalTab === 'terms' ? handleTermsScroll : handlePrivacyScroll}
                className="p-5 max-h-64 overflow-y-auto text-xs text-stone-700 leading-relaxed font-sans prose prose-stone max-w-none"
              >
                {isLoadingLegal ? (
                  <div className="py-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-teal mb-2" />
                    <span className="text-stone-400 text-xs">Memuat dokumen resmi...</span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeLegalTab === 'terms' ? termsMarkdown : privacyMarkdown}
                  </ReactMarkdown>
                )}
              </div>
            </div>

            {/* Checkboxes Persetujuan (HANYA AKTIF JIKA DOKUMEN SUDAH DI-SCROLL) */}
            <div className="space-y-3 pt-2">
              
              {/* Checkbox 1: ToS */}
              <div className={`p-4 rounded-2xl border transition-all ${
                hasScrolledTerms ? 'bg-stone-50/80 border-stone-200' : 'bg-stone-100/50 border-stone-200/50 opacity-60'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!hasScrolledTerms}
                    checked={termsAccepted}
                    onChange={(e) => {
                      if (!hasScrolledTerms) {
                        warning('Harap buka dan gulir dokumen Syarat & Ketentuan hingga akhir terlebih dahulu.');
                        return;
                      }
                      setTermsAccepted(e.target.checked);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-stone-300 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="text-xs text-stone-700 leading-snug">
                    <span className="font-bold text-stone-900 block mb-0.5">
                      Persetujuan Syarat & Ketentuan Kemitraan Kreator Asisten Guru
                    </span>
                    <span>
                      Saya telah membaca, memahami, dan menyetujui seluruh ketentuan kemitraan, standar mutu kurasi produk, bagi hasil royalti, dan kebijakan hak kekayaan intelektual Asisten Guru.
                    </span>
                    {!hasScrolledTerms && (
                      <span className="text-[10.5px] text-amber-700 font-bold block mt-1">
                        * Buka tab Syarat & Ketentuan di atas dan gulir hingga akhir untuk mencentang.
                      </span>
                    )}
                  </div>
                </label>
              </div>

              {/* Checkbox 2: Privacy Policy */}
              <div className={`p-4 rounded-2xl border transition-all ${
                hasScrolledPrivacy ? 'bg-stone-50/80 border-stone-200' : 'bg-stone-100/50 border-stone-200/50 opacity-60'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!hasScrolledPrivacy}
                    checked={privacyAccepted}
                    onChange={(e) => {
                      if (!hasScrolledPrivacy) {
                        warning('Harap buka dan gulir dokumen Kebijakan Privasi hingga akhir terlebih dahulu.');
                        return;
                      }
                      setPrivacyAccepted(e.target.checked);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-stone-300 accent-teal-600 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="text-xs text-stone-700 leading-snug">
                    <span className="font-bold text-stone-900 block mb-0.5">
                      Persetujuan Kebijakan Privasi & Pemrosesan Data Sensitif (UU PDP No. 27/2022)
                    </span>
                    <span>
                      Saya menyetujui pemrosesan data identitas pribadi, data rekening bank, serta berkas kurasi karya saya untuk keperluan administrasi kemitraan resmi Asisten Guru.
                    </span>
                    {!hasScrolledPrivacy && (
                      <span className="text-[10.5px] text-amber-700 font-bold block mt-1">
                        * Buka tab Kebijakan Privasi di atas dan gulir hingga akhir untuk mencentang.
                      </span>
                    )}
                  </div>
                </label>
              </div>

            </div>
          </section>

          {/* TOMBOL SUBMIT & NOTIFIKASI OPERASIONAL */}
          <div className="bg-stone-900 rounded-3xl p-6 sm:p-8 text-white card-shadow flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-xl text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>SOP Peninjauan Kurasi</span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                Siap Mengajukan Kemitraan?
              </h3>
              <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                Setelah mengirimkan pendaftaran, tim Super Admin kami akan memverifikasi permohonan Anda dalam waktu <strong>maksimal 3x24 jam kerja</strong> (Senin – Jumat, pukul <strong>07.00 – 15.00 WIB</strong>).
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isAgeValid || samplePhotos.length === 0 || !termsAccepted || !privacyAccepted}
              className="w-full md:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-teal-900/40 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Mengirimkan Pendaftaran...</span>
                </>
              ) : (
                <>
                  <span>Kirim & Ajukan Verifikasi Kemitraan</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

        </form>

      </main>

      {/* Modal Notifikasi Sukses Pendaftaran */}
      {submittedSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center card-shadow border border-stone-200 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brand-teal" />
            </div>
            
            <h2 className="text-xl font-extrabold text-stone-900 font-sans tracking-tight">
              Pendaftaran Berhasil Dikirim!
            </h2>
            
            <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
              Data pendaftaran dan portofolio kurasi Anda telah tersimpan dengan aman. Pengajuan kemitraan Anda akan diverifikasi oleh tim maksimal <strong>3x24 jam</strong> di hari kerja (<strong>07.00 – 15.00 WIB</strong>).
            </p>

            <div className="mt-5 p-3.5 rounded-2xl bg-teal-50/80 border border-teal-100 text-[11px] text-teal-800 font-medium">
              <span>Mengarahkan Anda ke halaman status peninjauan...</span>
            </div>

            <div className="mt-6 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
