import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Percent, TrendingUp, Plus, Settings, AlertCircle, History, User, Landmark, CheckCircle, XCircle, Copy, Check, ShieldCheck, HelpCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/dateFormatter';

interface FeeConfig {
  id: string;
  fee_bps: number;
  min_fee: number | null;
  max_fee: number | null;
  min_withdrawal_amount?: number;
  min_product_price?: number;
  midtrans_fee_payer?: 'buyer' | 'platform' | 'seller';
  midtrans_qris_rate_bps?: number;
  midtrans_va_fee?: number;
  midtrans_fee_note?: string;
  bank_disbursement_fee?: number;
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
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  created_at: string;
  processed_at: string | null;
  admin_note: string | null;
  transfer_receipt_url: string | null;
  processed_by_name: string | null;
}

interface AdminComplaint {
  id: string;
  transaction_id: string;
  hub_transaction_id: string;
  buyer_hub_id: string;
  category: string;
  reason: string;
  evidence_urls: string | null;
  status: string;
  seller_response: string | null;
  seller_replacement_url: string | null;
  seller_responded_at: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  seller_name: string;
  seller_email: string;
  product_title: string;
  product_slug: string;
  gross_amount: number;
  seller_net_amount: number;
  paid_at: string;
  resolved_by_name: string | null;
}

