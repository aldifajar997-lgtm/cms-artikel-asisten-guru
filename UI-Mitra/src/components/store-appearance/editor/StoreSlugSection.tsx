import React from 'react';
import { Sparkles, Lock, AlertTriangle, ArrowUpRight, Copy, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../../types';

interface StoreSlugSectionProps {
  profile: UserProfile;
  hasPermanentSlug: boolean;
  isApprovedSeller: boolean;
  storeSlugInput: string;
  slugValidation: {
    checking: boolean;
    available?: boolean;
    isCurrent?: boolean;
    message?: string;
  };
  slugDisclaimerAgreed: boolean;
  isSavingSlug: boolean;
  setStoreSlugInput: (val: string) => void;
  setSlugDisclaimerAgreed: (agreed: boolean) => void;
  onOpenConfirmSlug: () => void;
  onCopySuccess: (msg: string) => void;
}

export const StoreSlugSection: React.FC<StoreSlugSectionProps> = ({
  profile,
  hasPermanentSlug,
  isApprovedSeller,
  storeSlugInput,
  slugValidation,
  slugDisclaimerAgreed,
  isSavingSlug,
  setStoreSlugInput,
  setSlugDisclaimerAgreed,
  onOpenConfirmSlug,
  onCopySuccess
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 card-shadow space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-sans">
            Tautan Toko Personal (Vanity URL)
          </h2>
        </div>
        {hasPermanentSlug ? (
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-600" /> Permanen Terverifikasi
          </span>
        ) : isApprovedSeller ? (
          <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Dibuat 1x Seumur Hidup
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200 flex items-center gap-1">
            <Lock className="w-3 h-3 text-stone-500" /> Khusus Mitra Disetujui
          </span>
        )}
      </div>

      {/* KASUS 1: SLUG SUDAH AKTIF (PERMANEN TERKUNCI & TIDAK BISA DIUBAH) */}
      {hasPermanentSlug ? (
        <div className="space-y-3">
          <p className="text-xs text-stone-600 leading-relaxed">
            Tautan toko digital Anda telah resmi terpasang di domain utama. Tautan ini bersifat permanen seumur hidup untuk menjaga keaslian tautan bagi para pembeli Anda.
          </p>

          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center shrink-0 text-brand-teal">
                <Lock className="w-5 h-5 text-brand-teal" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold block">Tautan Toko Resmi Anda</span>
                <a
                  href={`https://asisten-guru.id/${profile.store_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm sm:text-base font-bold font-mono text-stone-900 hover:text-brand-teal transition flex items-center gap-1 truncate"
                >
                  asisten-guru.id/{profile.store_slug}
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70 text-stone-400" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`https://asisten-guru.id/${profile.store_slug}`);
                  onCopySuccess('Tautan toko berhasil disalin ke clipboard!');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-stone-500" /> Salin
              </button>
              <a
                href={`https://asisten-guru.id/${profile.store_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-teal hover:bg-brand-teal-light text-white transition flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Buka Toko
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Tautan terkunci permanen seumur hidup (tanpa sistem pengalihan/redirect demi integritas toko).</span>
          </div>
        </div>
      ) : !isApprovedSeller ? (
        /* KASUS 2: SELLER BELUM APPROVED (PENDING / NONE) */
        <div className="space-y-3">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-amber-900">Tautan Toko Khusus Belum Terbuka</h3>
              <p className="text-stone-600 leading-relaxed">
                Pembuatan alamat toko langsung di domain utama (<span className="font-mono text-amber-800 font-semibold">asisten-guru.id/namatoko</span>) hanya dapat dilakukan 1 kali setelah akun kemitraan Anda resmi disetujui oleh tim kurator.
              </p>
              <div className="pt-1 text-[11px] text-stone-500">
                Status akun Anda saat ini:{' '}
                <span className="font-semibold text-stone-800 uppercase px-2 py-0.5 rounded bg-white border border-stone-200">
                  {profile.seller_status === 'pending' ? 'Sedang Ditinjau Kurator' : profile.seller_status || 'Belum Mengajukan Kemitraan'}
                </span>
              </div>
            </div>
          </div>

          {profile.id && (
            <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs">
              <span className="text-stone-500">Tautan Sementara: <span className="font-mono text-stone-800 font-medium">asisten-guru.id/toko/penjual/{profile.id}</span></span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`https://asisten-guru.id/toko/penjual/${profile.id}`);
                  onCopySuccess('Tautan sementara disalin ke clipboard!');
                }}
                className="text-brand-teal hover:text-brand-teal-light font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Salin
              </button>
            </div>
          )}
        </div>
      ) : (
        /* KASUS 3: SELLER SUDAH APPROVED DAN BELUM MEMILIKI SLUG (BUAT 1x SEUMUR HIDUP) */
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Penting: Dibuat 1 Kali Seumur Hidup & Permanen
            </div>
            <p className="text-xs text-amber-950/85 leading-relaxed">
              Pilihlah nama tautan toko Anda dengan sangat cermat. Sekali disimpan, tautan ini akan <strong>terkunci permanen selamanya</strong> dan tidak dapat diubah kembali. Kami <strong>tidak menyediakan sistem pengalihan (redirect)</strong> tautan lama guna melindungi kredibilitas toko Anda di mata pembeli.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-800">Pilih Nama Tautan Toko Anda</span>
              {slugValidation.checking && (
                <span className="text-[11px] text-stone-500 flex items-center gap-1 font-normal">
                  <RefreshCw className="w-3 h-3 animate-spin text-brand-teal" /> Memeriksa ketersediaan...
                </span>
              )}
              {!slugValidation.checking && slugValidation.available && (
                <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {slugValidation.message}
                </span>
              )}
              {!slugValidation.checking && slugValidation.available === false && (
                <span className="text-[11px] text-rose-600 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3 h-3 text-rose-500" /> {slugValidation.message}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center bg-stone-50 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus-within:border-brand-teal focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-teal/20 transition">
                <span className="text-stone-500 font-mono text-xs sm:text-sm select-none font-semibold">asisten-guru.id/</span>
                <input
                  type="text"
                  value={storeSlugInput}
                  onChange={(e) => setStoreSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="nama-toko-anda"
                  className="flex-1 bg-transparent text-stone-900 placeholder-stone-400 focus:outline-none font-mono text-xs sm:text-sm ml-0.5"
                  maxLength={30}
                />
              </div>

              <button
                type="button"
                onClick={onOpenConfirmSlug}
                disabled={isSavingSlug || slugValidation.checking || !slugValidation.available || !storeSlugInput.trim() || !slugDisclaimerAgreed}
                className="px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white shadow-xs disabled:bg-stone-100 disabled:text-stone-400 disabled:border disabled:border-stone-200"
              >
                {isSavingSlug ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Tetapkan Tautan Permanen</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
              <span>Hanya huruf kecil (a-z), angka (0-9), & tanda hubung (-). 3-30 karakter.</span>
            </div>

            {/* CHECKBOX KONFIRMASI PEMAHAMAN RESIKO */}
            <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={slugDisclaimerAgreed}
                onChange={(e) => setSlugDisclaimerAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-stone-300 bg-white cursor-pointer accent-[#0D5B52]"
              />
              <span className="text-xs text-stone-600 group-hover:text-stone-900 transition leading-relaxed">
                Saya memahami dan menyetujui bahwa <strong>tautan toko ini bersifat permanen seumur hidup</strong>, tidak dapat diubah atau dihapus kembali setelah disimpan, dan tidak ada pengalihan tautan lama.
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
