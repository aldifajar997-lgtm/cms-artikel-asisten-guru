import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  FileBox,
  RefreshCw,
  Send,
  Search,
  GraduationCap,
  Link as LinkIcon,
  Save,
  Lock,
  Eye,
  Package,
  ShieldCheck,
  Calculator,
  Sparkles,
  Coins,
  ArrowRight,
  XCircle,
  Download,
  Check
} from 'lucide-react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import api, { handleApiError } from '../utils/api';
import { Product, ProductStatus, Category, FeePolicy } from '../types';
import { generateSlug } from '../utils/seoAnalyzer';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatCurrency } from '../utils/dateFormatter';
import { 
  calculateDiscountPercentage, 
  calculateProductEarningsWithPolicy,
  estimateProductEarnings 
} from '../utils/financialCalculations';
import { getMediaUrl } from '../utils/mediaUrl';
import { SellerNetCalculatorModal } from './SellerNetCalculatorModal';
import { compressImage } from '../utils/imageCompressor';

interface ProductEditorProps {
  product: Product;
  categories: Category[];
  onSave: (savedProduct: Product) => Promise<string | void>;
  onBack: () => void;
  setHasUnsavedChanges?: (hasChanges: boolean) => void;
}

const EDITOR_OPTIONS = {
  height: 'auto',
  minHeight: '220px',
  placeholder: 'Tuliskan deskripsi lengkap, keunggulan, serta panduan produk digital Anda...',
  linkProtocol: 'https://',
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic'],
    ['fontColor', 'hiliteColor'],
    ['align', 'list'],
    ['link', 'image'],
    ['fullScreen', 'codeView']
  ]
};

const stripHtml = (val?: string | null): string => {
  return val ? val.replace(/<[^>]*>?/gm, '').trim() : '';
};

