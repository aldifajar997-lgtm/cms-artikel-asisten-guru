import React from 'react';
import { excerptFallback } from './SerpPreview';

interface MetadataPanelProps {
  title: string;
  metaTitle: string;
  setMetaTitle: (val: string) => void;
  metaDescription: string;
  setMetaDescription: (val: string) => void;
  content: string;
  slug: string;
  setSlug: (val: string) => void;
  generateSlug: (text: string) => string;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  title,
  metaTitle,
  setMetaTitle,
  metaDescription,
  setMetaDescription,
  content,
  slug,
  setSlug,
  generateSlug
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Meta Tags & URL
      </h3>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <label className="font-bold text-slate-700">Meta Title Tag</label>
            <span className={`text-[10px] font-bold ${(metaTitle || title).length > 60 ? 'text-rose-500' : (metaTitle || title).length >= 45 ? 'text-teal-600' : 'text-slate-400'
              }`}>
              {(metaTitle || title).length}/60
            </span>
          </div>
          <input
            type="text"
            maxLength={60}
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder={title || 'Judul hasil pencarian...'}
            className={`w-full text-xs px-3 py-2 bg-slate-50 border ${(metaTitle || title).length > 60 ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-teal-500'} rounded-lg focus:ring-1 focus:bg-white placeholder:text-slate-300`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <label className="font-bold text-slate-700">Meta Description</label>
            <span className={`text-[10px] font-bold ${(metaDescription || excerptFallback(content)).length > 160 ? 'text-rose-500' : (metaDescription || excerptFallback(content)).length >= 120 ? 'text-teal-600' : 'text-slate-400'
              }`}>
              {(metaDescription || excerptFallback(content)).length}/160
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={160}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder={excerptFallback(content) || 'Ringkasan 120-160 karakter...'}
            className={`w-full text-xs px-3 py-2 bg-slate-50 border ${(metaDescription || excerptFallback(content)).length > 160 ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-teal-500'} rounded-lg focus:ring-1 focus:bg-white resize-none placeholder:text-slate-300`}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Custom Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={(e) => setSlug(generateSlug(e.target.value))}
            placeholder={generateSlug(title) || 'slug-url-artikel'}
            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 font-mono placeholder:text-slate-300"
          />
        </div>
      </div>
    </div>
  );
};
