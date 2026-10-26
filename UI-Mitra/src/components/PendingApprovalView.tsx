import React from 'react';
import { 
  Clock, AlertTriangle, CheckCircle2, ShieldAlert, 
  ArrowRight, Store, BookOpen, ExternalLink, HelpCircle 
} from 'lucide-react';
import { UserProfile } from '../types';

interface PendingApprovalViewProps {
  profile: UserProfile;
  onGoToProfile: () => void;
  onOpenTerms: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  profile,
  onGoToProfile,
  onOpenTerms
}) => {
  const isPending = !profile.seller_status || profile.seller_status === 'pending';
  const isRejected = profile.seller_status === 'rejected';
  const isSuspended = profile.seller_status === 'suspended';

  if (!isPending && !isRejected && !isSuspended) {
    return null;
  }

  return (
    <div className="w-full bg-stone-50 border-b border-stone-200/80 px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {isPending && (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-5 sm:p-6 card-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100/90 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  <span>Tahap Kurasi Akun</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight font-sans">
                  Pendaftaran Kemitraan Anda Sedang Ditinjau Admin
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
                  Terima kasih telah mendaftar. Super Admin sedang memeriksa kelayakan profil dan portofolio Anda (estimasi 1x24 jam kerja). Sebelum disetujui, Anda belum dapat mempublikasikan karya ke etalase utama Asisten Guru.
                </p>
                
                {/* Micro Steps */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-stone-500">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Akun SSO Terdaftar</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Syarat Kemitraan Disetujui</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 ${
                    profile.seller_sample_photos && profile.seller_sample_photos.length > 0
                      ? 'text-emerald-700'
                      : 'text-amber-700 font-bold'
                  }`}>
                    {profile.seller_sample_photos && profile.seller_sample_photos.length > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {profile.seller_sample_photos && profile.seller_sample_photos.length > 0
                        ? `${profile.seller_sample_photos.length} Foto Sampel Terunggah`
                        : 'Unggah Contoh Produk'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Verifikasi Super Admin</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={onOpenTerms}
                className="px-4 py-2.5 rounded-xl border border-amber-200 bg-white hover:bg-amber-50/50 text-stone-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-stone-400" />
                <span>Pelajari SOP Kurasi</span>
              </button>

              <button
                type="button"
                onClick={onGoToProfile}
                className="px-4.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Lengkapi Profil & Foto Sampel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 sm:p-6 card-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  <span>Pendaftaran Belum Disetujui</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight font-sans">
                  Pengajuan Kemitraan Memerlukan Penyesuaian Data
                </h3>
                <p className="text-xs sm:text-sm text-stone-700 max-w-2xl leading-relaxed">
                  {profile.seller_rejection_reason ? (
                    <span><strong>Catatan Kurator:</strong> "{profile.seller_rejection_reason}"</span>
                  ) : (
                    "Kelengkapan profil toko, portofolio karya, atau data identitas Anda belum memenuhi kriteria mutu kurasi Asisten Guru."
                  )}
                </p>
                <p className="text-xs text-stone-500 pt-1">
                  Silakan perbarui profil, lengkapi portofolio atau media sosial edukasi Anda, lalu hubungi pengelola sistem.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={onGoToProfile}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Perbarui Data Profil</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isSuspended && (
          <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 card-shadow flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                Akses Mitra Ditangguhkan Sementara
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-2xl leading-relaxed">
                Akun kemitraan Anda dinonaktifkan sementara karena adanya evaluasi kepatuhan terhadap Syarat & Ketentuan Kemitraan Kreator. Silakan hubungi pengelola ekosistem Asisten Guru.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
