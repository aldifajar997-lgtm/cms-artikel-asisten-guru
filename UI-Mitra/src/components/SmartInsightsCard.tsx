import React from 'react';
import { ActionableInsightItem } from '../types';
import { 
  Sparkles, ArrowRight, MessageCircle, Package, 
  Lightbulb, AlertCircle, CheckCircle, TrendingUp, Smartphone, Star
} from 'lucide-react';

interface SmartInsightsCardProps {
  insights?: ActionableInsightItem[];
  loading?: boolean;
  onNavigateToProducts?: () => void;
  onNavigateToNewProduct?: () => void;
  onShareWhatsApp?: () => void;
}

export const SmartInsightsCard: React.FC<SmartInsightsCardProps> = ({
  insights = [],
  loading = false,
  onNavigateToProducts,
  onNavigateToNewProduct,
  onShareWhatsApp
}) => {
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'conversion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <TrendingUp className="w-2.5 h-2.5" /> Konversi
          </span>
        );
      case 'traffic':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <MessageCircle className="w-2.5 h-2.5" /> Promosi
          </span>
        );
      case 'catalog':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
            <Package className="w-2.5 h-2.5" /> Katalog
          </span>
        );
      case 'rating':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" /> Reputasi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            <Lightbulb className="w-2.5 h-2.5" /> Tips
          </span>
        );
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-700" />
          </div>
        );
      case 'success':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-700" />
          </div>
        );
      case 'info':
        return (
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 border border-sky-200">
            <Smartphone className="w-4 h-4 text-sky-700" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-teal-100 text-brand-teal flex items-center justify-center shrink-0 border border-teal-200">
            <Lightbulb className="w-4 h-4 text-brand-teal" />
          </div>
        );
    }
  };

  const handleAction = (actionType?: string) => {
    if (actionType === 'navigate_products' && onNavigateToProducts) {
      onNavigateToProducts();
    } else if (actionType === 'navigate_new_product' && onNavigateToNewProduct) {
      onNavigateToNewProduct();
    } else if (actionType === 'share_wa' && onShareWhatsApp) {
      onShareWhatsApp();
    }
  };

  return (
    <div className="bg-gradient-to-br from-stone-900 via-stone-950 to-teal-950 p-5 sm:p-6 rounded-3xl text-white card-shadow border border-teal-900/40 relative overflow-hidden flex flex-col justify-between">
      {/* Background ambient decoration */}
      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
        <Sparkles className="w-48 h-48 text-teal-300" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Rekomendasi Cerdas Penjualan</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  AI Toko
                </span>
              </h3>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Saran taktis berdasarkan analisis performa riil produk dan pengunjung toko Anda
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-12 text-center text-xs text-stone-400 animate-pulse">
            Menganalisis performa toko Anda...
          </div>
        ) : insights.length === 0 ? (
          <div className="py-8 text-center bg-white/5 rounded-2xl border border-white/10 p-5">
            <Lightbulb className="w-8 h-8 text-teal-400/60 mx-auto mb-2" />
            <p className="text-xs font-bold text-stone-200">Performa Toko Berjalan Optimal</p>
            <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
              Terus pantau kunjungan dan tambahkan karya digital baru untuk memperbesar jangkauan guru pembeli.
            </p>
          </div>
        ) : (
          <div className="space-y-3 my-2">
            {insights.slice(0, 3).map((item) => (
              <div 
                key={item.id}
                className="bg-white/10 hover:bg-white/15 transition rounded-2xl p-3.5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(item.type)}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getCategoryBadge(item.category)}
                      <h4 className="text-xs font-bold text-stone-100">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-[11.5px] text-stone-300 leading-relaxed max-w-2xl">
                      {item.message}
                    </p>
                    {item.metric_highlight && (
                      <span className="inline-block mt-1 text-[10.5px] font-mono font-semibold text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
                        {item.metric_highlight}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Button */}
                {item.action_label && item.action_type !== 'none' && (
                  <button
                    type="button"
                    onClick={() => handleAction(item.action_type)}
                    className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-xl bg-brand-mint hover:bg-brand-mint-light active:bg-brand-mint-dark text-white text-xs font-bold transition flex items-center gap-1 shadow-md cursor-pointer"
                  >
                    <span>{item.action_label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[10.5px] text-stone-400">
        <span>Diperbarui otomatis secara real-time</span>
        <span className="text-teal-300 font-semibold">Tips Kreator Asisten Guru</span>
      </div>
    </div>
  );
};
