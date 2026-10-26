import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, MessageSquareWarning, ExternalLink, X, Send, 
  CheckCircle2, Clock, AlertCircle, RefreshCw, Filter, ShieldAlert
} from 'lucide-react';
import { OrderComplaint } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/dateFormatter';
import { getSafeUrl, isSafeExternalUrl } from '../utils/safeUrl';

interface BuyerComplaintsProps {
  onComplaintCountChange?: (count: number) => void;
}

export const BuyerComplaints: React.FC<BuyerComplaintsProps> = ({ onComplaintCountChange }) => {
  const { success, error: showError } = useToast();

  const [complaints, setComplaints] = useState<OrderComplaint[]>([]);
  const [totalComplaints, setTotalComplaints] = useState<number>(0);
  const [openComplaintsCount, setOpenComplaintsCount] = useState<number>(0);
  const [complaintFilter, setComplaintFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);

  // Modal Response State
  const [selectedComplaint, setSelectedComplaint] = useState<OrderComplaint | null>(null);
  const [sellerResponse, setSellerResponse] = useState<string>('');
  const [sellerReplacementUrl, setSellerReplacementUrl] = useState<string>('');
  const [submittingResponse, setSubmittingResponse] = useState<boolean>(false);

  useEffect(() => {
    fetchComplaints();
  }, [complaintFilter]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      let url = `/earnings/complaints?limit=50&offset=0`;
      if (complaintFilter !== 'all') {
        url += `&status=${complaintFilter}`;
      }
      const res = await api.get(url);
      if (res.data?.data) {
        setComplaints(res.data.data);
        setTotalComplaints(res.data.total || 0);

        // Hitung komplain berstatus 'open' (yang butuh tanggapan)
        const openCount = res.data.data.filter((c: OrderComplaint) => c.status === 'open').length;
        setOpenComplaintsCount(openCount);
        if (onComplaintCountChange) {
          onComplaintCountChange(openCount);
        }
      }
    } catch (err) {
      console.error('Fetch complaints error', err);
      showError('Gagal memuat daftar komplain pembeli.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResponseModal = (complaint: OrderComplaint) => {
    setSelectedComplaint(complaint);
    setSellerResponse(complaint.seller_response || '');
    setSellerReplacementUrl(complaint.seller_replacement_url || '');
  };

  const handleCloseResponseModal = () => {
    setSelectedComplaint(null);
    setSellerResponse('');
    setSellerReplacementUrl('');
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    const trimmedResponse = sellerResponse.trim();
    if (trimmedResponse.length < 5) {
      showError('Tanggapan minimal 5 karakter.');
      return;
    }

    if (trimmedResponse.length > 1000) {
      showError('Tanggapan maksimal 1000 karakter.');
      return;
    }

    const trimmedUrl = sellerReplacementUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      showError('Tautan perbaikan harus diawali http:// atau https://');
      return;
    }

    setSubmittingResponse(true);
    try {
      await api.put(`/earnings/complaints/${selectedComplaint.id}/respond`, {
        seller_response: trimmedResponse,
        seller_replacement_url: trimmedUrl || undefined
      });

      success('Tanggapan dan tautan perbaikan berhasil dikirimkan ke pembeli dan tim admin.');
      handleCloseResponseModal();
      fetchComplaints();
    } catch (err) {
      console.error('Failed to respond to complaint', err);
      showError(handleApiError(err));
    } finally {
      setSubmittingResponse(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'corrupt_file':
        return { label: 'File Rusak / Corrupt', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'broken_link':
        return { label: 'Tautan Unduh Mati', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'content_mismatch':
        return { label: 'Isi Tidak Sesuai', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: 'Kendala Lainnya', color: 'bg-stone-100 text-stone-700 border-stone-200' };
    }
  };

  const getComplaintStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertCircle className="w-3 h-3" /> Butuh Tanggapan Anda
          </span>
        );
      case 'seller_replied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" /> Tanggapan Terkirim
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Sedang Ditinjau Admin
          </span>
        );
      case 'resolved_refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
            Selesai (Refunded)
          </span>
        );
      case 'resolved_rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Selesai (Dana Dirilis)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight font-sans">
                Komplain Pembeli
              </h1>
              <p className="text-xs text-stone-500 mt-0.5">
                Pusat resolusi bantuan pembeli terkait berkas rusak, tautan unduh, atau keluhan transaksi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchComplaints}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Banner Peringatan jika ada komplain terbuka */}
      {openComplaintsCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start sm:items-center justify-between gap-3 text-rose-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <p className="font-bold">
                Terdapat {openComplaintsCount} komplain pembeli yang membutuhkan respon Anda!
              </p>
              <p className="text-rose-700/90 text-[11px] mt-0.5">
                Tanggapi keluhan pembeli atau sertakan tautan perbaikan file sebelum masa kliring ditutup oleh admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-stone-200/80 card-shadow">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Filter className="w-4 h-4 text-stone-400" />
          <span className="font-semibold text-stone-700">Filter Kasus:</span>
          <span className="text-stone-400">Total {totalComplaints} tiket</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={complaintFilter}
            onChange={(e) => setComplaintFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white text-stone-800"
          >
            <option value="all">Semua Status Tiket</option>
            <option value="open">Perlu Ditanggapi ({openComplaintsCount})</option>
            <option value="seller_replied">Sudah Ditanggapi</option>
            <option value="under_review">Sedang Ditinjau Admin</option>
            <option value="resolved_rejected">Dana Dirilis ke Seller</option>
            <option value="resolved_refunded">Refund Selesai</option>
          </select>
        </div>
      </div>

      {/* Daftar Tiket Komplain */}
      <div className="bg-white rounded-3xl border border-stone-200/80 card-shadow overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-stone-400 animate-pulse">
            Memuat daftar komplain pembeli...
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-brand-teal flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">Tidak ada komplain pembeli</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Semua transaksi berjalan lancar tanpa ada sengketa file atau keluhan pembeli.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {complaints.map((c) => {
              const cat = getCategoryBadge(c.category);
              let evidenceList: string[] = [];
              if (c.evidence_urls) {
                try {
                  const parsed = JSON.parse(c.evidence_urls);
                  if (Array.isArray(parsed)) evidenceList = parsed;
                } catch {
                  if (typeof c.evidence_urls === 'string') evidenceList = [c.evidence_urls];
                }
              }

              const isPendingSellerAction = c.status === 'open';

              return (
                <div key={c.id} className="p-6 hover:bg-stone-50/50 transition space-y-4">
                  
                  {/* Top Meta Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cat.color}`}>
                        {cat.label}
                      </span>
                      {getComplaintStatusBadge(c.status)}
                      <span className="text-[11px] text-stone-400 font-mono">
                        Tiket #{c.id.substring(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>Diajukan: {formatDateTime(c.created_at, true, true)}</span>
                    </div>
                  </div>

                  {/* Main Complaint Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Col 1 & 2: Detail Masalah Pembeli */}
                    <div className="lg:col-span-2 space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
                          Produk Terkait
                        </span>
                        <h4 className="font-bold text-sm text-stone-900 leading-snug">
                          {c.product_title || 'Produk Digital'}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
                          Tx #{c.hub_transaction_id} • Hak Tertahan Sementara: <span className="font-bold text-rose-600">{formatCurrency(c.seller_net_amount || 0)}</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                          Keluhan Pembeli
                        </span>
                        <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/60 text-xs text-stone-800 leading-relaxed font-sans">
                          "{c.reason}"
                        </div>
                      </div>

                      {/* Evidence Links */}
                      {evidenceList.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                            Bukti Lampiran Pembeli ({evidenceList.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {evidenceList.map((url, idx) => {
                              const isSafe = isSafeExternalUrl(url);
                              const safeUrl = getSafeUrl(url);
                              return isSafe ? (
                                <a
                                  key={idx}
                                  href={safeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 hover:text-brand-teal transition shadow-2xs"
                                >
                                  <ExternalLink className="w-3 h-3 text-stone-400" />
                                  <span>Bukti #{idx + 1}</span>
                                </a>
                              ) : (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-200 text-stone-400 text-xs font-medium"
                                  title="Tautan bukti tidak valid atau tidak aman"
                                >
                                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                                  <span>Bukti #{idx + 1} (Link Tidak Aman)</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Col 3: Status Tanggapan & Tindakan */}
                    <div className="lg:col-span-1 bg-stone-50/70 p-4 rounded-2xl border border-stone-200/60 space-y-3 flex flex-col justify-between">
                      
                      <div className="space-y-3">
                        {/* Tanggapan Seller Eksisting */}
                        {c.seller_response ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Tanggapan Anda
                            </span>
                            <div className="p-3 bg-white rounded-xl border border-teal-100 text-xs text-stone-800 leading-relaxed">
                              "{c.seller_response}"
                            </div>
                            {c.seller_replacement_url && (
                              isSafeExternalUrl(c.seller_replacement_url) ? (
                                <a
                                  href={getSafeUrl(c.seller_replacement_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-teal hover:underline pt-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Buka Tautan File Perbaikan</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-stone-400 italic block pt-1">
                                  Tautan perbaikan tidak aman atau tidak valid.
                                </span>
                              )
                            )}
                            <p className="text-[10px] text-stone-400 mt-1">
                              Dikirim: {c.seller_responded_at ? formatDateTime(c.seller_responded_at, true, true) : '-'}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 leading-relaxed">
                            <p className="font-bold flex items-center gap-1 text-amber-800">
                              <AlertCircle className="w-3.5 h-3.5" /> Butuh Tanggapan
                            </p>
                            <p className="text-[11px] text-amber-800/90 mt-1">
                              Silakan berikan klarifikasi atau tautan file perbaikan agar keluhan pembeli segera tertangani.
                            </p>
                          </div>
                        )}

                        {/* Catatan Admin Resolusi (Jika ada) */}
                        {c.admin_notes && (
                          <div className="pt-2 border-t border-stone-200/60 text-xs space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Catatan Tim Investigasi Admin
                            </span>
                            <p className="p-2.5 bg-stone-100/80 rounded-xl text-stone-700 text-[11px]">
                              {c.admin_notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Tombol Aksi */}
                      {c.status !== 'resolved_refunded' && c.status !== 'resolved_rejected' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenResponseModal(c)}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                            isPendingSellerAction
                              ? 'bg-brand-teal hover:bg-brand-teal-light text-white'
                              : 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-200'
                          }`}
                        >
                          <MessageSquareWarning className="w-4 h-4" />
                          <span>{c.seller_response ? 'Perbarui Tanggapan / Link' : 'Tanggapi Komplain Ini'}</span>
                        </button>
                      ) : (
                        <div className="p-2.5 bg-stone-100 rounded-xl text-center text-xs text-stone-500 font-semibold">
                          Kasus Selesai • Ditutup
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tanggapi Komplain */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-stone-200/80 overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
                  <MessageSquareWarning className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-900 leading-tight">Tanggapi Komplain Pembeli</h3>
                  <p className="text-[11px] text-stone-500 truncate max-w-xs">
                    {selectedComplaint.product_title || 'Produk Digital'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={handleCloseResponseModal} 
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSubmitResponse} className="p-6 space-y-4">
              
              {/* Ringkasan Keluhan Pembeli */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/60 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Keluhan Pembeli:
                </span>
                <p className="text-stone-800 leading-relaxed font-sans">
                  "{selectedComplaint.reason}"
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Tanggapan / Klarifikasi Anda <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={sellerResponse}
                  onChange={(e) => setSellerResponse(e.target.value)}
                  placeholder="Contoh: Mohon maaf atas kendalanya. File telah kami perbarui dan tautan unduh alternatif dapat diakses melalui link di bawah ini..."
                  className="w-full px-3.5 py-2.5 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal bg-stone-50/50 resize-none font-sans placeholder:text-stone-400"
                ></textarea>
                <div className="flex justify-between items-center text-[10px] text-stone-400 mt-1">
                  <span>Minimal 5 karakter, maksimal 1000 karakter</span>
                  <span className={sellerResponse.length > 1000 ? 'text-rose-500 font-bold' : ''}>
                    {sellerResponse.length}/1000
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Tautan File Perbaikan / Link Pengganti <span className="text-stone-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="url"
                  value={sellerReplacementUrl}
                  onChange={(e) => setSellerReplacementUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... (atau link penyimpanan lain)"
                  className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal bg-stone-50/50 font-sans placeholder:text-stone-400"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Sertakan jika ada file pengganti agar pembeli dapat langsung mengunduh file yang sudah diperbaiki.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleCloseResponseModal}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse || sellerResponse.trim().length < 5}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingResponse ? (
                    'Mengirimkan...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Tanggapan</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
