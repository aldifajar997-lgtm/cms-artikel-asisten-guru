import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../utils/api';
import { 
  FileText, Lock, Loader2, ArrowLeft, Printer, Share2, 
  CheckCircle2, AlertCircle, ChevronUp, ExternalLink 
} from 'lucide-react';

interface StandaloneLegalPageProps {
  initialTab?: 'terms' | 'privacy';
}

export const StandaloneLegalPage: React.FC<StandaloneLegalPageProps> = ({ initialTab = 'terms' }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [termsContent, setTermsContent] = useState<string>('');
  const [privacyContent, setPrivacyContent] = useState<string>('');
  const [termsVersion, setTermsVersion] = useState<number>(1);
  const [privacyVersion, setPrivacyVersion] = useState<number>(1);
  const [termsUpdatedAt, setTermsUpdatedAt] = useState<string>('');
  const [privacyUpdatedAt, setPrivacyUpdatedAt] = useState<string>('');
  const [termsTitle, setTermsTitle] = useState<string>('');
  const [privacyTitle, setPrivacyTitle] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  useEffect(() => {
    loadLegalData();
    // Sinkronkan favicon tab browser ke favicon Asisten Guru resmi
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
  }, []);

  const loadLegalData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/auth/terms/seller', { params: { _t: Date.now() } });
      const data = res.data;
      if (data) {
        setTermsContent(data.markdown || '');
        setTermsTitle(data.title || 'Syarat dan Ketentuan Kemitraan Kreator');
        setTermsVersion(data.terms_version || 1);
        setTermsUpdatedAt(data.terms_updated_at || '');

        setPrivacyContent(data.privacy_markdown || '');
        setPrivacyTitle(data.privacy_title || 'Kebijakan Privasi & Perlindungan Data Sensitif');
        setPrivacyVersion(data.privacy_version || 1);
        setPrivacyUpdatedAt(data.privacy_updated_at || '');
      }
    } catch (err: any) {
      console.error('Failed to load legal documents in SPA:', err);
      setErrorMsg('Gagal memuat naskah dokumen legal. Silakan periksa koneksi internet Anda atau coba muat ulang.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Terbaru';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const currentContent = activeTab === 'terms' ? termsContent : privacyContent;
  const currentTitle = activeTab === 'terms' ? termsTitle : privacyTitle;
  const currentVersion = activeTab === 'terms' ? termsVersion : privacyVersion;
  const currentUpdated = activeTab === 'terms' ? termsUpdatedAt : privacyUpdatedAt;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 font-sans text-stone-900">
      
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Brand */}
          <a href="/" className="flex items-center gap-3 text-stone-900 hover:opacity-90 transition">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-full h-full" aria-label="Logo Asisten Guru">
                <defs>
                  <linearGradient id="spaTealGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#074e44" />
                    <stop offset="50%" stopColor="#0e6f62" />
                    <stop offset="100%" stopColor="#229a8a" />
                  </linearGradient>
                  <linearGradient id="spaArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0e6f62" />
                    <stop offset="50%" stopColor="#2ca191" />
                    <stop offset="100%" stopColor="#54beae" />
                  </linearGradient>
                </defs>
                <path d="M 20,65 Q 40,78 60,71 Q 80,78 100,65 L 100,69 Q 80,82 60,75 Q 40,82 20,69 Z" fill="#074e44" />
                <path d="M 22,63 Q 40,76 60,69 Q 80,76 98,63 L 98,66 Q 80,79 60,72 Q 40,79 22,66 Z" fill="#14524a" opacity="0.3" />
                <path d="M 22,61 Q 40,74 60,67 L 60,70 Q 40,77 22,64 Z" fill="#2ca191" />
                <path d="M 60,67 Q 80,74 98,61 L 98,64 Q 80,77 60,70 Z" fill="#2ca191" />
                <circle cx="52" cy="33" r="7" fill="none" stroke="#0e6f62" strokeWidth="3" />
                <path d="M 52,40 C 44,40 40,51 51,62 C 51,63 50,65 49,68 C 50,66 52,62 53,60" fill="none" stroke="#0e6f62" strokeWidth="3" strokeLinecap="round" />
                <path d="M 48,58 Q 68,54 80,41 Q 86,34 88,27" fill="none" stroke="url(#spaArrowGrad)" strokeWidth="4.5" strokeLinecap="round" />
                <path d="M 88,27 L 85,34 L 81,32 Z" fill="#0e6f62" />
                <path d="M 88,27 L 80,29 L 82,33 Z" fill="#0e6f62" />
                <path d="M 64,31 C 64,31 65,37 68,36 C 71,35 69,28 69,28 C 69,28 66,28 64,31 Z" fill="#4fa597" />
                <path d="M 64,31 C 66,31 68,33 68,36" fill="none" stroke="#229a8a" strokeWidth="0.5" />
                <path d="M 48,46 C 48,46 51,50 55,47 C 59,44 54,41 54,41 C 54,41 51,42 48,46 Z" fill="#4fa597" />
                <path d="M 78,51 C 74,51 73,56 78,56 C 83,56 82,51 78,51 Z" fill="#1b5a51" />
                <path d="M 84,41 Q 84,44 87,44 Q 84,44 84,47 Q 84,44 81,44 Q 84,44 84,41 Z" fill="#0e6f62" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-teal-950">Asisten Guru</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-100/80 text-brand-teal">
                  Legal
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">Portal Kemitraan Kreator</p>
            </div>
          </a>

          {/* Switcher Tab Dokumen */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('terms');
                window.history.replaceState({}, '', '/tos');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-brand-teal shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Syarat & Ketentuan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('privacy');
                window.history.replaceState({}, '', '/privacy');
              }}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-brand-teal shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kebijakan Privasi</span>
            </button>
          </div>

          {/* Aksi Navigasi */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Cetak Dokumen"
            >
              <Printer className="w-3.5 h-3.5 text-stone-500" />
              <span>Cetak</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Salin Tautan Resmi"
            >
              <Share2 className="w-3.5 h-3.5 text-stone-500" />
              <span>{copySuccess ? 'Tersalin!' : 'Salin'}</span>
            </button>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-teal hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Masuk Portal</span>
            </a>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Hero Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-teal-50 text-brand-teal border border-teal-200">
              Versi {currentVersion}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Aktif & Berlaku Mengikat
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight leading-snug">
            {currentTitle || (activeTab === 'terms' ? 'Syarat & Ketentuan Kemitraan Kreator' : 'Kebijakan Privasi Platform')}
          </h1>

          <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-4 text-xs text-stone-500 font-medium">
            <div>
              Terakhir Diperbarui: <strong className="text-stone-800">{formatDate(currentUpdated)}</strong>
            </div>
            <span>•</span>
            <div>
              Yurisdiksi: <strong className="text-stone-800">Republik Indonesia</strong>
            </div>
            <span>•</span>
            <div>
              Penerbit: <strong className="text-stone-800">Asisten Guru Indonesia</strong>
            </div>
          </div>
        </div>

        {/* Naskah Markdown */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/80 shadow-xs">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
              <p className="text-xs font-semibold">Memuat naskah resmi dari server...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-bold">Dokumen Tidak Dapat Dimuat</p>
              <p className="text-xs text-rose-600">{errorMsg}</p>
              <button
                type="button"
                onClick={loadLegalData}
                className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <article className="prose prose-stone max-w-none text-xs sm:text-sm leading-relaxed
              prose-headings:font-bold prose-headings:text-stone-900 prose-headings:tracking-tight
              prose-h1:text-xl prose-h1:border-b prose-h1:border-stone-200 prose-h1:pb-3 prose-h1:mb-4
              prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-stone-100 prose-h2:pb-2
              prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-stone-700 prose-p:leading-relaxed prose-p:my-3
              prose-ul:my-3 prose-ul:list-disc prose-ul:pl-5
              prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-5
              prose-li:text-stone-700 prose-li:my-1
              prose-strong:text-stone-900 prose-strong:font-bold
              prose-a:text-brand-teal prose-a:font-semibold prose-a:underline hover:prose-a:text-teal-800
              prose-blockquote:border-l-4 prose-blockquote:border-teal-700 prose-blockquote:bg-stone-50 prose-blockquote:p-4 prose-blockquote:rounded-r-xl prose-blockquote:my-4 prose-blockquote:italic
              prose-table:w-full prose-table:border-collapse prose-table:my-4
              prose-th:bg-stone-100 prose-th:p-2.5 prose-th:border prose-th:border-stone-200 prose-th:text-left prose-th:text-xs prose-th:font-bold
              prose-td:p-2.5 prose-td:border prose-td:border-stone-200 prose-td:text-xs
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentContent}
              </ReactMarkdown>
            </article>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-8 px-4 text-center text-xs text-stone-500 space-y-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Asisten Guru — PT Asisten Guru Indonesia. Seluruh hak cipta dilindungi undang-undang.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 font-semibold"
          >
            <span>Kembali ke Atas</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </footer>

    </div>
  );
};
