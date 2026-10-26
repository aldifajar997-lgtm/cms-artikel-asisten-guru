import React from 'react';
import { Palette, Check } from 'lucide-react';
import { PRESET_THEMES } from '../constants';
import { StoreAppearanceConfig } from '../../../types';

interface ThemePresetSectionProps {
  currentPreset: string;
  onSelectPreset: (key: string) => void;
}

export const ThemePresetSection: React.FC<ThemePresetSectionProps> = ({
  currentPreset,
  onSelectPreset
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            1. Preset Tema Edukatif
          </h2>
        </div>
        <span className="text-[11px] text-stone-400 font-medium">1-Klik Langsung Cantik</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(PRESET_THEMES).map(([key, item]) => {
          const isSelected = currentPreset === key;
          return (
            <div
              key={key}
              onClick={() => onSelectPreset(key)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'border-brand-teal bg-teal-50/40 shadow-sm ring-1 ring-brand-teal'
                  : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-900">{item.name}</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">{item.description}</p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-stone-100">
                <div 
                  className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                  style={{ background: item.config.background.value }} 
                />
                <div 
                  className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                  style={{ background: item.config.button.bgColor }} 
                />
                <span className="text-[10px] text-stone-400 font-mono ml-auto">
                  {item.config.typography.fontFamily}
                </span>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-teal text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
