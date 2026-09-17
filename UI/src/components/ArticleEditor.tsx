import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  Sliders,
  Smartphone,
  Monitor,
  Tag,
  RefreshCw,
  Loader2
} from 'lucide-react';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import api from '../utils/api';
import { Article, Category, UserProfile, ArticleStatus, Tag as TagType } from '../types';
import { calculateSEOAnalysis, generateSlug } from '../utils/seoAnalyzer';
import { FeaturedImageUploader } from './FeaturedImageUploader';

interface ArticleEditorProps {
  article: Article;
  categories: Category[];
  tags: TagType[];
  profile: UserProfile;
  onSave: (updatedArticle: Article) => Promise<void>;
  onBack: () => void;
  onPreview: (article: Article) => void;
  onTagsChange: (tags: TagType[]) => void;
  setHasUnsavedChanges?: (hasChanges: boolean) => void;
}

const EDITOR_OPTIONS = {
  height: 'auto',
  minHeight: '400px',
  placeholder: 'Ketik isi artikel di sini...',
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['removeFormat'],
    ['fontColor', 'hiliteColor'],
    ['outdent', 'indent'],
    ['align', 'horizontalRule', 'list', 'table'],
    ['link', 'image', 'video'],
    ['fullScreen', 'showBlocks', 'codeView'],
    ['preview']
  ],
  // Configuration specifically for youtube/video linking
  videoFileInput: false, // Matikan file upload untuk video, biarkan link saja
  youtubeQuery: 'autoplay=0&rel=0'
};

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
  // Form states
  const [title, setTitle] = useState(article.title || '');
  const [slug, setSlug] = useState(article.slug || '');
  const [content, setContent] = useState(article.content || '');
  const [categoryId, setCategoryId] = useState(article.categoryId || categories[0]?.id || '');
  const [focusKeyword, setFocusKeyword] = useState(article.focusKeyword || '');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(article.secondaryKeywords || []);
  const [newSecondaryKeyword, setNewSecondaryKeyword] = useState('');
  const [metaTitle, setMetaTitle] = useState(article.metaTitle || article.title || '');
  const [metaDescription, setMetaDescription] = useState(article.metaDescription || '');
  const [status, setStatus] = useState<ArticleStatus>(article.status || 'draft');
  const [featuredImage, setFeaturedImage] = useState(article.featuredImage || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState(article.featuredImageAlt || '');
  const [featuredImageCaption, setFeaturedImageCaption] = useState(article.featuredImageCaption || '');
  const [tagIds, setTagIds] = useState<string[]>(article.tagIds || []);

  // UI modes
  const [isSeoPanelOpen, setIsSeoPanelOpen] = useState(true);
  const [serpDevice, setSerpDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSeoTab, setActiveSeoTab] = useState<'checklist' | 'serp' | 'keywords'>('checklist');
  const [lastSavedTime, setLastSavedTime] = useState<string>(
    article.updatedAt ? new Date(article.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Live SEO Analysis
  const seoAnalysis = useMemo(() => {
    return calculateSEOAnalysis(
      title,
      content,
      focusKeyword,
      metaTitle,
      metaDescription,
      profile.targetMinWords || 1200,
      featuredImage,
      featuredImageAlt,
      secondaryKeywords
    );
  }, [title, content, focusKeyword, metaTitle, metaDescription, profile.targetMinWords, featuredImage, featuredImageAlt, secondaryKeywords]);

  // Keep slug in sync if untouched or user requests
  const handleAutoSlug = () => {
    setSlug(generateSlug(title));
  };

  // Sync meta title with title if meta title is blank
  useEffect(() => {
    if (!metaTitle && title) {
      setMetaTitle(title.length > 55 ? `${title.slice(0, 55)}...` : title);
    }
  }, [title, metaTitle]);

  const [hasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false);

  // Deteksi perubahan belum disimpan
  useEffect(() => {
    const isChanged = 
      title !== article.title ||
      content !== article.content ||
      slug !== article.slug ||
      categoryId !== (article.categoryId || categories[0]?.id || '') ||
      focusKeyword !== article.focusKeyword ||
      JSON.stringify(secondaryKeywords) !== JSON.stringify(article.secondaryKeywords || []) ||
      metaTitle !== (article.metaTitle || article.title) ||
      metaDescription !== (article.metaDescription || '') ||
      featuredImage !== (article.featuredImage || '') ||
      featuredImageAlt !== (article.featuredImageAlt || '') ||
      featuredImageCaption !== (article.featuredImageCaption || '') ||
      JSON.stringify(tagIds) !== JSON.stringify(article.tagIds || []);

    setLocalHasUnsavedChanges(isChanged);
    if (setHasUnsavedChanges) {
      setHasUnsavedChanges(isChanged);
    }
  }, [
    title, content, slug, categoryId, focusKeyword, secondaryKeywords, 
    metaTitle, metaDescription, featuredImage, featuredImageAlt, 
    featuredImageCaption, tagIds, article, categories, setHasUnsavedChanges
  ]);

  // Handle Before Unload (Refresh/Tutup Tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser behavior
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle image upload via SunEditor
  const handleImageUploadBefore = useCallback((files: any[], info: object, uploadHandler: Function) => {
    const uploadImage = async () => {
      try {
        const formData = new FormData();
        formData.append('file', files[0]);

        const response = await api.post('/media', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        // The API returns { result: [{ url, name, size }] }
        const data = response.data;
        if (data && data.result && data.result.length > 0) {
          const baseUrl = api.defaults.baseURL || 'http://localhost:8787/api';
          const origin = baseUrl.replace(/\/api\/?$/, '');
          data.result[0].url = `${origin}${data.result[0].url}`;

        }

        uploadHandler(data);
      } catch (error) {
        console.error('Failed to upload image:', error);
        // Fallback to error handling, pass error to uploadHandler
        uploadHandler({
          errorMessage: 'Gagal mengunggah gambar. Pastikan format didukung (JPG/PNG/WEBP) dan ukuran max 2MB.'
        });
      }
    };

    uploadImage();

    // Harus mereturn true agar SunEditor tahu kita yang handle proses uploadnya (asynchronous)
    return true;
  }, []);

  const handleAddSecondaryKeyword = () => {
    const trimmed = newSecondaryKeyword.trim();
    if (trimmed && !secondaryKeywords.includes(trimmed)) {
      setSecondaryKeywords([...secondaryKeywords, trimmed]);
      setNewSecondaryKeyword('');
    }
  };

  const handleRemoveSecondaryKeyword = (kwToRemove: string) => {
    setSecondaryKeywords(secondaryKeywords.filter((kw) => kw !== kwToRemove));
  };

  const excerptFallback = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  const triggerSave = async (targetStatus: ArticleStatus = status): Promise<Article | null> => {
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
      content,
      excerpt: metaDescription || excerptFallback(content),
      categoryId,
      focusKeyword,
      secondaryKeywords,
      metaTitle,
      metaDescription,
      status: targetStatus,
      seoScore: seoAnalysis.score,
      wordCount: seoAnalysis.wordCount,
      readingTimeMinutes: seoAnalysis.readingTime,
      updatedAt: new Date().toISOString(),
      featuredImage,
      featuredImageAlt,
      featuredImageCaption,
      tagIds,
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

  // Score color helper
  const getScoreBadge = (score: number) => {
    if (score >= 85) return { bg: 'bg-teal-50 text-teal-800 border-teal-200', label: 'Optimal' };
    if (score >= 70) return { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Cukup' };
    return { bg: 'bg-amber-50 text-amber-800 border-amber-200', label: 'Perlu Ditingkatkan' };
  };

  const scoreBadge = getScoreBadge(seoAnalysis.score);

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

          {hasUnsavedChanges ? (
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
          {/* SEO Score Pill */}
          <button
            onClick={() => setIsSeoPanelOpen(!isSeoPanelOpen)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${scoreBadge.bg}`}
            title="Buka / Tutup Panel SEO"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>SEO {seoAnalysis.score}/100</span>
          </button>

          {/* SEO Panel Toggle Button */}
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

          {/* Preview Button */}
          <button
            onClick={async () => {
              let artToPreview: Article = {
                ...article,
                title,
                slug,
                content,
                categoryId,
                focusKeyword,
                secondaryKeywords,
                metaTitle,
                metaDescription,
                status,
                seoScore: seoAnalysis.score,
                wordCount: seoAnalysis.wordCount,
                readingTimeMinutes: seoAnalysis.readingTime,
                featuredImage,
                featuredImageAlt,
                featuredImageCaption,
              };

              if (hasUnsavedChanges || article.id.startsWith('art-')) {
                const saved = await triggerSave(status);
                if (saved) {
                  artToPreview = saved;
                } else {
                  return; // If save failed (e.g. no title), don't proceed to preview
                }
              }
              onPreview(artToPreview);
            }}
            className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            title="Pratinjau tampilan artikel"
          >
            Pratinjau
          </button>

          {/* Save Draft */}
          <button
            id="btn-save-draft"
            disabled={isSaving}
            onClick={() => triggerSave('draft')}
            className="px-3 sm:px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isSaving && status === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Draft</span>
          </button>

          {/* Publish Article Button (Sleek Theme Signature) */}
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

      {/* Editor Body: Canvas & Right SEO Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Distraction-free Writing Canvas */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-12 py-8 flex flex-col">
          <div className={`w-full mx-auto flex flex-col flex-1 ${!isSeoPanelOpen ? 'max-w-4xl' : 'max-w-3xl'}`}>
            {/* Featured Cover Image Uploader */}
            <FeaturedImageUploader
              imageUrl={featuredImage}
              altText={featuredImageAlt}
              caption={featuredImageCaption}
              focusKeyword={focusKeyword}
              onImageChange={(url) => setFeaturedImage(url)}
              onAltTextChange={(alt) => setFeaturedImageAlt(alt)}
              onCaptionChange={(cap) => setFeaturedImageCaption(cap)}
              onRemoveImage={() => {
                setFeaturedImage('');
                setFeaturedImageAlt('');
                setFeaturedImageCaption('');
              }}
            />

            {/* Title & Metadata Row */}
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
                {/* Category Select */}
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="font-medium text-slate-500 bg-transparent border-none outline-none focus:ring-0 cursor-pointer hover:text-teal-600 py-1"
                >
                  {categories.filter(c => !c.parentId).map((parentCat) => (
                    <optgroup key={parentCat.id} label={parentCat.name}>
                      <option value={parentCat.id}>{parentCat.name} (Umum)</option>
                      {categories.filter(c => c.parentId === parentCat.id).map((subCat) => (
                        <option key={subCat.id} value={subCat.id}>
                          -- {subCat.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div className="h-4 w-px bg-slate-200" />

                {/* Slug display and refresh */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <span>/{slug || 'slug-artikel'}</span>
                  <button
                    onClick={handleAutoSlug}
                    title="Perbarui slug otomatis"
                    className="p-1 hover:text-teal-600 rounded transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-200" />

                {/* Focus Keyword in title bar */}
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
              </div>
            </div>

            {/* SunEditor Container */}
            <div className="flex-1 flex flex-col min-h-[500px] mb-4">
              {useMemo(() => (
                <SunEditor
                  defaultValue={article.content}
                  onChange={setContent}
                  onImageUploadBefore={handleImageUploadBefore}
                  setOptions={EDITOR_OPTIONS}
                />
              ), [article.content, handleImageUploadBefore])}
            </div>

            {/* Sleek Bottom Bar with Word Count and SEO Score */}
            <div className="py-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-auto">
              <span>Word Count: {seoAnalysis.wordCount} words (~{seoAnalysis.readingTime} min)</span>
              <span>SEO Score: {seoAnalysis.score}/100</span>
            </div>
          </div>
        </div>

        {/* Sleek Right SEO Sidebar */}
        {isSeoPanelOpen && (
          <aside className="w-80 lg:w-88 border-l border-slate-100 bg-slate-50/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
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
                Google SERP
              </button>
              <button
                onClick={() => setActiveSeoTab('keywords')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeSeoTab === 'keywords'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Keywords & Silo
              </button>
            </div>

            {/* Tab 1: SEO Checklist & Audit */}
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
                    SEO Checklist ({seoAnalysis.checks.filter((c) => c.status === 'good').length}/{seoAnalysis.checks.length})
                  </h3>
                  <div className="space-y-2.5">
                    {seoAnalysis.checks.map((check) => (
                      <div
                        key={check.id}
                        className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-start gap-2.5"
                      >
                        {check.status === 'good' && (
                          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        )}
                        {check.status === 'warning' && (
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        {check.status === 'bad' && (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        )}
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

            {/* Tab 2: Google SERP Preview */}
            {activeSeoTab === 'serp' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Google SERP Preview
                    </h3>
                    <div className="flex items-center space-x-1 bg-slate-200/70 p-0.5 rounded-lg">
                      <button
                        onClick={() => setSerpDevice('desktop')}
                        className={`p-1 rounded-md text-xs ${serpDevice === 'desktop' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-500'
                          }`}
                        title="Desktop"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                      <button
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

                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Meta Tags & URL
                  </h3>

                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label className="font-bold text-slate-700">Meta Title Tag</label>
                        <span className={`text-[10px] font-bold ${(metaTitle || title).length >= 45 && (metaTitle || title).length <= 60 ? 'text-teal-600' : 'text-slate-400'
                          }`}>
                          {(metaTitle || title).length}/60
                        </span>
                      </div>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder={title || 'Judul hasil pencarian...'}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 focus:bg-white placeholder:text-slate-300"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label className="font-bold text-slate-700">Meta Description</label>
                        <span className={`text-[10px] font-bold ${(metaDescription || excerptFallback(content)).length >= 120 && (metaDescription || excerptFallback(content)).length <= 160 ? 'text-teal-600' : 'text-slate-400'
                          }`}>
                          {(metaDescription || excerptFallback(content)).length}/160
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        placeholder={excerptFallback(content) || 'Ringkasan 120-160 karakter...'}
                        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 focus:bg-white resize-none placeholder:text-slate-300"
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
              </div>
            )}

            {/* Tab 3: Keywords & Silo */}
            {activeSeoTab === 'keywords' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Category Pillar
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Kategori Terpilih</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 font-medium text-slate-800"
                    >
                      {categories.filter(c => !c.parentId).map((parentCat) => (
                        <optgroup key={parentCat.id} label={parentCat.name}>
                          <option value={parentCat.id}>
                            {parentCat.name} (Utama - {parentCat.targetKeywords.length} pilar KW)
                          </option>
                          {categories.filter(c => c.parentId === parentCat.id).map((subCat) => (
                            <option key={subCat.id} value={subCat.id}>
                              -- {subCat.name} ({subCat.targetKeywords.length} pilar KW)
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {currentCategory && (
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {currentCategory.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tags Management */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                    Tags Artikel
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {tags.map((t) => {
                        const isSelected = tagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              if (isSelected) {
                                setTagIds(tagIds.filter(id => id !== t.id));
                              } else {
                                setTagIds([...tagIds, t.id]);
                              }
                            }}
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer ${isSelected
                                ? 'bg-teal-50 border-teal-200 text-teal-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ketik lalu Enter untuk tag baru..."
                        className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              const newSlug = generateSlug(val);
                              
                              // 1. Cek apakah tag sudah ada di state lokal (menghindari API call tidak perlu)
                              const existingLocal = tags.find(t => t.slug === newSlug || t.name.toLowerCase() === val.toLowerCase());
                              if (existingLocal) {
                                if (!tagIds.includes(existingLocal.id)) {
                                  setTagIds([...tagIds, existingLocal.id]);
                                }
                                e.currentTarget.value = '';
                                return;
                              }

                              // 2. Jika tidak ada di lokal (mungkin baru, atau di atas limit 100), panggil API
                              // API sekarang memiliki behavior Get-or-Create sehingga tidak akan melempar 400 jika slug sudah ada.
                              try {
                                const res = await api.post('/tags', { name: val, slug: newSlug });
                                const newTag = { id: res.data.id, name: val, slug: newSlug };
                                onTagsChange([...tags, newTag]);
                                setTagIds([...tagIds, newTag.id]);
                                e.currentTarget.value = '';
                              } catch (err: any) {
                                alert(err.response?.data?.message || 'Gagal menambahkan tag baru');
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                    LSI Keywords ({secondaryKeywords.length})
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSecondaryKeyword}
                        onChange={(e) => setNewSecondaryKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSecondaryKeyword();
                          }
                        }}
                        placeholder="Tambah LSI keyword..."
                        className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddSecondaryKeyword}
                        className="px-3 py-1.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg text-xs font-medium hover:bg-teal-100 cursor-pointer"
                      >
                        Tambah
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {secondaryKeywords.map((kw) => {
                        const occurences = countOccurrences(content, kw);
                        return (
                          <span
                            key={kw}
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${occurences > 0
                                ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                          >
                            <span>{kw}</span>
                            <span
                              className={`text-[10px] font-bold px-1 rounded ${occurences > 0 ? 'bg-teal-200 text-teal-900' : 'bg-slate-200 text-slate-500'
                                }`}
                            >
                              {occurences}x
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSecondaryKeyword(kw)}
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
          </aside>
        )}
      </div>
    </div>
  );
};

// Helper: Count string occurrences (Strip HTML first)
function countOccurrences(text: string, phrase: string): number {
  if (!phrase || !text) return 0;
  const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ');
  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');
  const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = cleanText.match(new RegExp(`\\b${escaped}\\b`, 'gi'));
  return matches ? matches.length : 0;
}

// Helper: Excerpt fallback (Strip HTML first)
function excerptFallback(content: string): string {
  if (!content) return '';
  const clean = content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 150);
}
