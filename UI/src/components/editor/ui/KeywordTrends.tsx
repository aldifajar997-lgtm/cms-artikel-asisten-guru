import React from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

interface KeywordTrendsProps {
  focusKeyword: string;
  isTrendLoading: boolean;
  trendStatus: 'idle' | 'trending' | 'niche' | 'error';
  lsiKeywords: string[];
  secondaryKeywords: string[];
  setSecondaryKeywords: (keywords: string[]) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
}

export const KeywordTrends: React.FC<KeywordTrendsProps> = ({
  focusKeyword,
  isTrendLoading,
  trendStatus,
  lsiKeywords,
  secondaryKeywords,
  setSecondaryKeywords,
  setHasUnsavedChanges
}) => {
  const { success, error } = useToast();

  return (
    <div>
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
        <span>Live Tren & Saran LSI</span>
        {isTrendLoading && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
      </h3>
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        {!focusKeyword.trim() ? (
          <p className="text-xs text-slate-500 text-center italic">Masukkan Focus Keyword di panel atas untuk melihat tren.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              {trendStatus === 'trending' && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold border border-rose-100">
                  🔥 Volume Tinggi / Populer
                </span>
              )}
              {trendStatus === 'niche' && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-100">
                  💡 Spesifik / Niche
                </span>
              )}
              {trendStatus === 'error' && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold border border-slate-200">
                  Gagal memuat tren
                </span>
              )}
            </div>

            {lsiKeywords.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-medium">Klik LSI Keyword dari Google Suggest di bawah ini untuk menambahkannya ke daftar artikel Anda:</p>
                <div className="flex flex-wrap gap-1.5">
                  {lsiKeywords.map((kw, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={async () => {
                        if (!secondaryKeywords.includes(kw)) {
                          if (secondaryKeywords.length >= 5) {
                            error('Maksimal 5 Secondary Keywords.');
                            return;
                          }
                          setSecondaryKeywords([...secondaryKeywords, kw]);
                          setHasUnsavedChanges(true);
                        }
                        
                        try {
                          await navigator.clipboard.writeText(kw);
                          success(`'${kw}' disalin & ditambahkan!`);
                        } catch (err) {
                          success(`'${kw}' berhasil ditambahkan ke daftar!`);
                        }
                      }}
                      className="text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-300 hover:bg-teal-50 rounded-full transition-colors cursor-pointer text-left"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {lsiKeywords.length === 0 && !isTrendLoading && trendStatus !== 'error' && (
              <p className="text-xs text-slate-500">Tidak ada saran LSI tambahan ditemukan.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
