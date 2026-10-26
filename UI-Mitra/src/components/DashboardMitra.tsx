import React, { useState, useEffect } from 'react';
import { 
  Package, ShoppingCart, TrendingUp, DollarSign, CreditCard, 
  Percent, AlertCircle, History, Landmark, GraduationCap, CheckCircle2, 
  Clock, ArrowUpRight, ExternalLink, ShieldCheck, RefreshCw, Eye, AlertTriangle,
  Star, Calendar, Filter, Phone
} from 'lucide-react';
import { UserProfile, EarningsSummary, WithdrawalRequest, SellerDashboardAnalytics, TopProduct, FeePolicy } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/dateFormatter';
import { 
  calculateConversionRate, 
  calculateFeePercentage, 
  calculateNetPercentage 
} from '../utils/financialCalculations';
import { EarningsBarChart } from './charts/EarningsBarChart';
import { ProductStatusChart } from './charts/ProductStatusChart';
import { PaymentMethodChart } from './charts/PaymentMethodChart';
import { TrafficSourceChart } from './charts/TrafficSourceChart';
import { ConversionFunnelChart } from './charts/ConversionFunnelChart';
import { SmartInsightsCard } from './SmartInsightsCard';
import { useShortLink } from '../hooks/useShortLink';
import { WithdrawalModal } from './WithdrawalModal';
import { getMediaUrl } from '../utils/mediaUrl';

export type PeriodType = '7d' | '30d' | 'this_month' | '6m' | 'all';

interface DashboardMitraProps {
  profile: UserProfile;
  onNavigateToProducts: () => void;
  onNavigateToNewProduct: () => void;
  onNavigateToComplaints?: () => void;
  onNavigateToProfile?: () => void;
}

