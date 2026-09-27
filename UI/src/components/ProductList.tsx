import React from 'react';
import {
  Plus,
  PenSquare,
  Trash2,
  Image as ImageIcon,
  Clock,
  Calendar,
  ShoppingBag,
  DollarSign,
  Eye
} from 'lucide-react';
import { Product, ProductStatus } from '../types';

interface ProductListProps {
  products: Product[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelectProduct: (product: Product) => void;
  onNewProduct: () => void;
  onDeleteProduct: (id: string) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelectProduct,
  onNewProduct,
  onDeleteProduct,
}) => {
  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Terbit</span>
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Marketplace Produk Digital
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola file digital, atur harga, dan pantau etalase Anda.
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

      {/* Products List / Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-700">Tidak ada produk ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Belum ada produk digital yang ditambahkan. Silakan unggah produk baru.
            </p>
            <button
              onClick={onNewProduct}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Produk Baru</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((product) => {
              // Create full media URL if there's a cover image key
              const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';
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
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3
                          onClick={() => onSelectProduct(product)}
                          className="text-base sm:text-lg font-bold text-slate-800 hover:text-teal-600 cursor-pointer transition-colors leading-snug line-clamp-1"
                        >
                          {product.title}
                        </h3>
                        {/* Remove HTML tags for simple preview */}
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {product.description?.replace(/<[^>]*>?/gm, '') || 'Tanpa deskripsi'}
                        </p>
                      </div>

                      {/* Meta footer */}
                      <div className="flex flex-wrap items-center space-x-4 text-xs text-slate-400 pt-1">
                        <span className="flex items-center space-x-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Diperbarui{' '}
                            {new Date(product.created_at).toLocaleDateString('id-ID', {
                              timeZone: 'Asia/Jakarta',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
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
                  <div className="flex items-center justify-between lg:justify-end space-x-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 min-w-[200px]">
                    
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

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onSelectProduct(product)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                        title="Edit produk"
                      >
                        <PenSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(product.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Hapus produk"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
    </div>
  );
};
