import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, BarChart3, MousePointerClick, Layers, DollarSign, 
  Percent, CreditCard, AlertCircle, History, Landmark, X, Package, 
  ShoppingCart, LayoutGrid, Eye, CheckCircle2, Clock, Archive, 
  TrendingUp, Award, Target, ShieldCheck, Activity, HardDrive, Users
} from 'lucide-react';
import { UserProfile, ArticleStats, DashboardAnalytics } from '../types';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ContentTrendChart } from './charts/ContentTrendChart';
import { EarningsBarChart } from './charts/EarningsBarChart';
import { ArticleStatusChart } from './charts/ArticleStatusChart';
import { formatDateTime } from '../utils/dateFormatter';

interface DashboardProps {
  profile: UserProfile;
  stats: ArticleStats;
}

interface EarningsSummary {
  total_transactions: number;
  total_gross: number;
  total_admin_fee: number;
  total_net: number;
  pending_payout: number;
  processing_payout: number;
  paid_out: number;
  pending_count: number;
  processing_count: number;
  transferred_count: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  bank_details: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  processed_at: string | null;
  admin_note: string | null;
  transfer_receipt_url: string | null;
}

type DashboardViewTab = 'executive' | 'editorial' | 'writer' | 'seller' | 'all';

export const Dashboard: React.FC<DashboardProps> = ({ profile, stats: fallbackStats }) => {
  const { success, error: showError } = useToast();
  
  // Real Analytics State
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  
  // Peran Pengguna
  const roles = profile.role ? profile.role.split(',').map(r => r.trim().toLowerCase()) : [];
  const isSuperAdmin = roles.includes('super admin') || roles.includes('super_admin');
  const isAdmin = isSuperAdmin || roles.includes('admin');
  const isEditor = isAdmin || roles.includes('editor');
  const isSeller = isAdmin || roles.includes('seller');
  const isWriter = isAdmin || isEditor || roles.includes('writer');

  // Menentukan tab awal yang paling relevan secara otomatis sesuai peran (Smart Role Default)
  const getInitialTab = (): DashboardViewTab => {
    if (isSuperAdmin || isAdmin) return 'executive';
    if (isEditor) return 'editorial';
    if (isSeller && !isWriter) return 'seller';
    if (isWriter && !isSeller) return 'writer';
    return 'all';
  };

  const [activeTab, setActiveTab] = useState<DashboardViewTab>(getInitialTab);

  // Earnings & Withdrawal State
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  
  // Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [bankDetails, setBankDetails] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  useEffect(() => {
    fetchRealAnalytics();
    if (isSeller) {
      fetchEarningsData();
    }
  }, [profile.role]);

  // Sesuaikan tab otomatis jika profil role berubah
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [profile.role]);

  const fetchRealAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await api.get('/dashboard/analytics');
      if (res.data?.data) {
        setAnalytics(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard analytics', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchEarningsData = async () => {
    setLoadingEarnings(true);
    try {
      const summaryRes = await api.get('/earnings/summary');
      if (summaryRes.data?.summary) {
        setSummary(summaryRes.data.summary);
      }
      
      const withdrawalsRes = await api.get('/earnings/withdrawals');
      if (withdrawalsRes.data?.data) {
        setWithdrawals(withdrawalsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch earnings data', err);
    } finally {
      setLoadingEarnings(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankDetails.trim() || bankDetails.length < 5) {
      showError('Detail rekening tidak valid. Harap isi dengan lengkap (Misal: BCA 1234567 a/n Budi)');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      await api.post('/earnings/withdrawals', { bank_details: bankDetails });
      success('Permintaan penarikan dana berhasil diajukan!');
      setShowWithdrawModal(false);
      setBankDetails('');
      fetchEarningsData();
      fetchRealAnalytics();
    } catch (err: any) {
      console.error('Withdrawal error', err);
      showError(err.response?.data?.message || 'Gagal mengajukan penarikan dana.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString, true, false);
  };

  // Safe fallback statistics
  const articleData = analytics?.articles || {
    total_articles: fallbackStats.totalArticles,
    published_count: fallbackStats.publishedCount,
    draft_count: fallbackStats.draftCount,
    total_words: fallbackStats.totalWords,
    avg_words: Math.round(fallbackStats.totalWords / Math.max(1, fallbackStats.totalArticles)),
    avg_score: fallbackStats.avgScore,
    avg_geo_score: fallbackStats.avgGeoScore,
    total_views: fallbackStats.totalViews || 0,
    status_distribution: [
      { name: 'Terpublikasi', value: fallbackStats.publishedCount, color: '#0d9488' },
      { name: 'Draf', value: fallbackStats.draftCount, color: '#94a3b8' }
    ],
    trend: [],
    top_articles: []
  };

  const productData = analytics?.products || {
    total_products: 0,
    published_count: 0,
    draft_count: 0,
    archived_count: 0,
    total_views: 0,
    total_sales: summary?.total_transactions || 0,
    avg_price: 0,
    total_gross_revenue: summary?.total_gross || 0,
    total_net_revenue: summary?.total_net || 0,
    pending_payout: summary?.pending_payout || 0,
    paid_out: summary?.paid_out || 0,
    status_distribution: [
      { name: 'Terpublikasi', value: 0, color: '#10b981' },
      { name: 'Draf', value: 0, color: '#f59e0b' },
      { name: 'Diarsipkan', value: 0, color: '#94a3b8' }
    ],
    trend: [],
    top_products: []
  };

  const overviewData = analytics?.overview || {
    total_content: articleData.total_articles + productData.total_products,
    total_views: articleData.total_views + productData.total_views,
    total_sales: productData.total_sales,
    total_earnings: productData.total_net_revenue
  };

  const executiveMetrics = analytics?.executive_metrics;
  const editorialDesk = analytics?.editorial_desk;
  const creatorGoals = analytics?.creator_goals;
  const sellerMetrics = analytics?.seller_metrics;

  return (
    <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in duration-500">
      
      {/* --- Welcome Banner Berbasis Peran --- */}
      <div className="bg-gradient-to-r from-teal-800 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20 relative overflow-hidden border border-teal-900/40">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold mb-3">
              {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              {isEditor && !isAdmin && <Award className="w-3.5 h-3.5 text-indigo-400" />}
              {isWriter && !isAdmin && !isEditor && <Target className="w-3.5 h-3.5 text-teal-400" />}
              {isSeller && !isAdmin && !isWriter && <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />}
              
              <span>
                {isAdmin 
                  ? 'Panel Eksekutif & Manajemen Platform' 
                  : isEditor 
                    ? 'Meja Redaksi & Quality Governance' 
                    : isSeller && !isWriter 
                      ? 'Pusat Niaga & Produk Digital' 
                      : 'Studio Kreator Jurnalistik'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
              Selamat datang, {profile.name ? profile.name.split(' ')[0] : 'Kreator'}! 👋
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isAdmin 
                ? 'Pantau kesehatan platform, omset ekosistem marketplace, dan koordinasi antrean editorial seluruh media.'
                : isEditor 
                  ? 'Tinjau draf penulis, pantau produktivitas redaksi, dan jaga standar kualitas SEO konten.'
                  : isWriter 
                    ? 'Fokus pada pencapaian target menulis bulanan dan tingkatkan jangkauan pembaca setia Anda.'
                    : 'Kelola penjualan produk digital Anda, pantau omset harian, dan cairkan saldo pendapatan.'}
            </p>
          </div>

          {/* Quick Info Box di Kanan Banner */}
          <div className="flex md:flex-col items-center md:items-end justify-between gap-2 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm self-start md:self-auto">
            <span className="text-[11px] text-slate-300 font-medium">Peran Terverifikasi:</span>
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-500/30">
              {profile.role || 'Member'}
            </span>
          </div>
        </div>
      </div>

      {/* --- Role-Tailored Navigation Switcher --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">Navigasi Sudut Pandang Peran</h2>
            <p className="text-xs text-slate-500">Pilih perspektif dashboard yang disesuaikan dengan wewenang Anda</p>
          </div>
        </div>

        <div className="inline-flex flex-wrap p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-semibold gap-1">
          {/* Opsi Tab Super Admin & Admin */}
          {isAdmin && (
            <button 
              type="button"
              onClick={() => setActiveTab('executive')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'executive' 
                  ? 'bg-white text-teal-800 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Eksekutif
            </button>
          )}

          {/* Opsi Tab Editor / Redaktur */}
          {isEditor && (
            <button 
              type="button"
              onClick={() => setActiveTab('editorial')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'editorial' 
                  ? 'bg-white text-teal-800 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" /> Meja Redaksi
            </button>
          )}

          {/* Opsi Tab Penulis */}
          {isWriter && (
            <button 
              type="button"
              onClick={() => setActiveTab('writer')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'writer' 
                  ? 'bg-white text-teal-800 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-teal-600" /> Studio Penulis
            </button>
          )}

          {/* Opsi Tab Seller */}
          {isSeller && (
            <button 
              type="button"
              onClick={() => setActiveTab('seller')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'seller' 
                  ? 'bg-white text-teal-800 shadow-sm font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-amber-600" /> Pusat Seller
            </button>
          )}

          {/* Opsi Ringkasan Global (Semua) */}
          <button 
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'all' 
                ? 'bg-white text-teal-800 shadow-sm font-bold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Ringkasan Global
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* VIEW 1: SUPER ADMIN & MANAJEMEN (EXECUTIVE COCKPIT)                  */}
      {/* ==================================================================== */}
      {activeTab === 'executive' && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Ringkasan Keuangan Platform & Ekosistem
            </h3>
            <span className="text-xs text-slate-500 font-medium">Data real-time seluruh sistem</span>
          </div>

          {/* 4 Kartu Metrik Eksekutif */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Omset Platform (GMV)
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {formatCurrency(executiveMetrics?.total_gross_gmv || 0)}
                </p>
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-2">Seluruh transaksi sukses</p>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-700" /> Pendapatan Platform
                </p>
                <p className="text-2xl font-black text-emerald-800">
                  {formatCurrency(executiveMetrics?.total_platform_fee_collected || 0)}
                </p>
              </div>
              <p className="text-[11px] text-emerald-600 font-medium mt-2">Akumulasi potongan admin</p>
            </div>

            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" /> Kewajiban Payout
                </p>
                <p className="text-2xl font-black text-amber-800">
                  {formatCurrency(executiveMetrics?.total_pending_seller_payout || 0)}
                </p>
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-2">Saldo seller yang belum ditarik</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" /> Ekosistem Kreator
                </p>
                <p className="text-2xl font-black text-slate-900">
                  {executiveMetrics?.total_users_count || 0}
                </p>
              </div>
              <p className="text-[11px] text-indigo-600 font-medium mt-2">
                {executiveMetrics?.active_authors_count || 0} Penulis • {executiveMetrics?.active_sellers_count || 0} Seller
              </p>
            </div>
          </div>

          {/* Status Sinkronisasi & Infrastruktur */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  Status S2S Hub Sync Queue 
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    🟢 Normal & Sinkron
                  </span>
                </h4>
                <p className="text-xs text-slate-400">Sinkronisasi pembayaran otomatis berjalan setiap 15 menit melalui Cloudflare Worker Cron.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <HardDrive className="w-3.5 h-3.5 text-teal-400" />
                <span>{executiveMetrics?.total_media_count || 0} Aset Media di Cloudflare R2</span>
              </div>
            </div>
          </div>

          {/* Grafik Gabungan: Artikel vs Pendapatan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContentTrendChart 
              title="Volume Aktivitas Publikasi Platform"
              data={articleData.trend} 
              loading={loadingAnalytics} 
            />
            <EarningsBarChart 
              title="Tren Penjualan Produk Platform"
              data={productData.trend} 
              loading={loadingAnalytics} 
            />
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: EDITOR-IN-CHIEF / REDAKTUR (EDITORIAL DESK)                 */}
      {/* ==================================================================== */}
      {activeTab === 'editorial' && isEditor && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" /> Meja Redaksi & Manajemen Kualitas Konten
            </h3>
            <span className="text-xs text-slate-500 font-medium">Tata kelola penerbitan artikel</span>
          </div>

          {/* 4 Kartu Metrik Redaksi */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Antrean Draf</p>
                <p className="text-lg font-bold text-indigo-900 leading-tight">{editorialDesk?.pending_drafts_count || 0}</p>
                <p className="text-[10px] text-indigo-500 font-medium">Perlu review redaksi</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Artikel Terbit</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.published_count}</p>
                <p className="text-[10px] text-teal-600 font-medium">Aktif dibaca publik</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rata-rata SEO Redaksi</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.avg_score} / 100</p>
                <p className="text-[10px] text-emerald-600 font-medium">Standar optimasi</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Pembaca</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.total_views.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-sky-600 font-medium">Tayangan kumulatif</p>
              </div>
            </div>
          </div>

          {/* Antrean Draf Review & Leaderboard Penulis (Side by Side) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Widget 1: Antrean Draf Review Redaksi */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Antrean Draf yang Menunggu Review
                </h4>
                {editorialDesk?.pending_review_queue && editorialDesk.pending_review_queue.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {editorialDesk.pending_review_queue.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Oleh: <strong className="text-slate-600">{item.author_name || 'Penulis'}</strong></span>
                            <span>•</span>
                            <span>{item.word_count || 0} kata</span>
                          </p>
                        </div>
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          SEO: {item.seo_score || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                    Semua artikel draf telah selesai ditinjau. Kerja bagus tim redaksi!
                  </div>
                )}
              </div>
            </div>

            {/* Widget 2: Leaderboard Produktivitas Penulis */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-600" /> Penulis Paling Produktif (Leaderboard)
                </h4>
                {editorialDesk?.author_leaderboard && editorialDesk.author_leaderboard.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {editorialDesk.author_leaderboard.map((author, idx) => (
                      <div key={author.author_id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                            idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{author.author_name}</p>
                            <p className="text-[11px] text-slate-400">{author.total_words.toLocaleString('id-ID')} kata diproduksi</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-teal-700">{author.published_count} Terbit</span>
                          <p className="text-[10px] text-slate-400">Avg SEO: {author.avg_seo_score}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                    Belum ada data artikel terbit dari para penulis.
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ContentTrendChart 
                title="Tren Penerbitan Konten Editorial"
                data={articleData.trend} 
                loading={loadingAnalytics} 
              />
            </div>
            <div className="lg:col-span-1">
              <ArticleStatusChart 
                title="Rasio Status Naskah Redaksi"
                data={articleData.status_distribution}
                loading={loadingAnalytics}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 3: PENULIS / KREATOR KONTEN (CREATOR STUDIO)                    */}
      {/* ==================================================================== */}
      {activeTab === 'writer' && isWriter && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-600" /> Target Pencapaian & Performa Karya Saya
            </h3>
            <span className="text-xs text-slate-500 font-medium">Bulan Berjalan ({new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})</span>
          </div>

          {/* Widget Progress Bar Target Bulanan Penulis */}
          {creatorGoals && (
            <div className="bg-gradient-to-r from-teal-50 to-indigo-50 p-5 rounded-2xl border border-teal-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-teal-900 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-teal-600" /> Progres Target Menulis Bulan Ini
                  </h4>
                  <p className="text-xs text-slate-600">Disinkronkan dengan preferensi profil penulis Anda</p>
                </div>
                <span className="text-xs font-bold text-teal-700 bg-teal-100 px-3 py-1 rounded-full self-start sm:self-auto">
                  Minimal {creatorGoals.target_min_words} kata / artikel
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>Target Artikel: {creatorGoals.articles_published_this_month} / {creatorGoals.monthly_article_goal} terbit</span>
                    <span className="text-teal-700 font-bold">{creatorGoals.article_goal_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-teal-600 h-3 rounded-full transition-all duration-500" 
                      style={{ width: `${creatorGoals.article_goal_percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>Target Kata: {creatorGoals.words_written_this_month.toLocaleString('id-ID')} / {creatorGoals.monthly_word_goal.toLocaleString('id-ID')} kata</span>
                    <span className="text-indigo-700 font-bold">{creatorGoals.word_goal_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-500" 
                      style={{ width: `${creatorGoals.word_goal_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5 Kartu Metrik Penulis Pribadi */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Artikel Saya</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.total_articles}</p>
                <p className="text-[10px] text-teal-600 font-medium">{articleData.published_count} Terbit</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Skor Kualitas</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">S:{articleData.avg_score} <span className="text-slate-300">|</span> G:{articleData.avg_geo_score}</p>
                <p className="text-[10px] text-teal-600 font-medium">SEO & GEO Kualitas</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Kata</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.total_words.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-teal-600 font-medium">~{articleData.avg_words} kata / artikel</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pembaca Karya</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.total_views.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-teal-600 font-medium">Pengunjung</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Draf Pengerjaan</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{articleData.draft_count}</p>
                <p className="text-[10px] text-slate-400 font-medium">Belum terbit</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ContentTrendChart 
                title="Tren Pembaca Tulisan Saya (6 Bulan)"
                data={articleData.trend} 
                loading={loadingAnalytics} 
              />
            </div>
            <div className="lg:col-span-1">
              <ArticleStatusChart 
                title="Rasio Status Naskah Saya"
                data={articleData.status_distribution}
                loading={loadingAnalytics}
              />
            </div>
          </div>

          {/* Tabel 5 Artikel Saya Paling Banyak Dilihat */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-teal-600" /> 5 Artikel Saya Paling Populer
            </h3>
            {articleData.top_articles && articleData.top_articles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Judul Artikel</th>
                      <th className="px-4 py-3 text-center">Skor SEO</th>
                      <th className="px-4 py-3 text-center">Skor GEO</th>
                      <th className="px-4 py-3 text-right">Tayangan</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {articleData.top_articles.map((art) => (
                      <tr key={art.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-md truncate">{art.title}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">
                            {art.seo_score || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            {art.geo_score || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {(art.view_count || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {art.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Terbit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
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
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                Belum ada data artikel. Publikasikan karya pertama Anda hari ini!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 4: SELLER (MERCHANT CENTER & PUSAT NIAGA)                      */}
      {/* ==================================================================== */}
      {activeTab === 'seller' && isSeller && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" /> Pusat Niaga & Konversi Produk Digital
            </h3>
            <span className="text-xs text-slate-500 font-medium">Performa katalog & penjualan produk</span>
          </div>

          {/* 4 Kartu Metrik Merchant */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Produk</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{productData.total_products}</p>
                <p className="text-[11px] text-emerald-600 font-medium">{productData.published_count} Terpublikasi</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unit Terjual</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{productData.total_sales}</p>
                <p className="text-[11px] text-emerald-600 font-medium">Transaksi Berhasil</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Konversi (CVR)</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{sellerMetrics?.conversion_rate || 0}%</p>
                <p className="text-[11px] text-indigo-600 font-medium">Pembeli vs Tayangan</p>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Pendapatan Bersih</p>
                <p className="text-2xl font-black text-emerald-800 leading-tight">{formatCurrency(productData.total_net_revenue)}</p>
                <p className="text-[11px] text-emerald-600 font-medium">Hak bersih seller</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EarningsBarChart 
                title="Tren Penjualan Produk Saya (6 Bulan)"
                data={productData.trend} 
                loading={loadingAnalytics} 
              />
            </div>
            <div className="lg:col-span-1">
              <ArticleStatusChart 
                title="Rasio Status Produk"
                data={productData.status_distribution}
                loading={loadingAnalytics}
              />
            </div>
          </div>

          {/* Tabel 5 Produk Unggulan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" /> 5 Produk Digital Terlaris Saya
            </h3>
            {productData.top_products && productData.top_products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Nama Produk Digital</th>
                      <th className="px-4 py-3 text-right">Harga Satuan</th>
                      <th className="px-4 py-3 text-center">Terjual</th>
                      <th className="px-4 py-3 text-right">Tayangan</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {productData.top_products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900 max-w-md truncate">{prod.title}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(prod.price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {prod.sales_count || 0} unit
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-600">{(prod.view_count || 0).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-center">
                          {prod.status === 'published' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Terbit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
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
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl">
                Belum ada produk digital yang dibuat. Tambahkan produk Anda di menu Produk!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 5: RINGKASAN GLOBAL (ALL / MULTI-ROLE)                         */}
      {/* ==================================================================== */}
      {activeTab === 'all' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Konten</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{overviewData.total_content}</p>
                <p className="text-[11px] text-teal-600 font-medium">{articleData.total_articles} Artikel • {productData.total_products} Produk</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                <MousePointerClick className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tayangan</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{overviewData.total_views.toLocaleString('id-ID')}</p>
                <p className="text-[11px] text-sky-600 font-medium">Pengunjung Website</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Penjualan</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{overviewData.total_sales}</p>
                <p className="text-[11px] text-emerald-600 font-medium">Transaksi Produk</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pendapatan Bersih</p>
                <p className="text-2xl font-extrabold text-slate-800 leading-tight">{formatCurrency(overviewData.total_earnings)}</p>
                <p className="text-[11px] text-amber-600 font-medium">Saldo Hak Seller</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContentTrendChart 
              title="Tren Aktivitas Artikel (6 Bulan)"
              data={articleData.trend} 
              loading={loadingAnalytics} 
            />
            <EarningsBarChart 
              title="Tren Pendapatan Produk (6 Bulan)"
              data={productData.trend} 
              loading={loadingAnalytics} 
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ArticleStatusChart 
              title="Rasio Status Konten Artikel"
              data={articleData.status_distribution}
              loading={loadingAnalytics}
            />
            <ArticleStatusChart 
              title="Rasio Status Katalog Produk"
              data={productData.status_distribution}
              loading={loadingAnalytics}
            />
          </div>
        </div>
      )}

      {/* --- PANEL SALDO & PENARIKAN DANA SELLER (Bagi Pengguna dengan Peran Seller) --- */}
      {isSeller && (
        <div className="space-y-6 pt-4 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 mb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Ringkasan Keuangan & Saldo Penjualan
              </h2>
              <p className="text-xs text-slate-500">Kelola saldo hak seller dan ajukan penarikan dana ke rekening Anda</p>
            </div>
            {summary && summary.pending_payout >= 10000 && (
              <button 
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-emerald-700/20 transition flex items-center gap-2 self-start sm:self-auto"
              >
                <Landmark className="w-4 h-4" /> Tarik Dana ({formatCurrency(summary.pending_payout)})
              </button>
            )}
          </div>

          {loadingEarnings ? (
            <div className="animate-pulse flex space-x-4"><div className="h-24 bg-slate-200 rounded-xl w-full"></div></div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CreditCard className="w-4 h-4" /> Omset Kotor
                </p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{formatCurrency(summary.total_gross)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{summary.total_transactions} sukses</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Percent className="w-4 h-4" /> Biaya Admin
                </p>
                <p className="text-lg sm:text-xl font-bold text-rose-600">-{formatCurrency(summary.total_admin_fee)}</p>
                <p className="text-[10px] text-slate-400 mt-1">Biaya platform</p>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                <p className="text-emerald-700 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> Bersih (Net)
                </p>
                <p className="text-lg sm:text-xl font-bold text-emerald-800">{formatCurrency(summary.total_net)}</p>
                <p className="text-[10px] text-emerald-600 mt-1">Total hak seller</p>
              </div>

              <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-center ${summary.pending_payout > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <p className="text-slate-600 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Saldo Dapat Ditarik
                </p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{formatCurrency(summary.pending_payout)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{summary.pending_count} transaksi</p>
              </div>

              {summary.processing_payout > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-center">
                  <p className="text-blue-700 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <History className="w-4 h-4" /> Sedang Diproses
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-blue-800">{formatCurrency(summary.processing_payout)}</p>
                  <p className="text-[10px] text-blue-600 mt-1">Menunggu transfer</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
              Belum ada data pendapatan. Mulai publikasikan produk untuk mendapatkan penghasilan!
            </div>
          )}
        </div>
      )}

      {/* --- Riwayat Penarikan Dana --- */}
      {isSeller && withdrawals.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" /> Riwayat Penarikan Dana
          </h3>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Tanggal Pengajuan</th>
                    <th className="px-4 py-3 text-right">Jumlah (Rp)</th>
                    <th className="px-4 py-3">Tujuan Transfer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Catatan Admin</th>
                    <th className="px-4 py-3">Bukti Transfer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{formatDate(w.created_at)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(w.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{w.bank_details}</td>
                      <td className="px-4 py-3">
                        {w.status === 'pending' && <span className="inline-flex px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Diproses</span>}
                        {w.status === 'completed' && <span className="inline-flex px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">Selesai</span>}
                        {w.status === 'rejected' && <span className="inline-flex px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">Ditolak</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{w.admin_note || '-'}</td>
                      <td className="px-4 py-3">
                        {w.transfer_receipt_url ? (
                          <a href={w.transfer_receipt_url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline font-semibold">
                            Lihat Bukti
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal Withdrawal --- */}
      {showWithdrawModal && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Landmark className="w-5 h-5 text-emerald-600" /> Tarik Dana Pendapatan</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="bg-emerald-50 rounded-lg p-4 mb-6 border border-emerald-100 text-center">
                <p className="text-xs text-emerald-700 mb-1 font-medium">Total Saldo yang Akan Ditarik</p>
                <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(summary.pending_payout)}</p>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Informasi Rekening Tujuan</label>
                  <textarea 
                    required
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="Contoh: Bank BCA 123456789 a/n Nama Lengkap Anda"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 h-24 resize-none"
                  ></textarea>
                  <p className="text-[11px] text-slate-500 mt-1">Pastikan nama pemilik rekening sesuai dengan identitas Anda.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowWithdrawModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                  <button type="submit" disabled={submittingWithdraw} className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                    {submittingWithdraw ? 'Mengajukan...' : 'Ajukan Penarikan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