export const DashboardMitra: React.FC<DashboardMitraProps> = ({ 
  profile, 
  onNavigateToProducts,
  onNavigateToNewProduct,
  onNavigateToComplaints,
  onNavigateToProfile
}) => {
  const { success, error: showError } = useToast();
  
  // Period Filter State (Default: 30 Hari Terakhir)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('30d');

  // Real Analytics State
  const [analytics, setAnalytics] = useState<SellerDashboardAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  
  // Earnings & Withdrawal State
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [feePolicy, setFeePolicy] = useState<FeePolicy | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState<boolean>(false);
  
  // Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);

  // Hook link resmi toko untuk quick action share ke WhatsApp dari Smart Insights
  const { shareLinks } = useShortLink({
    sellerId: profile.id || '',
    storeName: profile.store_name || profile.name,
    storeSlug: profile.store_slug
  });

  useEffect(() => {
    fetchDashboardData(selectedPeriod);
  }, []);

  const fetchDashboardData = async (period: PeriodType = selectedPeriod) => {
    setLoadingAnalytics(true);
    setLoadingEarnings(true);
    try {
      const [analyticsRes, summaryRes, withdrawalsRes] = await Promise.allSettled([
        api.get(`/dashboard/analytics?period=${period}`),
        api.get('/earnings/summary'),
        api.get('/earnings/withdrawals')
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.data) {
        setAnalytics(analyticsRes.value.data.data);
      }

      if (summaryRes.status === 'fulfilled') {
        if (summaryRes.value.data?.summary) {
          setSummary(summaryRes.value.data.summary);
        }
        if (summaryRes.value.data?.current_fee_policy) {
          setFeePolicy(summaryRes.value.data.current_fee_policy);
        }
      }

      if (withdrawalsRes.status === 'fulfilled' && withdrawalsRes.value.data?.data) {
        setWithdrawals(withdrawalsRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      showError('Gagal memuat data dashboard. Silakan muat ulang halaman.');
    } finally {
      setLoadingAnalytics(false);
      setLoadingEarnings(false);
    }
  };

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setSelectedPeriod(newPeriod);
    fetchDashboardData(newPeriod);
  };

  const handleCancelWithdrawal = async (id: string) => {
    if (!window.confirm('Batalkan permintaan penarikan dana ini? Saldo akan segera dikembalikan ke saldo aktif Anda.')) {
      return;
    }
    try {
      await api.post(`/earnings/withdrawals/${id}/cancel`);
      success('Permintaan penarikan dana berhasil dibatalkan.');
      fetchDashboardData(selectedPeriod);
    } catch (err: any) {
      showError(err.response?.data?.message || 'Gagal membatalkan permintaan penarikan.');
    }
  };

  // Type-coerced fallback metrics
  const productData = {
    total_products: Number(analytics?.products?.total_products) || 0,
    published_count: Number(analytics?.products?.published_count) || 0,
    draft_count: Number(analytics?.products?.draft_count) || 0,
    archived_count: Number(analytics?.products?.archived_count) || 0,
    total_views: Number(analytics?.traffic?.total_views && analytics.traffic.total_views > 0
      ? analytics.traffic.total_views 
      : analytics?.products?.total_views) || 0,
    total_sales: Number(analytics?.products?.total_sales) || 0,
    avg_price: Number(analytics?.products?.avg_price) || 0,
    aov: Number(analytics?.products?.aov ?? analytics?.seller_metrics?.aov) || 0,
    store_rating: Number(analytics?.products?.store_rating ?? analytics?.seller_metrics?.store_rating) || 0,
    total_reviews: Number(analytics?.products?.total_reviews ?? analytics?.seller_metrics?.total_reviews) || 0,
    total_gross_revenue: Number(analytics?.products?.total_gross_revenue) || 0,
    total_net_revenue: Number(analytics?.products?.total_net_revenue) || 0,
    pending_payout: Number(summary?.pending_payout ?? analytics?.products?.pending_payout) || 0,
    paid_out: Number(summary?.paid_out ?? analytics?.products?.paid_out) || 0,
    status_distribution: analytics?.products?.status_distribution || [
      { name: 'Terpublikasi', value: 0, color: '#0D5B52' },
      { name: 'Draf', value: 0, color: '#f59e0b' },
      { name: 'Diarsipkan', value: 0, color: '#a8a29e' }
    ],
    trend: analytics?.products?.trend || [],
    top_products: analytics?.products?.top_products || [],
    payment_methods: analytics?.products?.payment_methods || analytics?.seller_metrics?.payment_methods || []
  };

  const getPeriodLabel = (p: PeriodType) => {
    switch (p) {
      case '7d': return '7 Hari Terakhir';
      case '30d': return '30 Hari Terakhir';
      case 'this_month': return 'Bulan Ini';
      case '6m': return '6 Bulan Terakhir';
      case 'all': return 'Semua Waktu';
      default: return '30 Hari Terakhir';
    }
  };

  // Safe percentage calculations
  const totalGross = Number(summary?.total_gross) || productData.total_gross_revenue;
  const totalAdminFee = Number(summary?.total_admin_fee) || 0;
  const totalNet = Number(summary?.total_net) || productData.total_net_revenue;
  const holdingPayout = Number(summary?.holding_payout) || 0;
  const holdingCount = Number(summary?.holding_count) || 0;
  const availablePayout = Number(summary?.available_payout ?? summary?.pending_payout) || productData.pending_payout;
  const pendingPayout = availablePayout;
  const processingPayout = Number(summary?.processing_payout) || 0;

  // Persentase potongan platform dan hak seller
  const actualFeePercent = calculateFeePercentage(
    totalAdminFee, 
    totalGross, 
    feePolicy ? (feePolicy.fee_bps ?? (parseFloat(feePolicy.fee_percent) * 100)) : 1500
  );
  const actualNetPercent = calculateNetPercentage(totalNet, totalGross, 100 - actualFeePercent);

  // Rasio Konversi Riil (CVR)
  const dynamicCVR = calculateConversionRate(productData.total_sales, productData.total_views);
  const conversionRate = analytics?.seller_metrics?.conversion_rate != null && analytics.seller_metrics.conversion_rate > 0
    ? analytics.seller_metrics.conversion_rate
    : dynamicCVR;

  // Persentase alokasi saldo siap ditarik terhadap total hak bersih
  const pendingPayoutRatio = totalNet > 0 
    ? Math.min(100, Math.round((pendingPayout / totalNet) * 100)) 
    : 0;

  // Batas penarikan dinamis dari kebijakan super admin
  const minWithdrawalLimit = feePolicy?.min_withdrawal_amount ?? 50000;
  const isWithdrawalEligible = pendingPayout >= minWithdrawalLimit;

  const sellerName = profile.name ? profile.name.split(' ')[0] : 'Mitra';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* --- Banner Sambutan Mitra (Asisten Guru Hub Teal & Minimalist Look) --- */}
      <div className="bg-gradient-to-r from-teal-950 via-stone-900 to-stone-950 rounded-3xl p-6 sm:p-8 text-white card-shadow relative overflow-hidden border border-teal-800/30">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <GraduationCap className="w-56 h-56 text-teal-400 -rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
              <span>Pusat Niaga Kreator & Mitra Asisten Guru</span>
              <span className="text-teal-400/60">•</span>
              <span className="text-teal-300 font-bold">
                Potongan Platform: {feePolicy ? feePolicy.fee_percent : `${actualFeePercent}%`} (Hak Bersih {actualNetPercent}%)
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2 font-sans">
              Selamat datang, {sellerName}! 👋
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Pantau performa penjualan produk digital Anda, kelola katalog etalase, dan lakukan penarikan saldo pendapatan dengan cepat dan aman.
            </p>
          </div>

          {/* Quick Actions di Kanan Banner */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={onNavigateToNewProduct}
              className="px-4 py-2.5 rounded-xl bg-brand-mint text-white hover:bg-brand-mint-light active:bg-brand-mint-dark text-xs font-bold shadow-lg shadow-teal-900/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Tambah Produk</span>
            </button>
            <button
              onClick={() => fetchDashboardData()}
              title="Perbarui Data"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Banner Peringatan Komplain Pembeli Aktif (Jika Ada) --- */}
      {Boolean(summary?.disputed_count && summary.disputed_count > 0) && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 p-4 sm:p-5 rounded-3xl border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-rose-950 flex items-center gap-2">
                <span>Perhatian: Ada {summary?.disputed_count} Komplain Pembeli Membutuhkan Respon</span>
              </h4>
              <p className="text-xs text-rose-800/90 mt-0.5">
                Dana transaksi dibekukan sementara. Segera berikan tanggapan atau sertakan tautan perbaikan file agar sengketa segera diselesaikan.
              </p>
            </div>
          </div>
          {onNavigateToComplaints && (
            <button
              type="button"
              onClick={onNavigateToComplaints}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Buka Tab Komplain</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* --- Banner Peringatan Lengkapi Nomor WhatsApp (Jika Belum Diatur) --- */}
      {!profile.phone_number && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 rounded-3xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
              <Phone className="w-5 h-5 text-amber-700 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                <span>Nomor WhatsApp Aktif Belum Terdaftar</span>
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Lengkapi nomor WhatsApp Anda di Profil Toko agar tim kurator dan administrator dapat menghubungi Anda dengan cepat terkait pencairan saldo dan verifikasi produk.
              </p>
            </div>
          </div>
          {onNavigateToProfile && (
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <span>Lengkapi Profil</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* --- FILTER RENTANG WAKTU ANALITIK TOKO --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 card-shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span>Periode Analitik:</span>
              <span className="text-brand-teal font-extrabold">{getPeriodLabel(selectedPeriod)}</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Menampilkan performa penjualan, CVR, AOV, dan kanal bayar sesuai rentang waktu terpilih
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200/70 self-start sm:self-auto">
          {[
            { id: '7d', label: '7 Hari' },
            { id: '30d', label: '30 Hari' },
            { id: 'this_month', label: 'Bulan Ini' },
            { id: '6m', label: '6 Bulan' },
            { id: 'all', label: 'Semua Waktu' },
          ].map((item) => {
            const active = selectedPeriod === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePeriodChange(item.id as PeriodType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  active
                    ? 'bg-brand-teal text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-white/80'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- 6 KARTU METRIK UTAMA MERCHANT (RESPONSIVE GRID) --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Metrik 1: Total Produk */}
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-brand-teal" /> Katalog
              </p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">
                {productData.total_products}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="pt-2.5 mt-2.5 border-t border-stone-100 flex items-center justify-between text-[10.5px]">
            <span className="text-emerald-700 font-bold">{productData.published_count} Terbit</span>
            <span className="text-stone-400">{productData.draft_count} Draf</span>
          </div>
        </div>

        {/* Metrik 2: Unit Terjual (Periode Ini) */}
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" /> Terjual
              </p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">
                {productData.total_sales}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10.5px] text-emerald-700 font-semibold pt-2.5 mt-2.5 border-t border-stone-100 truncate">
            {getPeriodLabel(selectedPeriod)}
          </p>
        </div>

        {/* Metrik 3: Konversi (CVR) */}
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-teal-600" /> Rasio CVR
              </p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">
                {conversionRate}%
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10.5px] text-stone-500 font-medium pt-2.5 mt-2.5 border-t border-stone-100 truncate">
            {productData.total_views.toLocaleString('id-ID')} tayangan
          </p>
        </div>

        {/* Metrik 4: Pendapatan Bersih (Net Revenue) */}
        <div className="bg-emerald-50/70 p-4 rounded-3xl border border-emerald-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-700" /> Hak Bersih
              </p>
              <p className="text-lg sm:text-xl font-black text-emerald-950 leading-tight truncate" title={formatCurrency(productData.total_net_revenue)}>
                {formatCurrency(productData.total_net_revenue)}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10.5px] text-emerald-700 font-semibold pt-2.5 mt-2.5 border-t border-emerald-100 flex items-center justify-between">
            <span>Bagi hasil</span>
            <span className="font-bold bg-emerald-200/60 px-1 py-0.2 rounded text-[10px] text-emerald-900">
              {productData.total_gross_revenue > 0 
                ? Math.round((productData.total_net_revenue / productData.total_gross_revenue) * 100) 
                : actualNetPercent}% net
            </span>
          </p>
        </div>

        {/* Metrik 5: Nilai Rata-rata Pesanan (AOV) (Baru) */}
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1" title="Average Order Value">
                <Percent className="w-3.5 h-3.5 text-sky-600" /> Rata Order (AOV)
              </p>
              <p className="text-lg sm:text-xl font-black text-stone-900 leading-tight truncate" title={formatCurrency(productData.aov)}>
                {productData.aov > 0 ? formatCurrency(productData.aov) : '-'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10.5px] text-stone-500 font-medium pt-2.5 mt-2.5 border-t border-stone-100 truncate">
            {productData.aov > 0 ? 'Per transaksi pembeli' : 'Belum ada transaksi'}
          </p>
        </div>

        {/* Metrik 6: Rating Toko & Kepuasan Pembeli (Baru) */}
        <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-200/80 card-shadow card-shadow-hover flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> Rating Toko
              </p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 leading-tight flex items-center gap-1">
                <span>{productData.store_rating > 0 ? productData.store_rating.toFixed(1) : '5.0'}</span>
                <span className="text-xs font-semibold text-stone-400">/ 5.0</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
              <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
            </div>
          </div>
          <p className="text-[10.5px] text-amber-800 font-semibold pt-2.5 mt-2.5 border-t border-amber-200/60 truncate">
            {productData.total_reviews > 0 ? `⭐ ${productData.total_reviews} ulasan terverifikasi` : '⭐ Pelayanan prima'}
          </p>
        </div>

      </div>

      {/* --- PANEL SALDO & DOMPET PENJUALAN SELLER --- */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 card-shadow space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-stone-100 pb-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-brand-teal flex items-center justify-center border border-emerald-100">
                <Landmark className="w-4 h-4" />
              </div>
              <span>Dompet & Saldo Hasil Penjualan</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Rincian omset kotor, potongan admin ({feePolicy?.fee_percent || `${actualFeePercent}%`}), dan saldo siap cair ke rekening Anda.
            </p>
          </div>

          {/* Tombol Pencairan Dana */}
          {isWithdrawalEligible && (
            <button 
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-brand-teal/20 transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Landmark className="w-4 h-4" /> 
              <span>Tarik Dana ({formatCurrency(pendingPayout)})</span>
            </button>
          )}
        </div>

        {/* 6 Kartu Rincian Saldo Dompet */}
        {loadingEarnings ? (
          <div className="animate-pulse grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-stone-100 rounded-2xl"></div>
            ))}
          </div>
        ) : (summary || productData.total_sales > 0) ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* Omset Kotor */}
            <div className="bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/80 flex flex-col justify-between">
              <p className="text-stone-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5" /> Omset Kotor
              </p>
              <p className="text-base sm:text-lg font-bold text-stone-900">{formatCurrency(totalGross)}</p>
              <p className="text-[10px] text-stone-400 mt-1">{productData.total_sales} transaksi sukses</p>
            </div>

            {/* Potongan Admin Platform */}
            <div className="bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/80 flex flex-col justify-between">
              <p className="text-stone-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" /> Biaya Platform
              </p>
              <p className="text-base sm:text-lg font-bold text-rose-600">-{formatCurrency(totalAdminFee)}</p>
              <p className="text-[10px] text-stone-500 mt-1 flex items-center justify-between">
                <span>Bagi hasil</span>
                <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                  {actualFeePercent}%
                </span>
              </p>
            </div>

            {/* Total Hak Bersih */}
            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
              <p className="text-emerald-800 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Hak Bersih (Net)
              </p>
              <p className="text-base sm:text-lg font-bold text-emerald-900">{formatCurrency(totalNet)}</p>
              <p className="text-[10px] text-emerald-700 mt-1 flex items-center justify-between">
                <span>Total hak</span>
                <span className="font-bold bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                  {actualNetPercent}%
                </span>
              </p>
            </div>

            {/* Saldo Tertahan (Holding 3 Hari) */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              holdingPayout > 0 
                ? 'bg-amber-50/70 border-amber-200 text-amber-950' 
                : 'bg-stone-50/70 border-stone-200/80'
            }`}>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 text-amber-800">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Saldo Tertahan
              </p>
              <p className="text-base sm:text-lg font-bold text-amber-950">{formatCurrency(holdingPayout)}</p>
              <p className="text-[10px] text-amber-700/80 mt-1 truncate" title="Dana ditahan 3x24 jam sejak transaksi untuk proteksi komplain pembeli">
                {holdingCount > 0 ? `⏳ ${holdingCount} pesanan masa kliring` : 'Kliring 3 hari aman'}
              </p>
            </div>

            {/* Saldo Siap Ditarik */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              availablePayout > 0 
                ? 'bg-teal-50/80 border-teal-200 text-teal-950' 
                : 'bg-stone-50/70 border-stone-200/80'
            }`}>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 text-brand-teal">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" /> Siap Ditarik
              </p>
              <p className="text-base sm:text-lg font-bold text-stone-900">{formatCurrency(availablePayout)}</p>
              <p className="text-[10px] text-stone-500 mt-1">
                {isWithdrawalEligible ? `✅ Siap dicairkan (${pendingPayoutRatio}%)` : `Min. ${formatCurrency(minWithdrawalLimit)}`}
              </p>
            </div>

            {/* Sedang Diproses */}
            <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              processingPayout > 0 
                ? 'bg-sky-50/80 border-sky-200 text-sky-950' 
                : 'bg-stone-50/70 border-stone-200/80'
            }`}>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 text-sky-700">
                <History className="w-3.5 h-3.5 text-sky-600" /> Diproses
              </p>
              <p className="text-base sm:text-lg font-bold text-stone-900">{formatCurrency(processingPayout)}</p>
              <p className="text-[10px] text-sky-600 mt-1">
                {summary?.processing_count || 0} pengajuan antre
              </p>
            </div>

          </div>
        ) : (
          <div className="p-8 text-center text-stone-400 text-xs bg-stone-50 rounded-2xl border border-stone-200/60">
            Belum ada riwayat transaksi pendapatan. Mulai terbitkan produk digital Anda!
          </div>
        )}

        {/* --- KARTU TRANSPARANSI BAGI HASIL & BIAYA PAYMENT GATEWAY (MIDTRANS) --- */}
        <div className="bg-gradient-to-br from-stone-50 to-teal-50/30 p-4 sm:p-5 rounded-2xl border border-stone-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                Transparansi Skema Bagi Hasil & Biaya Gerbang Pembayaran (Midtrans)
              </h3>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100/70 text-brand-teal border border-teal-200/60 w-fit">
              Kebijakan Aktif Platform
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-stone-200/60">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Bagi Hasil Kreator</span>
              <p className="text-base font-extrabold text-brand-teal mt-0.5">
                {feePolicy?.creator_share_percent || `${actualNetPercent}%`}
              </p>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Biaya platform {feePolicy?.fee_percent || `${actualFeePercent}%`} per transaksi
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-stone-200/60">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Ketentuan Gerbang Pembayaran</span>
              <p className="text-base font-extrabold text-stone-800 mt-0.5">
                Midtrans Gateway
              </p>
              <p className="text-[10.5px] text-emerald-700 font-semibold mt-0.5">
                {feePolicy?.midtrans?.payer_label || 'Dibebankan kepada Pembeli saat Checkout'}
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-stone-200/60">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Ketentuan Pencairan (Withdrawal)</span>
              <p className="text-base font-extrabold text-stone-800 mt-0.5">
                Min. {formatCurrency(minWithdrawalLimit)}
              </p>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Masa kliring 3x24 jam bebas sengketa
              </p>
            </div>
          </div>

          <p className="text-[11px] text-stone-500 leading-relaxed bg-white/70 p-3 rounded-xl border border-stone-200/40">
            ℹ️ <span className="font-semibold text-stone-700">Pemberitahuan Resmi:</span> {feePolicy?.midtrans?.note || 'Biaya transaksi gerbang pembayaran (MDR QRIS 0.7% / Virtual Account) ditetapkan secara resmi oleh Midtrans & Bank Indonesia untuk infrastruktur pemrosesan pembayaran, bukan merupakan potongan komisi ataupun pendapatan dari Asisten Guru.'}
          </p>
        </div>
      </div>

      {/* --- KOTAK REKOMENDASI CERDAS MITRA (SMART ACTIONABLE INSIGHTS) --- */}
      <SmartInsightsCard 
        insights={analytics?.insights}
        loading={loadingAnalytics}
        onNavigateToProducts={onNavigateToProducts}
        onNavigateToNewProduct={onNavigateToNewProduct}
        onShareWhatsApp={() => {
          if (shareLinks.whatsapp) {
            window.open(shareLinks.whatsapp, '_blank');
          }
        }}
      />

      {/* --- Visual Charts Grid (Tren Penjualan & Kanal Pembayaran di Periode Terpilih) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EarningsBarChart 
            title={`Tren Penjualan Produk (${getPeriodLabel(selectedPeriod)})`}
            data={productData.trend} 
            loading={loadingAnalytics} 
          />
        </div>
        <div className="lg:col-span-1">
          <PaymentMethodChart 
            title={`Kanal Pembayaran (${getPeriodLabel(selectedPeriod)})`}
            data={productData.payment_methods}
            loading={loadingAnalytics}
          />
        </div>
      </div>

      {/* --- Corong Konversi Belanja & Sumber Trafik Toko --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnelChart 
          title={`Corong Konversi Belanja (${getPeriodLabel(selectedPeriod)})`}
          funnel={analytics?.funnel}
          loading={loadingAnalytics}
        />
        <TrafficSourceChart 
          title={`Sumber Trafik & Asal Pengunjung (${getPeriodLabel(selectedPeriod)})`}
          traffic={analytics?.traffic}
          loading={loadingAnalytics}
        />
      </div>

      {/* --- Rasio Status Katalog & 5 Produk Digital Terlaris --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProductStatusChart 
            title="Rasio Status Katalog"
            data={productData.status_distribution}
            loading={loadingAnalytics}
          />
        </div>
        <div className="lg:col-span-2">

      {/* --- Tabel 5 Produk Digital Terlaris --- */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-brand-teal flex items-center justify-center border border-emerald-100">
              <Package className="w-4 h-4" />
            </div>
            <span>5 Produk Digital Terlaris Saya</span>
          </h3>
          <button
            onClick={onNavigateToProducts}
            className="text-xs font-bold text-brand-teal hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Semua Produk</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {productData.top_products && productData.top_products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Nama Produk Digital</th>
                  <th className="px-4 py-3 text-right">Harga Satuan</th>
                  <th className="px-4 py-3 text-center">Terjual</th>
                  <th className="px-4 py-3 text-right">Tayangan</th>
                  <th className="px-4 py-3 text-center rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {productData.top_products.map((prod: TopProduct) => (
                  <tr key={prod.id} className="hover:bg-stone-50/80 transition">
                    <td className="px-4 py-3.5 font-bold text-stone-900 max-w-md truncate">
                      {prod.title}
                    </td>
                    <td className="px-4 py-3.5 text-right font-extrabold text-stone-900">
                      {formatCurrency(prod.price)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {prod.sales_count || 0} unit
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-stone-600">
                      {(prod.view_count || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {prod.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                          <CheckCircle2 className="w-3 h-3" /> Terbit
                        </span>
                      ) : prod.status === 'archived' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                          Diarsipkan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" /> Draf
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-stone-400 text-xs bg-stone-50 rounded-2xl border border-stone-200/60">
            Belum ada produk digital yang dibuat. Terbitkan karya pertama Anda sekarang!
          </div>
        )}
      </div>
    </div>
  </div>

      {/* --- Tabel Riwayat Penarikan Dana (Withdrawals History) --- */}
      {withdrawals.length > 0 && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
          <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <span>Riwayat Penarikan Dana</span>
          </h3>

          <div className="overflow-x-auto border border-stone-200/80 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Tanggal Pengajuan</th>
                  <th className="px-4 py-3 text-right">Jumlah (Rp)</th>
                  <th className="px-4 py-3">Tujuan Transfer</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Catatan Admin</th>
                  <th className="px-4 py-3 text-center">Bukti Transfer</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-stone-50/60 transition">
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDateTime(w.created_at, true, true)}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-stone-900">{formatCurrency(w.amount)}</td>
                    <td className="px-4 py-3 text-stone-700 font-medium font-mono text-[11px]">{w.bank_details}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {w.status === 'pending' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          Sedang Diproses
                        </span>
                      )}
                      {w.status === 'completed' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Selesai Ditransfer
                        </span>
                      )}
                      {w.status === 'rejected' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          Ditolak
                        </span>
                      )}
                      {w.status === 'cancelled' && (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 text-[10px] font-bold">
                          Dibatalkan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-[11px] max-w-xs">{w.admin_note || '-'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {w.transfer_receipt_url ? (
                        <a 
                          href={getMediaUrl(w.transfer_receipt_url)} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-brand-teal hover:underline font-bold"
                        >
                          <span>Lihat Bukti</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {w.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleCancelWithdrawal(w.id)}
                          className="text-stone-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg border border-stone-200 transition text-[11px] font-semibold"
                          title="Batalkan permintaan penarikan dan kembalikan saldo ke dompet"
                        >
                          Batalkan
                        </button>
                      ) : (
                        <span className="text-stone-300 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Modal Withdrawal --- */}
      <WithdrawalModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        pendingPayout={pendingPayout}
        holdingPayout={holdingPayout}
        initialBankDetails={profile.bankDetails || ''}
        minWithdrawalAmount={minWithdrawalLimit}
        bankDisbursementFee={feePolicy?.bank_disbursement_fee ?? 2500}
        onSuccess={() => {
          fetchDashboardData();
        }}
      />

    </div>
  );
};
