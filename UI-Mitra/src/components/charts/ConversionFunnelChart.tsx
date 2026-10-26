import React from 'react';
import { StoreConversionFunnel } from '../../types';
import { 
  Filter, Eye, ShoppingCart, CheckCircle2, 
  ArrowDown, TrendingUp, AlertCircle, ShoppingBag, Store
} from 'lucide-react';

interface ConversionFunnelChartProps {
  title?: string;
  funnel?: StoreConversionFunnel | null;
  loading?: boolean;
}

export const ConversionFunnelChart: React.FC<ConversionFunnelChartProps> = ({
  title = "Corong Konversi Belanja (Sales Funnel)",
  funnel,
  loading = false
}) => {
  const steps = funnel?.steps || [];
  const totalImpressions = funnel?.total_impressions || 0;
  const overallCvr = funnel?.overall_cvr || 0;
  const completedSales = funnel?.completed_sales || 0;

  const getStepIcon = (key: string) => {
    switch (key) {
      case 'store_view':
        return <Store className="w-4 h-4 text-brand-teal" />;
      case 'product_view':
        return <Eye className="w-4 h-4 text-sky-600" />;
      case 'checkout_intent':
        return <ShoppingBag className="w-4 h-4 text-amber-600" />;
      case 'completed_sale':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      default:
        return <Filter className="w-4 h-4 text-stone-500" />;
    }
  };

  const maxCount = Math.max(1, ...(steps.map(s => s.count || 0)));

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 card-shadow flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                <Filter className="w-4 h-4" />
              </div>
              <span>{title}</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Alur perjalanan calon pembeli: Tayangan toko → Buka produk → Klik beli → Bayar
            </p>
          </div>

          {/* Overall CVR Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold self-start sm:self-auto shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Konversi Total:</span>
            <span className="text-emerald-700 font-extrabold">{overallCvr}%</span>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="h-[240px] flex items-center justify-center text-stone-400 text-xs animate-pulse">
            Memuat corong konversi belanja...
          </div>
        ) : steps.length === 0 || (totalImpressions === 0 && completedSales === 0) ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-center p-6 bg-stone-50/60 rounded-2xl border border-stone-100">
            <Filter className="w-10 h-10 text-stone-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-stone-700">Belum Ada Data Konversi Belanja</p>
            <p className="text-[11px] text-stone-400 mt-1 max-w-sm">
              Data corong akan terisi secara otomatis seiring bertambahnya kunjungan dan transaksi di toko digital Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-4 my-2">
            {steps.map((step, idx) => {
              const widthPercent = Math.max(12, Math.round((step.count / maxCount) * 100));
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200/70">
                        {getStepIcon(step.key)}
                      </div>
                      <span className="font-bold text-stone-800">{step.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <span className="font-extrabold text-stone-900 text-xs">
                        {step.count.toLocaleString('id-ID')}
                      </span>
                      <span className="text-stone-400 text-[11px]">
                        {idx === 0 ? 'awal' : `${step.step_conversion_rate}% lolos`}
                      </span>
                    </div>
                  </div>

                  {/* Funnel Bar Container */}
                  <div className="w-full bg-stone-100/90 h-3 rounded-full overflow-hidden flex items-center p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: step.color || '#0D5B52'
                      }}
                    />
                  </div>

                  {/* Drop-off Connection Indicator between steps */}
                  {!isLast && (
                    <div className="flex items-center gap-2 px-3 py-0.5 text-[10.5px] text-stone-400">
                      <ArrowDown className="w-3 h-3 text-stone-300" />
                      <span>
                        {step.count > 0 && steps[idx + 1].count < step.count
                          ? `${Math.round(((step.count - steps[idx + 1].count) / step.count) * 100)}% beralih / keluar`
                          : 'Lolos ke tahap berikutnya'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info Tips */}
      <div className="pt-3 mt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5 text-brand-teal" />
          <span>Pesanan Sukses: <strong className="text-stone-900">{completedSales} unit</strong></span>
        </span>
        <span className="text-[10.5px] text-stone-400">
          Tip: Lengkapi deskripsi & preview untuk memperkecil rasio batal checkout
        </span>
      </div>
    </div>
  );
};
