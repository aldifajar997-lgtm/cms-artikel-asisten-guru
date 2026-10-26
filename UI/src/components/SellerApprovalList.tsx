import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  CreditCard,
  Mail,
  Calendar,
  RefreshCw,
  Ban,
  ShieldCheck,
  ChevronRight,
  Info,
  Image as ImageIcon,
  Eye,
  Store,
  MapPin,
  User,
  FileText,
  Phone,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';
import api, { handleApiError } from '../utils/api';
import { SellerApplicant } from '../types';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatDateTime } from '../utils/dateFormatter';
import { getMediaUrl } from '../utils/mediaUrl';

const calculateAge = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

interface SellerAvatarProps {
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

const SellerAvatar: React.FC<SellerAvatarProps> = ({ name, email, avatarUrl }) => {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = getMediaUrl(avatarUrl);
  const initial = (name || email || '?').charAt(0).toUpperCase();

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  return (
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-sm overflow-hidden select-none">
      {resolvedUrl && !hasError ? (
        <img
          src={resolvedUrl}
          alt=""
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};

export const SellerApprovalList: React.FC = () => {
  const { success, error: showError, info } = useToast();
  const { show: showConfirm } = useConfirm();

  const [sellers, setSellers] = useState<SellerApplicant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal Tolak
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedSeller, setSelectedSeller] = useState<SellerApplicant | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [previewModalPhoto, setPreviewModalPhoto] = useState<string | null>(null);

  const getSamplePhotos = (photos: string[] | string | null | undefined): string[] => {
    if (!photos) return [];
    if (Array.isArray(photos)) return photos;
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  };

  const fetchSellers = async () => {
    setIsLoading(true);
    try {
      const endpoint = filterStatus === 'pending'
        ? '/users/sellers/pending'
        : `/users/sellers?status=${filterStatus === 'all' ? '' : filterStatus}`;
      const res = await api.get(endpoint);
      if (res.data?.data) {
        setSellers(res.data.data);
      }
    } catch (err) {
      console.error('Gagal memuat data seller:', err);
      showError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, [filterStatus]);

  const handleApprove = async (seller: SellerApplicant) => {
    const confirmed = await showConfirm(
      'Setujui Kemitraan Kreator',
      `Apakah Anda yakin ingin menyetujui "${seller.name || seller.email}" sebagai seller resmi? User ini akan dapat mulai mengunggah produk dan mengajukan kurasi.`
    );
    if (!confirmed) return;

    try {
      await api.put(`/users/sellers/${seller.id}/approve`);
      success(`Kemitraan seller ${seller.name || seller.email} berhasil disetujui!`);
      fetchSellers();
    } catch (err) {
      showError(handleApiError(err));
    }
  };

  const handleOpenReject = (seller: SellerApplicant) => {
    setSelectedSeller(seller);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    if (!rejectionReason.trim()) {
      showError('Harap cantumkan alasan penolakan untuk informasi ke calon seller.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.put(`/users/sellers/${selectedSeller.id}/reject`, {
        reason: rejectionReason.trim()
      });
      success(`Permohonan seller ${selectedSeller.name || selectedSeller.email} telah ditolak.`);
      setRejectModalOpen(false);
      setSelectedSeller(null);
      fetchSellers();
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspend = async (seller: SellerApplicant) => {
    const confirmed = await showConfirm(
      'Bekukan Kemitraan Seller',
      `Yakin ingin membekukan status seller "${seller.name || seller.email}"? Seluruh produk seller akan dinonaktifkan dari etalase Frontend Hub (berkas di R2 tetap aman untuk pembeli terdahulu) dan sesi login seller akan dicabut.`
    );
    if (!confirmed) return;

    try {
      await api.put(`/users/sellers/${seller.id}/suspend`);
      info(`Status seller ${seller.name || seller.email} telah dibekukan dan seluruh produknya dinonaktifkan dari etalase.`);
      fetchSellers();
    } catch (err) {
      showError(handleApiError(err));
    }
  };

  const filteredSellers = sellers.filter(s => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(query);
    const emailMatch = s.email.toLowerCase().includes(query);
    const bankMatch = (s.bank_name || '').toLowerCase().includes(query);
    return nameMatch || emailMatch || bankMatch;
  });

  const pendingCount = sellers.filter(s => s.seller_status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-xs font-medium text-teal-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Gerbang Kurasi & Kemitraan Mitra</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Persetujuan Pendaftaran Seller
            </h1>
            <p className="text-sm text-teal-100/80 leading-relaxed">
              Tinjau pendaftar kreator baru dari portal Mitra Asisten Guru. Verifikasi identitas dan data rekening bank sebelum mereka diizinkan menjual produk digital.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSellers}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-xl text-sm font-semibold backdrop-blur-md border border-white/20 text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              filterStatus === 'pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Menunggu Persetujuan</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-white text-amber-600 font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              filterStatus === 'approved'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Disetujui</span>
          </button>

          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              filterStatus === 'rejected'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>Ditolak</span>
          </button>

          <button
            onClick={() => setFilterStatus('suspended')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              filterStatus === 'suspended'
                ? 'bg-amber-700 text-white shadow-md shadow-amber-700/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>Dibekukan</span>
          </button>

          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              filterStatus === 'all'
                ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Semua Data</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, email, bank..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">Memuat data pendaftar seller...</p>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <UserCheck className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">Tidak ada pendaftar seller</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data pendaftar yang cocok dengan filter atau kata kunci saat ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSellers.map((seller) => {
              const status = seller.seller_status;
              return (
                <div key={seller.id} className="p-6 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* User Info */}
                    <div className="flex items-start gap-4">
                      <SellerAvatar 
                        name={seller.name} 
                        email={seller.email} 
                        avatarUrl={seller.avatar_url} 
                      />

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">
                            {seller.name || 'Nama Belum Diisi'}
                          </h3>
                          {status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Menunggu Verifikasi</span>
                            </span>
                          )}
                          {status === 'approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Seller Aktif</span>
                            </span>
                          )}
                          {status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>Ditolak</span>
                            </span>
                          )}
                          {status === 'suspended' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                              <Ban className="w-3 h-3" />
                              <span>Dibekukan</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {seller.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Mendaftar: {formatDateTime(seller.seller_applied_at || seller.created_at)}
                          </span>

                          {/* Kontak WhatsApp / Nomor HP Calon Seller */}
                          {seller.phone_number ? (
                            (() => {
                              const cleanDigits = seller.phone_number.replace(/[^0-9]/g, '');
                              const waNumber = cleanDigits.startsWith('0') ? '62' + cleanDigits.slice(1) : (cleanDigits.startsWith('8') ? '62' + cleanDigits : cleanDigits);
                              const waGreeting = encodeURIComponent(`Halo Bapak/Ibu ${seller.name || 'Mitra Penjual'}, kami dari Tim Kurator Asisten Guru ingin mengonfirmasi pendaftaran kemitraan toko Anda (${seller.store_name || ''}).`);
                              const waUrl = `https://wa.me/${waNumber}?text=${waGreeting}`;

                              return (
                                <div className="inline-flex items-center gap-1.5 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200/90 text-emerald-900">
                                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-mono font-bold text-xs">{seller.phone_number}</span>
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs transition"
                                    title="Hubungi via WhatsApp Web / App"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>Chat WA</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(seller.phone_number || '');
                                      success('Nomor telepon seller disalin ke clipboard.');
                                    }}
                                    className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition cursor-pointer"
                                    title="Salin nomor telepon"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                              <Phone className="w-3 h-3 text-amber-500" />
                              <span>No. HP Belum Diatur</span>
                            </span>
                          )}
                        </div>

                        {/* Informasi Toko & Identitas Pemohon */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                          {/* Info Toko */}
                          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Store className="w-3.5 h-3.5 text-teal-600" />
                              <span>Profil Toko Mitra</span>
                            </div>
                            <div className="text-slate-900 font-semibold">
                              {seller.store_name || <span className="text-slate-400 italic">Nama toko belum diisi</span>}
                            </div>
                            {seller.store_description && (
                              <p className="text-slate-600 line-clamp-2 leading-relaxed">
                                {seller.store_description}
                              </p>
                            )}
                            <div className="flex items-start gap-1 text-slate-500 pt-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">
                                {seller.store_address || <span className="italic">Alamat toko belum diisi</span>}
                              </span>
                            </div>
                          </div>

                          {/* Biodata Diri & Alamat */}
                          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <User className="w-3.5 h-3.5 text-teal-600" />
                              <span>Biodata Calon Mitra</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-slate-700">
                              <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-medium">
                                {seller.gender || 'Gender: -'}
                              </span>
                              {seller.birth_date && (
                                <span className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-medium">
                                  Lahir: {seller.birth_date} 
                                  {calculateAge(seller.birth_date) !== null && ` (${calculateAge(seller.birth_date)} thn)`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-start gap-1 text-slate-500 pt-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">
                                {seller.personal_address || <span className="italic">Alamat tinggal belum diisi</span>}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Rekening Bank */}
                        <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 px-3 py-1.5 bg-teal-50/50 rounded-xl text-xs text-slate-700 border border-teal-100">
                          <CreditCard className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="font-semibold text-slate-800">{seller.bank_name || 'Bank Belum Diisi'}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-900 font-bold">{seller.bank_account_number || '-'}</span>
                          <span>•</span>
                          <span className="text-slate-600">a.n. {seller.bank_account_holder || '-'}</span>
                        </div>

                        {/* Contoh Foto Produk Untuk Kurasi Admin (Maks 5 Foto) */}
                        {(() => {
                          const samplePhotos = getSamplePhotos(seller.seller_sample_photos);
                          return (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                  <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                                  <span>Contoh Produk / Portofolio Karya ({samplePhotos.length} / 5 Foto)</span>
                                </div>
                                {samplePhotos.length === 0 ? (
                                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Belum ada foto karya
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                                    Siap Dikurasi
                                  </span>
                                )}
                              </div>

                              {samplePhotos.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {samplePhotos.map((photoUrl, idx) => {
                                    const resolvedPhotoUrl = getMediaUrl(photoUrl);
                                    return (
                                      <div 
                                        key={idx}
                                        onClick={() => setPreviewModalPhoto(resolvedPhotoUrl)}
                                        className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-xs hover:ring-2 hover:ring-teal-500 transition-all shrink-0"
                                        title="Klik untuk melihat resolusi penuh"
                                      >
                                        <img 
                                          src={resolvedPhotoUrl} 
                                          alt={`Sampel ${idx + 1}`} 
                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                          <Eye className="w-4 h-4" />
                                        </div>
                                        <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded-md bg-black/60 text-[9px] font-bold text-white leading-tight">
                                          #{idx + 1}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">
                                  Pendaftar belum mengunggah contoh foto produk digital.
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* Catatan Penolakan bila ada */}
                        {status === 'rejected' && seller.seller_rejection_reason && (
                          <div className="mt-2 flex items-start gap-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Alasan Penolakan: </span>
                              {seller.seller_rejection_reason}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      {status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(seller)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Setujui Kemitraan</span>
                          </button>

                          <button
                            onClick={() => handleOpenReject(seller)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </>
                      )}

                      {status === 'approved' && (
                        <button
                          onClick={() => handleSuspend(seller)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5 text-slate-500" />
                          <span>Bekukan</span>
                        </button>
                      )}

                      {status === 'rejected' && (
                        <button
                          onClick={() => handleApprove(seller)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tinjau Ulang & Setujui</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Alasan Penolakan */}
      {rejectModalOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Tolak Permohonan Seller</h3>
                <p className="text-xs text-slate-500">{selectedSeller.name || selectedSeller.email}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Informasi rekening bank tidak cocok dengan data pendaftar, atau kelengkapan profil belum memenuhi syarat."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pesan ini akan ditampilkan ke user di portal Mitra agar mereka memahami perbaikan yang dibutuhkan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'Kirim Penolakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal Preview Foto Sampel Produk */}
      {previewModalPhoto && (
        <div 
          onClick={() => setPreviewModalPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
        >
          <div 
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-2" 
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={getMediaUrl(previewModalPhoto)} 
              alt="Preview Foto Sampel Seller" 
              className="max-h-[80vh] w-auto object-contain mx-auto rounded-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewModalPhoto(null)}
              className="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-black/70 hover:bg-black text-white text-xs font-bold transition cursor-pointer shadow-lg"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
