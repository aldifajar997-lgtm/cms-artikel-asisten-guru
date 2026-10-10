import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, BarChart3, MousePointerClick, Layers, DollarSign, Percent, CreditCard, AlertCircle, History, Landmark, X } from 'lucide-react';
import { UserProfile, ArticleStats } from '../types';
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

export const Dashboard: React.FC<DashboardProps> = ({ profile, stats }) => {
  const { success, error: showError } = useToast();
  
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  
  // Withdrawal Modal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [bankDetails, setBankDetails] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const roles = profile.role ? profile.role.split(',').map(r => r.trim().toLowerCase()) : [];
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isWriter = roles.includes('writer') || isAdmin;
  const isSeller = roles.includes('seller') || isAdmin;

  useEffect(() => {
    if (isSeller) {
      fetchEarningsData();
    }
  }, [profile.role]);

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
      fetchEarningsData(); // Refresh data
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

  return (
    <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-teal-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Selamat datang, {profile.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-teal-100 text-lg max-w-2xl">
            Berikut adalah ringkasan performa konten Anda. Mari buat karya hebat lainnya hari ini!
          </p>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="space-y-8">
        
        {/* --- Status Analitik --- */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" /> Status Analitik Konten
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Artikel</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{stats.totalArticles}</p>
                <p className="text-[10px] text-teal-600 font-medium">{stats.publishedCount} Terpublikasi</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rata-rata Skor</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">S:{stats.avgScore} <span className="text-slate-300">|</span> G:{stats.avgGeoScore}</p>
                <p className="text-[10px] text-teal-600 font-medium">Optimasi SEO</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Kata</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{stats.totalWords.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-teal-600 font-medium">~{Math.round(stats.totalWords / Math.max(1, stats.totalArticles))} kata</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <MousePointerClick className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tayangan</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{stats.totalViews?.toLocaleString('id-ID') || 0}</p>
                <p className="text-[10px] text-teal-600 font-medium">Pengunjung</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Draf / Menunggu</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{stats.draftCount}</p>
                <p className="text-[10px] text-slate-400 font-medium">Pengerjaan</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- Visualisasi Grafik --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isSeller && <EarningsBarChart />}
            {isWriter && <ContentTrendChart />}
          </div>
          <div className="lg:col-span-1">
            <ArticleStatusChart published={stats.publishedCount} draft={stats.draftCount} />
          </div>
        </div>

        {/* --- Ringkasan Pendapatan Seller --- */}
        {isSeller && (
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" /> Ringkasan Pendapatan & Penjualan
            </h2>
            {summary && summary.pending_payout >= 10000 && (
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
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
                <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Kotor</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{formatCurrency(summary.total_gross)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{summary.total_transactions} sukses</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-slate-500 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Percent className="w-4 h-4" /> Admin</p>
                <p className="text-lg sm:text-xl font-bold text-rose-600">-{formatCurrency(summary.total_admin_fee)}</p>
                <p className="text-[10px] text-slate-400 mt-1">Biaya platform</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-center">
                <p className="text-emerald-700 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Net</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-800">{formatCurrency(summary.total_net)}</p>
                <p className="text-[10px] text-emerald-600 mt-1">Total bersih</p>
              </div>
              <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-center ${summary.pending_payout > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <p className="text-slate-600 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Mengendap</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{formatCurrency(summary.pending_payout)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{summary.pending_count} trx</p>
              </div>
              {summary.processing_payout > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-center">
                  <p className="text-blue-700 text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><History className="w-4 h-4" /> Diproses</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-800">{formatCurrency(summary.processing_payout)}</p>
                  <p className="text-[10px] text-blue-600 mt-1">Menunggu</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500">
              Belum ada data pendapatan. Mulai publikasikan produk untuk mendapatkan penghasilan!
            </div>
          )}
        </div>
        )}

        {/* --- Riwayat Penarikan Dana --- */}
        {isSeller && withdrawals.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" /> Riwayat Penarikan Dana
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Tanggal Pengajuan</th>
                      <th className="px-4 py-3 font-semibold text-right">Jumlah (Rp)</th>
                      <th className="px-4 py-3 font-semibold">Tujuan Transfer</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Catatan Admin</th>
                      <th className="px-4 py-3 font-semibold">Bukti Transfer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">{formatDate(w.created_at)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(w.amount)}</td>
                        <td className="px-4 py-3 text-slate-600">{w.bank_details}</td>
                        <td className="px-4 py-3">
                          {w.status === 'pending' && <span className="inline-flex px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">Diproses</span>}
                          {w.status === 'completed' && <span className="inline-flex px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Selesai</span>}
                          {w.status === 'rejected' && <span className="inline-flex px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-bold">Ditolak</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{w.admin_note || '-'}</td>
                        <td className="px-4 py-3">
                          {w.transfer_receipt_url ? (
                            <a href={w.transfer_receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold text-xs">
                              Lihat Bukti
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
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

      </div>

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
                <p className="text-sm text-emerald-700 mb-1">Total Saldo yang Akan Ditarik</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(summary.pending_payout)}</p>
              </div>

              <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Informasi Rekening Tujuan</label>
                  <textarea 
                    required
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="Contoh: Bank BCA 123456789 a/n Nama Lengkap Anda"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 h-24 resize-none"
                  ></textarea>
                  <p className="text-xs text-slate-500 mt-1">Pastikan nama pemilik rekening sesuai dengan identitas Anda.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setShowWithdrawModal(false)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                  <button type="submit" disabled={submittingWithdraw} className="px-6 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
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
