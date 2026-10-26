import React from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { StoreAppearanceConfig, FaqItem } from '../../../types';

interface FaqSectionProps {
  faq: StoreAppearanceConfig['faq'];
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
  onLoadFaqTemplate: () => void;
  onAddFaqItem: () => void;
  onRemoveFaqItem: (id: string) => void;
  onUpdateFaqItem: (id: string, field: 'question' | 'answer', value: string) => void;
}

export const FaqSection: React.FC<FaqSectionProps> = ({
  faq,
  setAppearance,
  onLoadFaqTemplate,
  onAddFaqItem,
  onRemoveFaqItem,
  onUpdateFaqItem
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            9. Tanya Jawab (FAQ Accordion)
          </h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={faq.enabled}
            onChange={(e) => setAppearance(prev => ({
              ...prev,
              preset: 'custom',
              faq: { ...prev.faq, enabled: e.target.checked }
            }))}
            className="rounded text-brand-teal focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-bold text-stone-700">Tampilkan</span>
        </label>
      </div>

      {faq.enabled ? (
        <div className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Judul Seksi FAQ
            </label>
            <input
              type="text"
              maxLength={80}
              value={faq.title}
              onChange={(e) => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                faq: { ...prev.faq, title: e.target.value.slice(0, 80) }
              }))}
              placeholder="Pertanyaan yang Sering Diajukan"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
            <span className="text-xs font-bold text-stone-800">
              Daftar Pertanyaan ({faq.items.length}/10)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLoadFaqTemplate}
                className="py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold transition cursor-pointer"
              >
                Gunakan Template Guru
              </button>

              <button
                type="button"
                onClick={onAddFaqItem}
                disabled={faq.items.length >= 10}
                className="py-1.5 px-3 rounded-xl bg-brand-teal hover:bg-brand-teal-light text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          {faq.items.length === 0 ? (
            <div className="p-4 rounded-2xl bg-stone-50 border border-dashed border-stone-200 text-center">
              <p className="text-xs text-stone-500 mb-2">Belum ada pertanyaan FAQ yang ditambahkan.</p>
              <button
                type="button"
                onClick={onLoadFaqTemplate}
                className="py-1.5 px-3 rounded-xl bg-brand-teal text-white text-xs font-bold shadow-xs hover:bg-brand-teal-light cursor-pointer"
              >
                Gunakan Template Bawaan Guru (1-Klik)
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {faq.items.map((item, idx) => (
                <div key={item.id} className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-700">Pertanyaan #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFaqItem(item.id)}
                      className="p-1 text-stone-400 hover:text-red-600 transition cursor-pointer"
                      title="Hapus Pertanyaan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={200}
                    value={item.question}
                    onChange={(e) => onUpdateFaqItem(item.id, 'question', e.target.value)}
                    placeholder="Pertanyaan (misal: Apakah file bisa diedit di Canva?)"
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs bg-white text-stone-900 focus:outline-none focus:border-brand-teal"
                  />
                  <textarea
                    rows={2}
                    maxLength={800}
                    value={item.answer}
                    onChange={(e) => onUpdateFaqItem(item.id, 'answer', e.target.value)}
                    placeholder="Jawaban penjelasan ramah untuk pembeli..."
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs bg-white text-stone-900 focus:outline-none focus:border-brand-teal"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic">
          Seksi FAQ dinonaktifkan. Centang "Tampilkan" untuk menambahkan tanya jawab panduan pembeli.
        </p>
      )}
    </div>
  );
};
