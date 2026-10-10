import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Category } from '../../../types';

interface SerpPreviewProps {
  serpDevice: 'desktop' | 'mobile';
  setSerpDevice: (device: 'desktop' | 'mobile') => void;
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  slug: string;
  currentCategory: Category | undefined;
  featuredImage: string;
  featuredImageAlt: string;
  generateSlug: (title: string) => string;
}

// Helper: Excerpt fallback (Strip HTML first)
export function excerptFallback(content: string): string {
  if (!content) return '';
  const clean = content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > 155 ? `${clean.substring(0, 155)}...` : clean;
}

export const SerpPreview: React.FC<SerpPreviewProps> = ({
  serpDevice,
  setSerpDevice,
  title,
  metaTitle,
  metaDescription,
  content,
  slug,
  currentCategory,
  featuredImage,
  featuredImageAlt,
  generateSlug
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Simulasi Google SERP
        </h3>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSerpDevice('desktop')}
            className={`p-1 rounded-md text-xs ${serpDevice === 'desktop' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500'
              }`}
            title="Desktop"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSerpDevice('mobile')}
            className={`p-1 rounded-md text-xs ${serpDevice === 'mobile' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500'
              }`}
            title="Mobile"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs space-y-2 font-sans mx-auto transition-all duration-300 ${serpDevice === 'mobile' ? 'max-w-[340px]' : 'w-full'
        }`}>
        <div className="flex items-center space-x-2 text-[11px] text-slate-600">
          <div className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center text-[10px] text-white font-bold">
            G
          </div>
          <div className="truncate">
            <span className="font-medium text-slate-800">example.com</span>
            <span className="text-slate-400"> › {currentCategory?.slug || 'artikel'} › {slug || generateSlug(title) || 'judul'}</span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-[#1a0dab] hover:underline leading-snug cursor-pointer line-clamp-2">
              {metaTitle || title || 'Judul Halaman Artikel SEO Anda'}
            </p>
            <p className="text-xs text-[#4d5156] leading-relaxed line-clamp-3">
              {metaDescription ||
                excerptFallback(content) ||
                'Masukkan meta description untuk melihat cuplikan ringkasan yang akan ditampilkan Google kepada jutaan calon pembaca...'}
            </p>
          </div>
          {featuredImage && (
            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-50">
              <img
                src={featuredImage}
                alt={featuredImageAlt || 'SERP Thumbnail'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