export const EarningsAdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fee-config' | 'withdrawals' | 'complaints'>('overview');
  const [loading, setLoading] = useState(false);
  const { success, error: showError } = useToast();

  // Data states
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [sellers, setSellers] = useState<SellerLeaderboard[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<FeeConfig[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states - Fee Config
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeePercent, setNewFeePercent] = useState<string>('15');
  const [newMinFee, setNewMinFee] = useState<string>('');
  const [newMaxFee, setNewMaxFee] = useState<string>('');
  const [newMinWithdrawal, setNewMinWithdrawal] = useState<string>('50000');
  const [newMinProductPrice, setNewMinProductPrice] = useState<string>('10000');
  const [newMidtransPayer, setNewMidtransPayer] = useState<'buyer' | 'platform' | 'seller'>('buyer');
  const [newMidtransQrisPercent, setNewMidtransQrisPercent] = useState<string>('0.7');
  const [newMidtransVaFee, setNewMidtransVaFee] = useState<string>('4000');
  const [newMidtransNote, setNewMidtransNote] = useState<string>(
    'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)'
  );
  const [newBankFee, setNewBankFee] = useState<string>('2500');
  const [newNote, setNewNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Form states - Withdrawals Action
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [withdrawAction, setWithdrawAction] = useState<'completed' | 'rejected' | null>(null);
  const [withdrawAdminNote, setWithdrawAdminNote] = useState('');
  const [withdrawReceiptUrl, setWithdrawReceiptUrl] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Form states - Complaints Action
  const [selectedComplaint, setSelectedComplaint] = useState<AdminComplaint | null>(null);
  const [resolveAction, setResolveAction] = useState<'refund' | 'release' | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  useEffect(() => {
    // Fetch withdrawals immediately on mount to calculate pending count badge
    fetchWithdrawals();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'fee-config') fetchFeeConfigs();
    else if (activeTab === 'withdrawals') fetchWithdrawals();
    else if (activeTab === 'complaints') fetchComplaints();
  }, [activeTab]);

  useEffect(() => {
    if (feeConfigs.length > 0) {
      const active = feeConfigs[0];
      setNewFeePercent((active.fee_bps / 100).toString());
      setNewMinFee(active.min_fee != null ? active.min_fee.toString() : '');
      setNewMaxFee(active.max_fee != null ? active.max_fee.toString() : '');
      setNewMinWithdrawal((active.min_withdrawal_amount ?? 50000).toString());
      setNewMinProductPrice((active.min_product_price ?? 10000).toString());
      setNewMidtransPayer(active.midtrans_fee_payer || 'buyer');
      setNewMidtransQrisPercent(((active.midtrans_qris_rate_bps ?? 70) / 100).toString());
      setNewMidtransVaFee((active.midtrans_va_fee ?? 4000).toString());
      setNewMidtransNote(
        active.midtrans_fee_note ||
          'Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia (bukan potongan komisi platform Asisten Guru)'
      );
      setNewBankFee((active.bank_disbursement_fee ?? 2500).toString());
    }
  }, [feeConfigs]);

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
        min_withdrawal_amount: newMinWithdrawal ? parseInt(newMinWithdrawal, 10) : 50000,
        min_product_price: newMinProductPrice ? parseInt(newMinProductPrice, 10) : 10000,
        midtrans_fee_payer: newMidtransPayer,
        midtrans_qris_rate_bps: Math.round(parseFloat(newMidtransQrisPercent) * 100),
        midtrans_va_fee: newMidtransVaFee ? parseInt(newMidtransVaFee, 10) : 4000,
        midtrans_fee_note: newMidtransNote,
        bank_disbursement_fee: newBankFee ? parseInt(newBankFee, 10) : 2500,
        note: newNote || 'Pembaruan kebijakan dari Super Admin'
      };

      await api.post('/earnings/admin/fee-config', payload);
      success('Konfigurasi potongan admin dan Midtrans berhasil diperbarui.');
      setShowAddForm(false);
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

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/earnings/admin/complaints');
      if (res.data?.data) {
        setComplaints(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch complaints', err);
      showError('Gagal memuat data komplain.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !resolveAction) return;

    setSubmittingResolve(true);
    try {
      await api.put(`/earnings/admin/complaints/${selectedComplaint.id}/resolve`, {
        action: resolveAction,
        admin_notes: resolveNotes.trim() || undefined
      });
      success(resolveAction === 'refund' ? 'Komplain disetujui untuk Refund Pembeli.' : 'Komplain ditolak, dana berhasil dirilis ke seller.');
      setSelectedComplaint(null);
      setResolveAction(null);
      setResolveNotes('');
      fetchComplaints();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Gagal memproses penyelesaian komplain.');
    } finally {
      setSubmittingResolve(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString, true, true);
  };

  const pendingWithdrawalCount = withdrawals.filter((w) => w.status === 'pending').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Pendapatan & Fee</h1>
          <p className="text-slate-500 text-sm mt-1">Pantau transaksi marketplace, atur persentase revenue share, kebijakan Midtrans, dan kelola penarikan dana manual.</p>
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
          {pendingWithdrawalCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white animate-pulse">
              {pendingWithdrawalCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('complaints')}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'complaints' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertCircle className="w-4 h-4" /> Komplain Pembeli
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800">Riwayat & Konfigurasi Kebijakan Biaya</h3>
              <p className="text-sm text-slate-500 mt-1">
                Atur bagi hasil platform, biaya payment gateway Midtrans, dan aturan penarikan dana. Kebijakan baru <strong>tidak akan mengubah perhitungan saldo transaksi sebelumnya</strong>.
              </p>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" /> {showAddForm ? 'Tutup Formulir' : 'Atur Kebijakan Baru'}
            </button>
          </div>

          {showAddForm && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-teal-600" /> Form Konfigurasi Kebijakan Dinamis
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Semua nominal di bawah ini diatur relatif oleh Super Admin dan langsung disinkronkan ke UI Mitra.</p>
                </div>
              </div>

              <form onSubmit={handleAddFeeConfig} className="space-y-6">
                {/* Bagian 1: Bagi Hasil Platform */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                  <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2 text-teal-800">
                    <Percent className="w-4 h-4 text-teal-600" /> 1. Kebijakan Bagi Hasil Platform Asisten Guru
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Persentase Potongan Platform (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          max="100" 
                          required 
                          value={newFeePercent} 
                          onChange={e => setNewFeePercent(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-bold text-sm">%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Misal: 15 untuk 15% (seller menerima 85%).</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Minimal Potongan Platform (Rp) <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        value={newMinFee} 
                        onChange={e => setNewMinFee(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Batas dasar fee terendah per penjualan.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Maksimal Potongan Platform (Rp) <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        value={newMaxFee} 
                        onChange={e => setNewMaxFee(e.target.value)}
                        placeholder="Contoh: 100000"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Batas maksimal potongan untuk produk mahal.</p>
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Batas Transaksi & Penarikan Dana */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                  <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2 text-blue-800">
                    <Landmark className="w-4 h-4 text-blue-600" /> 2. Aturan Batas Transaksi & Penarikan Dana Seller
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Batas Minimal Penarikan (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="10000"
                        step="1000"
                        required
                        value={newMinWithdrawal} 
                        onChange={e => setNewMinWithdrawal(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Mitra hanya bisa tarik saldo jika saldo mencapai nominal ini (cth: Rp 50.000).</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Minimal Harga Produk Seller (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="5000"
                        step="1000"
                        required
                        value={newMinProductPrice} 
                        onChange={e => setNewMinProductPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Harga jual produk terendah yang diizinkan untuk seller (cth: Rp 10.000).</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Estimasi Biaya Transfer Bank / BI-Fast (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        step="500"
                        required
                        value={newBankFee} 
                        onChange={e => setNewBankFee(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Biaya admin transfer antar bank (BI-Fast) saat Super Admin transfer manual.</p>
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Transparansi Midtrans Payment Gateway */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2 text-indigo-800">
                      <CreditCard className="w-4 h-4 text-indigo-600" /> 3. Transparansi Biaya Payment Gateway (Midtrans)
                    </h5>
                    <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">
                      Tampil di Dashboard Seller
                    </span>
                  </div>
                  
                  <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <p>
                      <strong>Informasi untuk Seller:</strong> Pengaturan ini memastikan para mitra seller mengetahui bahwa biaya transaksi metode pembayaran (seperti QRIS atau Virtual Account) berasal dari pihak payment gateway resmi Midtrans & Bank Indonesia, bukan pemotongan komisi platform.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Penanggung Biaya Midtrans <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newMidtransPayer}
                        onChange={e => setNewMidtransPayer(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold bg-white"
                      >
                        <option value="buyer">Dibebankan ke Pembeli saat Checkout (Direkomendasikan)</option>
                        <option value="platform">Ditanggung Platform Asisten Guru</option>
                        <option value="seller">Dipotong dari Saldo Seller</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">Siapa yang membayar biaya payment gateway saat transaksi dibuat.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Biaya QRIS Midtrans (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          max="10" 
                          required
                          value={newMidtransQrisPercent} 
                          onChange={e => setNewMidtransQrisPercent(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-bold text-sm">%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Standar Bank Indonesia: 0.7% MDR QRIS.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Biaya Virtual Account Midtrans (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        step="500"
                        required
                        value={newMidtransVaFee} 
                        onChange={e => setNewMidtransVaFee(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Biaya flat VA Midtrans (cth: Rp 4.000 / transaksi).</p>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Teks Catatan Resmi Midtrans (Akan dibaca Seller di Dashboard Mitra) <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        value={newMidtransNote}
                        onChange={e => setNewMidtransNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-xs"
                        placeholder="Biaya layanan transaksi dari payment gateway resmi Midtrans & Bank Indonesia..."
                      />
                    </div>
                  </div>
                </div>

                {/* Catatan Perubahan */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan / Catatan Perubahan Kebijakan Ini (Audit Log)
                  </label>
                  <input 
                    type="text" 
                    value={newNote} 
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Misal: Penyesuaian bagi hasil 85:15 dan batas penarikan Rp 50.000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)} 
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 text-sm shadow-md"
                  >
                    {submitting ? 'Menyimpan...' : 'Terapkan Kebijakan Baru'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabel Riwayat Kebijakan */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-teal-600" /> Riwayat Versi Kebijakan
              </h4>
              <span className="text-xs text-slate-500">Menyimpan snapshot historis agar tidak merusak transaksi lama</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bagi Hasil Platform</th>
                    <th className="px-4 py-3 font-semibold">Min/Max Potongan</th>
                    <th className="px-4 py-3 font-semibold">Batas Nominal</th>
                    <th className="px-4 py-3 font-semibold">Midtrans & Bank</th>
                    <th className="px-4 py-3 font-semibold">Berlaku Sejak</th>
                    <th className="px-4 py-3 font-semibold">Diatur Oleh & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {feeConfigs.map((config, i) => (
                    <tr key={config.id} className={i === 0 ? 'bg-teal-50/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-teal-800">{(config.fee_bps / 100).toFixed(2)}%</span>
                          {i === 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white">AKTIF</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">({config.fee_bps} bps • Seller {(100 - config.fee_bps / 100).toFixed(2)}%)</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>Min: {config.min_fee != null ? formatCurrency(config.min_fee) : '-'}</p>
                        <p>Max: {config.max_fee != null ? formatCurrency(config.max_fee) : '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p>Min Tarik: <strong className="text-slate-900">{formatCurrency(config.min_withdrawal_amount ?? 50000)}</strong></p>
                        <p>Min Harga: <span className="text-slate-600">{formatCurrency(config.min_product_price ?? 10000)}</span></p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>Payer: <strong className="text-indigo-700 uppercase">{config.midtrans_fee_payer || 'buyer'}</strong></p>
                        <p>QRIS: {((config.midtrans_qris_rate_bps ?? 70) / 100).toFixed(2)}% • VA: {formatCurrency(config.midtrans_va_fee ?? 4000)}</p>
                        <p>BI-Fast: {formatCurrency(config.bank_disbursement_fee ?? 2500)}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {formatDate(config.effective_from)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs">
                        <p className="font-semibold text-slate-700">{config.set_by_name || 'System / Default'}</p>
                        <p className="text-[11px] truncate text-slate-500">{config.note || '-'}</p>
                      </td>
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
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-teal-600" /> Permintaan Penarikan Dana Seller (Transfer Manual)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lakukan transfer manual ke rekening seller, lalu unggah URL bukti transfer untuk menyelesaikan permintaan.
                </p>
              </div>
              <button 
                onClick={fetchWithdrawals}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Muat Ulang
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Seller</th>
                    <th className="px-4 py-3 font-semibold text-right">Jumlah Bersih</th>
                    <th className="px-4 py-3 font-semibold">Tujuan Transfer</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{req.seller_name}</p>
                        <p className="text-xs text-slate-500">{req.seller_email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(req.amount)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-xs">
                        <div className="flex items-start justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="whitespace-pre-wrap font-mono select-all text-slate-800">{req.bank_details}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(req.bank_details);
                              setCopiedId(req.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors shrink-0"
                            title="Salin Data Rekening"
                          >
                            {copiedId === req.id ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' && <span className="inline-flex px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">Menunggu Transfer</span>}
                        {req.status === 'completed' && <span className="inline-flex px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Selesai Ditransfer</span>}
                        {req.status === 'rejected' && <span className="inline-flex px-2 py-1 rounded bg-rose-100 text-rose-700 text-xs font-bold">Ditolak</span>}
                        {req.status === 'cancelled' && <span className="inline-flex px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">Dibatalkan Seller</span>}
                        {req.processed_by_name && <p className="text-[10px] text-slate-400 mt-1">oleh {req.processed_by_name}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {req.status === 'pending' ? (
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => { setSelectedWithdrawal(req); setWithdrawAction('completed'); }}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1 shadow-sm"
                              title="Tandai Sudah Ditransfer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Transfer
                            </button>
                            <button 
                              onClick={() => { setSelectedWithdrawal(req); setWithdrawAction('rejected'); }}
                              className="px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100 flex items-center gap-1"
                              title="Tolak Penarikan"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Tolak
                            </button>
                          </div>
                        ) : (
                          req.transfer_receipt_url ? (
                            <a href={req.transfer_receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold text-xs inline-flex items-center gap-1">
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
      {/* Tab 4: Complaints */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daftar Komplain & Laporan Pembeli</h3>
              <p className="text-xs text-slate-500">Kelola tiket komplain untuk membebaskan atau mengembalikan dana pesanan</p>
            </div>
            <button
              onClick={fetchComplaints}
              className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Muat Ulang
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Tanggal & ID</th>
                  <th className="px-4 py-3">Produk & Seller</th>
                  <th className="px-4 py-3">Kategori & Masalah</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold block">{c.id.slice(0, 8)}...</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(c.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{c.product_title}</p>
                      <p className="text-[10px] text-slate-500">Seller: {c.seller_name} ({c.seller_email})</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 mb-1">
                        {c.category}
                      </span>
                      <p className="line-clamp-2 text-slate-600">{c.reason}</p>
                      {(() => {
                        let evList: string[] = [];
                        if (c.evidence_urls) {
                          try {
                            const parsed = JSON.parse(c.evidence_urls);
                            if (Array.isArray(parsed)) evList = parsed;
                          } catch {
                            if (typeof c.evidence_urls === 'string') evList = [c.evidence_urls];
                          }
                        }
                        return evList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {evList.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-semibold transition"
                              >
                                Bukti #{idx + 1} ↗
                              </a>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      {c.seller_response && (
                        <div className="mt-1.5 text-[10px] text-teal-700 bg-teal-50 p-1.5 rounded border border-teal-100 space-y-0.5">
                          <p><strong>Tanggapan Mitra:</strong> {c.seller_response}</p>
                          {c.seller_replacement_url && (
                            <a
                              href={c.seller_replacement_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-800 font-bold hover:underline inline-block"
                            >
                              Buka File Perbaikan ↗
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(c.gross_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.status === 'resolved_refunded' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Refund Selesai
                        </span>
                      ) : c.status === 'resolved_rejected' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Dana Dirilis
                        </span>
                      ) : c.status === 'seller_replied' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                          Seller Merespon
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Menunggu Investigasi
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.status !== 'resolved_refunded' && c.status !== 'resolved_rejected' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => { setSelectedComplaint(c); setResolveAction('release'); setResolveNotes(''); }}
                            className="px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            title="Tolak komplain dan rilis saldo ke seller"
                          >
                            Lepas Dana
                          </button>
                          <button
                            onClick={() => { setSelectedComplaint(c); setResolveAction('refund'); setResolveNotes(''); }}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700"
                            title="Setujui refund pembeli dan batalkan transaksi seller"
                          >
                            Refund
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
                {complaints.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada laporan komplain pembeli yang tercatat saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Resolve Complaint */}
      {selectedComplaint && resolveAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${resolveAction === 'release' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <h3 className={`font-bold text-sm flex items-center gap-2 ${resolveAction === 'release' ? 'text-emerald-800' : 'text-rose-800'}`}>
                {resolveAction === 'release' ? 'Tolak Komplain & Rilis Dana ke Seller' : 'Setujui Refund Pembeli'}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-3">
                <p className="text-xs text-slate-400">Produk</p>
                <p className="font-semibold text-sm">{selectedComplaint.product_title}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs text-slate-400">Alasan Pembeli</p>
                <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{selectedComplaint.reason}</p>
              </div>
              {(() => {
                let evList: string[] = [];
                if (selectedComplaint.evidence_urls) {
                  try {
                    const parsed = JSON.parse(selectedComplaint.evidence_urls);
                    if (Array.isArray(parsed)) evList = parsed;
                  } catch {
                    if (typeof selectedComplaint.evidence_urls === 'string') evList = [selectedComplaint.evidence_urls];
                  }
                }
                return evList.length > 0 ? (
                  <div className="mb-3">
                    <p className="text-xs text-slate-400 mb-1">Bukti Lampiran Pembeli ({evList.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {evList.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition"
                        >
                          Buka Bukti #{idx + 1} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {selectedComplaint.seller_response && (
                <div className="mb-4 space-y-1">
                  <p className="text-xs text-teal-700 font-semibold">Tanggapan Mitra</p>
                  <p className="text-xs text-teal-900 bg-teal-50 p-2 rounded border border-teal-100">{selectedComplaint.seller_response}</p>
                  {selectedComplaint.seller_replacement_url && (
                    <a
                      href={selectedComplaint.seller_replacement_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs font-bold text-teal-700 hover:underline bg-teal-50 px-2 py-1 rounded border border-teal-200"
                    >
                      Buka Tautan File Pengganti ↗
                    </a>
                  )}
                </div>
              )}
              <form onSubmit={handleResolveComplaint} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Admin (Opsional)</label>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder={resolveAction === 'release' ? 'File pengganti sudah valid...' : 'Tautan mati dan seller tidak merespon...'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs h-20 resize-none focus:ring-2 focus:ring-teal-500"
                  ></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => { setSelectedComplaint(null); setResolveAction(null); }} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
                  <button type="submit" disabled={submittingResolve} className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg disabled:opacity-50 ${resolveAction === 'release' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {submittingResolve ? 'Memproses...' : 'Konfirmasi Keputusan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Actions Withdrawal */}
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
              <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500 font-semibold mb-1">Tujuan Transfer:</p>
                  <p className="text-sm font-mono whitespace-pre-wrap select-all text-slate-800">{selectedWithdrawal.bank_details}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedWithdrawal.bank_details);
                    setCopiedId(selectedWithdrawal.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm"
                  title="Salin Rekening"
                >
                  {copiedId === selectedWithdrawal.id ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === selectedWithdrawal.id ? 'Tersalin' : 'Salin'}
                </button>
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
