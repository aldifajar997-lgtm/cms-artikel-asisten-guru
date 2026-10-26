import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  FileBox,
  RefreshCw,
  Sparkles,
  Lock,
  Download,
  Check,
  ShieldCheck
} from 'lucide-react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import api from '../utils/api';
import { Product, ProductStatus, Category } from '../types';
import { generateSlug } from '../utils/seoAnalyzer';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

interface ProductEditorProps {
  product: Product;
  categories: Category[];
  onSave: (updatedProduct: Product) => Promise<void>;
  onBack: () => void;
  setHasUnsavedChanges?: (hasChanges: boolean) => void;
}

const EDITOR_OPTIONS = {
  height: 'auto',
  minHeight: '200px',
  placeholder: 'Tuliskan deskripsi produk digital Anda di sini...',
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic', 'strike'],
    ['fontColor', 'hiliteColor'],
    ['outdent', 'indent', 'align', 'list'],
    ['link', 'image'],
    ['showBlocks', 'codeView']
  ]
};

export const ProductEditor: React.FC<ProductEditorProps> = ({
  product,
  categories,
  onSave,
  onBack,
  setHasUnsavedChanges,
}) => {
  const { success, warning, error: showError, info } = useToast();
  const { show: showConfirm } = useConfirm();
  const isArchived = product.status === 'archived';
  
  // Form states
  const [title, setTitle] = useState(product.title || '');
  const [slug, setSlug] = useState(product.slug || generateSlug(product.title || ''));
  const [description, setDescription] = useState(product.description || '');
  const [price, setPrice] = useState<string>(product.price.toString());
  const [originalPrice, setOriginalPrice] = useState<string>(product.original_price ? product.original_price.toString() : '');
  const [status, setStatus] = useState<ProductStatus>(product.status || 'draft');
  const [coverImageKey, setCoverImageKey] = useState<string | null>(product.cover_image_key || null);
  const [coverImageAlt, setCoverImageAlt] = useState<string>(product.cover_image_alt || '');
  const [detailImage1Key, setDetailImage1Key] = useState<string | null>(product.detail_image_1_key || null);
  const [detailImage1Alt, setDetailImage1Alt] = useState<string>(product.detail_image_1_alt || '');
  const [detailImage2Key, setDetailImage2Key] = useState<string | null>(product.detail_image_2_key || null);
  const [detailImage2Alt, setDetailImage2Alt] = useState<string>(product.detail_image_2_alt || '');
  const [detailImage3Key, setDetailImage3Key] = useState<string | null>(product.detail_image_3_key || null);
  const [detailImage3Alt, setDetailImage3Alt] = useState<string>(product.detail_image_3_alt || '');
  const [fileR2Key, setFileR2Key] = useState<string | null>(product.file_r2_key || null);
  const [categoryId, setCategoryId] = useState<string>(product.category_id || '');
  const [metaTitle, setMetaTitle] = useState(product.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(product.meta_description || '');

  const [isSaving, setIsSaving] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [hasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false);

  // Upload states
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingDetail, setIsUploadingDetail] = useState<{ [key: number]: boolean }>({ 1: false, 2: false, 3: false });
  
  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');

  // Deteksi perubahan belum disimpan
  useEffect(() => {
    const isChanged = 
      title !== product.title ||
      slug !== product.slug ||
      description !== (product.description || '') ||
      price !== product.price.toString() ||
      originalPrice !== (product.original_price?.toString() || '') ||
      coverImageKey !== (product.cover_image_key || null) ||
      coverImageAlt !== (product.cover_image_alt || '') ||
      detailImage1Key !== (product.detail_image_1_key || null) ||
      detailImage1Alt !== (product.detail_image_1_alt || '') ||
      detailImage2Key !== (product.detail_image_2_key || null) ||
      detailImage2Alt !== (product.detail_image_2_alt || '') ||
      detailImage3Key !== (product.detail_image_3_key || null) ||
      detailImage3Alt !== (product.detail_image_3_alt || '') ||
      fileR2Key !== (product.file_r2_key || null) ||
      categoryId !== (product.category_id || '') ||
      metaTitle !== (product.meta_title || '') ||
      metaDescription !== (product.meta_description || '') ||
      status !== product.status;

    setLocalHasUnsavedChanges(isChanged);
    if (setHasUnsavedChanges) {
      setHasUnsavedChanges(isChanged);
    }
  }, [
    title, slug, description, price, originalPrice, 
    coverImageKey, coverImageAlt, detailImage1Key, detailImage1Alt, detailImage2Key, detailImage2Alt, detailImage3Key, detailImage3Alt,
    fileR2Key, categoryId, metaTitle, metaDescription, status, product, setHasUnsavedChanges
  ]);

  const handleAutoSlug = () => {
    if (!slug) {
      setSlug(generateSlug(title));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      warning('Ukuran gambar maksimal adalah 1MB.');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/media', formData);

      if (response.data?.result?.[0]?.url) {
        const url = response.data.result[0].url;
        const key = url.split('/').pop();
        if (key) setCoverImageKey(key);
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Gagal mengunggah cover produk.');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleDetailUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      warning('Ukuran gambar maksimal adalah 3MB.');
      if (detailInputRefs[index - 1].current) detailInputRefs[index - 1].current!.value = '';
      return;
    }

    setIsUploadingDetail(prev => ({ ...prev, [index]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'content');
      
      const response = await api.post('/media', formData);

      if (response.data?.result?.[0]?.url) {
        const url = response.data.result[0].url;
        const key = url.split('/').pop();
        if (key) {
          if (index === 1) setDetailImage1Key(key);
          else if (index === 2) setDetailImage2Key(key);
          else if (index === 3) setDetailImage3Key(key);
        }
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Gagal mengunggah gambar detail.');
    } finally {
      setIsUploadingDetail(prev => ({ ...prev, [index]: false }));
      if (detailInputRefs[index - 1].current) detailInputRefs[index - 1].current!.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      warning('Format berkas tidak diizinkan. Seluruh dokumen & materi modul wajib dikemas dalam format arsip .zip.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      warning('Ukuran file maksimal adalah 50MB.');
      return;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/products/upload-file', formData);

      if (response.data?.r2_key) {
        setFileR2Key(response.data.r2_key);
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Gagal mengunggah file produk.');
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

  const triggerSave = async (targetStatus: ProductStatus = status) => {
    if (!title.trim()) {
      warning('Judul produk wajib diisi!');
      return;
    }

    if (targetStatus === 'published') {
      if (!categoryId) {
        warning('Kategori produk wajib diisi!');
        return;
      }
      if (!price || isNaN(Number(price))) {
        warning('Harga produk tidak valid!');
        return;
      }
      if (!coverImageKey) {
        warning('Cover gambar produk wajib diunggah!');
        return;
      }
      const cleanDesc = description.replace(/<[^>]*>?/gm, '').trim();
      if (!cleanDesc && !description.includes('<img')) {
        warning('Deskripsi produk wajib diisi!');
        return;
      }
      if (!fileR2Key) {
        warning('File unduhan digital wajib diunggah!');
        return;
      }
    }

    let finalSlug = generateSlug(title) || slug.trim() || 'produk';
    
    setIsSaving(true);
    const prevStatus = status;
    setStatus(targetStatus);

    const updatedProduct: Product = {
      ...product,
      title,
      slug: finalSlug,
      description,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      status: targetStatus,
      cover_image_key: coverImageKey,
      cover_image_alt: coverImageAlt,
      detail_image_1_key: detailImage1Key,
      detail_image_1_alt: detailImage1Alt,
      detail_image_2_key: detailImage2Key,
      detail_image_2_alt: detailImage2Alt,
      detail_image_3_key: detailImage3Key,
      detail_image_3_alt: detailImage3Alt,
      file_r2_key: fileR2Key,
      category_id: categoryId || null,
      meta_title: metaTitle,
      meta_description: metaDescription,
      created_at: product.created_at || new Date().toISOString(),
    };

    try {
      await onSave(updatedProduct);
      setShowNotification(
        targetStatus === 'published' ? 'Produk berhasil dipublikasikan!' : 'Draft berhasil disimpan!'
      );
      setTimeout(() => setShowNotification(null), 3000);
    } catch (err) {
      setStatus(prevStatus); // revert if failed
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 bg-teal-900 text-white text-sm font-medium rounded-xl shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 bg-white shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (hasUnsavedChanges) {
                const confirmed = await showConfirm('Konfirmasi', 'Ada perubahan yang belum disimpan. Yakin ingin keluar?');
                if (!confirmed) return;
              }
              onBack();
            }}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-slate-800">
            {title.trim() ? title : 'Produk Baru'}
          </h1>
          {isArchived && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-semibold border border-gray-200">
              <AlertCircle className="w-3 h-3" />
              <span>Diarsipkan (Read-only)</span>
            </span>
          )}
          {!isArchived && hasUnsavedChanges && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-medium border border-amber-100">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              <span>Belum Disimpan</span>
            </span>
          )}
        </div>

        {!isArchived && (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              disabled={isSaving || isUploadingCover || Object.values(isUploadingDetail).some(v => v)}
              onClick={() => triggerSave('draft')}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSaving && status === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Draft</span>
            </button>

            <button
              disabled={isSaving || isUploadingCover || Object.values(isUploadingDetail).some(v => v)}
              onClick={() => triggerSave('published')}
              className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl shadow-lg hover:bg-teal-700 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSaving && status === 'published' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Publikasikan</span>
            </button>
          </div>
        )}
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden bg-white">
        {/* Main Area */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12 py-8 flex flex-col">
          <div className="w-full mx-auto flex flex-col flex-1 max-w-4xl">
            
            {/* Title & Meta Row */}
            <div className="mb-8">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitle(val);
                  setSlug(generateSlug(val));
                }}
                placeholder="Judul Produk Baru..."
                disabled={isArchived}
                className={`w-full text-3xl sm:text-4xl font-extrabold text-slate-900 border-none outline-none placeholder:text-slate-200 bg-transparent focus:ring-0 leading-tight ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
              />

              <div className="flex flex-wrap items-center gap-4 mt-6 border-b border-slate-100 pb-4 text-sm">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isArchived}
                  className={`font-medium text-slate-500 bg-transparent border-none outline-none focus:ring-0 cursor-pointer hover:text-teal-600 py-1 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.filter(c => c.type === 'product').map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200 select-none cursor-not-allowed" title="Slug produk dikunci otomatis dari judul produk">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>/{slug || generateSlug(title) || 'slug-produk'}</span>
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Harga Jual"
                    disabled={isArchived}
                    className={`bg-transparent border-none outline-none text-sm text-teal-800 font-bold placeholder:text-slate-300 w-24 focus:ring-0 py-0 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 line-through">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="Harga Coret (Opsional)"
                    disabled={isArchived}
                    className={`bg-transparent border-none outline-none text-xs text-slate-400 font-medium placeholder:text-slate-300 w-36 focus:ring-0 py-0 line-through ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Images: Cover & Details */}
            <div className="mb-8 space-y-4">
              {/* Upload Cover */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Cover Gambar <span className="text-rose-500">*</span></h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Rekomendasi: Resolusi 1200x900px (4:3) atau Persegi, Maksimal 1MB.</p>
                </div>
                
                {!coverImageKey ? (
                  <div
                    onClick={() => !isUploadingCover && !isArchived && coverInputRef.current?.click()}
                    className={`w-full h-48 border-2 border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    {isUploadingCover ? (
                      <Loader2 className="w-6 h-6 animate-spin text-teal-600 mb-2" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-xs font-bold text-slate-600">{isArchived ? 'Tanpa sampul' : 'Klik untuk unggah cover utama'}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full aspect-video md:aspect-[21/9] rounded-xl overflow-hidden border border-slate-200 group">
                    <img 
                      src={`${baseUrl}/media/${coverImageKey}`} 
                      alt="Cover" 
                      className="w-full h-full object-cover"
                    />
                    {!isArchived && (
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none group-hover:pointer-events-auto">
                        <button
                          onClick={() => { setCoverImageKey(null); setCoverImageAlt(''); }}
                          className="px-4 py-2 bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm"
                        >
                          Hapus Cover
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <input type="file" ref={coverInputRef} onChange={handleCoverUpload} accept="image/*" className="hidden" />

                {coverImageKey && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Alt Text (Cover SEO)</label>
                    <input
                      type="text"
                      value={coverImageAlt}
                      onChange={(e) => setCoverImageAlt(e.target.value)}
                      placeholder="Deskripsi gambar untuk SEO..."
                      disabled={isArchived}
                      className={`w-full text-sm px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                )}
              </div>

              {/* Upload Detail Images */}
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Detail Gambar (Opsional)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Rekomendasi: Resolusi Persegi 1080x1080px (1:1), Maksimal 1MB per file.</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { id: 1, key: detailImage1Key, setKey: setDetailImage1Key, alt: detailImage1Alt, setAlt: setDetailImage1Alt },
                    { id: 2, key: detailImage2Key, setKey: setDetailImage2Key, alt: detailImage2Alt, setAlt: setDetailImage2Alt },
                    { id: 3, key: detailImage3Key, setKey: setDetailImage3Key, alt: detailImage3Alt, setAlt: setDetailImage3Alt }
                  ].map((item) => (
                    <div key={item.id} className="flex flex-col">
                      <p className="text-[11px] font-bold text-slate-500 mb-2 text-center">Detail {item.id}</p>
                      {!item.key ? (
                        <div
                          onClick={() => !isUploadingDetail[item.id] && !isArchived && detailInputRefs[item.id - 1].current?.click()}
                          className={`w-full aspect-square border-2 border-dashed border-slate-200 rounded-xl bg-white flex flex-col items-center justify-center p-2 text-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
                        >
                          {isUploadingDetail[item.id] ? (
                            <Loader2 className="w-5 h-5 animate-spin text-teal-600 mb-1" />
                          ) : (
                            <>
                              <ImageIcon className="w-5 h-5 text-slate-400 mb-1" />
                              <p className="text-[10px] font-bold text-slate-600 leading-tight">Unggah</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 flex-1 flex flex-col">
                          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                            <img 
                              src={`${baseUrl}/media/${item.key}`} 
                              alt={`Detail ${item.id}`} 
                              className="w-full h-full object-cover"
                            />
                            {!isArchived && (
                              <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none group-hover:pointer-events-auto">
                                <button
                                  onClick={() => { item.setKey(null); item.setAlt(''); }}
                                  className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold rounded-lg shadow-sm"
                                >
                                  Hapus
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="mt-auto pt-1">
                            <label className="block text-[9px] font-bold text-slate-700 mb-0.5 truncate">Alt Text (SEO)</label>
                            <input
                              type="text"
                              value={item.alt}
                              onChange={(e) => item.setAlt(e.target.value)}
                              placeholder="Deskripsi..."
                              disabled={isArchived}
                              className={`w-full text-[10px] px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={detailInputRefs[item.id - 1]}
                        onChange={(e) => handleDetailUpload(e, item.id)}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 flex flex-col min-h-[400px] mb-8">
              <label className="block text-sm font-bold text-slate-800 mb-2">Deskripsi Produk <span className="text-rose-500">*</span></label>
              <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col">
                {useMemo(() => (
                  <SunEditor
                    defaultValue={description}
                    onChange={setDescription}
                    setOptions={EDITOR_OPTIONS}
                  />
                ), [])}
              </div>
            </div>

            {/* Upload File Digital */}
            <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-100 space-y-4 mb-8">
              <h3 className="text-sm font-bold text-slate-800">File Unduhan Digital <span className="text-rose-500">*</span></h3>
              
                {!fileR2Key ? (
                <div
                  onClick={() => !isUploadingFile && !isArchived && fileInputRef.current?.click()}
                  className={`w-full p-8 border-2 border-dashed border-blue-200 rounded-xl bg-white flex flex-col items-center justify-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}
                >
                  {isUploadingFile ? (
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                  ) : (
                    <>
                      <FileBox className="w-10 h-10 text-blue-400 mb-3" />
                      <p className="text-sm font-bold text-slate-700 text-center">{isArchived ? 'Tidak ada file' : 'Pilih berkas produk digital (.ZIP wajib)'}</p>
                      {!isArchived && <p className="text-xs text-slate-500 mt-1.5">Maks. 50MB. Seluruh dokumen & materi modul wajib dikemas dalam format .zip.</p>}
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0" />
                    <span className="text-sm font-bold text-teal-800 truncate" title={fileR2Key}>
                      {isArchived ? 'File terlindungi (read-only)' : `Arsip .ZIP Siap! (${fileR2Key})`}
                    </span>
                  </div>
                  {!isArchived && (
                    <button
                      onClick={() => setFileR2Key(null)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 shrink-0 px-3 py-1.5 bg-rose-50 rounded-lg cursor-pointer"
                    >
                      Hapus File
                    </button>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
              />

              {/* Box SOP Kurasi & Tombol Unduh Template README */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800">
                      SOP & Syarat Lolos Kurasi Produk Digital
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadReadmeTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-800 text-[11px] font-bold rounded-xl border border-teal-200 shadow-xs transition cursor-pointer self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600" />
                    <span>Unduh Template PANDUAN_PRODUK.txt</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Wajib ada README.txt:</strong> Jelaskan isi paket, panduan penggunaan, dan rincian tautan di dalam arsip ZIP.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Format Editable:</strong> Sertakan format yang bisa diedit (.docx/.pptx) atau tautan template Canva selain PDF.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Tautan Akses Publik:</strong> Jika ada link Canva/GDrive, pastikan hak akses sudah dibuka (View/Duplicate) tanpa perlu izin.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Anti-Phishing & Domain Asli:</strong> Dilarang menggunakan pemendek link (bit.ly/s.id) dan wajib bebas dari skrip terlarang.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Sidebar: Analysis Panel for Product */}
        <aside className="w-80 lg:w-88 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              Kelengkapan Produk
            </h3>
            
            <div className="space-y-2.5">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5">
                {title.trim().length >= 10 ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Judul Produk</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {title.trim().length >= 10 ? 'Judul sudah cukup panjang.' : 'Judul minimal 10 karakter.'}
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5">
                {coverImageKey ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Cover Gambar</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {coverImageKey ? 'Cover telah diunggah.' : 'Wajib mengunggah cover produk.'}
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5">
                {price && Number(price) > 0 ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Harga Jual</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {price && Number(price) > 0 ? 'Harga jual valid.' : 'Harga jual harus lebih dari 0.'}
                  </p>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5">
                {fileR2Key ? <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 leading-tight">File Digital</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {fileR2Key ? 'Arsip .zip siap dijual.' : 'Wajib mengunggah berkas materi .zip.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              SEO Meta Data
            </h3>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Meta Title</label>
                  <span className={`text-[10px] font-bold ${metaTitle.length > 60 ? 'text-rose-500' : metaTitle.length > 40 ? 'text-teal-600' : 'text-slate-400'}`}>
                    {metaTitle.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Judul untuk Google..."
                  className={`w-full text-xs px-3 py-2 bg-slate-50 border ${metaTitle.length > 60 ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-teal-500'} rounded-xl focus:ring-1 outline-none`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Meta Description</label>
                  <span className={`text-[10px] font-bold ${metaDescription.length > 160 ? 'text-rose-500' : metaDescription.length >= 120 ? 'text-teal-600' : 'text-slate-400'}`}>
                    {metaDescription.length}/160
                  </span>
                </div>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Deskripsi untuk Google..."
                  rows={4}
                  className={`w-full text-xs px-3 py-2 bg-slate-50 border ${metaDescription.length > 160 ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-teal-500'} rounded-xl focus:ring-1 outline-none resize-none`}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
