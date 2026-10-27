import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  User,
  ShoppingBag,
  ExternalLink,
  MessageSquare,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  FileText,
  AlertCircle,
  Check,
  Copy,
  Info,
  Link as LinkIcon,
  CheckSquare,
  Square,
  FileBox,
  Lock,
  Key
} from 'lucide-react';
import { Product } from '../types';
import { FileExplorer, FileItem } from './FileExplorer';
import { formatDateTime } from '../utils/dateFormatter';
import api, { handleApiError } from '../utils/api';
import { getMediaUrl } from '../utils/mediaUrl';

// Client-side HTML Sanitizer berbasis DOMParser native (bebas dependensi eksternal, anti-XSS)
const sanitizeHtml = (dirtyHtml?: string | null): string => {
  if (!dirtyHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHtml, 'text/html');

    // Buang tag berbahaya
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'link', 'style', 'base', 'applet'];
    dangerousTags.forEach(tag => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });

    // Buang attribute inline event listener dan URI skrip
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return doc.body.innerHTML;
  } catch {
    return '';
  }
};

interface ProductCurationProps {
  onProductCurated?: () => void;
  initialProductId?: string | null;
}

export const ProductCuration: React.FC<ProductCurationProps> = ({
  onProductCurated,
  initialProductId
}) => {
  const [queue, setQueue] = useState<Product[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail inspection state
  const [inspectionData, setInspectionData] = useState<any | null>(null);
  const [isLoadingInspection, setIsLoadingInspection] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'explorer' | 'sop_checklist' | 'details' | 'seller'>('explorer');

  // SOP Curation Checklist & Evaluator State
  const [copiedReadme, setCopiedReadme] = useState<boolean>(false);
  const [sopChecks, setSopChecks] = useState<{ [key: string]: boolean }>({
    isZipFormat: true,
    hasReadme: false,
    hasEditableFiles: false,
    linksVerified: false,
    noPhishing: true,
    contentMatches: false
  });

  // Modal Action State (Revisi / Tolak / Setujui)
  const [modalMode, setModalMode] = useState<'revision' | 'reject' | 'approve' | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');

  // Quick Action Helpers untuk Kurator
  const openRevisionModalWithNote = (suggestedNote: string) => {
    setModalMode('revision');
    setReviewNotes(suggestedNote);
  };

  const openRejectModalWithNote = (suggestedNote: string) => {
    setModalMode('reject');
    setReviewNotes(suggestedNote);
  };

  const toggleSopCheck = (key: string) => {
    setSopChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const markAllSopPass = () => {
    setSopChecks({
      isZipFormat: true,
      hasReadme: true,
      hasEditableFiles: true,
      linksVerified: true,
      noPhishing: true,
      contentMatches: true
    });
  };

  const handleCopyReadme = () => {
    const text = inspectionData?.archiveInfo?.sopAnalysis?.readmeContent;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedReadme(true);
      setTimeout(() => setCopiedReadme(false), 2000);
    }
  };

  const handleGenerateRevisionFromChecklist = () => {
    const missing: string[] = [];
    if (!sopChecks.isZipFormat) missing.push('- Format file wajib berupa arsip .ZIP utuh tanpa kerusakan.');
    if (!sopChecks.hasReadme) missing.push('- Belum menyertakan berkas PANDUAN_PRODUK.txt (atau README.txt) di dalam berkas ZIP.');
    if (!sopChecks.hasEditableFiles) missing.push('- Perlu menyertakan materi format mentahan (.docx/.pptx) atau link template Canva agar guru dapat mengedit isi materi.');
    if (!sopChecks.linksVerified) missing.push('- Tautan Canva/Google Drive tidak dapat diakses publik atau masih meminta izin akses khusus (terkunci).');
    if (!sopChecks.noPhishing) missing.push('- Ditemukan tautan pemendek link (bit.ly/s.id) yang berisiko keamanan. Wajib gunakan link asli langsung.');
    if (!sopChecks.contentMatches) missing.push('- Isi materi di dalam arsip ZIP belum sesuai dengan deskripsi atau foto cover produk.');

    if (missing.length === 0) {
      setFeedbackMessage({
        type: 'success',
        text: 'Seluruh kriteria SOP kurasi telah terpenuhi! Anda dapat langsung menyetujui dan menerbitkan produk ini.'
      });
      return;
    }

    const compiledNote = `Berdasarkan hasil kurasi berkas digital, mohon perbaiki poin-poin berikut sebelum produk dapat disetujui:\n\n${missing.join('\n')}\n\nSilakan perbaiki berkas dan ajukan kurasi kembali melalui dashboard mitra seller.`;
    openRevisionModalWithNote(compiledNote);
  };

  // Fetch antrean kurasi dengan prioritas auto-select
  const fetchQueue = async (targetSelectId?: string | null) => {
    setIsLoadingQueue(true);
    try {
      const res = await api.get('/products/admin/curation-queue');
      const items: Product[] = res.data?.data || [];
      setQueue(items);

      if (items.length > 0) {
        const preferredId = targetSelectId || selectedProductId || initialProductId;
        const exists = items.some(p => p.id === preferredId);
        if (exists && preferredId) {
          setSelectedProductId(preferredId);
        } else {
          setSelectedProductId(items[0].id);
        }
      } else {
        setSelectedProductId(null);
      }
    } catch (err: any) {
      console.error('Gagal mengambil antrean kurasi:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal memuat antrean kurasi. ' + handleApiError(err)
      });
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue(initialProductId);
  }, [initialProductId]);

  // Fetch detail files & metadata saat selectedProductId berganti (dengan guard anti-race condition)
  useEffect(() => {
    if (!selectedProductId) {
      setInspectionData(null);
      return;
    }

    let isCurrent = true;

    const fetchFiles = async () => {
      setIsLoadingInspection(true);
      try {
        const res = await api.get(`/products/admin/${selectedProductId}/files`);
        if (isCurrent) {
          setInspectionData(res.data);
          const sop = res.data?.archiveInfo?.sopAnalysis;
          setSopChecks({
            isZipFormat: Boolean(res.data?.product?.file_r2_key?.toLowerCase().endsWith('.zip')),
            hasReadme: Boolean(sop?.readmeStatus === 'found'),
            hasEditableFiles: Boolean(sop?.hasEditableFiles),
            linksVerified: Boolean(!sop?.externalUrls || sop.externalUrls.length === 0),
            noPhishing: Boolean(!sop?.externalUrls?.some((u: any) => u.isSuspicious)),
            contentMatches: false
          });
        }
      } catch (err: any) {
        if (isCurrent) {
          console.error('Gagal mengambil struktur berkas produk:', err);
          setFeedbackMessage({
            type: 'error',
            text: 'Gagal memuat berkas produk. ' + handleApiError(err)
          });
        }
      } finally {
        if (isCurrent) {
          setIsLoadingInspection(false);
        }
      }
    };

    fetchFiles();

    return () => {
      isCurrent = false;
    };
  }, [selectedProductId]);

  const selectedProduct = queue.find(p => p.id === selectedProductId) || inspectionData?.product;

  const filteredQueue = queue.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.author_name && p.author_name.toLowerCase().includes(q)) ||
      (p.slug && p.slug.toLowerCase().includes(q))
    );
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const [isDownloadingMainFile, setIsDownloadingMainFile] = useState<boolean>(false);

  // Unduh berkas asli produk secara aman dengan Authorization Bearer Token
  const handleDownloadMainFile = async () => {
    if (!selectedProductId) return;
    setIsDownloadingMainFile(true);
    try {
      const res = await api.get(`/products/admin/${selectedProductId}/download-file`, {
        responseType: 'blob'
      });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      const fileExt = inspectionData?.mainFile?.type === 'pdf' ? 'pdf' : (inspectionData?.mainFile?.type === 'rar' ? 'rar' : 'zip');
      const safeTitle = (selectedProduct?.title || 'berkas-produk')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      link.setAttribute('download', `${safeTitle}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Gagal mengunduh berkas produk:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal mengunduh berkas produk. ' + handleApiError(err)
      });
    } finally {
      setIsDownloadingMainFile(false);
    }
  };

  // Submit Aksi Kurasi (Approve, Revision, Reject)
  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !modalMode) return;

    const trimmedNotes = reviewNotes.trim();

    if (modalMode === 'revision' || modalMode === 'reject') {
      if (trimmedNotes.length < 5) {
        setFeedbackMessage({
          type: 'error',
          text: 'Catatan kurasi minimal 5 karakter agar seller memahami poin perbaikan.'
        });
        return;
      }
      if (trimmedNotes.length > 1000) {
        setFeedbackMessage({
          type: 'error',
          text: 'Catatan kurasi maksimal 1000 karakter.'
        });
        return;
      }
    }

    if (modalMode === 'approve' && inspectionData?.malwareReport && !inspectionData.malwareReport.isClean) {
      setFeedbackMessage({
        type: 'error',
        text: 'Tindakan ditolak: Produk terdeteksi mengandung ancaman keamanan / malware dan dilarang disetujui.'
      });
      return;
    }

    setIsSubmittingAction(true);
    setFeedbackMessage(null);

    try {
      if (modalMode === 'approve') {
        await api.put(`/products/admin/${selectedProductId}/approve`);
        setFeedbackMessage({
          type: 'success',
          text: `Produk "${selectedProduct?.title || ''}" berhasil disetujui dan langsung terbit di etalase marketplace!`
        });
      } else if (modalMode === 'revision') {
        await api.put(`/products/admin/${selectedProductId}/request-revision`, {
          review_notes: trimmedNotes,
          notes: trimmedNotes
        });
        setFeedbackMessage({
          type: 'success',
          text: 'Catatan permintaan revisi telah dikirim ke seller.'
        });
      } else if (modalMode === 'reject') {
        await api.put(`/products/admin/${selectedProductId}/reject`, {
          review_notes: trimmedNotes,
          notes: trimmedNotes
        });
        setFeedbackMessage({
          type: 'success',
          text: 'Produk telah ditolak dan diarsipkan dari antrean kurasi.'
        });
      }

      setModalMode(null);
      setReviewNotes('');

      // Hitung item berikutnya dari antrean agar workspace langsung menampilkan produk berikutnya
      const remainingItems = queue.filter(p => p.id !== selectedProductId);
      const nextSelectId = remainingItems[0]?.id || null;

      setSelectedProductId(nextSelectId);
      setInspectionData(null);

      // Refresh antrean dengan target nextSelectId
      await fetchQueue(nextSelectId);
      if (onProductCurated) onProductCurated();
    } catch (err: any) {
      console.error('Gagal memproses kurasi:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Gagal memproses tindakan kurasi. ' + handleApiError(err)
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. TOP HEADER & METRICS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-semibold text-amber-800 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Gerbang Kurasi & Moderasi Konten Seller</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Kurasi Produk Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Inspeksi struktur berkas arsip (ZIP/PDF), pastikan kelengkapan materi ajar, deteksi file berisiko, dan tentukan kelayakan tayang di marketplace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueue()}
            disabled={isLoadingQueue}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin text-teal-600' : ''}`} />
            <span>Segarkan Antrean</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className={`p-4 rounded-2xl border text-sm flex items-start justify-between gap-3 animate-in fade-in ${
          feedbackMessage.type === 'success'
            ? 'bg-teal-50 border-teal-200 text-teal-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-bold hover:underline opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. SPLIT LAYOUT: QUEUE LIST (Kiri) + CURATION WORKSPACE (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: DAFTAR ANTREAN PRODUK (4 Kolom) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-800 text-sm">Antrean Kurasi</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {queue.length} Menunggu
            </span>
          </div>

          {/* Search Queue */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul atau nama seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </div>

          {/* List Card Antrean */}
          <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
            {isLoadingQueue ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
                <Clock className="w-8 h-8 text-amber-400 mx-auto animate-spin" />
                <p>Memuat antrean kurasi produk...</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-teal-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Tidak ada produk dalam antrean</p>
                <p className="text-[11px] text-slate-400">
                  Seluruh pengajuan kurasi produk mitra telah selesai diproses.
                </p>
              </div>
            ) : (
              filteredQueue.map((item) => {
                const isSelected = item.id === selectedProductId;
                const coverUrl = getMediaUrl(item.cover_image_key);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedProductId(item.id);
                      setActiveTab('explorer');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group flex gap-3 ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {/* Thumbnail Cover */}
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center">
                      {coverUrl ? (
                        <img src={coverUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className={`text-xs font-bold leading-snug truncate ${
                        isSelected ? 'text-teal-900' : 'text-slate-800'
                      }`}>
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{item.author_name || item.author_email || 'Seller Mitra'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="font-bold text-slate-700">
                          {formatPrice(item.price)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.submitted_for_review_at ? formatDateTime(item.submitted_for_review_at, false) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* KOLOM KANAN: WORKSPACE KURASI & INSPEKSI BERKAS (8 Kolom) */}
        <div className="lg:col-span-8 space-y-5">
          {!selectedProduct ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 space-y-3">
              <FileCheck className="w-16 h-16 text-slate-200 mx-auto stroke-1" />
              <h3 className="text-base font-bold text-slate-700">Pilih Produk Untuk Dikurasi</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Klik salah satu produk dari antrean sebelah kiri untuk memeriksa struktur berkas, isi materi, dan foto sampel seller.
              </p>
            </div>
          ) : (
            <>
              {/* Product Info Bar & Main Action Buttons */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        Menunggu Kurasi
                      </span>
                      {selectedProduct.category_id && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                          Kategori ID: {selectedProduct.category_id}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-snug">
                      {selectedProduct.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Diajukan oleh <strong className="text-slate-700">{selectedProduct.author_name || selectedProduct.author_email}</strong> • Harga: <strong className="text-teal-700 font-bold">{formatPrice(selectedProduct.price)}</strong>
                    </p>
                  </div>

                  {/* Top Action Trigger Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {(() => {
                      const hasMalwareThreat = Boolean(inspectionData?.malwareReport && !inspectionData.malwareReport.isClean);
                      const isMissingRequiredAssets = Boolean(!selectedProduct.cover_image_key || !selectedProduct.file_r2_key || (inspectionData && !inspectionData.mainFile?.exists));
                      const isApproveDisabled = isLoadingInspection || !inspectionData || hasMalwareThreat || isMissingRequiredAssets;

                      const approveTitle = isLoadingInspection
                        ? 'Sedang memeriksa kelayakan berkas...'
                        : hasMalwareThreat
                        ? 'Dilarang menyetujui produk yang mengandung ancaman keamanan'
                        : isMissingRequiredAssets
                        ? 'Produk belum memiliki berkas digital atau foto cover utama'
                        : 'Setujui produk dan terbitkan ke etalase utama';

                      return (
                        <button
                          onClick={() => {
                            if (isApproveDisabled) return;
                            setModalMode('approve');
                          }}
                          disabled={isApproveDisabled}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                            isApproveDisabled
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 cursor-pointer'
                          }`}
                          title={approveTitle}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Setujui & Terbitkan</span>
                        </button>
                      );
                    })()}

                    <button
                      onClick={() => {
                        setModalMode('revision');
                        setReviewNotes('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Minta Revisi</span>
                    </button>

                    <button
                      onClick={() => {
                        setModalMode('reject');
                        setReviewNotes('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>

                {/* 2.5 STATUS PINDAIAN MALWARE */}
                {inspectionData?.malwareReport && (
                  <div className={`p-4 rounded-2xl border text-xs transition-all ${
                    !inspectionData.malwareReport.isClean
                      ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm'
                      : inspectionData.malwareReport.warnings?.length
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          !inspectionData.malwareReport.isClean
                            ? 'bg-rose-600 text-white animate-bounce'
                            : inspectionData.malwareReport.warnings?.length
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {!inspectionData.malwareReport.isClean ? (
                            <ShieldAlert className="w-5 h-5" />
                          ) : (
                            <ShieldCheck className="w-5 h-5" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">
                              {!inspectionData.malwareReport.isClean
                                ? 'PERINGATAN: Muatan Berbahaya (Malware/Script) Terdeteksi!'
                                : inspectionData.malwareReport.warnings?.length
                                ? 'Perhatian: Berkas Memuat Aplikasi Edukasi (.exe/.apk) atau Macro VBA (.xlsm)'
                                : 'Hasil Pindaian: Bebas Malware & Aman'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !inspectionData.malwareReport.isClean
                                ? 'bg-rose-200 text-rose-800 uppercase'
                                : inspectionData.malwareReport.warnings?.length
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {!inspectionData.malwareReport.isClean ? 'Berisiko Tinggi' : inspectionData.malwareReport.warnings?.length ? 'Perlu Verifikasi (Dapat Disetujui)' : 'Terverifikasi Bersih'}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            {!inspectionData.malwareReport.isClean
                              ? 'Ditemukan ekstensi cloaking, penyamaran executable (bukan format aslinya), atau exploit zip-slip. DILARANG MENYETUJUI produk ini.'
                              : inspectionData.malwareReport.warnings?.length
                              ? 'Ditemukan aplikasi edukasi (.exe/.apk) atau skrip Macro VBA (.xlsm). Pastikan fungsi aplikasi/formulasi ini sah dan sesuai deskripsi materi ajar. Produk ini TETAP DAPAT DISETUJUI oleh kurator.'
                              : `${inspectionData.malwareReport.stats?.totalChecked || 0} berkas telah dipindai (verifikasi magic bytes, macro Office VBA, zip-slip, dan cloaking).`}
                          </p>
                        </div>
                      </div>

                      {!inspectionData.malwareReport.isClean ? (
                        <button
                          onClick={() => {
                            const reasons = (inspectionData.malwareReport.threats || [])
                              .map((t: any) => `[${t.fileName || t.file || 'berkas'}] ${t.description || t.message || 'ancaman terdeteksi'}`)
                              .join(', ');
                            setModalMode('reject');
                            setReviewNotes(`Produk ditolak otomatis karena terdeteksi mengandung ancaman keamanan: ${reasons}`.slice(0, 1000));
                          }}
                          className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          Tolak Langsung Karena Malware
                        </button>
                      ) : inspectionData.malwareReport.warnings?.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            openRevisionModalWithNote(
                              'Berkas Excel/Office Anda terdeteksi memuat script Macro VBA (.xlsm). Sesuai SOP, mohon jelaskan secara transparan di dalam berkas PANDUAN_PRODUK.txt apa fungsi formulasi/otomasi macro tersebut bagi guru (contoh: "Macro berfungsi untuk menghitung nilai rapor dan cetak PDF otomatis").'
                            );
                          }}
                          className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Minta Penjelasan Fungsi Macro
                        </button>
                      ) : null}
                    </div>

                    {/* Detail Rincian Ancaman (Jika ada) */}
                    {inspectionData.malwareReport.threats?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-1.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-rose-800 block">
                          Rincian Ancaman ({inspectionData.malwareReport.threats.length}):
                        </span>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {inspectionData.malwareReport.threats.map((threat: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 p-1.5 bg-white/70 rounded-lg text-[11px] font-mono text-rose-950">
                              <span className="px-1.5 py-0.5 bg-rose-200 text-rose-900 rounded text-[9px] font-bold uppercase">{threat.type}</span>
                              <span className="font-bold truncate max-w-xs">{threat.fileName || threat.file}:</span>
                              <span className="truncate">{threat.description || threat.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub Tab Navigation */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setActiveTab('explorer')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'explorer'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>File Explorer Berkas</span>
                    {inspectionData?.archiveInfo?.totalFiles ? (
                      <span className="px-1.5 py-0.2 bg-teal-500 text-white text-[10px] rounded-full">
                        {inspectionData.archiveInfo.totalFiles}
                      </span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => setActiveTab('sop_checklist')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'sop_checklist'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>Checklist Kurasi & SOP</span>
                    {(() => {
                      const sop = inspectionData?.archiveInfo?.sopAnalysis;
                      if (!sop) return null;
                      const hasWarning = sop.readmeStatus !== 'found' || sop.externalUrls?.some((u: any) => u.isSuspicious);
                      return hasWarning ? (
                        <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full animate-pulse">
                          Perlu Cek
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 bg-teal-500 text-white text-[10px] rounded-full">
                          SOP OK
                        </span>
                      );
                    })()}
                  </button>

                  <button
                    onClick={() => setActiveTab('details')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'details'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Deskripsi & Spesifikasi</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('seller')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'seller'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Portofolio Seller</span>
                    {inspectionData?.samplePhotos?.length ? (
                      <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
                        {inspectionData.samplePhotos.length}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>

              {/* INSPECTION CONTENT AREA */}
              {isLoadingInspection ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 text-teal-600 mx-auto animate-spin" />
                  <p className="text-xs font-semibold text-slate-700">Membaca arsip digital & membedah berkas...</p>
                  <p className="text-[11px] text-slate-400">
                    Memeriksa struktur Central Directory ZIP dan memvalidasi keamanan berkas secara real-time.
                  </p>
                </div>
              ) : activeTab === 'explorer' ? (
                /* TAB 1: MICROSOFT FILE EXPLORER */
                <FileExplorer
                  key={selectedProduct.id}
                  productId={selectedProduct.id}
                  productTitle={selectedProduct.title}
                  mainFileMeta={inspectionData?.mainFile || { exists: false }}
                  zipEntries={(inspectionData?.archiveInfo?.entries || []).map((e: any) => ({
                    ...e,
                    sourceType: 'zip_entry'
                  }))}
                  malwareReport={inspectionData?.malwareReport}
                  galleryImages={inspectionData?.galleryImages || []}
                  samplePhotos={inspectionData?.samplePhotos || []}
                  onDownloadMainFile={handleDownloadMainFile}
                  isDownloadingMainFile={isDownloadingMainFile}
                />
              ) : activeTab === 'sop_checklist' ? (
                /* TAB 2: CHECKLIST KURASI & SOP */
                <div className="space-y-6 animate-in fade-in duration-200">
                  {(() => {
                    const sop = inspectionData?.archiveInfo?.sopAnalysis;
                    const isZipValid = Boolean(selectedProduct.file_r2_key?.toLowerCase().endsWith('.zip'));
                    const hasReadme = sop?.readmeStatus === 'found';
                    const editableCount = sop?.editableFilesCount || 0;
                    const urlCount = sop?.externalUrls?.length || 0;
                    const hasSuspiciousUrl = Boolean(sop?.externalUrls?.some((u: any) => u.isSuspicious));

                    return (
                      <>
                        {/* 1. KARTU STATUS INDIKATOR SOP (4 GRID) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                          <div className={`p-4 rounded-2xl border ${
                            isZipValid ? 'bg-teal-50/70 border-teal-200 text-teal-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-500 uppercase">Format Berkas</span>
                              <FileBox className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-sm font-bold truncate">
                              {isZipValid ? 'Arsip .ZIP Resmi' : 'Bukan .ZIP'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {isZipValid ? 'Magic bytes PK valid' : 'Wajib dikemas format .zip'}
                            </p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${
                            hasReadme ? 'bg-teal-50/70 border-teal-200 text-teal-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-500 uppercase">Berkas Panduan</span>
                              <FileText className={`w-4 h-4 ${hasReadme ? 'text-teal-600' : 'text-rose-600'}`} />
                            </div>
                            <p className="text-sm font-bold truncate">
                              {hasReadme ? (sop?.readmeName || 'README.txt') : 'Tidak Ditemukan'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {hasReadme ? 'Tersedia di root ZIP' : 'Wajib ada PANDUAN_PRODUK.txt'}
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl bg-white border border-slate-200">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-500 uppercase">Materi Mentahan</span>
                              <Layers className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {editableCount} Berkas Siap Edit
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {editableCount > 0 ? '.docx / .pptx / .xlsx' : 'Hanya PDF / Media'}
                            </p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${
                            hasSuspiciousUrl
                              ? 'bg-rose-50 border-rose-300 text-rose-900'
                              : urlCount > 0
                              ? 'bg-blue-50/60 border-blue-200 text-blue-900'
                              : 'bg-white border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-slate-500 uppercase">Tautan Luar</span>
                              <LinkIcon className={`w-4 h-4 ${hasSuspiciousUrl ? 'text-rose-600' : 'text-blue-600'}`} />
                            </div>
                            <p className="text-sm font-bold truncate">
                              {urlCount} Tautan Terdeteksi
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {hasSuspiciousUrl ? 'Ada Link Mencurigakan!' : urlCount > 0 ? 'Canva / Drive perlu diuji' : '100% Offline di ZIP'}
                            </p>
                          </div>
                        </div>

                        {/* 2. VIEWER BERKAS PANDUAN_PRODUK.txt / README.txt */}
                        {hasReadme && sop?.readmeContent ? (
                          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-800 text-sm">
                                      {sop.readmeName || 'PANDUAN_PRODUK.txt'}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                                      Terbaca Otomatis dari ZIP
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400">
                                    {sop.readmeContent.length} karakter • {sop.readmeContent.split('\n').length} baris petunjuk seller
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleCopyReadme}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer self-start sm:self-auto"
                              >
                                {copiedReadme ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedReadme ? 'Tersalin ke Clipboard' : 'Salin Isi Panduan'}</span>
                              </button>
                            </div>
                            <div className="relative">
                              <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed overflow-x-auto max-h-80 whitespace-pre-wrap select-all">
                                {sop.readmeContent}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-rose-900">
                                  Berkas Panduan (PANDUAN_PRODUK.txt / README.txt) Tidak Ditemukan!
                                </h4>
                                <p className="text-xs text-rose-700 leading-relaxed">
                                  Sesuai SOP Marketplace Asisten Guru, seller wajib menyertakan berkas teks panduan di dalam arsip ZIP untuk menjelaskan struktur folder, petunjuk cetak/edit, dan rincian tautan eksternal bagi pembeli.
                                </p>
                              </div>
                            </div>
                            <div className="pt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openRevisionModalWithNote('Mohon lengkapi arsip ZIP dengan berkas PANDUAN_PRODUK.txt (atau README.txt) yang memuat petunjuk penggunaan materi, daftar isi modul, dan penjelasan fungsi tautan jika menggunakan Canva atau Google Drive. Template resmi dapat diunduh langsung di halaman editor produk.')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Minta Revisi: Wajib Tambahkan PANDUAN_PRODUK.txt</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 3. PEMERIKSAAN TAUTAN EKSTERNAL (CANVA / GOOGLE DRIVE / LINK SHORTENER) */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="w-4 h-4 text-teal-600" />
                              <h4 className="font-bold text-slate-800 text-sm">
                                Pemeriksaan Tautan Eksternal ({urlCount})
                              </h4>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Verifikasi Hak Akses Publik & Anti-Phishing
                            </span>
                          </div>

                          {!sop?.externalUrls || sop.externalUrls.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">Tidak Ada Tautan Eksternal</p>
                                <p className="text-[11px] text-slate-500">Seluruh materi modul dan perangkat pembelajaran tersimpan secara offline di dalam arsip ZIP.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-xs text-slate-500 leading-relaxed">
                                Klik tombol <strong>Uji Tautan ↗</strong> untuk memastikan tautan dapat dibuka langsung oleh pembeli (akses publik tanpa perlu login privat/minta izin) dan bukan tautan berbahaya.
                              </p>
                              <div className="space-y-2.5">
                                {sop.externalUrls.map((linkItem: any, idx: number) => {
                                  const isCanva = linkItem.type === 'canva';
                                  const isGdrive = linkItem.type === 'gdrive';
                                  const isDropbox = linkItem.type === 'dropbox';
                                  const isPlaystore = linkItem.type === 'playstore';
                                  const isAppstore = linkItem.type === 'appstore';
                                  const isGithub = linkItem.type === 'github';
                                  const isInstaller = linkItem.type === 'installer_app';
                                  const isCustomApp = linkItem.type === 'custom_app';
                                  const isSuspicious = linkItem.isSuspicious;

                                  return (
                                    <div
                                      key={idx}
                                      className={`p-4 rounded-2xl border transition-all ${
                                        isSuspicious
                                          ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
                                          : isInstaller || isCustomApp
                                          ? 'bg-amber-50/60 border-amber-200'
                                          : 'bg-slate-50/80 border-slate-200/80'
                                      }`}
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                              isCanva
                                                ? 'bg-purple-100 text-purple-800'
                                                : isGdrive
                                                ? 'bg-blue-100 text-blue-800'
                                                : isDropbox
                                                ? 'bg-sky-100 text-sky-800'
                                                : isPlaystore
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : isAppstore
                                                ? 'bg-slate-800 text-white'
                                                : isGithub
                                                ? 'bg-slate-900 text-white'
                                                : isInstaller
                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                : isCustomApp
                                                ? 'bg-indigo-100 text-indigo-900'
                                                : isSuspicious
                                                ? 'bg-rose-600 text-white animate-pulse'
                                                : 'bg-slate-200 text-slate-700'
                                            }`}>
                                              {isCanva
                                                ? 'Canva Template'
                                                : isGdrive
                                                ? 'Google Drive'
                                                : isDropbox
                                                ? 'Dropbox'
                                                : isPlaystore
                                                ? 'Play Store (Android Resmi)'
                                                : isAppstore
                                                ? 'App Store (Apple iOS)'
                                                : isGithub
                                                ? 'GitHub Releases'
                                                : isInstaller
                                                ? 'Installer Aplikasi (.APK / .EXE)'
                                                : isCustomApp
                                                ? 'Aplikasi / Server Mandiri'
                                                : isSuspicious
                                                ? 'Pemendek Link (Mencurigakan!)'
                                                : 'Tautan Eksternal'}
                                            </span>

                                            <span className="text-[10px] text-slate-400 font-medium">
                                              Sumber: {linkItem.source === 'readme' ? 'PANDUAN_PRODUK.txt' : 'Deskripsi Produk'}
                                            </span>
                                          </div>

                                          <a
                                            href={linkItem.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-mono font-bold text-teal-700 hover:text-teal-800 underline break-all block"
                                          >
                                            {linkItem.url}
                                          </a>

                                          {linkItem.warningNote && (
                                            <p className={`text-[11px] leading-relaxed font-medium ${
                                              isSuspicious ? 'text-rose-700 font-bold' : 'text-slate-600'
                                            }`}>
                                              💡 <em>Catatan Kurasi:</em> {linkItem.warningNote}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                          <a
                                            href={linkItem.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                                            <span>Uji Tautan ↗</span>
                                          </a>

                                          {(isInstaller || isCustomApp) && (
                                            <>
                                              <a
                                                href="https://www.virustotal.com/gui/home/url"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-xl border border-indigo-200 transition"
                                                title="Periksa reputasi URL/Installer di VirusTotal"
                                              >
                                                <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                                <span>Scan VirusTotal ↗</span>
                                              </a>

                                              <button
                                                type="button"
                                                onClick={() => openRevisionModalWithNote(`Aplikasi eksternal [${linkItem.url}] memerlukan lisensi atau akun login untuk dijalankan. Mohon sertakan akun demo / kunci lisensi uji coba untuk tim kurator di PANDUAN_PRODUK.txt agar fungsi aplikasi dapat diverifikasi.`)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-xl border border-amber-200 transition cursor-pointer"
                                                title="Minta seller sertakan akun uji coba atau lisensi demo"
                                              >
                                                <Key className="w-3 h-3 text-amber-600" />
                                                <span>Minta Akun Uji/Lisensi</span>
                                              </button>
                                            </>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => openRevisionModalWithNote(`Tautan eksternal [${linkItem.url}] tidak dapat diakses publik atau masih terkunci (meminta izin akses khusus). Mohon ubah pengaturan berbagi link menjadi 'Siapa saja yang memiliki tautan dapat melihat/mengakses' agar pembeli dapat langsung memakainya.`)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold rounded-xl border border-orange-200 transition cursor-pointer"
                                            title="Minta seller buka akses publik jika link meminta login/izin"
                                          >
                                            <Lock className="w-3 h-3 text-orange-600" />
                                            <span>Tautan Terkunci</span>
                                          </button>

                                          {isSuspicious && (
                                            <button
                                              type="button"
                                              onClick={() => openRevisionModalWithNote(`Penggunaan pemendek tautan atau safelink iklan pada link [${linkItem.url}] dilarang di platform demi keamanan pembeli sekolah. Mohon cantumkan tautan domain asli langsung (misal: canva.com / drive.google.com / domain resmi aplikasi Anda) dan jelaskan fungsinya di PANDUAN_PRODUK.txt.`)}
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer"
                                            >
                                              <AlertTriangle className="w-3 h-3" />
                                              <span>Peringatkan Link Pendek/Iklan</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. DAFTAR CHECKLIST EVALUASI KURASI INTERAKTIF */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                              <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <CheckSquare className="w-5 h-5 text-teal-600" />
                                <span>Daftar Checklist Evaluasi Kurasi</span>
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Centang kriteria yang lolos. Sistem secara otomatis menandai poin yang terdeteksi valid dari berkas ZIP.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={markAllSopPass}
                                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl border border-teal-200 transition cursor-pointer"
                              >
                                Tandai Semua Lolos
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar Kepatuhan SOP */}
                          {(() => {
                            const checksList = [
                              sopChecks.isZipFormat,
                              sopChecks.hasReadme,
                              sopChecks.hasEditableFiles,
                              sopChecks.linksVerified,
                              sopChecks.noPhishing,
                              sopChecks.contentMatches
                            ];
                            const passedCount = checksList.filter(Boolean).length;
                            const percent = Math.round((passedCount / 6) * 100);

                            return (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className="text-slate-700">Kepatuhan Standar SOP:</span>
                                  <span className={passedCount === 6 ? 'text-teal-600' : 'text-amber-600'}>
                                    {passedCount} dari 6 Kriteria ({percent}%)
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      passedCount === 6 ? 'bg-teal-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          {/* 6 Checklist Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              {
                                key: 'isZipFormat',
                                label: '1. Format Berkas .ZIP Valid',
                                desc: 'Berkas digital dikemas dalam format .zip resmi tanpa korupsi/kerusakan struktur file.'
                              },
                              {
                                key: 'hasReadme',
                                label: '2. Berkas PANDUAN_PRODUK.txt Terlampir',
                                desc: 'Tersedia berkas teks panduan penggunaan modul dan penjelasan alur pembelajaran.'
                              },
                              {
                                key: 'hasEditableFiles',
                                label: '3. Menyediakan Format Siap Edit',
                                desc: 'Menyertakan berkas mentahan (.docx/.pptx) atau template Canva yang bisa diduplikasi pembeli.'
                              },
                              {
                                key: 'linksVerified',
                                label: '4. Tautan Eksternal Dibuka Publik',
                                desc: 'Link Canva/Google Drive sudah diuji dan tidak meminta login privat atau izin akses khusus.'
                              },
                              {
                                key: 'noPhishing',
                                label: '5. Bebas Phishing & Pemendek Link',
                                desc: 'Tidak ada domain mencurigakan, cloaking nama file, skrip terlarang, atau pemendek tautan.'
                              },
                              {
                                key: 'contentMatches',
                                label: '6. Isi Materi Sesuai Etalase & Cover',
                                desc: 'Konten di dalam berkas ZIP sesuai dengan judul, jenjang, fase, dan sampel cover produk.'
                              }
                            ].map((item) => {
                              const isChecked = Boolean(sopChecks[item.key]);
                              return (
                                <div
                                  key={item.key}
                                  onClick={() => toggleSopCheck(item.key)}
                                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                                    isChecked
                                      ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-500/20'
                                      : 'bg-slate-50/60 border-slate-200/90 hover:bg-white'
                                  }`}
                                >
                                  <div className="mt-0.5 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare className="w-5 h-5 text-teal-600" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-300" />
                                    )}
                                  </div>
                                  <div className="space-y-0.5 min-w-0 flex-1">
                                    <p className={`text-xs font-bold ${isChecked ? 'text-teal-950' : 'text-slate-800'}`}>
                                      {item.label}
                                    </p>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                      {item.desc}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Quick Revision Generator from Unmet Checklist */}
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400">
                              Poin yang tidak dicentang akan otomatis dirangkum menjadi catatan revisi terstruktur.
                            </span>
                            <button
                              type="button"
                              onClick={handleGenerateRevisionFromChecklist}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Buat Catatan Revisi dari Checklist</span>
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : activeTab === 'details' ? (
                /* TAB 2: DETAIL PRODUK & DESKRIPSI */
                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-3">Deskripsi Produk (Yang Tampil ke Pembeli)</h3>
                    <div
                      className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(selectedProduct.description) || '<p class="text-slate-400 italic">Tidak ada deskripsi rinci.</p>'
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-400 font-semibold block mb-1">Harga Final</span>
                      <span className="text-base font-bold text-teal-700">{formatPrice(selectedProduct.price)}</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-400 font-semibold block mb-1">Harga Asli (Coret)</span>
                      <span className="text-base font-bold text-slate-500">
                        {selectedProduct.original_price ? formatPrice(selectedProduct.original_price) : '-'}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-400 font-semibold block mb-1">Slug URL Etalase</span>
                      <span className="text-xs font-mono text-slate-700 truncate block">{selectedProduct.slug || '-'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 3: PORTOFOLIO SELLER */
                <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg">
                      {selectedProduct.author_name?.[0]?.toUpperCase() || 'S'}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{selectedProduct.author_name || 'Seller'}</h3>
                      <p className="text-xs text-slate-400">{selectedProduct.author_email}</p>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-800 text-xs pt-2">Contoh Foto Portofolio yang Diunggah Seller Saat Pendaftaran</h4>
                  {(!inspectionData?.samplePhotos || inspectionData.samplePhotos.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Seller belum mengunggah foto portofolio.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {inspectionData.samplePhotos.map((s: any) => (
                        <div key={s.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group">
                          <img
                            src={getMediaUrl(s.r2_key)}
                            alt={s.file_name}
                            className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="p-2 text-[10px] text-slate-500 truncate font-mono">
                            {s.file_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3. MODAL KURASI (SETUJUI / REVISI / TOLAK) */}
      {modalMode && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                modalMode === 'approve'
                  ? 'bg-teal-50 text-teal-600'
                  : modalMode === 'revision'
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-rose-50 text-rose-600'
              }`}>
                {modalMode === 'approve' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : modalMode === 'revision' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {modalMode === 'approve'
                    ? 'Setujui & Publikasikan Produk'
                    : modalMode === 'revision'
                    ? 'Minta Revisi ke Seller'
                    : 'Tolak Produk'}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">{selectedProduct.title}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmAction} className="space-y-4">
              {modalMode === 'approve' ? (
                <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl text-xs text-teal-800 space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-teal-900">
                    Apakah Anda yakin telah menginspeksi isi berkas dan kelayakan produk ini?
                  </p>
                  <p>
                    Setelah disetujui, produk akan berstatus <strong>published</strong> dan dapat langsung dicari, dibeli, serta diunduh oleh ribuan guru pembeli di marketplace.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Catatan Penjelasan untuk Seller <span className="text-rose-500">*</span>
                    </label>
                    <span className={`text-[10px] font-bold ${
                      reviewNotes.trim().length > 1000
                        ? 'text-rose-600'
                        : reviewNotes.trim().length < 5
                        ? 'text-amber-600'
                        : 'text-teal-600'
                    }`}>
                      {reviewNotes.trim().length}/1000 karakter (min. 5)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={
                      modalMode === 'revision'
                        ? 'Tuliskan secara jelas poin apa saja yang perlu diperbaiki (contoh: "Mohon sertakan lembar kunci jawaban pada modul", "Format berkas corrupt pada Bab 2", dll)...'
                        : 'Jelaskan alasan penolakan produk secara edukatif dan profesional...'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Catatan ini akan langsung tampil di dashboard mitra seller yang bersangkutan.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAction}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                    modalMode === 'approve'
                      ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                      : modalMode === 'revision'
                      ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {isSubmittingAction ? (
                    'Memproses...'
                  ) : modalMode === 'approve' ? (
                    'Ya, Setujui & Terbitkan'
                  ) : modalMode === 'revision' ? (
                    'Kirim Permintaan Revisi'
                  ) : (
                    'Tolak Produk'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
