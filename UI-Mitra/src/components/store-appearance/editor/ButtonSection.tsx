import React from 'react';
import { Sliders } from 'lucide-react';
import { StoreAppearanceConfig } from '../../../types';
import { getButtonRadiusClass, getButtonStyleProps } from '../utils';

interface ButtonSectionProps {
  button: StoreAppearanceConfig['button'];
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
  onButtonColorChange: (color: string) => void;
}

export const ButtonSection: React.FC<ButtonSectionProps> = ({
  button,
  setAppearance,
  onButtonColorChange
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            3. Gaya Tombol & Kartu Produk
          </h2>
        </div>
        <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
          Smart Contrast Guard
        </span>
      </div>

      {/* Bentuk Sudut Tombol (Radius) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-stone-700 block">Bentuk Sudut (Radius)</label>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'sharp', label: 'Kotak (Sharp)', class: 'rounded-md' },
            { id: 'rounded', label: 'Membulat (Rounded)', class: 'rounded-2xl' },
            { id: 'pill', label: 'Lonjong (Pill)', class: 'rounded-full' }
          ].map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                button: { ...prev.button, radius: r.id as any }
              }))}
              className={`py-2 px-3 text-xs font-bold transition border cursor-pointer ${
                button.radius === r.id
                  ? 'border-brand-teal bg-teal-50/50 text-teal-900'
                  : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
              } ${r.class}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gaya Efek Tombol (Surface Style) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-stone-700 block">Efek Permukaan Tombol</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: 'fill', label: 'Fill (Pekat Solid)' },
            { id: 'outline', label: 'Outline (Garis Tepi)' },
            { id: 'shadow-soft', label: 'Soft Shadow (Melayang)' },
            { id: 'shadow-hard', label: 'Hard Shadow (Retro Pop)' },
            { id: 'glassmorphism', label: 'Glass (Transparan Kaca)' }
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                button: { ...prev.button, style: s.id as any }
              }))}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition border text-left cursor-pointer ${
                button.style === s.id
                  ? 'border-brand-teal bg-teal-50/50 text-teal-900 font-extrabold'
                  : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pemilih Warna Tombol & Smart Contrast Badge */}
      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-stone-800 block">Warna Utama Tombol</span>
            <span className="text-[10px] text-stone-500">Teks tombol otomatis disesuaikan agar selalu terbaca</span>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={button.bgColor}
              onChange={(e) => onButtonColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border border-stone-300 p-0.5 bg-white"
            />
            <span className="text-xs font-mono font-bold text-stone-700 uppercase">
              {button.bgColor}
            </span>
          </div>
        </div>

        {/* Live Preview Sample Tombol */}
        <div className="pt-2 flex items-center justify-between border-t border-stone-200">
          <span className="text-[11px] text-stone-500 font-medium">Hasil Preview Tombol:</span>
          <div
            className={`py-2 px-6 text-xs font-bold transition ${getButtonRadiusClass(button.radius)}`}
            style={getButtonStyleProps(button)}
          >
            Beli Modul Rp 35.000
          </div>
        </div>
      </div>
    </div>
  );
};
