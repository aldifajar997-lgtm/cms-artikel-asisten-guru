import React, { useState } from 'react';
import {
  Plus,
  PenSquare,
  Trash2,
  Image as ImageIcon,
  Clock,
  Calendar,
  ShoppingBag,
  DollarSign,
  Eye,
  Archive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  User,
  MessageSquare
} from 'lucide-react';
import { Product, ProductStatus } from '../types';
import { formatDateTime } from '../utils/dateFormatter';

interface ProductListProps {
  products: Product[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelectProduct: (product: Product) => void;
  onNewProduct: () => void;
  onDeleteProduct: (id: string) => void;
  onArchiveProduct: (id: string) => void;
  onApproveProduct?: (id: string) => void;
  onRequestRevisionProduct?: (id: string, notes: string) => void;
  onRejectProduct?: (id: string, notes: string) => void;
  onOpenCurationTab?: (productId?: string) => void;
  userRole: string;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelectProduct,
  onNewProduct,
  onDeleteProduct,
  onArchiveProduct,
  onApproveProduct,
  onRequestRevisionProduct,
  onRejectProduct,
  onOpenCurationTab,
  userRole,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending_review' | 'published' | 'draft' | 'needs_revision'>('all');

  // Modal notes kurasi
  const [modalMode, setModalMode] = useState<'revision' | 'reject' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const roles = userRole ? userRole.split(',').map(r => r.trim().toLowerCase()) : [];
  const isSuperAdmin = roles.includes('super admin') || roles.includes('super_admin');
  const isAdminOrEditor = isSuperAdmin || roles.includes('admin') || roles.includes('editor');

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Terbit</span>
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Menunggu Kurasi</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            <span>Perlu Revisi</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Ditolak</span>
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span>Diarsipkan</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Draft</span>
          </span>
        );
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const filteredProducts = products.filter(p => {
    if (filterTab === 'all') return true;
    return p.status === filterTab;
  });

  const pendingCurationCount = products.filter(p => p.status === 'pending_review').length;

  const handleOpenReviewModal = (product: Product, mode: 'revision' | 'reject') => {
    setSelectedProduct(product);
    setModalMode(mode);
    setReviewNotes('');
  };

