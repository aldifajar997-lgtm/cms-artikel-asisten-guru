import React from 'react';
import { Type, X, Search, ChevronRight, CheckCircle2 } from 'lucide-react';
import { CURATED_FONTS, FONT_CATEGORIES, FontCategory, loadGoogleFont } from '../../../constants/fonts';

interface FontExplorerModalProps {
  isOpen: boolean;
  currentFontFamily: string;
  fontSearch: string;
  selectedFontCategory: FontCategory;
  onClose: () => void;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: FontCategory) => void;
  onSelectFont: (fontFamily: string) => void;
}

export const FontExplorerModal: React.FC<FontExplorerModalProps> = ({
  isOpen,
  currentFontFamily,
  fontSearch,
  selectedFontCategory,
  onClose,
  onSearchChange,
  onCategoryChange,
  onSelectFont
}) => {
  if (!isOpen) return null;

  const filteredFonts = CURATED_FONTS.filter(font => {
    const matchesCategory = selectedFontCategory === 'all' || font.category === selectedFontCategory;
    const matchesSearch = !fontSearch.trim() ||
                          font.family.toLowerCase().includes(fontSearch.toLowerCase().trim()) ||
                          font.label.toLowerCase().includes(fontSearch.toLowerCase().trim()) ||
                          font.badge.toLowerCase().includes(fontSearch.toLowerCase().trim()) ||
                          font.sampleText.toLowerCase().includes(fontSearch.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-4xl w-full h-[85vh] max-h-[750px] flex flex-col text-stone-900 shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-brand-teal flex items-center justify-center shadow-xs">
              <Type className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                Koleksi Tipografi Guru (36 Gaya Font)
              </h3>
              <p className="text-xs text-stone-500">
                Pilih gaya huruf yang mencerminkan identitas dan karakter materi ajar Anda
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:px-6 border-b border-stone-100 bg-white space-y-3 shrink-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={fontSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari nama gaya font... (misal: Poppins, Lora, Fredoka, Caveat, Inter)"
              className="w-full bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200 focus:border-brand-teal rounded-xl pl-10 pr-10 py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none transition shadow-inner"
            />
            {fontSearch && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FONT_CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? CURATED_FONTS.length
                : CURATED_FONTS.filter(f => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryChange(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    selectedFontCategory === cat.id
                      ? 'bg-brand-teal text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedFontCategory === cat.id ? 'bg-white/25 text-white' : 'bg-stone-200/80 text-stone-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Font Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-50/60">
          {filteredFonts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-stone-500 space-y-2">
              <Type className="w-8 h-8 text-stone-300" />
              <p className="text-xs font-bold text-stone-700">Tidak ada font yang sesuai pencarian</p>
              <p className="text-[11px] text-stone-400">Coba gunakan kata kunci nama font lain atau bersihkan filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredFonts.map(font => {
                const isSelected = currentFontFamily.toLowerCase() === font.family.toLowerCase();
                return (
                  <div
                    key={font.family}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    onClick={() => {
                      loadGoogleFont(font.family);
                      onSelectFont(font.family);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between text-left ${
                      isSelected
                        ? 'bg-teal-50/60 border-brand-teal ring-2 ring-brand-teal shadow-sm'
                        : 'bg-white hover:bg-teal-50/20 border-stone-200/80 hover:border-brand-teal/50 hover:shadow-md'
                    }`}
                  >
                    {/* Top: Name & Category Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-stone-900 group-hover:text-brand-teal transition">
                        {font.label}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                        {font.badge}
                      </span>
                    </div>

                    {/* Middle: Live Sample Text in that font */}
                    <div className="my-2 py-2 border-y border-stone-100/80">
                      <div
                        className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2"
                        style={{ fontFamily: font.family }}
                      >
                        {font.sampleText}
                      </div>
                      <div
                        className="text-[11px] text-stone-500 mt-1 truncate"
                        style={{ fontFamily: font.family }}
                      >
                        Aa Bb Cc 123 • Kurikulum Merdeka
                      </div>
                    </div>

                    {/* Bottom: Action bar / status */}
                    <div className="mt-1 flex items-center justify-between pt-1">
                      <span className="text-[10px] text-stone-400 capitalize">
                        Gaya: {font.category}
                      </span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-teal">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sedang Dipakai</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-stone-400 group-hover:text-brand-teal transition opacity-0 group-hover:opacity-100 flex items-center gap-1">
                          <span>Pilih Font</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-stone-100 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-500">
            Font aktif saat ini: <strong className="text-stone-900 font-mono">{currentFontFamily}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white transition cursor-pointer shadow-xs"
          >
            Selesai Memilih
          </button>
        </div>
      </div>
    </div>
  );
};
