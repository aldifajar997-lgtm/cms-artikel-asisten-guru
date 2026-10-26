import React from 'react';
import { Type, Sparkles, Wand2, LayoutGrid, List, AlignJustify } from 'lucide-react';
import { StoreAppearanceConfig } from '../../../types';
import { loadGoogleFont } from '../../../constants/fonts';

interface TypographySectionProps {
  typography: StoreAppearanceConfig['typography'];
  catalogLayout: StoreAppearanceConfig['catalogLayout'];
  backgroundType: StoreAppearanceConfig['background']['type'];
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
  onOpenFontModal: () => void;
  onAutoOptimizeReadability: () => void;
}

export const TypographySection: React.FC<TypographySectionProps> = ({
  typography,
  catalogLayout,
  backgroundType,
  setAppearance,
  onOpenFontModal,
  onAutoOptimizeReadability
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            4. Tipografi & Keterbacaan Teks
          </h2>
        </div>
        <span className="text-[11px] text-stone-400 font-medium">Font, Warna & Wadah Profil</span>
      </div>

      {/* Smart Readability Banner jika wallpaper bergambar aktif */}
      {backgroundType === 'image' && (!typography.cardStyle || typography.cardStyle === 'none') && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <strong className="text-amber-900 font-bold block">Wallpaper Bergambar Terdeteksi</strong>
              <span className="text-amber-800/90 text-[11px]">
                Gunakan <strong>Wadah Kaca Transparan (Glassmorphism)</strong> agar nama toko dan bio Anda 100% terbaca jelas di atas gambar.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAutoOptimizeReadability}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>✨ Optimalkan Keterbacaan</span>
          </button>
        </div>
      )}

      {/* SUB-SEKSI A: PILIHAN JENIS FONT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold text-stone-800 block">Jenis Font Huruf Toko</label>
            <span className="text-[10px] text-stone-500">Pilih dari koleksi puluhan gaya font Google yang dikurasi khusus untuk guru</span>
          </div>
          <span className="text-xs font-mono font-bold text-brand-teal px-2 py-0.5 bg-teal-50 rounded-lg border border-teal-200">
            {typography.fontFamily}
          </span>
        </div>

        {/* Pratinjau Font Aktif */}
        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-stone-700 truncate" style={{ fontFamily: typography.fontFamily }}>
              {typography.fontFamily} — Pratinjau Teks
            </div>
            <div className="text-[11px] text-stone-500 truncate mt-0.5" style={{ fontFamily: typography.fontFamily }}>
              "Modul Ajar Kurikulum Merdeka & Perangkat Guru Digital"
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenFontModal}
            className="px-3.5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-light text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Jelajahi 36 Font</span>
          </button>
        </div>

        {/* 4 Pilihan Cepat Favorit */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['Plus Jakarta Sans', 'Inter', 'Outfit', 'Merriweather'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => {
                loadGoogleFont(f);
                setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  typography: { ...prev.typography, fontFamily: f }
                }));
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border cursor-pointer truncate ${
                typography.fontFamily === f
                  ? 'border-brand-teal bg-teal-50 text-teal-900 shadow-xs ring-1 ring-brand-teal'
                  : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
              }`}
              style={{ fontFamily: f }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-SEKSI B: SKEMA WARNA TEKS UTAMA (HEADING & BIO) */}
      <div className="pt-2 border-t border-stone-100 space-y-3">
        <div>
          <label className="text-xs font-bold text-stone-800 block">Skema Warna Teks Utama</label>
          <span className="text-[10px] text-stone-500">Sesuaikan kontras warna nama toko dan deskripsi profil Anda</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Warna Judul & Nama Toko */}
          <div className="p-3 bg-stone-50/70 rounded-2xl border border-stone-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Warna Judul / Nama Toko</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={typography.headingColor.startsWith('#') ? typography.headingColor : '#1c1917'}
                  onChange={(e) => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    typography: { ...prev.typography, headingColor: e.target.value }
                  }))}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-stone-300 p-0.5 bg-white"
                />
                <span className="text-[11px] font-mono font-bold text-stone-700 uppercase">
                  {typography.headingColor}
                </span>
              </div>
            </div>

            {/* Swatch Cepat Warna Judul */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-stone-400 font-medium">Cepat:</span>
              {[
                { label: 'Charcoal', color: '#1c1917' },
                { label: 'Putih Bersih', color: '#ffffff' },
                { label: 'Deep Teal', color: '#064e3b' },
                { label: 'Academic Navy', color: '#1e3a8a' },
                { label: 'Emas Amber', color: '#b45309' }
              ].map(sw => (
                <button
                  key={sw.color}
                  type="button"
                  onClick={() => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    typography: { ...prev.typography, headingColor: sw.color }
                  }))}
                  className={`w-6 h-6 rounded-lg border transition cursor-pointer shadow-2xs ${
                    typography.headingColor.toLowerCase() === sw.color.toLowerCase()
                      ? 'ring-2 ring-brand-teal scale-110'
                      : 'border-stone-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: sw.color }}
                  title={sw.label}
                />
              ))}
            </div>
          </div>

          {/* 2. Warna Teks Deskripsi & Bio */}
          <div className="p-3 bg-stone-50/70 rounded-2xl border border-stone-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-700">Warna Deskripsi / Bio</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={typography.bioColor.startsWith('#') ? typography.bioColor : '#57534e'}
                  onChange={(e) => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    typography: { ...prev.typography, bioColor: e.target.value }
                  }))}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-stone-300 p-0.5 bg-white"
                />
                <span className="text-[11px] font-mono font-bold text-stone-700 uppercase">
                  {typography.bioColor}
                </span>
              </div>
            </div>

            {/* Swatch Cepat Warna Bio */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-stone-400 font-medium">Cepat:</span>
              {[
                { label: 'Stone Gray', color: '#57534e' },
                { label: 'Slate Gelap', color: '#0f172a' },
                { label: 'Muted Light Slate', color: '#cbd5e1' },
                { label: 'Soft White', color: '#f8fafc' },
                { label: 'Muted Teal', color: '#047857' }
              ].map(sw => (
                <button
                  key={sw.color}
                  type="button"
                  onClick={() => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    typography: { ...prev.typography, bioColor: sw.color }
                  }))}
                  className={`w-6 h-6 rounded-lg border transition cursor-pointer shadow-2xs ${
                    typography.bioColor.toLowerCase() === sw.color.toLowerCase()
                      ? 'ring-2 ring-brand-teal scale-110'
                      : 'border-stone-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: sw.color }}
                  title={sw.label}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SUB-SEKSI C: WADAH KARTU PROFIL & TRANSPARANSI KETERBACAAN */}
      <div className="pt-2 border-t border-stone-100 space-y-3">
        <div>
          <label className="text-xs font-bold text-stone-800 block">Wadah Profil & Efek Transparansi Kaca</label>
          <span className="text-[10px] text-stone-500">
            Lindungi teks profil agar selalu terlihat elegan dan terbaca sempurna di atas motif wallpaper apapun
          </span>
        </div>

        {/* Pilihan Tipe Wadah */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'none', label: 'Tanpa Kartu', desc: 'Melayang Bebas' },
            { id: 'glass', label: 'Kaca Glass', desc: 'Transparan Blur' },
            { id: 'soft', label: 'Transparan Halus', desc: 'Tint Lembut' },
            { id: 'solid', label: 'Kartu Solid', desc: 'Pekat Berwarna' }
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                typography: {
                  ...prev.typography,
                  cardStyle: item.id as any,
                  ...(item.id === 'glass' && !prev.typography.cardBgColor ? { cardBgColor: '#ffffff', cardOpacity: 85 } : {})
                }
              }))}
              className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                (typography.cardStyle || 'none') === item.id
                  ? 'border-brand-teal bg-teal-50/70 text-teal-950 font-extrabold ring-1 ring-brand-teal'
                  : 'border-stone-200 hover:border-stone-300 text-stone-600 bg-white'
              }`}
            >
              <span className="text-xs block font-bold">{item.label}</span>
              <span className="text-[10px] text-stone-500 block">{item.desc}</span>
            </button>
          ))}
        </div>

        {/* Panel Kontrol Transparansi & Warna Wadah jika wadah aktif */}
        {typography.cardStyle && typography.cardStyle !== 'none' && (
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3.5 animate-in fade-in duration-200">
            
            {/* Warna Latar Wadah & Swatch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-stone-800 block">Warna Dasar Wadah Profil</span>
                <span className="text-[10px] text-stone-500">Pilih putih kristal atau hitam elegan untuk efek kaca</span>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { label: 'Putih Kaca', color: '#ffffff' },
                  { label: 'Gelap Elegan', color: '#0f172a' },
                  { label: 'Deep Teal', color: '#064e3b' },
                  { label: 'Ivory Krem', color: '#fdfbf7' }
                ].map(c => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setAppearance(prev => ({
                      ...prev,
                      preset: 'custom',
                      typography: { ...prev.typography, cardBgColor: c.color }
                    }))}
                    className={`w-7 h-7 rounded-lg border transition cursor-pointer ${
                      (typography.cardBgColor || '#ffffff').toLowerCase() === c.color.toLowerCase()
                        ? 'ring-2 ring-brand-teal scale-110'
                        : 'border-stone-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.label}
                  />
                ))}

                <input
                  type="color"
                  value={typography.cardBgColor || '#ffffff'}
                  onChange={(e) => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    typography: { ...prev.typography, cardBgColor: e.target.value }
                  }))}
                  className="w-7 h-7 rounded-lg cursor-pointer border border-stone-300 p-0.5 bg-white ml-1"
                  title="Pilih Warna Bebas"
                />
              </div>
            </div>

            {/* Slider Transparansi / Opasitas Wadah */}
            <div className="space-y-1.5 pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700">Tingkat Transparansi (Opasitas)</span>
                <span className="font-mono font-bold text-brand-teal px-2 py-0.5 bg-teal-50 rounded-md border border-teal-200">
                  {typography.cardOpacity ?? 85}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={typography.cardOpacity ?? 85}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  typography: { ...prev.typography, cardOpacity: Number(e.target.value) }
                }))}
                className="w-full accent-brand-teal cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400">
                <span>Sangat Bening (15%)</span>
                <span>Seimbang (85%)</span>
                <span>Pekat Solid (100%)</span>
              </div>
            </div>

            {/* Intensitas Blur Kaca */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <span className="text-xs font-bold text-stone-700">Intensitas Blur Latar</span>
              <div className="flex gap-1.5">
                {[
                  { id: 'none', label: 'Tanpa Blur' },
                  { id: 'sm', label: 'Ringan' },
                  { id: 'md', label: 'Sedang' },
                  { id: 'lg', label: 'Kuat' }
                ].map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setAppearance(prev => ({
                      ...prev,
                      preset: 'custom',
                      typography: { ...prev.typography, cardBlur: b.id as any }
                    }))}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition border cursor-pointer ${
                      (typography.cardBlur || 'md') === b.id
                        ? 'bg-brand-teal text-white border-brand-teal'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Opsi Efek Bayangan Teks (Text Shadow) */}
        <div className="p-3 bg-stone-50/70 rounded-2xl border border-stone-200/70 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-stone-700 block">Efek Bayangan Teks (Readability Halo)</span>
            <span className="text-[10px] text-stone-500">Membantu teks tetap terbaca kontras tanpa harus menggunakan kartu</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {[
              { id: 'none', label: 'Polos' },
              { id: 'soft', label: 'Bayangan Halus' },
              { id: 'glow', label: 'Halo Kontras' }
            ].map(sh => (
              <button
                key={sh.id}
                type="button"
                onClick={() => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  typography: { ...prev.typography, textShadow: sh.id as any }
                }))}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                  (typography.textShadow || 'none') === sh.id
                    ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }`}
              >
                {sh.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUB-SEKSI D: TATA LETAK PRODUK */}
      <div className="pt-2 border-t border-stone-100 space-y-2">
        <label className="text-xs font-bold text-stone-700 block">Tata Letak Katalog Produk</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setAppearance(prev => ({ ...prev, preset: 'custom', catalogLayout: 'grid' }))}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 cursor-pointer ${
              catalogLayout === 'grid'
                ? 'border-brand-teal bg-teal-50 text-teal-900'
                : 'border-stone-200 text-stone-600 bg-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid 2 Kolom</span>
          </button>

          <button
            type="button"
            onClick={() => setAppearance(prev => ({ ...prev, preset: 'custom', catalogLayout: 'list' }))}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 cursor-pointer ${
              catalogLayout === 'list'
                ? 'border-brand-teal bg-teal-50 text-teal-900'
                : 'border-stone-200 text-stone-600 bg-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List Baris</span>
          </button>

          <button
            type="button"
            onClick={() => setAppearance(prev => ({ ...prev, preset: 'custom', catalogLayout: 'compact' }))}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 cursor-pointer ${
              catalogLayout === 'compact'
                ? 'border-brand-teal bg-teal-50 text-teal-900'
                : 'border-stone-200 text-stone-600 bg-white'
            }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span>Compact</span>
          </button>
        </div>
      </div>
    </div>
  );
};
