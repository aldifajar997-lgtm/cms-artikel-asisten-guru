import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  FileBox
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
  const { warning, error: showError, info } = useToast();
  const { show: showConfirm } = useConfirm();
  const isArchived = product.status === 'archived';
  
  // Form states
  const [title, setTitle] = useState(product.title || '');
  const [slug, setSlug] = useState(product.slug || '');
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

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

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
      
      const response = await api.post('/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

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

    if (file.size > 1 * 1024 * 1024) {
      warning('Ukuran gambar maksimal adalah 1MB.');
      if (detailInputRefs[index - 1].current) detailInputRefs[index - 1].current!.value = '';
      return;
    }

    setIsUploadingDetail(prev => ({ ...prev, [index]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

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

    if (file.size > 50 * 1024 * 1024) {
      warning('Ukuran file maksimal adalah 50MB.');
      return;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/products/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

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

  const triggerSave = async (targetStatus: ProductStatus = status) => {
    if (!title.trim()) {
      warning('Judul produk wajib diisi!');
      return;
    }

    if (!price || isNaN(Number(price))) {
      warning('Harga produk tidak valid!');
      return;
    }

    let finalSlug = slug.trim() || generateSlug(title);
    
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info (Left) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Judul Produk</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!product.id || product.id.startsWith('prod-')) handleAutoSlug();
                  }}
                  onBlur={handleAutoSlug}
                  placeholder="Contoh: Modul Belajar Bahasa Inggris..."
                  disabled={isArchived}
                  className={`w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-semibold ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Slug URL (Opsional)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="modul-belajar-bahasa-inggris"
                  disabled={isArchived}
                  className={`w-full text-xs px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 font-mono text-slate-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Deskripsi Produk</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {useMemo(() => (
                    <SunEditor
                      defaultValue={description}
                      onChange={setDescription}
                      setOptions={EDITOR_OPTIONS}
                    />
                  ), [])}
                </div>
              </div>
            </div>
          </div>

          {/* Settings & Upload (Right) */}
          <div className="space-y-6">
            
            {/* Category Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Kategori</h3>
              <div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isArchived}
                  className={`w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 cursor-pointer ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.filter(c => c.type === 'product').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SEO Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Pengaturan SEO</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Meta Title</label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Opsional (Default: Judul)"
                  className="w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Meta Description</label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Opsional (Default: Ekstrak deskripsi)"
                  rows={3}
                  className="w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Harga Produk</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Harga Jual (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  disabled={isArchived}
                  className={`w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Harga Coret / Asli (Opsional)</label>
                <input
                  type="number"
                  min="0"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="Opsional, misal harga sebelum diskon"
                  disabled={isArchived}
                  className={`w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 line-through text-slate-400 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>

            {/* Upload Cover */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Cover Gambar</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Rekomendasi: Resolusi 1200x900px (4:3) atau Persegi, Maksimal 1MB.</p>
              </div>
              
              {!coverImageKey ? (
                <div
                  onClick={() => !isUploadingCover && !isArchived && coverInputRef.current?.click()}
                  className={`w-full h-40 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                >
                  {isUploadingCover ? (
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600 mb-2" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-600">{isArchived ? 'Tanpa sampul' : 'Klik untuk unggah cover'}</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 group">
                  <img 
                    src={`${baseUrl}/media/${coverImageKey}`} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                  />
                  {!isArchived && (
                    <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button
                        onClick={() => { setCoverImageKey(null); setCoverImageAlt(''); }}
                        className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                      >
                        Hapus Cover
                      </button>
                    </div>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                className="hidden"
              />

              {coverImageKey && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Alt Text (Cover SEO)</label>
                  <input
                    type="text"
                    value={coverImageAlt}
                    onChange={(e) => setCoverImageAlt(e.target.value)}
                    placeholder="Deskripsi gambar untuk SEO..."
                    disabled={isArchived}
                    className={`w-full text-sm px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              )}
            </div>

            {/* Upload Detail Images */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Detail Gambar (Opsional, Maks 3)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Rekomendasi: Resolusi Persegi 1080x1080px (1:1) agar seragam, Maksimal 1MB.</p>
              </div>
              
              <div className="space-y-6">
                {[
                  { id: 1, key: detailImage1Key, setKey: setDetailImage1Key, alt: detailImage1Alt, setAlt: setDetailImage1Alt },
                  { id: 2, key: detailImage2Key, setKey: setDetailImage2Key, alt: detailImage2Alt, setAlt: setDetailImage2Alt },
                  { id: 3, key: detailImage3Key, setKey: setDetailImage3Key, alt: detailImage3Alt, setAlt: setDetailImage3Alt }
                ].map((item) => (
                  <div key={item.id} className="pt-4 border-t border-slate-100 first:pt-0 first:border-0">
                    <p className="text-xs font-bold text-slate-500 mb-2">Detail {item.id}</p>
                    {!item.key ? (
                      <div
                        onClick={() => !isUploadingDetail[item.id] && !isArchived && detailInputRefs[item.id - 1].current?.click()}
                        className={`w-full h-32 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100'}`}
                      >
                        {isUploadingDetail[item.id] ? (
                          <Loader2 className="w-5 h-5 animate-spin text-teal-600 mb-2" />
                        ) : (
                          <>
                            <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                            <p className="text-xs font-bold text-slate-600">Klik untuk unggah</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 group">
                          <img 
                            src={`${baseUrl}/media/${item.key}`} 
                            alt={`Detail ${item.id}`} 
                            className="w-full h-full object-cover"
                          />
                          {!isArchived && (
                            <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <button
                                onClick={() => { item.setKey(null); item.setAlt(''); }}
                                className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
                              >
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-1">Alt Text (SEO)</label>
                          <input
                            type="text"
                            value={item.alt}
                            onChange={(e) => item.setAlt(e.target.value)}
                            placeholder="Deskripsi gambar..."
                            disabled={isArchived}
                            className={`w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
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

            {/* Upload File Digital */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800">File Unduhan Digital</h3>
              
              {!fileR2Key ? (
                <div
                  onClick={() => !isUploadingFile && !isArchived && fileInputRef.current?.click()}
                  className={`w-full p-6 border-2 border-dashed border-slate-200 rounded-xl bg-blue-50/50 flex flex-col items-center justify-center transition-colors ${isArchived ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50'}`}
                >
                  {isUploadingFile ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                  ) : (
                    <>
                      <FileBox className="w-8 h-8 text-blue-400 mb-2" />
                      <p className="text-xs font-bold text-slate-600 text-center">{isArchived ? 'Tidak ada file' : 'Pilih file produk digital (.zip, .pdf)'}</p>
                      {!isArchived && <p className="text-[10px] text-slate-400 mt-1">Maks. 50MB</p>}
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                    <span className="text-xs font-bold text-teal-800 truncate" title={fileR2Key}>
                      {isArchived ? 'File terlindungi (read-only)' : `File Siap! (${fileR2Key.substring(0, 15)}...)`}
                    </span>
                  </div>
                  {!isArchived && (
                    <button
                      onClick={() => setFileR2Key(null)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".zip,.rar,.pdf"
                className="hidden"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
