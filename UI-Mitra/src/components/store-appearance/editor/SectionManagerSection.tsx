import React from 'react';
import { Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { SectionBlockType } from '../../../types';
import { SECTION_METADATA } from '../constants';

interface SectionManagerSectionProps {
  sectionsOrder: SectionBlockType[];
  isSectionEnabled: (sectionId: SectionBlockType) => boolean;
  onToggleSectionEnabled: (sectionId: SectionBlockType) => void;
  onMoveSection: (index: number, direction: 'up' | 'down') => void;
}

export const SectionManagerSection: React.FC<SectionManagerSectionProps> = ({
  sectionsOrder,
  isSectionEnabled,
  onToggleSectionEnabled,
  onMoveSection
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            5. Urutan Blok Halaman (Modular Blocks)
          </h2>
        </div>
        <span className="text-[11px] text-stone-400 font-medium">Bebas Susun Urutan Tampil</span>
      </div>

      <p className="text-xs text-stone-500 leading-relaxed">
        Atur urutan tampilan setiap bagian pada etalase toko Anda. Geser ke atas atau bawah sesuai prioritas promosi Anda.
      </p>

      <div className="space-y-2">
        {sectionsOrder.map((sectionId, idx) => {
          const meta = SECTION_METADATA[sectionId];
          if (!meta) return null;
          const SectionIcon = meta.icon;
          const isEnabled = isSectionEnabled(sectionId);

          return (
            <div
              key={sectionId}
              className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                isEnabled
                  ? 'bg-stone-50/70 border-stone-200/90'
                  : 'bg-stone-100/50 border-stone-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 shrink-0 shadow-2xs">
                  <SectionIcon className="w-4 h-4 text-brand-teal" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {idx + 1}. {meta.name}
                    </span>
                    {!meta.canDisable ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-stone-200 text-stone-600 shrink-0">
                        Wajib
                      </span>
                    ) : (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        isEnabled ? 'bg-teal-100 text-teal-800' : 'bg-stone-200 text-stone-500'
                      }`}>
                        {isEnabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 truncate block mt-0.5">
                    {meta.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {meta.canDisable && (
                  <button
                    type="button"
                    onClick={() => onToggleSectionEnabled(sectionId)}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition cursor-pointer mr-1 ${
                      isEnabled
                        ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                        : 'bg-stone-200 border-stone-300 text-stone-600 hover:bg-stone-300'
                    }`}
                    title={isEnabled ? 'Nonaktifkan seksi ini' : 'Aktifkan seksi ini'}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </button>
                )}

                {sectionId === 'profile' ? (
                  <span className="text-[10px] font-semibold text-stone-400 px-2.5 py-1 bg-stone-100 rounded-lg">
                    Header Tetap
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onMoveSection(idx, 'up')}
                      disabled={idx <= 1}
                      className="p-1.5 rounded-lg border border-stone-200 hover:bg-white text-stone-600 hover:text-stone-900 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      title="Geser ke Atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onMoveSection(idx, 'down')}
                      disabled={idx === sectionsOrder.length - 1}
                      className="p-1.5 rounded-lg border border-stone-200 hover:bg-white text-stone-600 hover:text-stone-900 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      title="Geser ke Bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