export const ProductEditor: React.FC<ProductEditorProps> = ({
  product,
  categories,
  onSave,
  onBack,
  setHasUnsavedChanges,
}) => {
  const { success, warning, error: showError } = useToast();
  const { show: showConfirm } = useConfirm();

  // Form states
  const [title, setTitle] = useState(product.title || '');
  const [slug, setSlug] = useState(product.slug || generateSlug(product.title || ''));
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState<string>(product.price ? product.price.toString() : '0');
  const [originalPrice, setOriginalPrice] = useState<string>(product.original_price ? product.original_price.toString() : '');
  const [status, setStatus] = useState<ProductStatus>(product.status || 'draft');
  const [coverImageKey, setCoverImageKey] = useState<string | null>(product.cover_image_key || null);
  const [coverImageAlt, setCoverImageAlt] = useState<string>(product.cover_image_alt || '');
  const [detailImage1Key, setDetailImage1Key] = useState<string | null>(product.detail_image_1_key || null);
  const [detailImage2Key, setDetailImage2Key] = useState<string | null>(product.detail_image_2_key || null);
  const [detailImage3Key, setDetailImage3Key] = useState<string | null>(product.detail_image_3_key || null);
  const [fileR2Key, setFileR2Key] = useState<string | null>(product.file_r2_key || null);
  const [categoryId, setCategoryId] = useState<string>(product.category_id || '');
  const [metaTitle, setMetaTitle] = useState(product.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(product.meta_description || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingDetail, setIsUploadingDetail] = useState<{ [key: number]: boolean }>({ 1: false, 2: false, 3: false });

  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [policy, setPolicy] = useState<FeePolicy | null>(() => {
    try {
      const cached = localStorage.getItem('cached_fee_policy');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.get('/earnings/policy', { params: { _t: Date.now() } }).then(res => {
      if (!isMounted) return;
      const pol = res.data?.policy || res.data?.current_fee_policy || res.data?.data;
      if (pol) {
        setPolicy(pol);
        try {
          localStorage.setItem('cached_fee_policy', JSON.stringify(pol));
        } catch {}
      }
    }).catch(err => {
      console.warn('Gagal memuat kebijakan royalti dinamis:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);
  const detailInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Deteksi perubahan
  useEffect(() => {
    const isChanged = 
      title !== (product.title || '') ||
      slug !== (product.slug || '') ||
      description !== (product.description || '') ||
      price !== (product.price ? product.price.toString() : '0') ||
      originalPrice !== (product.original_price ? product.original_price.toString() : '') ||
      coverImageKey !== (product.cover_image_key || null) ||
      detailImage1Key !== (product.detail_image_1_key || null) ||
      detailImage2Key !== (product.detail_image_2_key || null) ||
      detailImage3Key !== (product.detail_image_3_key || null) ||
      fileR2Key !== (product.file_r2_key || null) ||
      status !== (product.status || 'draft') ||
      categoryId !== (product.category_id || '') ||
      metaTitle !== (product.meta_title || '') ||
      metaDescription !== (product.meta_description || '');

    setHasUnsavedChanges?.(isChanged);
  }, [title, slug, description, price, originalPrice, coverImageKey, detailImage1Key, detailImage2Key, detailImage3Key, fileR2Key, status, categoryId, metaTitle, metaDescription]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(generateSlug(val));
  };

  // Upload Cover Image ke Cloudflare R2
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('File cover harus berupa gambar (JPG, PNG, atau WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Ukuran gambar cover maksimal 5MB.');
      return;
    }

    setIsUploadingCover(true);
    try {
      const processedFile = await compressImage(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.85 });
      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('type', 'featured');

      const res = await api.post('/media', formData);
      const url = res.data?.result?.[0]?.url;
      const key = url ? url.split('/').pop() : null;
      if (key) {
        setCoverImageKey(key);
        success('Foto cover produk berhasil diunggah.');
      }
    } catch (err) {
      console.error('Upload cover error', err);
      showError(handleApiError(err));
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Upload Gambar Detail (1, 2, 3)
  const handleDetailUpload = async (index: 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showError(`Ukuran foto detail #${index} maksimal 3MB.`);
      if (detailInputRefs[index - 1].current) detailInputRefs[index - 1].current!.value = '';
      return;
    }

    setIsUploadingDetail(prev => ({ ...prev, [index]: true }));
    try {
      const processedFile = await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.85 });
      const formData = new FormData();
      formData.append('file', processedFile);
      formData.append('type', 'content');

      const res = await api.post('/media', formData);
      const url = res.data?.result?.[0]?.url;
      const key = url ? url.split('/').pop() : null;
      if (key) {
        if (index === 1) setDetailImage1Key(key);
        if (index === 2) setDetailImage2Key(key);
        if (index === 3) setDetailImage3Key(key);
        success(`Foto detail #${index} berhasil diunggah.`);
      }
    } catch (err) {
      console.error('Upload detail error', err);
      showError(handleApiError(err));
    } finally {
      setIsUploadingDetail(prev => ({ ...prev, [index]: false }));
      if (detailInputRefs[index - 1].current) detailInputRefs[index - 1].current!.value = '';
    }
  };

  // Upload File Digital Produk (Wajib Format Arsip ZIP - max 50MB)
  const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      showError('Format berkas tidak diizinkan. Seluruh dokumen & materi modul wajib dikemas dalam format arsip .zip.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('Ukuran file produk maksimal 50MB.');
      return;
    }

    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/products/upload-file', formData);
      if (res.data?.r2_key) {
        setFileR2Key(res.data.r2_key);
        success('File aset digital berhasil diunggah dan disimpan dengan aman.');
      }
    } catch (err) {
      console.error('Upload digital file error', err);
      showError(handleApiError(err));
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Unduh Template PANDUAN_PRODUK.txt Resmi Sesuai SOP Kurasi
  const handleDownloadReadmeTemplate = () => {
    const templateText = `==================================================================
PANDUAN PENGGUNAAN & DAFTAR ISI PRODUK DIGITAL
Platform Marketplace Asisten Guru (asisten-guru.id)
==================================================================

1. INFORMASI PRODUK
------------------------------------------------------------------
Nama Produk : ${title.trim() || '[Tuliskan Nama Produk Anda]'}
Mata Pelajaran : [Contoh: Bahasa Indonesia / Matematika / IPA]
Jenjang / Fase / Kelas : [Contoh: Fase D - Kelas 7 SMP]
Kurikulum : Kurikulum Merdeka
Nama Toko / Kreator : [Tuliskan Nama Anda atau Nama Toko Anda]

2. DAFTAR BERKAS DI DALAM PAKET INI
------------------------------------------------------------------
Silakan susun berkas Anda ke dalam subfolder yang rapi, contoh:
- /01-Modul-Ajar/ : Dokumen modul ajar siap cetak (.pdf) dan siap edit (.docx)
- /02-LKPD/ : Lembar Kerja Peserta Didik (.pdf & .docx)
- /03-Asesmen/ : Kisi-kisi soal, rubrik penilaian, dan instrumen asesmen (.docx)
- /04-Media-Ajar/ : Slide presentasi (.pptx / tautan Canva)

3. TAUTAN EKSTERNAL (CANVA / GOOGLE DRIVE / APLIKASI MANDIRI) - JIKA ADA
------------------------------------------------------------------
Jika produk Anda menggunakan materi berbasis Cloud atau Aplikasi Software
(misal: Canva Template, Google Drive, Aplikasi Android APK, atau Web App),
wajib sebutkan tautannya secara transparan di bawah ini agar lolos kurasi:

[OPSI A: UNTUK MATERI CANVA / GOOGLE DRIVE]
Tautan   : [Tempel Tautan Canva / Google Drive di Sini]
Fungsi   : Desain interaktif / Video pembelajaran / Bank Soal
Status   : Wajib akses publik (Tanpa perlu izin/login privat)

[OPSI B: UNTUK APLIKASI SOFTWARE / APK ANDROID / SERVER MANDIRI]
Nama App : [Nama Aplikasi & Versi, misal: Aplikasi CBT Guru v1.2]
Tautan   : [Tempel Tautan Unduh Langsung / Play Store / Web App di Sini]
Platform : [Android / Windows / Web Browser]
Fungsi   : [Jelaskan apa fungsi aplikasi ini untuk guru/siswa]
Akun Uji : [Username/Password/Lisensi demo jika butuh login untuk kurator]
Catatan  : Wajib tautan langsung (DILARANG menggunakan safelink/iklan/bit.ly).
           Di dalam ZIP wajib disertakan buku panduan instalasi (.pdf).

4. KETENTUAN PENGGUNAAN & LISENSI
------------------------------------------------------------------
- Dokumen ini ditujukan untuk kebutuhan pembelajaran guru dan siswa di kelas.
- Dilarang menjual kembali materi ini atau membagikannya secara gratis di media
  sosial tanpa izin tertulis dari kreator resmi.
==================================================================`;

    const blob = new Blob([templateText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PANDUAN_PRODUK.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Template PANDUAN_PRODUK.txt berhasil diunduh! Masukkan file ini ke dalam arsip .zip Anda.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTitle = stripHtml(title);
    if (!cleanTitle) {
      showError('Judul produk wajib diisi.');
      return;
    }

    const parsedPrice = parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;
    const parsedOriginalPrice = originalPrice ? parseInt(originalPrice.replace(/[^0-9]/g, ''), 10) : undefined;

    if (parsedPrice < 0) {
      showError('Harga produk tidak boleh negatif.');
      return;
    }

    // Validasi ketat saat status diterbitkan (Published)
    if (status === 'published') {
      if (!categoryId) {
        showError('Pilih kategori produk terlebih dahulu sebelum menerbitkan produk.');
        return;
      }
      if (!coverImageKey) {
        showError('Foto cover utama wajib diunggah sebelum menerbitkan produk.');
        return;
      }
      if (!fileR2Key) {
        showError('File aset digital (.zip) wajib diunggah sebelum menerbitkan produk agar dapat diunduh pembeli.');
        return;
      }
      if (parsedPrice <= 0) {
        showError('Harga jual harus lebih dari Rp 0 untuk produk yang dipublikasikan.');
        return;
      }
      const plainDesc = description.replace(/<[^>]*>?/gm, '').trim();
      if (!plainDesc && !description.includes('<img')) {
        showError('Deskripsi lengkap produk wajib diisi.');
        return;
      }
    }

    if (description && description.length > 100000) {
      showError('Deskripsi lengkap produk melebihi batas maksimal 100.000 karakter.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProduct: Product = {
        ...product,
        title: cleanTitle,
        slug: slug.trim() || generateSlug(cleanTitle),
        description,
        price: parsedPrice,
        original_price: parsedOriginalPrice,
        status,
        cover_image_key: coverImageKey,
        cover_image_alt: stripHtml(coverImageAlt),
        detail_image_1_key: detailImage1Key,
        detail_image_2_key: detailImage2Key,
        detail_image_3_key: detailImage3Key,
        file_r2_key: fileR2Key,
        category_id: categoryId || null,
        meta_title: stripHtml(metaTitle),
        meta_description: stripHtml(metaDescription),
      };

      await onSave(updatedProduct);
      success('Draf produk digital berhasil disimpan!');
      setHasUnsavedChanges?.(false);
    } catch (err) {
      console.error('Save product error', err);
      showError(handleApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const parsedPrice = parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;
  const parsedOriginalPrice = originalPrice ? (parseInt(originalPrice.replace(/[^0-9]/g, ''), 10) || 0) : undefined;
  const discountPercentage = calculateDiscountPercentage(parsedOriginalPrice || 0, parsedPrice);
  const activeFeeBps = policy?.fee_bps ?? (policy?.fee_percent ? Math.round(parseFloat(policy.fee_percent) * 100) : 1500);
  const detailedEarnings = calculateProductEarningsWithPolicy(parsedPrice, policy, 'qris');
  const minProductPrice = policy?.min_product_price ?? 10000;

  // Ajukan Produk ke Antrean Kurasi Super Admin
  const handleSubmitReview = async () => {
    const cleanTitle = stripHtml(title);
    if (!cleanTitle) {
      showError('Nama produk wajib diisi.');
      return;
    }
    const minPriceLimit = policy?.min_product_price ?? 10000;
    if (parsedPrice < minPriceLimit) {
      showError(`Harga jual minimal ${formatCurrency(minPriceLimit)} sesuai kebijakan platform.`);
      return;
    }
    if (!categoryId) {
      showError('Pilih kategori produk terlebih dahulu sebelum mengajukan kurasi.');
      return;
    }
    if (!coverImageKey) {
      showError('Foto cover utama produk wajib diunggah sebelum mengajukan kurasi.');
      return;
    }
    if (!fileR2Key) {
      showError('Berkas digital produk (.zip) wajib diunggah sebelum mengajukan kurasi.');
      return;
    }

    if (parsedOriginalPrice && parsedOriginalPrice <= parsedPrice) {
      showError('Harga normal (coret) harus lebih tinggi dari harga jual.');
      return;
    }

    if (description && description.length > 100000) {
      showError('Deskripsi lengkap produk melebihi batas maksimal 100.000 karakter.');
      return;
    }

    const confirmed = await showConfirm(
      'Ajukan Kurasi Produk',
      'Produk akan dikirim ke Super Admin untuk ditinjau kelayakan mutu dan orisinalitasnya sebelum tayang di etalase utama Asisten Guru. Lanjutkan?'
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const targetStatus = product.status === 'needs_revision' ? 'needs_revision' : 'draft';
      const updatedProduct: Product = {
        ...product,
        title: cleanTitle,
        slug: generateSlug(cleanTitle) || slug.trim(),
        description: description.trim(),
        price: parsedPrice,
        original_price: parsedOriginalPrice,
        status: targetStatus,
        cover_image_key: coverImageKey,
        cover_image_alt: stripHtml(coverImageAlt),
        detail_image_1_key: detailImage1Key,
        detail_image_2_key: detailImage2Key,
        detail_image_3_key: detailImage3Key,
        file_r2_key: fileR2Key,
        category_id: categoryId || null,
        meta_title: stripHtml(metaTitle),
        meta_description: stripHtml(metaDescription),
      };

      const savedId = await onSave(updatedProduct);
      const targetId = savedId || product.id;
      await api.post(`/products/${targetId}/submit-review`);
      success('Produk berhasil diajukan! Super Admin akan meninjau produk Anda.');
      setHasUnsavedChanges?.(false);
      onBack();
    } catch (err) {
      console.error('Submit review error', err);
      showError(handleApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
      
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-stone-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 px-3.5 py-2 rounded-xl hover:bg-stone-100 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Katalog</span>
        </button>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Tombol Simpan Draf */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs sm:text-sm font-bold border border-stone-200 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
            ) : (
              <Save className="w-4 h-4 text-stone-600" />
            )}
            <span>Simpan Draf</span>
          </button>

          {/* Tombol Ajukan Kurasi */}
          <button
            type="button"
            onClick={handleSubmitReview}
            disabled={isSaving || product.status === 'pending_review'}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-teal/20 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : product.status === 'pending_review' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Sedang Ditinjau Admin</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-teal-200" />
                <span>
                  {product.status === 'needs_revision' 
                    ? 'Kirim Ulang Revisi' 
                    : product.status === 'rejected' 
                      ? 'Ajukan Ulang Kurasi' 
                      : 'Ajukan Kurasi Produk'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banner Peringatan Revisi Kurasi */}
      {product.status === 'needs_revision' && product.review_notes && (
        <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-300 text-stone-800 space-y-1.5 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Catatan Revisi dari Kurator Super Admin:</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-700 font-medium pl-6 leading-relaxed">
            "{product.review_notes}"
          </p>
          <p className="text-[11px] text-amber-800 pl-6">
            Silakan lakukan perbaikan yang diminta, lalu klik tombol <strong>"Kirim Ulang Revisi"</strong> di atas.
          </p>
        </div>
      )}

      {/* Banner Ditolak Kurasi */}
      {product.status === 'rejected' && (
        <div className="mb-6 p-5 rounded-2xl bg-rose-50 border border-rose-300 text-stone-800 space-y-1.5 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Produk Tidak Lolos Kurasi Super Admin:</span>
          </div>
          {product.review_notes && (
            <p className="text-xs sm:text-sm text-stone-700 font-medium pl-6 leading-relaxed">
              "{product.review_notes}"
            </p>
          )}
          <p className="text-[11px] text-rose-800 pl-6">
            Produk belum dapat diterbitkan. Anda dapat memperbarui data atau file materi di bawah ini, lalu klik tombol <strong>"Ajukan Ulang Kurasi"</strong> untuk ditinjau kembali.
          </p>
        </div>
      )}

      {/* Banner Menunggu Kurasi */}
      {product.status === 'pending_review' && (
        <div className="mb-6 p-4.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="text-xs leading-relaxed">
            <p className="font-bold">Produk ini sedang dalam antrean kurasi Super Admin.</p>
            <p className="text-indigo-700/80">Produk akan otomatis tayang di etalase publik Asisten Guru segera setelah disetujui.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Kolom Kiri & Tengah: Data Utama */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Informasi Dasar */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-5">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-teal" /> Informasi Produk
            </h2>

            {/* Judul Produk */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Nama / Judul Produk Digital <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={255}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Contoh: Modul Ajar Kurikulum Merdeka Matematika Fase E SMA"
                className="w-full px-4 py-2.5 text-xs sm:text-sm border border-stone-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal bg-stone-50/50 focus:bg-white transition"
              />
            </div>

            {/* Slug URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-stone-500" />
                  <span>Slug URL Produk</span>
                </label>
                <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                  Terkunci dari Judul
                </span>
              </div>
              <div className="flex items-center rounded-xl border border-stone-200 bg-stone-100/70 overflow-hidden cursor-not-allowed select-none">
                <span className="px-3 text-stone-400 text-xs font-mono shrink-0">/produk/</span>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={slug || generateSlug(title)}
                  className="w-full py-2.5 pr-4 text-xs font-mono bg-transparent text-stone-600 cursor-not-allowed outline-none select-all"
                  title="Slug produk otomatis dibuat dari judul produk dan dikunci."
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                Tautan URL unik produk digenerate otomatis dari judul produk tanpa skema custom slug.
              </p>
            </div>

            {/* Deskripsi Lengkap */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Deskripsi Lengkap & Panduan Produk
              </label>
              <div className="rounded-2xl overflow-hidden border border-stone-200">
                <SunEditor
                  setContents={description}
                  onChange={(content) => setDescription(content)}
                  setOptions={EDITOR_OPTIONS}
                />
              </div>
            </div>
          </div>

          {/* Card 2: File Aset Digital (Downloadable) */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <FileBox className="w-4 h-4 text-brand-teal" /> File Aset Digital (Diunduh Pembeli)
            </h2>
            <p className="text-xs text-stone-500">
              Kemas seluruh materi (dokumen modul, lembar kerja, materi presentasi) dalam satu file arsip <strong>.zip</strong>. Berkas hanya dapat diunduh oleh pembeli setelah transaksi berhasil (disimpan terenkripsi di Cloudflare R2).
            </p>

            <div className="p-4 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleDigitalFileUpload}
                className="hidden"
                accept=".zip,application/zip,application/x-zip-compressed"
              />
              {fileR2Key ? (
                <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <FileBox className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900 truncate max-w-xs">{fileR2Key}</p>
                      <p className="text-[10px] text-emerald-700 font-medium">Arsip .ZIP terhubung & siap dikurasi</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="text-xs font-bold text-brand-teal hover:underline px-2 py-1"
                  >
                    Ganti Berkas .ZIP
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-3">
                  <FileBox className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700">Unggah Berkas Materi (.ZIP, maks 50MB)</p>
                  <p className="text-[11px] text-stone-400 max-w-sm mx-auto leading-relaxed">
                    Wajib format <strong>.zip</strong> agar seluruh isi modul, lembar kerja siswa, dan kisi asesmen tersusun rapi.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="px-4 py-2 bg-white text-xs font-bold text-stone-800 rounded-xl border border-stone-200 hover:bg-stone-50 transition cursor-pointer"
                  >
                    {isUploadingFile ? 'Mengunggah...' : 'Pilih Berkas .ZIP'}
                  </button>
                </div>
              )}
            </div>

            {/* Box SOP Kurasi & Tombol Unduh Template README */}
            <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
                  <span className="text-xs font-bold text-stone-900">
                    SOP & Syarat Lolos Kurasi Produk Digital
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadReadmeTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-800 text-[11px] font-bold rounded-xl border border-teal-200 shadow-2xs transition cursor-pointer self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Unduh Template PANDUAN_PRODUK.txt</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-stone-600">
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5" />
                  <span><strong>Wajib ada README.txt:</strong> Jelaskan isi paket, panduan penggunaan, dan rincian tautan di dalam arsip ZIP.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5" />
                  <span><strong>Format Editable:</strong> Sertakan format yang bisa diedit (.docx/.pptx) atau tautan template Canva selain PDF.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5" />
                  <span><strong>Tautan Akses Publik:</strong> Jika ada link Canva/GDrive, pastikan hak akses sudah dibuka (View/Duplicate) tanpa perlu izin.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5" />
                  <span><strong>Anti-Phishing & Domain Asli:</strong> Dilarang menggunakan pemendek link (bit.ly/s.id) dan wajib bebas dari skrip terlarang.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: SEO Meta Tags */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-teal" /> Pengaturan SEO & Pencarian Google
            </h2>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Meta Title (Opsional)</label>
              <input
                type="text"
                maxLength={100}
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Judul untuk preview Google SERP"
                className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Meta Description (Opsional)</label>
              <textarea
                maxLength={300}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Deskripsi singkat yang memikat di hasil pencarian..."
                rows={2}
                className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white resize-none"
              ></textarea>
            </div>
          </div>

        </div>

        {/* Kolom Kanan: Pengaturan Harga, Kategori & Gambar Cover */}
        <div className="space-y-6">
          
          {/* Card Harga & Status */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-5">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Harga & Status
            </h2>

            {/* Status Penerbitan */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">Status Produk</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
              >
                <option value="draft">Draf (Belum tampil di toko)</option>
                <option value="published">Terpublikasi (Aktif di toko)</option>
                <option value="archived">Diarsipkan (Hanya pembeli lama)</option>
              </select>
            </div>

            {/* Harga Jual & Kalkulator Bersih */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-800">
                  Harga Jual (Rp) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-brand-teal">
                    {formatCurrency(parsedPrice)}
                  </span>
                </div>
              </div>
              <input
                type="number"
                required
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base font-extrabold text-stone-900 border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
              />

              {/* Quick Chips Preset Harga */}
              <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] font-bold text-stone-400 shrink-0 mr-1">Cepat:</span>
                {[15000, 25000, 50000, 75000, 100000, 150000].map((quickP) => (
                  <button
                    key={quickP}
                    type="button"
                    onClick={() => setPrice(quickP.toString())}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded-lg transition shrink-0 cursor-pointer ${
                      parsedPrice === quickP
                        ? 'bg-brand-teal text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 border border-stone-200/60'
                    }`}
                  >
                    {quickP >= 1000 ? `${quickP / 1000}rb` : quickP}
                  </button>
                ))}
              </div>

              {/* Rincian Real-time Kalkulasi Bersih per Penjualan */}
              {parsedPrice > 0 && (
                <div className="mt-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border border-teal-200/90 shadow-2xs text-xs space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-brand-teal" />
                      Estimasi Uang Bersih Mitra:
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-brand-teal bg-white px-2 py-0.5 rounded-md border border-teal-100 shadow-2xs">
                      {formatCurrency(detailedEarnings.net)}
                    </span>
                  </div>

                  {/* Rincian Dinamis Potongan Platform & Midtrans */}
                  <div className="space-y-1 text-[11px] text-stone-600 pt-1 border-t border-teal-100">
                    <div className="flex justify-between">
                      <span>Komisi Platform ({detailedEarnings.adminFeePercent}%):</span>
                      <strong className="text-stone-900">-{formatCurrency(detailedEarnings.adminFee)}</strong>
                    </div>

                    {detailedEarnings.midtransPayer === 'seller' ? (
                      <div className="space-y-0.5 pt-0.5">
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Midtrans QRIS ({detailedEarnings.midtransQrisPercent}):</span>
                          <span>-{formatCurrency(detailedEarnings.sellerDeductionMidtransQris)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Midtrans VA ({formatCurrency(detailedEarnings.midtransVaFee)}):</span>
                          <span>-{formatCurrency(detailedEarnings.sellerDeductionMidtransVa)}</span>
                        </div>
                        <p className="text-[10px] text-amber-800 font-medium">
                          * Sesuai aturan Admin: Biaya Midtrans dipotong dari seller (Bersih QRIS: {formatCurrency(detailedEarnings.netQRIS)} • VA: {formatCurrency(detailedEarnings.netVA)}).
                        </p>
                      </div>
                    ) : (
                      <div className="flex justify-between text-[10.5px] text-emerald-700 font-medium">
                        <span>Biaya Gateway Midtrans:</span>
                        <span>Rp 0 dipotong (Ditanggung {detailedEarnings.midtransPayer === 'platform' ? 'Platform' : 'Pembeli'})</span>
                      </div>
                    )}
                  </div>

                  {/* Split Visual Progress */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex justify-between text-[10px] font-semibold text-stone-500">
                      <span>Mitra ({detailedEarnings.netPercent}%)</span>
                      <span>Potongan ({detailedEarnings.feePercent}%): -{formatCurrency(detailedEarnings.fee)}</span>
                    </div>
                    <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(5, Math.min(95, detailedEarnings.netPercent))}%` }}
                        className="bg-brand-teal transition-all duration-300"
                        title={`Hak Bersih: ${detailedEarnings.netPercent}%`}
                      />
                      <div
                        style={{ width: `${Math.max(5, Math.min(95, detailedEarnings.feePercent))}%` }}
                        className="bg-stone-400 transition-all duration-300"
                        title={`Potongan: ${detailedEarnings.feePercent}%`}
                      />
                    </div>
                  </div>

                  {policy?.min_fee && (
                    <div className="text-[10px] text-stone-400 italic">
                      * Minimal potongan komisi platform: {formatCurrency(policy.min_fee)} per transaksi
                    </div>
                  )}
                </div>
              )}

              {/* Peringatan Jika di Bawah Harga Minimum Platform */}
              {parsedPrice > 0 && parsedPrice < minProductPrice && (
                <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center justify-between gap-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Min. platform: <strong>{formatCurrency(minProductPrice)}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrice(minProductPrice.toString())}
                    className="text-[10.5px] font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                  >
                    Atur ke Min
                  </button>
                </div>
              )}

              {/* Tombol Buka Kalkulator Lengkap */}
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(true)}
                className="w-full mt-2.5 p-3 rounded-2xl bg-stone-50 hover:bg-teal-50/60 border border-stone-200 hover:border-teal-300 text-stone-800 transition cursor-pointer flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center shrink-0 border border-teal-100 group-hover:bg-brand-teal group-hover:text-white transition">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-900 group-hover:text-brand-teal flex items-center gap-1">
                      <span>Kalkulator & Estimator Bersih</span>
                      <Sparkles className="w-2.5 h-2.5 text-brand-teal" />
                    </p>
                    <p className="text-[10px] text-stone-500">
                      Simulasikan target uang bersih, aturan Midtrans & proyeksi penjualan
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-brand-teal group-hover:translate-x-0.5 transition shrink-0" />
              </button>

              {/* Info Resmi Biaya Payment Gateway (Midtrans) dari Pengaturan Admin */}
              <div className="mt-2.5 p-3 bg-stone-50/90 rounded-2xl border border-stone-200/80 text-[11px] text-stone-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Pengaturan Biaya Gateway Midtrans Super Admin</span>
                </div>
                <p className="text-stone-500 leading-relaxed text-[10.5px]">
                  {policy?.midtrans?.note || (
                    detailedEarnings.midtransPayer === 'seller'
                      ? 'Sesuai kebijakan Super Admin, biaya layanan transaksi gateway Midtrans dipotong dari pendapatan hak seller.'
                      : detailedEarnings.midtransPayer === 'platform'
                      ? 'Sesuai kebijakan Super Admin, biaya layanan transaksi gateway Midtrans ditanggung penuh oleh platform.'
                      : 'Biaya layanan transaksi gerbang pembayaran resmi dari Midtrans dibebankan kepada pembeli saat checkout dan tidak mengurangi hak bersih royalti Anda.'
                  )}
                </p>
                <div className="flex items-center gap-2 pt-0.5 text-[10px] text-stone-400 font-medium">
                  <span>QRIS: {detailedEarnings.midtransQrisPercent}</span>
                  <span>•</span>
                  <span>VA: {formatCurrency(detailedEarnings.midtransVaFee)}</span>
                  <span>•</span>
                  <span className={`font-semibold ${detailedEarnings.midtransPayer === 'seller' ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {detailedEarnings.midtransPayerLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Harga Coret (Diskon) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-800">
                  Harga Normal / Coret (Rp, Opsional)
                </label>
                {discountPercentage > 0 && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Hemat {discountPercentage}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="Kosongkan jika tidak ada diskon"
                className="w-full px-3.5 py-2.5 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white"
              />
              {parsedOriginalPrice > 0 && parsedOriginalPrice <= parsedPrice && (
                <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Harga normal harus lebih besar dari harga jual agar diskon valid.</span>
                </p>
              )}
            </div>

            {/* Kategori */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Kategori Produk <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-stone-400 font-medium">Pengaturan Admin</span>
              </div>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white cursor-pointer"
              >
                <option value="">Pilih Kategori Produk...</option>
                {categories.filter((cat) => !cat.type || cat.type === 'product').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-stone-400 mt-1">
                Kategori produk dikelola resmi oleh Admin platform.
              </p>
            </div>
          </div>

          {/* Card Foto Cover */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center justify-between">
              <span>Foto Cover Utama</span>
              {coverImageKey && (
                <button
                  type="button"
                  onClick={() => setCoverImageKey(null)}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  Hapus
                </button>
              )}
            </h2>

            <input
              type="file"
              ref={coverInputRef}
              onChange={handleCoverUpload}
              className="hidden"
              accept="image/*"
            />

            <div 
              onClick={() => coverInputRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/70 hover:bg-stone-50 transition flex flex-col items-center justify-center p-3 cursor-pointer overflow-hidden relative"
            >
              {coverImageKey ? (
                <img
                  src={getMediaUrl(coverImageKey)}
                  alt="Cover"
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="text-center space-y-1.5">
                  <ImageIcon className="w-8 h-8 text-stone-400 mx-auto" />
                  <p className="text-xs font-semibold text-stone-700">Unggah Foto Cover</p>
                  <p className="text-[10px] text-stone-400">Rekomendasi 16:9 atau 4:3, maks 5MB</p>
                </div>
              )}
              {isUploadingCover && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
                </div>
              )}
            </div>
          </div>

          {/* Card Foto Detail Tambahan (Gallery) */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-3">
            <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Foto Preview Tambahan (Galeri)
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((idx) => {
                const key = idx === 1 ? detailImage1Key : idx === 2 ? detailImage2Key : detailImage3Key;
                return (
                  <div
                    key={idx}
                    onClick={() => detailInputRefs[idx - 1].current?.click()}
                    className="h-20 rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center cursor-pointer overflow-hidden relative hover:bg-stone-100 transition"
                  >
                    <input
                      type="file"
                      ref={detailInputRefs[idx - 1]}
                      onChange={(e) => handleDetailUpload(idx as 1 | 2 | 3, e)}
                      className="hidden"
                      accept="image/*"
                    />
                    {key ? (
                      <img
                        src={getMediaUrl(key)}
                        alt={`Detail ${idx}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-stone-400">Foto #{idx}</span>
                    )}
                    {isUploadingDetail[idx] && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </form>

      {/* Modal Kalkulator Pendapatan Bersih Seller */}
      <SellerNetCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        currentPrice={parsedPrice}
        onApplyPrice={(newPrice) => {
          setPrice(newPrice.toString());
          success(`Harga produk berhasil disesuaikan menjadi ${formatCurrency(newPrice)}`);
        }}
        policy={policy}
      />
    </div>
  );
};
