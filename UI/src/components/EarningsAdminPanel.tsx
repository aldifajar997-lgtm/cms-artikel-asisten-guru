import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Percent, TrendingUp, Plus, Settings, AlertCircle, History, User, Landmark, CheckCircle, XCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/dateFormatter';

interface FeeConfig {
  id: string;
  fee_bps: number;
  min_fee: number | null;
  max_fee: number | null;
  note: string;
  effective_from: string;
  set_by_name: string | null;
}

interface PlatformSummary {
  total_transactions: number;
  total_sellers: number;
  total_gross: number;
  total_platform_fee: number;
  total_seller_payout: number;
  pending_payout_total: number;
}

interface SellerLeaderboard {
  seller_id: string;
  seller_name: string;
  seller_email: string;
  total_sales: number;
  total_gross: number;
  admin_fee_collected: number;
  net_owed_to_seller: number;
  pending_payout: number;
}

interface WithdrawalRequest {
  id: string;
  seller_name: string;
  seller_email: string;
  amount: number;
  bank_details: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  processed_at: string | null;
  admin_note: string | null;
  transfer_receipt_url: string | null;
  processed_by_name: string | null;
}

export const EarningsAdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fee-config' | 'withdrawals'>('overview');
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // Data states
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [sellers, setSellers] = useState<SellerLeaderboard[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<FeeConfig[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  // Form states - Fee Config
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeePercent, setNewFeePercent] = useState<string>('10');
  const [newMinFee, setNewMinFee] = useState<string>('');
  const [newMaxFee, setNewMaxFee] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Form states - Withdrawals Action
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [withdrawAction, setWithdrawAction] = useState<'completed' | 'rejected' | null>(null);
  const [withdrawAdminNote, setWithdrawAdminNote] = useState('');
  const [withdrawReceiptUrl, setWithdrawReceiptUrl] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'fee-config') fetchFeeConfigs();
    else if (activeTab === 'withdrawals') fetchWithdrawals();
  }, [activeTab]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/earnings/admin/overview');
      if (res.data) {
        setPlatformSummary(res.data.platform);
        setSellers(res.data.per_seller);
      }
    } catch (err: any) {
      console.error('Failed to fetch overview', err);
      showError('Gagal memuat data ringkasan pendapatan.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeeConfigs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/earnings/admin/fee-config');
      if (res.data?.data) {
        setFeeConfigs(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch fee configs', err);
      showError('Gagal memuat konfigurasi fee.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/earnings/admin/withdrawals');
      if (res.data?.data) {
        setWithdrawals(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch withdrawals', err);
      showError('Gagal memuat permintaan penarikan dana.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        fee_bps: Math.round(parseFloat(newFeePercent) * 100),
        min_fee: newMinFee ? parseInt(newMinFee, 10) : null,
        max_fee: newMaxFee ? parseInt(newMaxFee, 10) : null,
        note: newNote || 'Pembaruan otomatis dari dashboard'
      };

      await api.post('/earnings/admin/fee-config', payload);
      success('Konfigurasi potongan admin berhasil diperbarui.');
      setShowAddForm(false);
      setNewFeePercent('10');
      setNewMinFee('');
      setNewMaxFee('');
      setNewNote('');
      fetchFeeConfigs();
    } catch (err: any) {
      console.error('Add fee config error', err);
      showError(err.response?.data?.message || 'Gagal menyimpan konfigurasi potongan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawal || !withdrawAction) return;

    if (withdrawAction === 'completed' && !withdrawReceiptUrl.trim()) {
      showError('URL Bukti transfer wajib diisi untuk status Selesai.');
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      await api.put(`/earnings/admin/withdrawals/${selectedWithdrawal.id}`, {
        status: withdrawAction,
        admin_note: withdrawAdminNote,
        transfer_receipt_url: withdrawAction === 'completed' ? withdrawReceiptUrl : undefined
      });
      
      success(`Status penarikan dana berhasil diubah menjadi ${withdrawAction === 'completed' ? 'Selesai' : 'Ditolak'}.`);
      setSelectedWithdrawal(null);
      setWithdrawAction(null);
      setWithdrawAdminNote('');
      setWithdrawReceiptUrl('');
      fetchWithdrawals();
    } catch (err: any) {
      console.error('Update withdrawal error', err);
      showError(err.response?.data?.message || 'Gagal memperbarui status penarikan dana.');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString, true, true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pendapatan & Fee</h1>
          <p className="text-slate-500 text-sm mt-1">Pantau transaksi marketplace, atur persentase revenue share, dan kelola penarikan dana.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'overview' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Ringkasan
        </button>
        <button
          onClick={() => setActiveTab('fee-config')}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'fee-config' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" /> Pengaturan Fee
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'withdrawals' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Landmark className="w-4 h-4" /> Penarikan Dana
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loading && !platformSummary ? (
            <div className="animate-pulse flex space-x-4"><div className="h-4 bg-slate-200 rounded w-1/4"></div></div>
          ) : platformSummary ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><DollarSign className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Gross Transaction Volume</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(platformSummary.total_gross)}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center shrink-0"><Percent className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Potongan Platform</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(platformSummary.total_platform_fee)}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0"><CreditCard className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Hak Seller (Net)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(platformSummary.total_seller_payout)}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0"><AlertCircle className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Belum Ditransfer (Pending)</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(platformSummary.pending_payout_total)}</p>
                  </div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><User className="w-5 h-5 text-teal-600" /> Leaderboard Seller</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Seller</th>
                        <th className="px-4 py-3 font-semibold">Transaksi</th>
                        <th className="px-4 py-3 font-semibold text-right">Penjualan Kotor (Gross)</th>
                        <th className="px-4 py-3 font-semibold text-right">Potongan Admin</th>
                        <th className="px-4 py-3 font-semibold text-right">Hak Seller (Net)</th>
                        <th className="px-4 py-3 font-semibold text-right">Status Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sellers.map((seller) => (
                        <tr key={seller.seller_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{seller.seller_name}</p>
                            <p className="text-xs text-slate-500">{seller.seller_email}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{seller.total_sales} trx</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(seller.total_gross)}</td>
                          <td className="px-4 py-3 text-right text-teal-600">{formatCurrency(seller.admin_fee_collected)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(seller.net_owed_to_seller)}</td>
                          <td className="px-4 py-3 text-right">
                            {seller.pending_payout > 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                {formatCurrency(seller.pending_payout)} Pending
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Semua Lunas</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {sellers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada transaksi terekam.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === 'fee-config' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800">Riwayat Kebijakan Potongan</h3>
              <p className="text-sm text-slate-500 mt-1">Kebijakan terbaru akan langsung berlaku untuk transaksi yang terjadi setelah waktu <strong>Effective From</strong>.</p>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah Kebijakan Baru
            </button>
          </div>

          {showAddForm && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Buat Kebijakan Baru</h4>
              <form onSubmit={handleAddFeeConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Potongan Admin (%) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="100" 
                      required 
                      value={newFeePercent} 
                      onChange={e => setNewFeePercent(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Contoh: 10 untuk 10%, atau 2.5 untuk 2.5%.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan / Alasan Perubahan</label>
                  <input 
                    type="text" 
                    value={newNote} 
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Misal: Penyesuaian fee platform 2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Minimal Potongan (Rupiah) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input 
                    type="number" 
                    min="0"
                    value={newMinFee} 
                    onChange={e => setNewMinFee(e.target.value)}
                    placeholder="Contoh: 5000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Maksimal Potongan (Rupiah) <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <input 
                    type="number" 
                    min="0"
                    value={newMaxFee} 
                    onChange={e => setNewMaxFee(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg">Batal</button>
                  <button type="submit" disabled={submitting} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                    {submitting ? 'Menyimpan...' : 'Terapkan Kebijakan'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Persentase (bps)</th>
                    <th className="px-4 py-3 font-semibold">Min Fee</th>
                    <th className="px-4 py-3 font-semibold">Max Fee</th>
                    <th className="px-4 py-3 font-semibold">Berlaku Sejak</th>
                    <th className="px-4 py-3 font-semibold">Diatur Oleh</th>
                    <th className="px-4 py-3 font-semibold">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeConfigs.map((config, i) => (
                    <tr key={config.id} className={i === 0 ? 'bg-teal-50/30' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <span className="font-bold text-teal-700">{(config.fee_bps / 100).toFixed(2)}%</span>
                        <span className="text-xs text-slate-400 ml-2">({config.fee_bps} bps)</span>
                        {i === 0 && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700">AKTIF</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{config.min_fee != null ? formatCurrency(config.min_fee) : '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{config.max_fee != null ? formatCurrency(config.max_fee) : '-'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{formatDate(config.effective_from)}</td>
                      <td className="px-4 py-3 text-slate-600">{config.set_by_name || 'System / Default'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{config.note || '-'}</td>
                    </tr>
                  ))}
                  {feeConfigs.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada konfigurasi fee.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-teal-600" /> Permintaan Penarikan Dana</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Seller</th>
                    <th className="px-4 py-3 font-semibold text-right">Jumlah</th>
                    <th className="px-4 py-3 font-semibold">Tujuan Transfer</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{req.seller_name}</p>
                        <p className="text-xs text-slate-500">{req.seller_email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(req.amount)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-pre-wrap max-w-xs">{req.bank_details}</td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' && <span className="inline-flex px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">Menunggu</span>}
                        {req.status === 'completed' && <span className="inline-flex px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Selesai</span>}
                        {req.status === 'rejected' && <span className="inline-flex px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-bold">Ditolak</span>}
                        {req.processed_by_name && <p className="text-[10px] text-slate-400 mt-1">oleh {req.processed_by_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setSelectedWithdrawal(req); setWithdrawAction('completed'); }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Tandai Selesai"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => { setSelectedWithdrawal(req); setWithdrawAction('rejected'); }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                              title="Tolak Penarikan"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          req.transfer_receipt_url ? (
                            <a href={req.transfer_receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold text-xs">
                              Lihat Bukti
                            </a>
                          ) : <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada permintaan penarikan dana.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tindakan Penarikan */}
      {selectedWithdrawal && withdrawAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${withdrawAction === 'completed' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <h3 className={`font-bold flex items-center gap-2 ${withdrawAction === 'completed' ? 'text-emerald-800' : 'text-rose-800'}`}>
                {withdrawAction === 'completed' ? 'Selesaikan Penarikan' : 'Tolak Penarikan'}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-slate-500">Seller</p>
                <p className="font-semibold">{selectedWithdrawal.seller_name}</p>
              </div>
              <div className="mb-4">
                <p className="text-sm text-slate-500">Jumlah Penarikan</p>
                <p className="font-bold text-xl">{formatCurrency(selectedWithdrawal.amount)}</p>
              </div>
              <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 font-semibold mb-1">Tujuan Transfer:</p>
                <p className="text-sm">{selectedWithdrawal.bank_details}</p>
              </div>

              <form onSubmit={handleWithdrawalAction} className="space-y-4">
                {withdrawAction === 'completed' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">URL Bukti Transfer <span className="text-rose-500">*</span></label>
                    <input 
                      type="url"
                      required
                      value={withdrawReceiptUrl}
                      onChange={(e) => setWithdrawReceiptUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Sertakan link gambar atau dokumen bukti transfer (misal dari Google Drive atau Cloud Storage).</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan Admin <span className="text-slate-400 font-normal">(Opsional)</span></label>
                  <textarea 
                    value={withdrawAdminNote}
                    onChange={(e) => setWithdrawAdminNote(e.target.value)}
                    placeholder={withdrawAction === 'completed' ? 'Transfer sukses via BCA...' : 'Rekening tidak valid...'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 h-20 resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setSelectedWithdrawal(null)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                  <button type="submit" disabled={submittingWithdrawal} className={`px-6 py-2 font-bold text-white rounded-lg disabled:opacity-50 ${withdrawAction === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {submittingWithdrawal ? 'Menyimpan...' : 'Konfirmasi'}
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
