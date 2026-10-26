import React, { useState } from 'react';
import { 
  Clock, ShieldCheck, CheckCircle2, ArrowRight, 
  RotateCw, LogOut, Store, Calendar, HelpCircle, GraduationCap, BookOpen 
} from 'lucide-react';
import { UserProfile } from '../types';
import { formatDateTime } from '../utils/dateFormatter';
import { useToast } from '../context/ToastContext';
import { SellerTermsModal } from './SellerTermsModal';

interface ApprovalStatusPageProps {
  profile: UserProfile;
  onRefreshStatus: () => Promise<void>;
  onLogout: () => void;
}

export const ApprovalStatusPage: React.FC<ApprovalStatusPageProps> = ({
  profile,
  onRefreshStatus,
  onLogout
}) => {
  const { info, success } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStatus();
      info('Memeriksa status pendaftaran terbaru dari server...');
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-50 font-sans text-stone-900 flex flex-col justify-between relative overflow-hidden">
      
      {/* Background Glows (Teal & Mint Asisten Guru) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-mint/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center p-2 shadow-xs">
              <img src="/logo.svg" alt="Asisten Guru" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-brand-teal block leading-none font-sans">
                Asisten Guru
              </span>
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                Portal Mitra Seller
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 z-10">
        <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl card-shadow border border-stone-200/90 p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-300">
          
          {/* Logo & Status Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-3xl bg-teal-50 border border-teal-100 flex items-center justify-center p-3.5 shadow-sm">
                <img src="/logo.svg" alt="Asisten Guru" className="w-full h-full object-contain" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-extrabold border border-amber-200 mb-2">
              <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
              <span>Tahap Verifikasi & Kurasi Toko</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight font-sans">
              Pendaftaran Mitra Sedang Ditinjau
            </h1>
            
            <p className="text-stone-600 mt-2 text-xs sm:text-sm max-w-lg leading-relaxed">
              Terima kasih atas pendaftaran Anda. Tim kurator Super Admin kami saat ini sedang meninjau data identitas dan mutu contoh karya digital Anda sebelum etalase toko resmi diaktifkan.
            </p>
          </div>

          {/* Kotak Jadwal & Jam Kerja Kurasi */}
          <div className="bg-gradient-to-r from-teal-900 to-stone-900 text-white rounded-2xl p-5 text-left mb-6 shadow-md border border-teal-800/40">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-teal-200 uppercase tracking-wider">
                  Estimasi Waktu & Jam Kerja Kurasi
                </h3>
                <p className="text-xs sm:text-sm text-stone-200 font-semibold mt-1">
                  Maksimal 3x24 Jam Kerja (Senin – Jumat, pukul 07.00 – 15.00 WIB)
                </p>
                <p className="text-[11px] text-stone-400 mt-1 leading-snug">
                  Kurasi dilakukan pada hari dan jam kerja resmi Asisten Guru. Permohonan yang diajukan di luar jam kerja atau hari libur nasional akan diproses pada hari kerja berikutnya.
                </p>
              </div>
            </div>
          </div>

          {/* Ringkasan Data Pengajuan */}
          <div className="bg-stone-50/90 rounded-2xl p-4 sm:p-5 border border-stone-200/80 text-left mb-6 space-y-3">
            <h4 className="text-xs font-extrabold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-brand-teal" />
              <span>Rincian Pengajuan Kemitraan</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-stone-200/60">
                <span className="text-stone-400 text-[10.5px] block font-medium">Nama Toko</span>
                <span className="font-bold text-stone-800 text-xs sm:text-sm">
                  {profile.store_name || 'Toko Mitra Edukasi'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-stone-200/60">
                <span className="text-stone-400 text-[10.5px] block font-medium">Nama Mitra (Pemilik)</span>
                <span className="font-bold text-stone-800 text-xs sm:text-sm">
                  {profile.name || profile.email}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-stone-200/60">
                <span className="text-stone-400 text-[10.5px] block font-medium">Kategori Utama</span>
                <span className="font-bold text-stone-800 text-xs sm:text-sm">
                  {profile.primaryNiche || 'Perangkat Pembelajaran'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-stone-200/60">
                <span className="text-stone-400 text-[10.5px] block font-medium">WhatsApp / HP Terdaftar</span>
                <span className="font-bold text-stone-800 text-xs sm:text-sm font-mono text-teal-800">
                  {profile.phone_number || '-'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-stone-200/60">
                <span className="text-stone-400 text-[10.5px] block font-medium">Waktu Pengajuan</span>
                <span className="font-bold text-stone-800 text-xs sm:text-sm">
                  {profile.seller_applied_at ? formatDateTime(profile.seller_applied_at) : 'Baru saja'}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Progress Steps */}
          <div className="border border-stone-200/80 rounded-2xl p-4 sm:p-5 mb-8 text-left bg-white">
            <span className="text-[11px] font-extrabold text-stone-500 uppercase tracking-wider block mb-3">
              Tahapan Pendaftaran
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              
              {/* Step 1: Selesai */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="block leading-tight text-[11px]">1. Formulir Terkirim</span>
                  <span className="text-[10px] text-emerald-700 font-normal">Biodata & sampel lengkap</span>
                </div>
              </div>

              {/* Step 2: Berjalan */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <div>
                  <span className="block leading-tight text-[11px]">2. Kurasi Dokumen</span>
                  <span className="text-[10px] text-amber-700 font-normal">Sedang ditinjau admin</span>
                </div>
              </div>

              {/* Step 3: Menunggu */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <span className="block leading-tight text-[11px]">3. Toko & Produk Aktif</span>
                  <span className="text-[10px] text-stone-400 font-normal">Mulai penjualan digital</span>
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="w-full sm:w-auto px-6 py-3 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Memperbarui...' : 'Periksa Status Terkini'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTermsModalOpen(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-stone-500" />
              <span>Pelajari SOP Kurasi</span>
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-stone-400 text-[11px] z-10">
        <p>&copy; {new Date().getFullYear()} Asisten Guru. Hak cipta dilindungi undang-undang.</p>
      </footer>

      {/* Modal Syarat & Ketentuan Kemitraan */}
      <SellerTermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

    </div>
  );
};
