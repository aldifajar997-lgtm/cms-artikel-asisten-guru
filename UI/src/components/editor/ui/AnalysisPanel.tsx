import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { SerpPreview } from './SerpPreview';
import { MetadataPanel } from './MetadataPanel';
import { KeywordTrends } from './KeywordTrends';
import { TaxonomyPanel } from './TaxonomyPanel';
import { Category, Tag as TagType } from '../../../types';
import { useToast } from '../../../context/ToastContext';

interface AnalysisPanelProps {
  activeSeoTab: 'checklist' | 'serp' | 'keywords' | 'geo';
  setActiveSeoTab: (tab: 'checklist' | 'serp' | 'keywords' | 'geo') => void;
  seoAnalysis: any;
  geoAnalysis: any;
  scoreBadge: { bg: string; label: string };
  geoScoreBadge: { bg: string; label: string };
  hasOriginalAngle: boolean;
  setHasOriginalAngle: (val: boolean) => void;
  isComprehensive: boolean;
  setIsComprehensive: (val: boolean) => void;
  
  // Serp + Meta
  serpDevice: 'desktop' | 'mobile';
  setSerpDevice: (val: 'desktop' | 'mobile') => void;
  title: string;
  metaTitle: string;
  setMetaTitle: (val: string) => void;
  metaDescription: string;
  setMetaDescription: (val: string) => void;
  content: string;
  slug: string;
  setSlug: (val: string) => void;
  currentCategory: Category | undefined;
  featuredImage: string;
  featuredImageAlt: string;
  generateSlug: (title: string) => string;

  // Taxonomy
  categories: Category[];
  tags: TagType[];
  categoryId: string;
  setCategoryId: (id: string) => void;
  tagIds: string[];
  setTagIds: (ids: string[]) => void;
  onTagsChange: (newTags: TagType[]) => void;

