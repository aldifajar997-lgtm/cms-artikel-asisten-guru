import React, { useState } from 'react';
import { Loader2, AlertCircle, ShieldCheck, ArrowRight, GraduationCap, Store, Lock, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import api, { handleApiError } from '../utils/api';
import { SellerTermsModal } from './SellerTermsModal';

import { isSafeRedirectUrl } from '../utils/safeUrl';

export function LoginMitra() {
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('terms');

  const handleOpenLegal = (tab: 'terms' | 'privacy') => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  // Inisialisasi Masuk SSO Hub Asisten Guru
  const handleSsoLogin = async () => {
    setIsSsoLoading(true);
    setError(null);

    try {
      const response = await api.get('/auth/sso/hub/init');
      const targetUrl = response.data?.url;
      if (targetUrl && isSafeRedirectUrl(targetUrl)) {
        window.location.href = targetUrl;
      } else {
        throw new Error('Tautan autentikasi masuk tidak valid atau berisiko demi keamanan akun.');
      }
    } catch (err) {
      setError(handleApiError(err));
      setIsSsoLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Soft Glows (Palette Khas Asisten Guru: Teal & Mint) */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-teal-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-brand-mint/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-stone-200/40 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl card-shadow border border-stone-200/90 p-8 sm:p-12 text-center">
          
          {/* Logo Asisten Guru */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 mb-4 bg-teal-50 rounded-2xl flex items-center justify-center border border-teal-100/80 p-3 shadow-xs">
              <img src="/logo.svg" alt="Logo Asisten Guru" className="w-full h-full object-contain" />
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-brand-teal text-xs font-bold border border-teal-100 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              <span>Portal Resmi Mitra Kreator</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight font-sans">
              Pusat Niaga Mitra
            </h1>
            <p className="text-stone-600 mt-2 text-xs sm:text-sm max-w-sm leading-relaxed">
              Ruang khusus bagi pendidik dan kreator untuk mempublikasikan, mendistribusikan, dan mengelola produk digital edukasi Asisten Guru.
            </p>
          </div>

          {/* Error Alert (Rule #7 compliant) */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Tombol Utama: Masuk Khusus Mitra Asisten Guru */}
          <div className="space-y-4 my-8">
            <button
              type="button"
              onClick={handleSsoLogin}
              disabled={isSsoLoading}
              className="w-full group relative py-4 px-6 bg-gradient-to-r from-stone-900 to-stone-800 hover:from-teal-900 hover:to-stone-900 active:scale-[0.99] text-white rounded-2xl text-sm sm:text-base font-extrabold shadow-xl shadow-stone-900/15 transition-all flex items-center justify-between gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-stone-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center p-1.5 shrink-0 border border-teal-400/30">
                  <img src="/logo.svg" alt="" className="w-full h-full object-contain brightness-200" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 leading-none">
                    <span>Masuk Khusus Mitra Asisten Guru</span>
                    <GraduationCap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  </div>
                  <span className="text-[11px] text-stone-300 font-normal block mt-1">
                    Autentikasi Aman via Hub Asisten Guru
                  </span>
                </div>
              </div>

              {isSsoLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-teal-400 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition shrink-0">
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
                </div>
              )}
            </button>

            {/* Akses Dokumen Legal Calon Pendaftar */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1.5">
              <span className="text-[11px] text-stone-500 font-medium">
                Calon mitra dapat meninjau ketentuan resmi sebelum bergabung:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
                <a
                  href="/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-teal hover:text-brand-teal-light hover:underline inline-flex items-center gap-1 cursor-pointer font-bold transition"
                  title="Buka halaman resmi Syarat & Ketentuan Kemitraan di tab baru"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Syarat & Ketentuan Kemitraan</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
                <span className="text-stone-300">•</span>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-teal hover:text-brand-teal-light hover:underline inline-flex items-center gap-1 cursor-pointer font-bold transition"
                  title="Buka halaman resmi Kebijakan Privasi di tab baru"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Kebijakan Privasi</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              </div>
            </div>
          </div>

          {/* Fitur & Jaminan Keamanan Ekosistem Mitra */}
          <div className="pt-6 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-2xl bg-stone-50/80 border border-stone-100 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold text-stone-800 block leading-tight">1 Akun Terpadu</span>
                <span className="text-[10px] text-stone-500 leading-snug">Akses seluruh layanan Hub</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50/80 border border-stone-100 flex items-start gap-2.5">
              <Store className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold text-stone-800 block leading-tight">Kurasi Mutu</span>
                <span className="text-[10px] text-stone-500 leading-snug">Standar karya edukasi terbaik</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-stone-50/80 border border-stone-100 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-bold text-stone-800 block leading-tight">Privasi Aman</span>
                <span className="text-[10px] text-stone-500 leading-snug">Data rekening & hak cipta</span>
              </div>
            </div>
          </div>

          {/* Footer SOP */}
          <div className="mt-6 text-center">
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Bagi mitra baru, Anda akan diarahkan ke formulir pendaftaran kurasi setelah proses masuk berhasil.
            </p>
          </div>

        </div>
      </div>

      {/* Modal Dokumen Legalitas Kemitraan */}
      <SellerTermsModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialTab={legalModalTab}
      />

    </div>
  );
}
