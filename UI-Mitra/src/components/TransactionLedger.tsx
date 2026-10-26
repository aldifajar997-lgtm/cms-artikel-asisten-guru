import React, { useState, useEffect } from 'react';
import { 
  CreditCard, DollarSign, History, Search, Download, 
  ArrowUpRight, CheckCircle2, Clock, Package, Filter, RefreshCw, AlertTriangle,
  XCircle, FileText
} from 'lucide-react';
import { SaleTransaction, ProductEarningStat } from '../types';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/dateFormatter';
import { 
  calculateFeePercentage, 
  calculateNetPercentage, 
  formatBpsToPercent 
} from '../utils/financialCalculations';

export const getPaymentMethodBadge = (method?: string | null) => {
  const m = (method || '').toLowerCase().trim();
  if (!m || m === 'other') {
    return { label: 'Online Payment', bg: 'bg-stone-50 text-stone-600 border-stone-200' };
  }
  if (m === 'qris') {
    return { label: 'QRIS', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (m === 'bca_va' || m.includes('bca')) {
    return { label: 'BCA VA', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (m === 'bni_va' || m.includes('bni')) {
    return { label: 'BNI VA', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
  }
  if (m === 'bri_va' || m.includes('bri')) {
    return { label: 'BRI VA', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
  }
  if (m === 'permata_va' || m.includes('permata')) {
    return { label: 'Permata VA', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }
  if (m === 'mandiri_bill' || m.includes('mandiri')) {
    return { label: 'Mandiri Bill', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
  }
  if (m.endsWith('_va') || m.includes('va')) {
    return { label: 'Virtual Account', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (m === 'gopay') {
    return { label: 'GoPay', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
  }
  if (m === 'shopeepay') {
    return { label: 'ShopeePay', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
  }
  if (m === 'wallet') {
    return { label: 'Saldo Akun', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  if (m === 'credit_card') {
    return { label: 'Kartu Kredit', bg: 'bg-stone-100 text-stone-700 border-stone-300' };
  }
  if (m === 'cstore' || m.includes('indomaret') || m.includes('alfamart')) {
    return { label: 'Gerai Ritel', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: m.toUpperCase(), bg: 'bg-stone-50 text-stone-600 border-stone-200' };
};

interface TransactionLedgerProps {
  defaultTab?: 'orders' | 'by-product';
  onNavigateToComplaints?: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({ 
  defaultTab = 'orders',
  onNavigateToComplaints 
}) => {
  const { error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<'orders' | 'by-product'>(defaultTab);
  
  // Transactions State
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [payoutFilter, setPayoutFilter] = useState<string>('all');
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [offset] = useState<number>(0);

  // By-Product Earnings State
  const [productStats, setProductStats] = useState<ProductEarningStat[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchTransactions();
    } else if (activeTab === 'by-product') {
      fetchProductStats();
    }
  }, [activeTab, payoutFilter]);

  const fetchTransactions = async () => {
    setLoadingOrders(true);
    try {
      let url = `/earnings/transactions?limit=25&offset=${offset}`;
      if (payoutFilter !== 'all') {
        url += `&payout_status=${payoutFilter}`;
      }
      const res = await api.get(url);
      if (res.data?.data) {
        setTransactions(res.data.data);
        setTotalTransactions(res.data.total || 0);
      }
    } catch (err) {
      console.error('Fetch transactions error', err);
      showError('Gagal memuat daftar transaksi.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchProductStats = async () => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/earnings/products');
      if (res.data?.data) {
        setProductStats(res.data.data);
      }
    } catch (err) {
      console.error('Fetch product stats error', err);
      showError('Gagal memuat rekapitulasi penjualan per produk.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'orders') {
      if (transactions.length === 0) {
        showError('Tidak ada data transaksi untuk diekspor.');
        return;
      }
      const headers = ['ID Transaksi Hub', 'Judul Produk', 'Metode Pembayaran', 'Omset Kotor (Rp)', 'Potongan Admin (Rp)', 'Hak Bersih (Rp)', 'Status Kliring', 'Status Payout', 'Tanggal Pembayaran'];
      const rows = transactions.map(t => [
        `"${t.hub_transaction_id || t.id}"`,
        `"${(t.product_title || 'Produk Digital').replace(/"/g, '""')}"`,
        `"${t.payment_method || 'Online Payment'}"`,
        t.gross_amount,
        t.admin_fee_amount,
        t.seller_net_amount,
        t.is_holding ? 'Tertahan Kliring' : 'Lolos Kliring',
        t.payout_status,
        `"${t.paid_at}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rekap_penjualan_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      if (productStats.length === 0) {
        showError('Tidak ada data performa produk untuk diekspor.');
        return;
      }
      const headers = ['Judul Produk', 'Harga Saat Ini (Rp)', 'Total Terjual', 'Total Omset (Rp)', 'Total Potongan (Rp)', 'Total Bersih (Rp)'];
      const rows = productStats.map(p => [
        `"${(p.product_title || '').replace(/"/g, '""')}"`,
        p.current_price,
        p.total_sales,
        p.total_gross,
        p.total_admin_fee,
        p.total_net
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `rekap_per_produk_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight font-sans">
            Riwayat Penjualan & Pembukuan
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Rekam jejak setiap pesanan yang masuk, rincian pembagian hasil, dan performa per produk digital.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-brand-teal bg-teal-50/90 border border-teal-200/80 rounded-xl hover:bg-teal-100/80 transition cursor-pointer shadow-xs"
            title="Unduh rekapan penjualan dalam format CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={() => {
              if (activeTab === 'orders') fetchTransactions();
              else fetchProductStats();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders || loadingProducts ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs (Hanya 2 Tab Finansial Murni) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow">
        
        <div className="inline-flex p-1 bg-stone-100/80 rounded-2xl border border-stone-200/60 text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white text-stone-900 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Riwayat Pesanan Masuk
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('by-product')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'by-product'
                ? 'bg-white text-stone-900 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Akumulasi per Produk
          </button>
        </div>

        {/* Filter per Tab */}
        {activeTab === 'orders' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium">Status Payout:</span>
            <select
              value={payoutFilter}
              onChange={(e) => setPayoutFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white text-stone-800"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Belum Dicairkan (Pending)</option>
              <option value="transferred">Sudah Ditransfer</option>
              <option value="skipped">Dilewati / Nol</option>
            </select>
          </div>
        )}

      </div>

      {/* Tab 1: Pesanan Masuk (Orders) */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-stone-400 animate-pulse">
              Memuat daftar transaksi pesanan...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <History className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">Belum ada pesanan ditemukan</h3>
              <p className="text-xs text-stone-500">
                Transaksi sukses dari pembeli akan otomatis tercatat di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold">
                  <tr>
                    <th className="px-6 py-4">ID Transaksi & Waktu</th>
                    <th className="px-6 py-4">Produk</th>
                    <th className="px-6 py-4">Metode Bayar</th>
                    <th className="px-6 py-4 text-right">Harga Beli</th>
                    <th className="px-6 py-4 text-right">Fee Platform</th>
                    <th className="px-6 py-4 text-right">Hak Bersih Seller</th>
                    <th className="px-6 py-4 text-center">Status Pencairan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-50/70 transition">
                      
                      {/* ID & Time */}
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-stone-900 block">
                          #{tx.id.substring(0, 8)}...
                        </span>
                        <span className="text-[11px] text-stone-400 block mt-0.5">
                          {formatDateTime(tx.paid_at, true, true)}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="px-6 py-4">
                        <p className="font-bold text-stone-900 max-w-xs truncate">
                          {tx.product_title || 'Produk Digital'}
                        </p>
                        <p className="text-[10px] text-stone-400">/{tx.product_slug || '-'}</p>
                      </td>

                      {/* Payment Method */}
                      <td className="px-6 py-4">
                        {(() => {
                          const badge = getPaymentMethodBadge(tx.payment_method);
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${badge.bg}`}>
                              <CreditCard className="w-3 h-3 opacity-70 shrink-0" />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Gross */}
                      <td className="px-6 py-4 text-right font-semibold text-stone-800">
                        {formatCurrency(tx.gross_amount)}
                      </td>

                      {/* Admin Fee */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-rose-600 font-semibold block">
                          -{formatCurrency(tx.admin_fee_amount)}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {tx.applied_fee_bps ? formatBpsToPercent(tx.applied_fee_bps) : `${calculateFeePercentage(tx.admin_fee_amount, tx.gross_amount)}%`}
                        </span>
                      </td>

                      {/* Net */}
                      <td className="px-6 py-4 text-right">
                        <span className="font-extrabold text-brand-teal text-sm block">
                          {formatCurrency(tx.seller_net_amount)}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                          {calculateNetPercentage(tx.seller_net_amount, tx.gross_amount)}% net
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {tx.status === 'refunded' || tx.dispute_status === 'refunded' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            <XCircle className="w-3 h-3 text-rose-500" /> Dibatalkan / Refund
                          </span>
                        ) : tx.payout_status === 'transferred' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Ditransfer
                          </span>
                        ) : (tx.dispute_status === 'complained' || tx.dispute_status === 'under_review') ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToComplaints?.()}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer" 
                            title="Klik untuk membuka menu Komplain Pembeli"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Dalam Komplain
                          </button>
                        ) : tx.payout_status === 'skipped' ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                            Dilewati
                          </span>
                        ) : (tx.is_holding || (tx.hold_until && new Date(tx.hold_until).getTime() > Date.now())) ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                            title={`Masa kliring perlindungan komplain pembeli sampai: ${tx.hold_until ? formatDateTime(tx.hold_until, true, true) : '3 hari'}`}
                          >
                            <Clock className="w-3 h-3 text-amber-600" /> Tertahan (3 Hari)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                            <CheckCircle2 className="w-3 h-3" /> Saldo Aktif
                          </span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Akumulasi per Produk */}
      {activeTab === 'by-product' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
          {loadingProducts ? (
            <div className="p-12 text-center text-xs text-stone-400 animate-pulse">
              Memuat performa per produk...
            </div>
          ) : productStats.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Package className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">Belum ada statistik produk</h3>
              <p className="text-xs text-stone-500">
                Statistik akumulasi pendapatan akan muncul begitu produk mulai terjual.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Nama Produk</th>
                    <th className="px-6 py-4 text-center">Total Terjual</th>
                    <th className="px-6 py-4 text-right">Harga Saat Ini</th>
                    <th className="px-6 py-4 text-right">Total Bruto</th>
                    <th className="px-6 py-4 text-right">Total Fee Platform</th>
                    <th className="px-6 py-4 text-right">Hak Bersih Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {productStats.map((prod) => (
                    <tr key={prod.product_id} className="hover:bg-stone-50/70 transition">
                      
                      <td className="px-6 py-4">
                        <p className="font-bold text-stone-900">{prod.product_title}</p>
                        <p className="text-[10px] text-stone-400">/{prod.product_slug}</p>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold bg-stone-100 text-stone-800 px-2.5 py-0.5 rounded-full text-[11px]">
                          <Package className="w-3 h-3 text-stone-500" />
                          {prod.total_sales} unit
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-stone-600">
                        {formatCurrency(prod.current_price)}
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-stone-900">
                        {formatCurrency(prod.total_gross)}
                      </td>

                      <td className="px-6 py-4 text-right text-rose-600 font-medium">
                        -{formatCurrency(prod.total_admin_fee)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-extrabold text-brand-teal text-sm">
                          {formatCurrency(prod.total_net)}
                        </span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