  // Keywords
  focusKeyword: string;
  isTrendLoading: boolean;
  trendStatus: 'idle' | 'trending' | 'niche' | 'error';
  lsiKeywords: string[];
  secondaryKeywords: string[];
  setSecondaryKeywords: (keywords: string[]) => void;
  setHasUnsavedChanges: (val: boolean) => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  activeSeoTab, setActiveSeoTab,
  seoAnalysis, geoAnalysis, scoreBadge, geoScoreBadge,
  hasOriginalAngle, setHasOriginalAngle, isComprehensive, setIsComprehensive,
  serpDevice, setSerpDevice, title, metaTitle, setMetaTitle, metaDescription, setMetaDescription,
  content, slug, setSlug, currentCategory, featuredImage, featuredImageAlt, generateSlug,
  categories, tags, categoryId, setCategoryId, tagIds, setTagIds, onTagsChange,
  focusKeyword, isTrendLoading, trendStatus, lsiKeywords, secondaryKeywords, setSecondaryKeywords, setHasUnsavedChanges
}) => {
  const { error } = useToast();

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs Selector */}
      <div className="flex bg-slate-200/60 p-1 rounded-xl">
        <button
          onClick={() => setActiveSeoTab('checklist')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSeoTab === 'checklist'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Checklist
        </button>
        <button
          onClick={() => setActiveSeoTab('serp')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSeoTab === 'serp'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          SERP
        </button>
        <button
          onClick={() => setActiveSeoTab('keywords')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSeoTab === 'keywords'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Keywords
        </button>
        <button
          onClick={() => setActiveSeoTab('geo')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSeoTab === 'geo'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          GEO
        </button>
      </div>

      {activeSeoTab === 'checklist' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              SEO Score & Status
            </h3>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Skor Optimasi Live</p>
                <p className="text-[11px] text-teal-600 font-semibold mt-0.5">{scoreBadge.label}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-50 border-2 border-teal-500 flex items-center justify-center font-bold text-teal-800 text-sm">
                {seoAnalysis.score}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              SEO Checklist ({seoAnalysis.checks.filter((c: any) => c.status === 'good').length}/{seoAnalysis.checks.length})
            </h3>
            <div className="space-y-2.5">
              {seoAnalysis.checks.map((check: any) => (
                <div
                  key={check.id}
                  className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5"
                >
                  {check.status === 'good' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />}
                  {check.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                  {check.status === 'bad' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{check.label}</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSeoTab === 'geo' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              GEO Score & Status
            </h3>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-800">Skor GEO Live</p>
                <p className="text-[11px] text-teal-600 font-semibold mt-0.5">{geoScoreBadge.label}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-teal-50 border-2 border-teal-500 flex items-center justify-center font-bold text-teal-800 text-sm">
                {geoAnalysis.score}
              </div>
            </div>
            
            {/* Manual Evaluation Checkboxes for GEO */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3 mb-6">
              <p className="text-xs font-bold text-slate-700 mb-2">Evaluasi Manual (Editor)</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={hasOriginalAngle} 
                  onChange={(e) => setHasOriginalAngle(e.target.checked)}
                  className="mt-0.5 border-slate-300 rounded text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Sudut Pandang Orisinal</p>
                  <p className="text-[10px] text-slate-500">Artikel memiliki sudut pandang, pengalaman langsung, atau analisis orisinal (bukan sekadar merangkum).</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isComprehensive} 
                  onChange={(e) => setIsComprehensive(e.target.checked)}
                  className="mt-0.5 border-slate-300 rounded text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Pembahasan Tuntas</p>
                  <p className="text-[10px] text-slate-500">Satu artikel menjawab maksud utama secara tuntas tanpa dipecah menjadi banyak halaman tipis.</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              GEO Checklist ({geoAnalysis.checks.filter((c: any) => c.status === 'good').length}/{geoAnalysis.checks.length})
            </h3>
            <div className="space-y-2.5">
              {geoAnalysis.checks.map((check: any) => (
                <div
                  key={check.id}
                  className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5"
                >
                  {check.status === 'good' && <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />}
                  {check.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                  {check.status === 'bad' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 leading-tight">{check.label}</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSeoTab === 'serp' && (
        <div className="space-y-6">
          <SerpPreview 
            serpDevice={serpDevice} setSerpDevice={setSerpDevice} title={title}
            metaTitle={metaTitle} metaDescription={metaDescription} content={content}
            slug={slug} currentCategory={currentCategory} featuredImage={featuredImage}
            featuredImageAlt={featuredImageAlt} generateSlug={generateSlug}
          />
          <MetadataPanel 
            title={title} metaTitle={metaTitle} setMetaTitle={setMetaTitle}
            metaDescription={metaDescription} setMetaDescription={setMetaDescription}
            content={content} slug={slug} setSlug={setSlug} generateSlug={generateSlug}
          />
        </div>
      )}

      {activeSeoTab === 'keywords' && (
        <div className="space-y-6">
          <TaxonomyPanel 
            categories={categories} tags={tags} categoryId={categoryId} setCategoryId={setCategoryId}
            tagIds={tagIds} setTagIds={setTagIds} generateSlug={generateSlug} onTagsChange={onTagsChange}
          />
          <KeywordTrends 
            focusKeyword={focusKeyword} isTrendLoading={isTrendLoading} trendStatus={trendStatus}
            lsiKeywords={lsiKeywords} secondaryKeywords={secondaryKeywords} 
            setSecondaryKeywords={setSecondaryKeywords} setHasUnsavedChanges={setHasUnsavedChanges}
          />

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Secondary Keywords ({secondaryKeywords.length}/5)</span>
            </h3>
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Ketik LSI Keyword lalu Enter..."
                  className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const val = target.value.trim();
                      if (val) {
                        if (secondaryKeywords.includes(val)) {
                          target.value = '';
                          return;
                        }
                        if (secondaryKeywords.length >= 5) {
                          error('Maksimal 5 Secondary Keywords.');
                          return;
                        }
                        setSecondaryKeywords([...secondaryKeywords, val]);
                        setHasUnsavedChanges(true);
                        target.value = '';
                      }
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {secondaryKeywords.map((kw, index) => {
                  return (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-[11px] font-medium"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => {
                          setSecondaryKeywords(secondaryKeywords.filter((_, i) => i !== index));
                          setHasUnsavedChanges(true);
                        }}
                        className="text-slate-400 hover:text-rose-600 ml-0.5 text-xs font-bold"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
