import React, { useState } from 'react';
import {
  Plus,
  PenSquare,
  Trash2,
  Image as ImageIcon,
  Clock,
  Package,
  Eye,
  Archive,
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Product, ProductStatus } from '../types';
import { formatCurrency, formatDateTime } from '../utils/dateFormatter';
import { calculateDiscountPercentage } from '../utils/financialCalculations';
import { getMediaUrl } from '../utils/mediaUrl';

interface ProductListProps {
  products: Product[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelectProduct: (product: Product) => void;
  onNewProduct: () => void;
  onDeleteProduct: (id: string) => void;
  onArchiveProduct: (id: string) => void;
  userRole: string;
  isLoading?: boolean;
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
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'needs_revision'
        ? (p.status === 'needs_revision' || p.status === 'rejected')
        : p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
            <span>Terbit</span>
          </span>
        );
      case 'pending_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Menunggu Kurasi</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Perlu Revisi</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Ditolak</span>
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            <span>Diarsipkan</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            <span>Draf</span>
          </span>
        );
    }
  };

  const publishedCount = products.filter(p => p.status === 'published').length;
  const pendingCount = products.filter(p => p.status === 'pending_review').length;
  const needsRevisionCount = products.filter(p => p.status === 'needs_revision' || p.status === 'rejected').length;
  const draftCount = products.filter(p => p.status === 'draft').length;
  const archivedCount = products.filter(p => p.status === 'archived').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight font-sans">
            Katalog & Etalase Produk Digital
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Kelola file digital, atur diskon harga jual, dan pantau produk yang tampil di toko Anda.
          </p>
        </div>

        <button
          onClick={onNewProduct}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-teal/20 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="inline-flex flex-wrap p-1 bg-stone-100/80 rounded-2xl border border-stone-200/60 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'all' 
                ? 'bg-white text-stone-900 shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Semua ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('published')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'published' 
                ? 'bg-white text-brand-teal shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Terbit ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending_review')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'pending_review' 
                ? 'bg-white text-indigo-700 shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Menunggu Kurasi ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('needs_revision')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'needs_revision' 
                ? 'bg-white text-amber-700 shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Perlu Revisi ({needsRevisionCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'draft' 
                ? 'bg-white text-stone-900 shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Draf ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('archived')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              statusFilter === 'archived' 
                ? 'bg-white text-stone-700 shadow-xs font-bold' 
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Diarsipkan ({archivedCount})
          </button>
        </div>

        {/* Search Field */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul produk atau slug..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition font-sans placeholder:text-stone-400"
          />
        </div>

      </div>

      {/* Products Table Container */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <p className="text-xs text-stone-500 font-medium">Memuat katalog produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center text-stone-400">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-800">Tidak ada produk ditemukan</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Anda belum memiliki produk digital pada filter status ini.'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewProduct}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold hover:bg-brand-teal-light transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Produk Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Produk Digital</th>
                  <th className="px-6 py-4 text-right">Harga Jual</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Terjual</th>
                  <th className="px-6 py-4 text-center">Tayangan</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-stone-50/70 transition group">
                    
                    {/* Produk Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 flex items-center justify-center">
                          {product.cover_image_key ? (
                            <img
                              src={getMediaUrl(product.cover_image_key)}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-stone-400" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-sm">
                          <button
                            onClick={() => onSelectProduct(product)}
                            className="text-xs font-bold text-stone-900 hover:text-brand-teal transition truncate block text-left cursor-pointer"
                          >
                            {product.title}
                          </button>
                          <span className="text-[11px] text-stone-400 block truncate mt-0.5">
                            /{product.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Harga Jual */}
                    <td className="px-6 py-4 text-right">
                      <div className="font-extrabold text-stone-900 text-sm">
                        {formatCurrency(product.price)}
                      </div>
                      {product.original_price && product.original_price > product.price && (
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-[11px] text-stone-400 line-through">
                            {formatCurrency(product.original_price)}
                          </span>
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            -{calculateDiscountPercentage(product.original_price, product.price)}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(product.status)}
                    </td>

                    {/* Terjual */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800">
                        {product.sales_count || 0} unit
                      </span>
                    </td>

                    {/* Tayangan */}
                    <td className="px-6 py-4 text-center text-stone-600 font-medium">
                      {(product.view_count || 0).toLocaleString('id-ID')}
                    </td>

                    {/* Aksi Buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectProduct(product)}
                          title="Edit Produk"
                          className="p-1.5 text-stone-500 hover:text-brand-teal hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        >
                          <PenSquare className="w-4 h-4" />
                        </button>
                        
                        {product.status !== 'archived' && (
                          <button
                            onClick={() => onArchiveProduct(product.id)}
                            title="Arsipkan Produk"
                            className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}

                        {product.status === 'draft' && (
                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            title="Hapus Draf Produk"
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="p-4 border-t border-stone-100 text-center bg-stone-50/50">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-5 py-2 text-xs font-bold text-brand-teal hover:bg-white rounded-xl border border-stone-200 transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isLoadingMore ? 'Memuat produk...' : 'Muat Lebih Banyak Produk'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
