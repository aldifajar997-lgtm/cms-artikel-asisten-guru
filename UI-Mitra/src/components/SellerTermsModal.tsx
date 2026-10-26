import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ShieldCheck, FileText, Loader2, Check, Lock, ExternalLink } from 'lucide-react';
import api from '../utils/api';

interface SellerTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  initialTab?: 'terms' | 'privacy';
}

export const SellerTermsModal: React.FC<SellerTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  initialTab = 'terms'
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [termsMarkdown, setTermsMarkdown] = useState<string>('');
  const [privacyMarkdown, setPrivacyMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchTerms = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await api.get('/auth/terms/seller', { params: { _t: Date.now() } });
        if (isMounted) {
          setTermsMarkdown(response.data?.markdown || '');
          setPrivacyMarkdown(response.data?.privacy_markdown || '');
        }
      } catch (err) {
        console.error('Failed to load seller terms & privacy', err);
        if (isMounted) {
          setLoadError('Gagal memuat dokumen legal. Pastikan perangkat terhubung ke internet.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTerms();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentContent = activeTab === 'terms' ? termsMarkdown : privacyMarkdown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/90 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-brand-teal">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight font-sans">
                  Ketentuan Hukum & Privasi Mitra Kreator
                </h2>
                <p className="text-[11px] text-stone-500 font-medium">
                  Landasan hukum resmi kemitraan, kurasi karya, dan perlindungan data sensitif
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-stone-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-stone-200/70 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Syarat & Ketentuan Kemitraan (ToS)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-stone-200/70 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>2. Kebijakan Privasi (UU PDP No. 27/2022)</span>
            </button>

            <a
              href={activeTab === 'terms' ? '/tos' : '/privacy'}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto px-2.5 py-1.5 rounded-xl text-xs font-semibold text-brand-teal hover:bg-stone-200/50 transition flex items-center gap-1.5"
              title="Buka naskah resmi di halaman penuh tab baru"
            >
              <span>Halaman Penuh</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Modal Body: Dynamic React Markdown */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 font-sans text-stone-700 text-xs sm:text-sm leading-relaxed space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-stone-400">
              <Loader2 className="w-7 h-7 animate-spin text-brand-teal" />
              <p className="text-xs font-semibold">Memuat dokumen resmi...</p>
            </div>
          ) : loadError ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {loadError}
            </div>
          ) : (
            <div className="prose prose-stone prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-stone-900 prose-a:text-brand-teal prose-strong:text-stone-900 prose-hr:border-stone-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/90 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
            <span>Dokumen mengikat secara hukum bagi setiap Mitra Kreator.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold transition cursor-pointer"
            >
              Tutup
            </button>
            {onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white text-xs font-bold shadow-md shadow-brand-teal/20 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Saya Paham & Setuju Seluruhnya</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