  const handleConfirmReviewAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !modalMode) return;
    const trimmedNotes = reviewNotes.trim();
    if (trimmedNotes.length < 5) {
      alert('Harap berikan catatan penjelasan minimal 5 karakter agar dipahami seller.');
      return;
    }
    if (trimmedNotes.length > 1000) {
      alert('Catatan penjelasan maksimal 1.000 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'revision' && onRequestRevisionProduct) {
        await onRequestRevisionProduct(selectedProduct.id, trimmedNotes);
      } else if (modalMode === 'reject' && onRejectProduct) {
        await onRejectProduct(selectedProduct.id, trimmedNotes);
      }
      setModalMode(null);
      setSelectedProduct(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Marketplace Produk Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola file digital, kurasi produk mitra seller, dan atur ketersediaan di etalase utama.
          </p>
        </div>

        <button
          onClick={onNewProduct}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Alert Banner jika ada produk menunggu kurasi */}
      {isAdminOrEditor && pendingCurationCount > 0 && onOpenCurationTab && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                Terdapat {pendingCurationCount} produk mitra yang menunggu kurasi admin
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Gunakan tab Kurasi Produk untuk memeriksa struktur file ZIP/PDF menggunakan File Explorer.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenCurationTab && onOpenCurationTab()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
          >
            <FileCheck className="w-4 h-4" />
            <span>Buka Tab Kurasi Produk</span>
            <span className="bg-amber-700 text-amber-100 px-1.5 py-0.2 rounded-full text-[10px]">
              {pendingCurationCount}
            </span>
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Semua ({products.length})
        </button>

        <button
          onClick={() => setFilterTab('pending_review')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            filterTab === 'pending_review'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Antrean Kurasi</span>
          {pendingCurationCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-white text-amber-600 font-bold">
              {pendingCurationCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilterTab('published')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            filterTab === 'published'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Terbit
        </button>

        <button
          onClick={() => setFilterTab('needs_revision')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            filterTab === 'needs_revision'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Perlu Revisi
        </button>

        <button
          onClick={() => setFilterTab('draft')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            filterTab === 'draft'
              ? 'bg-slate-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Draf
        </button>
      </div>

      {/* Products List / Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-700">Tidak ada produk ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Belum ada produk digital dengan filter status ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => {
              const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');
              const coverUrl = product.cover_image_key 
                ? `${baseUrl}/media/${product.cover_image_key}` 
                : null;

              return (
                <div
                  key={product.id}
                  className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail + Product Info */}
                  <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
                    {/* Featured Image Thumbnail */}
                    <div
                      onClick={() => onSelectProduct(product)}
                      className="relative w-full sm:w-32 md:w-36 h-36 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100 cursor-pointer group"
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-1 p-2 text-center">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                          <span className="text-[10px] text-slate-400 font-medium">Tanpa Sampul</span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-2 flex-1 min-w-0 pr-0 sm:pr-4">
                      {/* Status */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {getStatusBadge(product.status)}
                        {product.author_name && (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                            <User className="w-3 h-3 text-slate-400" />
                            Kreator: {product.author_name}
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3
                          onClick={() => onSelectProduct(product)}
                          className="text-base sm:text-lg font-bold text-slate-800 hover:text-teal-600 cursor-pointer transition-colors leading-snug line-clamp-1"
                        >
                          {product.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {product.description?.replace(/<[^>]*>?/gm, '') || 'Tanpa deskripsi'}
                        </p>
                      </div>

                      {/* Catatan Kurasi bila ada */}
                      {product.review_notes && (
                        <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Catatan Kurasi: </span>
                            {product.review_notes}
                          </div>
                        </div>
                      )}

                      {/* Meta footer */}
                      <div className="flex flex-wrap items-center space-x-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center space-x-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {product.submitted_for_review_at
                              ? `Diajukan: ${formatDateTime(product.submitted_for_review_at, false)}`
                              : `Diperbarui: ${formatDateTime(product.created_at, false)}`}
                          </span>
                        </span>
                        
                        {/* Analytics */}
                        <span className="flex items-center space-x-1 text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
                          <Eye className="w-3.5 h-3.5" />
                          <span>{product.view_count || 0}</span>
                        </span>
                        <span className="flex items-center space-x-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{product.sales_count || 0} terjual</span>
                        </span>

                        {!product.file_r2_key && (
                          <span className="flex items-center space-x-1 text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded-md">
                            ⚠️ Belum ada file unduhan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 min-w-[220px]">
                    
                    {/* Price Display */}
                    <div className="flex flex-col text-right">
                      {product.original_price && product.original_price > product.price && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatPrice(product.original_price)}
                        </span>
                      )}
                      <span className="text-lg font-bold text-slate-800">
                        {product.price > 0 ? formatPrice(product.price) : 'Gratis'}
                      </span>
                    </div>

                    {/* Tombol Kurasi (Jika Admin/Editor & Produk status pending_review) */}
                    {isAdminOrEditor && product.status === 'pending_review' && (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {onOpenCurationTab && (
                          <button
                            onClick={() => onOpenCurationTab(product.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                            title="Buka tab Kurasi Produk untuk inspeksi berkas digital lengkap menggunakan File Explorer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Buka di Kurasi</span>
                          </button>
                        )}
                        <button
                          onClick={() => onApproveProduct && onApproveProduct(product.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          title="Setujui dan publikasikan ke etalase utama"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => handleOpenReviewModal(product, 'revision')}
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          title="Minta revisi ke seller"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Revisi</span>
                        </button>
                      </div>
                    )}

                    {/* Standard Action Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onSelectProduct(product)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                        title="Edit produk"
                      >
                        <PenSquare className="w-4 h-4" />
                      </button>
                      
                      {product.status !== 'archived' && product.status !== 'draft' && (
                        <button
                          onClick={() => onArchiveProduct(product.id)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                          title="Arsipkan produk"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      {isSuperAdmin && (
                        <button
                          onClick={() => onDeleteProduct(product.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Hapus permanen produk (Khusus Super Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div className="p-6 text-center border-t border-slate-100">
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Review Kurasi (Revisi / Tolak) */}
      {modalMode && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                modalMode === 'revision' ? 'bg-orange-50 text-orange-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {modalMode === 'revision' ? <AlertTriangle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {modalMode === 'revision' ? 'Minta Revisi Produk' : 'Tolak Produk'}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">{selectedProduct.title}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmReviewAction} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Catatan untuk Kreator <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {reviewNotes.trim().length}/1000 karakter (min. 5)
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    modalMode === 'revision'
                      ? 'Jelaskan bagian apa yang harus diperbaiki, misal gambar sampul kurang jelas, format file keliru, atau deskripsi kurang lengkap...'
                      : 'Jelaskan alasan produk ini tidak dapat ditayangkan di marketplace...'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                    modalMode === 'revision'
                      ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {isSubmitting ? 'Memproses...' : modalMode === 'revision' ? 'Kirim Permintaan Revisi' : 'Tolak Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
