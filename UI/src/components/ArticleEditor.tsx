import React, { useMemo, useState, useCallback, useRef } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, Sparkles, Sliders, Loader2, Send, RefreshCw, Tag, Link2 } from 'lucide-react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';

import { Article, Category, UserProfile, Tag as TagType } from '../types';
import { generateSlug } from '../utils/seoAnalyzer';
import { FeaturedImageUploader } from './FeaturedImageUploader';
import { useToast } from '../context/ToastContext';

// Hooks
import { useArticleForm } from './editor/hooks/useArticleForm';
import { useLiveTrends } from './editor/hooks/useLiveTrends';
import { useSeoGeoAnalysis } from './editor/hooks/useSeoGeoAnalysis';
import { useSunEditor } from './editor/hooks/useSunEditor';

// UI Subcomponents
import { AnalysisPanel, SeoTab } from './editor/ui/AnalysisPanel';
import { extractInternalLinks } from './editor/ui/InternalLinkHelper';

interface ArticleEditorProps {
  article: Article;
  categories: Category[];
  tags: TagType[];
  profile: UserProfile;
  onSave: (data: Partial<Article>) => Promise<void>;
  onBack: () => void;
  onPreview: (data: Partial<Article>) => void;
  onTagsChange: (newTags: TagType[]) => void;
  setHasUnsavedChanges?: (hasChanges: boolean) => void;
}

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  article,
  categories,
  tags,
  profile,
  onSave,
  onBack,
  onPreview,
  onTagsChange,
  setHasUnsavedChanges,
}) => {
  // 1. Form State Management (Custom Hook)
  const { formState, setters, localHasUnsavedChanges, handleAutoSlug } = useArticleForm({
    article,
    categories,
    setHasUnsavedChanges
  });

  // Extract from formState
  const {
    title, slug, content, categoryId, focusKeyword, secondaryKeywords,
    metaTitle, metaDescription, status, featuredImage, featuredImageAlt, featuredImageCaption,
    tagIds, hasOriginalAngle, isComprehensive
  } = formState;
  
  const {
    setTitle, setSlug, setContent, setCategoryId, setFocusKeyword, setSecondaryKeywords,
    setMetaTitle, setMetaDescription, setStatus, setFeaturedImage, setFeaturedImageAlt, setFeaturedImageCaption,
    setTagIds, setHasOriginalAngle, setIsComprehensive
  } = setters;

  const { success, info } = useToast();
  const sunEditorRef = useRef<any>(null);
  const lastSelectedTextRef = useRef<string>('');

  // UI Modes
  const [isSeoPanelOpen, setIsSeoPanelOpen] = useState(true);
  const [serpDevice, setSerpDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSeoTab, setActiveSeoTab] = useState<SeoTab>('checklist');
  const [lastSavedTime, setLastSavedTime] = useState<string>(
    article.updatedAt ? new Date(article.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Link Assistant: Hitung tautan internal yang sudah terdeteksi di konten saat ini
  const detectedInternalLinks = useMemo(() => extractInternalLinks(content), [content]);

  // Link Assistant: Callback untuk menyisipkan tautan internal langsung ke SunEditor
  const handleInsertInternalLink = useCallback((targetTitle: string, targetSlug: string, customAnchor?: string) => {
    const url = `/blog/${targetSlug}`;
    
    // Tentukan teks jangkar: prioritas customAnchor -> seleksi kursor saat ini -> seleksi terakhir -> judul target
    let anchorText = customAnchor?.trim();
    if (!anchorText) {
      try {
        const liveSelection = sunEditorRef.current?.getSelection()?.toString()?.trim();
        anchorText = liveSelection || lastSelectedTextRef.current || targetTitle;
      } catch (e) {
        anchorText = lastSelectedTextRef.current || targetTitle;
      }
    }

    if (sunEditorRef.current) {
      try {
        sunEditorRef.current.focus();
      } catch (e) {}

      const safeAnchor = anchorText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeTitle = targetTitle.replace(/"/g, '&quot;');
      const linkHtml = `<a href="${url}" title="${safeTitle}">${safeAnchor}</a>`;

      try {
        sunEditorRef.current.insertHTML(linkHtml);
        const newContent = sunEditorRef.current.getContents();
        if (newContent) {
          setContent(newContent);
        }
      } catch (err) {
        setContent((prev: string) => prev + ` ${linkHtml}`);
      }

      lastSelectedTextRef.current = '';
      if (setHasUnsavedChanges) setHasUnsavedChanges(true);
      success(`Tautan internal disisipkan: "${anchorText}"`);
    } else {
      navigator.clipboard.writeText(url);
      info(`Tautan disalin ke clipboard: ${url}`);
    }
  }, [setContent, setHasUnsavedChanges, success, info]);

  // 2. Live Trends API (Custom Hook)
  const { lsiKeywords, isTrendLoading, trendStatus } = useLiveTrends(focusKeyword);

  // 3. SEO & GEO Calculations (Custom Hook)
  const { seoAnalysis, geoAnalysis } = useSeoGeoAnalysis({
    title, content, focusKeyword, metaTitle, metaDescription,
    secondaryKeywords, featuredImage, featuredImageAlt,
    hasOriginalAngle, isComprehensive, profile
  });

  const [sessionMediaKeys, setSessionMediaKeys] = useState<string[]>([]);
  const addSessionMediaKey = useCallback((key: string) => {
    setSessionMediaKeys(prev => [...new Set([...prev, key])]);
  }, []);

  // 4. SunEditor Config (Custom Hook)
  const { EDITOR_OPTIONS, handleImageUploadBefore } = useSunEditor(addSessionMediaKey);

  // Score color helper
  const getScoreBadge = (score: number) => {
    if (score >= 85) return { bg: 'bg-teal-50 text-teal-800 border-teal-200', label: 'Optimal' };
    if (score >= 70) return { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Cukup' };
    return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Perlu Ditingkatkan' };
  };

  const scoreBadge = getScoreBadge(seoAnalysis.score);
  const geoScoreBadge = getScoreBadge(geoAnalysis.score);

  // Save Logic
  const triggerSave = async (targetStatus: Article['status']) => {
    // Selalu ambil HTML konten paling mutakhir langsung dari SunEditor instance jika tersedia
    let currentLiveContent = content;
    if (sunEditorRef.current) {
      try {
        const liveContents = sunEditorRef.current.getContents(false);
        if (typeof liveContents === 'string') {
          currentLiveContent = liveContents;
          if (currentLiveContent !== content) {
            setContent(currentLiveContent);
          }
        }
      } catch (e) {
        console.warn('Gagal membaca getContents langsung dari SunEditor instance:', e);
      }
    }

    if (currentLiveContent.includes('data:image/')) {
      alert('Artikel mengandung gambar copy-paste (Base64). Harap hapus dan unggah melalui tombol gambar di editor agar performa situs tetap cepat.');
      return null;
    }

    if (!title.trim()) {
      alert('Judul artikel wajib diisi!');
      return null;
    }

    let finalSlug = slug.trim();
    if (!finalSlug) {
      finalSlug = generateSlug(title);
      setSlug(finalSlug);
    }

    setIsSaving(true);
    const prevStatus = status;
    setStatus(targetStatus);

    const updatedArticle: Article = {
      ...article,
      title,
      slug: finalSlug,
      content: currentLiveContent,
      excerpt: metaDescription, // excerptFallback applied inside useSeoGeoAnalysis theoretically or onSave
      categoryId,
      focusKeyword,
      secondaryKeywords,
      metaTitle,
      metaDescription,
      status: targetStatus,
      seoScore: seoAnalysis.score,
      geoScore: geoAnalysis.score,
      geoOriginalAngle: hasOriginalAngle,
      geoComprehensive: isComprehensive,
      wordCount: seoAnalysis.wordCount,
      readingTimeMinutes: seoAnalysis.readingTime,
      updatedAt: new Date().toISOString(),
      featuredImage,
      featuredImageAlt,
      featuredImageCaption,
      tagIds,
      sessionMediaKeys,
    };

    try {
      await onSave(updatedArticle);
      setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      setShowNotification(
        targetStatus === 'published' ? 'Artikel berhasil dipublikasikan!' : 'Draft berhasil disimpan!'
      );
      setTimeout(() => setShowNotification(null), 3000);
      return updatedArticle;
    } catch (err) {
      setStatus(prevStatus); // revert if failed
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const currentCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className={`h-full flex flex-col transition-colors overflow-hidden bg-white`}>
      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 bg-teal-900 text-white text-sm font-medium rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* Sleek Interface Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 lg:px-8 bg-white shrink-0 z-20">
        {/* Left: Title & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
            title="Kembali ke list artikel"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {title.trim() ? title : 'New Article'}
          </h1>

          {localHasUnsavedChanges ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-medium shrink-0 border border-amber-100/80">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              <span>Belum Disimpan</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full font-medium shrink-0 border border-teal-100/80">
              <CheckCircle2 className="w-3 h-3 text-teal-600" />
              <span>Tersimpan {lastSavedTime}</span>
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => { setActiveSeoTab('checklist'); setIsSeoPanelOpen(true); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${scoreBadge.bg}`}
              title="Skor SEO"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>SEO {seoAnalysis.score}/100</span>
            </button>
            <button
              onClick={() => { setActiveSeoTab('geo'); setIsSeoPanelOpen(true); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${geoScoreBadge.bg}`}
              title="Skor GEO (Generative Engine Optimization)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>GEO {geoAnalysis.score}/100</span>
            </button>
          </div>

          <button
            onClick={() => setIsSeoPanelOpen(!isSeoPanelOpen)}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${isSeoPanelOpen
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            title="Toggle Panel Asisten SEO"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={async () => {
              let artToPreview: Article = {
                ...article,
                title, slug, content, categoryId, focusKeyword, secondaryKeywords,
                metaTitle, metaDescription, status, seoScore: seoAnalysis.score,
                wordCount: seoAnalysis.wordCount, readingTimeMinutes: seoAnalysis.readingTime,
                featuredImage, featuredImageAlt, featuredImageCaption,
              };

              if (localHasUnsavedChanges || article.id.startsWith('art-')) {
                const saved = await triggerSave(status);
                if (saved) {
                  artToPreview = saved;
                } else {
                  return; 
                }
              }
              onPreview(artToPreview);
            }}
            className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            Pratinjau
          </button>

          <button
            id="btn-save-draft"
            disabled={isSaving}
            onClick={() => triggerSave('draft')}
            className="px-3 sm:px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isSaving && status === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Draft</span>
          </button>

          <button
            id="btn-publish-article"
            disabled={isSaving}
            onClick={() => triggerSave('published')}
            className="px-4 sm:px-6 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:bg-teal-800 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
          >
            {isSaving && status === 'published' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin hidden sm:inline" />
            ) : (
              <Send className="w-3.5 h-3.5 hidden sm:inline" />
            )}
            <span>Publikasikan</span>
          </button>
        </div>
      </header>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12 py-8 flex flex-col">
          <div className={`w-full mx-auto flex flex-col flex-1 ${!isSeoPanelOpen ? 'max-w-4xl' : 'max-w-3xl'}`}>
            <FeaturedImageUploader
              imageUrl={featuredImage}
              altText={featuredImageAlt}
              caption={featuredImageCaption}
              focusKeyword={focusKeyword}
              onImageChange={setFeaturedImage}
              onAltTextChange={setFeaturedImageAlt}
              onCaptionChange={setFeaturedImageCaption}
              onRemoveImage={() => {
                setFeaturedImage('');
                setFeaturedImageAlt('');
                setFeaturedImageCaption('');
              }}
              onImageUploaded={addSessionMediaKey}
            />

            <div className="mb-6">
              <input
                id="article-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Write your title here..."
                className="w-full text-3xl sm:text-4xl font-extrabold text-slate-900 border-none outline-none placeholder:text-slate-200 bg-transparent focus:ring-0 leading-tight"
              />

              <div className="flex flex-wrap items-center gap-4 mt-6 border-b border-slate-100 pb-4 text-sm">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="font-medium text-slate-500 bg-transparent border-none outline-none focus:ring-0 cursor-pointer hover:text-teal-600 py-1"
                >
                  {categories.filter(c => !c.parentId && (!c.type || c.type === 'article')).map((parentCat) => {
                    const subCats = categories.filter(c => c.parentId === parentCat.id && (!c.type || c.type === 'article'));
                    return (
                      <optgroup key={parentCat.id} label={parentCat.name}>
                        {categoryId == parentCat.id && (
                          <option value={parentCat.id}>
                            {parentCat.name} ⚠️ (Harap Pindah ke Sub-Kategori)
                          </option>
                        )}
                        {subCats.map((subCat) => (
                          <option key={subCat.id} value={subCat.id}>
                            -- {subCat.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <span>/{slug || 'slug-artikel'}</span>
                  <button onClick={handleAutoSlug} className="p-1 hover:text-teal-600 rounded transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <div className="flex items-center gap-1.5 text-xs">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={focusKeyword}
                    onChange={(e) => setFocusKeyword(e.target.value)}
                    placeholder="Fokus kata kunci..."
                    className="bg-transparent border-none outline-none text-xs text-teal-800 font-medium placeholder:text-slate-300 w-36 focus:ring-0 py-0"
                  />
                  {focusKeyword && (
                    <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold">
                      {seoAnalysis.keywordCount}x
                    </span>
                  )}
                </div>

                <div className="h-4 w-px bg-slate-200" />

                <button
                  type="button"
                  onClick={() => {
                    setIsSeoPanelOpen(true);
                    setActiveSeoTab('links');
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    isSeoPanelOpen && activeSeoTab === 'links'
                      ? 'bg-teal-100 text-teal-800'
                      : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50'
                  }`}
                  title="Buka Pustaka Tautan Internal untuk menyisipkan artikel terkait"
                >
                  <Link2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Pustaka Tautan</span>
                  {detectedInternalLinks.length > 0 && (
                    <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                      {detectedInternalLinks.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[500px] mb-4">
              <div className="flex items-center gap-2 mb-3 px-3.5 py-2.5 bg-sky-50 text-sky-800 rounded-xl text-xs font-semibold border border-sky-100 shadow-sm shadow-sky-100/50">
                <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Tips: Gunakan format WEBP. Batas maksimal ukuran per gambar dalam isi artikel adalah 1MB untuk menjaga halaman tetap cepat dimuat.</span>
              </div>
              {useMemo(() => (
                <SunEditor
                  getSunEditorInstance={(instance) => {
                    sunEditorRef.current = instance;
                  }}
                  defaultValue={article.content}
                  onChange={setContent}
                  onImageUploadBefore={handleImageUploadBefore}
                  setOptions={EDITOR_OPTIONS}
                  onClick={() => {
                    try {
                      const sel = sunEditorRef.current?.getSelection();
                      if (sel && sel.toString().trim()) {
                        lastSelectedTextRef.current = sel.toString().trim();
                      }
                    } catch (e) {}
                  }}
                  onKeyUp={() => {
                    try {
                      const sel = sunEditorRef.current?.getSelection();
                      if (sel && sel.toString().trim()) {
                        lastSelectedTextRef.current = sel.toString().trim();
                      }
                    } catch (e) {}
                  }}
                />
              ), [handleImageUploadBefore, setContent, EDITOR_OPTIONS, article.content])}
            </div>

            <div className="py-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-auto">
              <span>Word Count: {seoAnalysis.wordCount} words (~{seoAnalysis.readingTime} min)</span>
              <span>SEO: {seoAnalysis.score} | GEO: {geoAnalysis.score}</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Analysis Panel */}
        {isSeoPanelOpen && (
          <aside className="w-80 lg:w-88 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
            <AnalysisPanel 
              activeSeoTab={activeSeoTab} setActiveSeoTab={setActiveSeoTab}
              seoAnalysis={seoAnalysis} geoAnalysis={geoAnalysis}
              scoreBadge={scoreBadge} geoScoreBadge={geoScoreBadge}
              hasOriginalAngle={hasOriginalAngle} setHasOriginalAngle={setHasOriginalAngle}
              isComprehensive={isComprehensive} setIsComprehensive={setIsComprehensive}
              serpDevice={serpDevice} setSerpDevice={setSerpDevice}
              title={title} metaTitle={metaTitle} setMetaTitle={setMetaTitle}
              metaDescription={metaDescription} setMetaDescription={setMetaDescription}
              content={content} slug={slug} setSlug={setSlug} currentCategory={currentCategory}
              featuredImage={featuredImage} featuredImageAlt={featuredImageAlt} generateSlug={generateSlug}
              categories={categories} tags={tags} categoryId={categoryId} setCategoryId={setCategoryId}
              tagIds={tagIds} setTagIds={setTagIds} onTagsChange={onTagsChange}
              focusKeyword={focusKeyword} isTrendLoading={isTrendLoading} trendStatus={trendStatus}
              lsiKeywords={lsiKeywords} secondaryKeywords={secondaryKeywords} setSecondaryKeywords={setSecondaryKeywords}
              setHasUnsavedChanges={(val) => {
                if (setHasUnsavedChanges) setHasUnsavedChanges(val);
              }}
              onInsertLink={handleInsertInternalLink}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
