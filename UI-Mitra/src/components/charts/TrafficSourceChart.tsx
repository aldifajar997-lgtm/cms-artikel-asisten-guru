import React from 'react';
import { StoreTrafficAnalytics } from '../../types';
import { 
  Compass, Smartphone, Monitor, Tablet, Share2, 
  Store, Package, ShoppingBag, ExternalLink, Globe
} from 'lucide-react';

interface TrafficSourceChartProps {
  title?: string;
  traffic?: StoreTrafficAnalytics | null;
  loading?: boolean;
}

export const TrafficSourceChart: React.FC<TrafficSourceChartProps> = ({
  title = "Sumber Trafik & Pengunjung Toko",
  traffic,
  loading = false
}) => {
  const sources = traffic?.sources || [];
  const devices = traffic?.devices || [];
  const totalViews = traffic?.total_views || 0;
  const storeViews = traffic?.store_views || 0;
  const productViews = traffic?.product_views || 0;
  const checkoutIntents = traffic?.checkout_intents || 0;

  const getSourceIcon = (sourceKey: string) => {
    const s = sourceKey.toLowerCase();
    if (s === 'whatsapp') {
      return (
        <span className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[11px] border border-emerald-200">
          WA
        </span>
      );
    }
    if (s === 'instagram') {
      return (
        <span className="w-5 h-5 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-[11px] border border-pink-200">
          IG
        </span>
      );
    }
    if (s === 'tiktok') {
      return (
        <span className="w-5 h-5 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-[10px]">
          TT
        </span>
      );
    }
    if (s === 'facebook') {
      return (
        <span className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] border border-blue-200">
          FB
        </span>
      );
    }
    if (s === 'telegram') {
      return (
        <span className="w-5 h-5 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-[11px] border border-sky-200">
          TG
        </span>
      );
    }
    if (s === 'google') {
      return (
        <span className="w-5 h-5 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold text-[11px] border border-red-200">
          G
        </span>
      );
    }
    if (s === 'twitter' || s === 'x') {
      return (
        <span className="w-5 h-5 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-[10px]">
          X
        </span>
      );
    }
    if (s === 'youtube') {
      return (
        <span className="w-5 h-5 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-[10px] border border-red-200">
          YT
        </span>
      );
    }
    if (s === 'linkedin') {
      return (
        <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] border border-blue-200">
          IN
        </span>
      );
    }
    if (s === 'threads') {
      return (
        <span className="w-5 h-5 rounded-lg bg-stone-100 text-stone-900 flex items-center justify-center font-bold text-[10px] border border-stone-300">
          TH
        </span>
      );
    }
    if (s === 'direct') {
      return (
        <span className="w-5 h-5 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-200">
          <Share2 className="w-3 h-3" />
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center border border-stone-200">
        <Globe className="w-3 h-3" />
      </span>
    );
  };

  const getDeviceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-stone-600" />;
    if (t === 'desktop') return <Monitor className="w-3.5 h-3.5 text-stone-600" />;
    return <Tablet className="w-3.5 h-3.5 text-stone-600" />;
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 card-shadow flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                <Compass className="w-4 h-4" />
              </div>
              <span>{title}</span>
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Pelacakan sumber kunjungan pembeli (WhatsApp, Bio Instagram, TikTok, Direct)
            </p>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200/60 text-brand-teal text-[11px] font-bold">
              <Store className="w-3 h-3" />
              <span>{storeViews} Etalase</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] font-bold">
              <Package className="w-3 h-3" />
              <span>{productViews} Produk</span>
            </span>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="h-[220px] flex items-center justify-center text-stone-400 text-xs animate-pulse">
            Memuat data sumber trafik...
          </div>
        ) : sources.length === 0 && totalViews === 0 ? (
          <div className="h-[220px] flex flex-col items-center justify-center text-center p-6 bg-stone-50/60 rounded-2xl border border-stone-100">
            <Share2 className="w-10 h-10 text-stone-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-stone-700">Belum Ada Catatan Trafik Pengunjung</p>
            <p className="text-[11px] text-stone-400 mt-1 max-w-sm">
              Bagikan tautan etalase toko Anda ke grup WhatsApp guru atau bio media sosial untuk melihat kanal asal pembeli secara otomatis.
            </p>
          </div>
        ) : (
          <div className="space-y-4 my-2">
            {/* Source Progress Bars */}
            <div className="space-y-2.5">
              {sources.map((item) => (
                <div key={item.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {getSourceIcon(item.source)}
                      <span className="font-bold text-stone-800">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400 text-[11px]">{item.count} kunjungan</span>
                      <span className="font-extrabold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md text-[11px]">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar Baris */}
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.max(5, item.percentage)}%`, 
                        backgroundColor: item.color || '#0D5B52' 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Device Breakdown Footer Badges */}
            {devices.length > 0 && (
              <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Perangkat Pembeli:
                </span>
                <div className="flex items-center gap-2">
                  {devices.map((d) => (
                    <div 
                      key={d.device_type}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-[11px] font-semibold"
                    >
                      {getDeviceIcon(d.device_type)}
                      <span>{d.name.split(' ')[0]}:</span>
                      <strong className="text-stone-900">{d.percentage}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info Tips */}
      <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
        <span className="flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
          <span>Intent Checkout: <strong className="text-stone-900">{checkoutIntents} kali</strong></span>
        </span>
        <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
          Pelacakan Hybrid Aktif
        </span>
      </div>
    </div>
  );
};
