import React from 'react';
import { Flame, AlertCircle, RefreshCw } from 'lucide-react';
import { StoreAppearanceConfig, Product } from '../../../types';

interface FeaturedProductSectionProps {
  featuredProduct: StoreAppearanceConfig['featuredProduct'];
  publishedProducts: Product[];
  isLoadingProducts: boolean;
  isFeaturedProductStale: boolean;
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
}

export const FeaturedProductSection: React.FC<FeaturedProductSectionProps> = ({
  featuredProduct,
  publishedProducts,
  isLoadingProducts,
  isFeaturedProductStale,
  setAppearance
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            8. Sorot Produk Unggulan & Animasi
          </h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={featuredProduct.enabled}
            onChange={(e) => setAppearance(prev => ({
              ...prev,
              preset: 'custom',
              featuredProduct: { ...prev.featuredProduct, enabled: e.target.checked }
            }))}
            className="rounded text-brand-teal focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-bold text-stone-700">Tampilkan</span>
        </label>
      </div>

      {featuredProduct.enabled ? (
        <div className="space-y-3.5 pt-1">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Pilih Produk Unggulan
            </label>
            {isFeaturedProductStale && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Modul unggulan yang dipilih sebelumnya sudah tidak aktif atau dihapus dari katalog. Silakan pilih modul lain di bawah.</span>
              </div>
            )}

            {isLoadingProducts ? (
              <div className="flex items-center gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-teal" />
                <span>Memuat daftar modul resmi Anda...</span>
              </div>
            ) : publishedProducts.length > 0 ? (
              <select
                value={featuredProduct.productId || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  featuredProduct: { ...prev.featuredProduct, productId: e.target.value || null }
                }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal bg-white"
              >
                <option value="">-- Pilih salah satu modul terpublikasi --</option>
                {publishedProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} - Rp {p.price.toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-stone-400 italic">
                Belum ada produk terpublikasi. Kirim produk Anda ke kurasi terlebih dahulu.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Label Pita / Ribbon
              </label>
              <input
                type="text"
                maxLength={25}
                value={featuredProduct.badgeText}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  featuredProduct: { ...prev.featuredProduct, badgeText: e.target.value.slice(0, 25) }
                }))}
                placeholder="Contoh: BEST SELLER"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Efek Animasi Penarik Perhatian
              </label>
              <select
                value={featuredProduct.animationStyle}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  featuredProduct: { ...prev.featuredProduct, animationStyle: e.target.value as any }
                }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal bg-white"
              >
                <option value="none">Tanpa Animasi</option>
                <option value="pulse">Pulse (Berdenyut Lembut)</option>
                <option value="glow">Glow (Kilau Neon)</option>
                <option value="jiggle">Jiggle (Goyang Halus)</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic">
          Sorotan produk unggulan dinonaktifkan. Centang "Tampilkan" untuk menonjolkan modul terlaris Anda.
        </p>
      )}
    </div>
  );
};
