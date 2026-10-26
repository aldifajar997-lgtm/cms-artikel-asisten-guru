import React from 'react';
import { Eye, Upload, Trash2 } from 'lucide-react';
import { GRADIENT_OPTIONS, SOLID_OPTIONS, HEX_COLOR_REGEX } from '../constants';
import { StoreAppearanceConfig } from '../../../types';
import { getMediaUrl } from '../../../utils/mediaUrl';

interface BackgroundSectionProps {
  background: StoreAppearanceConfig['background'];
  isUploadingBg: boolean;
  bgInputRef: React.RefObject<HTMLInputElement | null>;
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
  onSolidBgChange: (color: string) => void;
  onBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBgImage: () => void;
}

export const BackgroundSection: React.FC<BackgroundSectionProps> = ({
  background,
  isUploadingBg,
  bgInputRef,
  setAppearance,
  onSolidBgChange,
  onBgUpload,
  onRemoveBgImage
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            2. Latar Belakang (Background)
          </h2>
        </div>
        <span className="text-[11px] text-stone-400 font-medium">Gradien, Warna, atau Foto</span>
      </div>

      {/* Pilihan Tipe Latar Belakang */}
      <div className="flex gap-2">
        {(['gradient', 'color', 'image'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => setAppearance(prev => {
              let newValue = prev.background.value;
              if (type === 'color' && !HEX_COLOR_REGEX.test(newValue)) {
                newValue = '#f5f5f4';
              } else if (type === 'gradient' && !newValue.startsWith('linear-gradient')) {
                newValue = 'linear-gradient(180deg, #f0fdf9 0%, #f5f5f4 100%)';
              } else if (type === 'image' && (!newValue || newValue.startsWith('linear-gradient(145deg'))) {
                newValue = '#f5f5f4';
              }
              return {
                ...prev,
                preset: 'custom',
                background: { ...prev.background, type, value: newValue }
              };
            })}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition capitalize cursor-pointer border ${
              background.type === type
                ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
            }`}
          >
            {type === 'gradient' ? 'Gradien Halus' : type === 'color' ? 'Warna Solid' : 'Wallpaper Kustom'}
          </button>
        ))}
      </div>

      {/* Konten Berdasarkan Tipe Background */}
      {background.type === 'gradient' && (
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-stone-700 block">Pilih Palet Gradien Halus & Nyaman</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {GRADIENT_OPTIONS.map((g, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const isLight = !g.isDark;
                  setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    background: { ...prev.background, type: 'gradient', value: g.value },
                    typography: {
                      ...prev.typography,
                      headingColor: isLight ? '#0f172a' : '#ffffff',
                      bioColor: isLight ? '#475569' : '#cbd5e1'
                    }
                  }));
                }}
                className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold shadow-xs transition p-2 cursor-pointer ${
                  background.value === g.value ? 'ring-2 ring-brand-teal border-stone-800' : 'border-stone-200'
                }`}
                style={{ background: g.value, color: g.isDark ? '#ffffff' : '#1c1917' }}
              >
                <span className="drop-shadow-xs">{g.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {background.type === 'color' && (
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-stone-700 block">Pilihan Warna Solid</label>
          <div className="flex flex-wrap gap-2.5 items-center">
            {SOLID_OPTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSolidBgChange(s.value)}
                className={`w-9 h-9 rounded-xl border-2 transition cursor-pointer ${
                  background.value === s.value ? 'ring-2 ring-brand-teal border-stone-800 scale-110' : 'border-stone-200'
                }`}
                style={{ backgroundColor: s.value }}
                title={s.label}
              />
            ))}
            
            {/* Custom Color Input */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <input
                type="color"
                value={background.value.startsWith('#') ? background.value : '#f5f5f4'}
                onChange={(e) => onSolidBgChange(e.target.value)}
                className="w-9 h-9 rounded-xl cursor-pointer border border-stone-300 p-0.5 bg-white"
              />
              <span className="text-xs text-stone-500 font-mono">Pilih Bebas</span>
            </div>
          </div>
        </div>
      )}

      {background.type === 'image' && (
        <div className="space-y-3 pt-2">
          <input
            type="file"
            ref={bgInputRef as any}
            onChange={onBgUpload}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />

          {background.imageUrl ? (
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0">
                  <img 
                    src={getMediaUrl(background.imageUrl)} 
                    alt="Wallpaper preview" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="truncate text-xs">
                  <span className="font-bold text-stone-800 block truncate">Wallpaper Etalase Aktif</span>
                  <span className="text-[10px] text-stone-400">Rasio Portrait Layar Smartphone (9:16)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => bgInputRef.current?.click()}
                  disabled={isUploadingBg}
                  className="py-1.5 px-3 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition cursor-pointer"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={onRemoveBgImage}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Hapus Wallpaper"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => !isUploadingBg && bgInputRef.current?.click()}
              className={`border-2 border-dashed border-stone-300 hover:border-brand-teal p-6 rounded-2xl text-center transition cursor-pointer bg-stone-50/50 hover:bg-teal-50/30 ${
                isUploadingBg ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <span className="text-xs font-bold text-stone-800 block">
                {isUploadingBg ? 'Mengunggah Wallpaper...' : 'Klik untuk Mengunggah Wallpaper Toko'}
              </span>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Disarankan gambar vertikal rasio 9:16 (Maks 3MB)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
