import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  FileText, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Edit3,
  X
} from 'lucide-react';
import api from '../../../utils/api';
import { useToast } from '../../../context/ToastContext';
import { Category } from '../../../types';

export interface PublishedPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  category_name?: string;
  category_slug?: string;
  category_id?: string;
  published_at?: string;
  reading_time_minutes?: number;
}

export interface DetectedInternalLink {
  href: string;
  text: string;
}

interface InternalLinkHelperProps {
  content: string;
  currentSlug: string;
  categories: Category[];
  onInsertLink: (title: string, slug: string, customAnchor?: string) => void;
}

/**
 * Ekstraksi tautan internal dari HTML artikel untuk mendeteksi link yang sudah terpasang
 */
export function extractInternalLinks(htmlContent: string): DetectedInternalLink[] {
  if (!htmlContent) return [];
  const links: DetectedInternalLink[] = [];
  const regex = /<a\s+[^>]*?href=["']((?:\/|https?:\/\/(?:www\.)?asisten-guru\.id)[^"']*)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(htmlContent)) !== null) {
    const href = match[1];
    const rawText = match[2].replace(/<[^>]+>/g, '').trim();
    links.push({
      href,
      text: rawText || href,
    });
  }
  return links;
}

export const InternalLinkHelper: React.FC<InternalLinkHelperProps> = ({
  content,
  currentSlug,
  categories,
  onInsertLink,
}) => {
  const { success, error, info } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [posts, setPosts] = useState<PublishedPostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Clipboard copy feedback state
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Custom anchor text state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [customAnchorInput, setCustomAnchorInput] = useState('');

  // Expand existing links list toggle
  const [isExistingLinksOpen, setIsExistingLinksOpen] = useState(false);

  // 1. Debounce search query 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 2. Fetch published posts
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const params: Record<string, any> = {
        limit: 15,
      };
      if (debouncedQuery) {
        params.q = debouncedQuery;
      }
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }

      const response = await api.get('/posts', { params });
      if (response.data && Array.isArray(response.data.data)) {
        setPosts(response.data.data);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Failed to load internal posts for linking:', err);
      setHasError(true);
      // Pesan ramah pengguna sesuai Rule #7
      error('Gagal memuat daftar artikel publik. Silakan periksa koneksi Anda.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, selectedCategory, error]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 3. Analisis tautan internal yang sudah ada di konten saat ini
  const detectedLinks = useMemo(() => extractInternalLinks(content), [content]);
  const internalCount = detectedLinks.length;

  const linkedSlugs = useMemo(() => {
    const set = new Set<string>();
    detectedLinks.forEach((link) => {
      // Ekstraksi slug dari /blog/:slug atau /:slug
      const match = link.href.match(/(?:\/blog\/|asisten-guru\.id\/blog\/)([a-z0-9-]+)/i);
      if (match && match[1]) {
        set.add(match[1].toLowerCase());
      }
    });
    return set;
  }, [detectedLinks]);

  // 4. Clipboard copy handlers
  const handleCopyPath = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const path = `/blog/${slug}`;
    navigator.clipboard.writeText(path);
    setCopiedType(`path-${slug}`);
    info(`Path tautan disalin: ${path}`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyMarkdown = (title: string, slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = `[${title}](/blog/${slug})`;
    navigator.clipboard.writeText(md);
    setCopiedType(`md-${slug}`);
    info('Format Markdown tautan disalin ke clipboard');
    setTimeout(() => setCopiedType(null), 2000);
  };

  // 5. Insert Handler
  const handleTriggerInsert = (post: PublishedPostItem, customAnchor?: string) => {
    onInsertLink(post.title, post.slug, customAnchor);
    setEditingPostId(null);
    setCustomAnchorInput('');
  };

  return (
    <div className="space-y-5">
      {/* 1. Header & Metric Card */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Pustaka Tautan Internal</span>
          </h3>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              internalCount >= 2
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : internalCount === 1
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {internalCount >= 2 ? 'Optimal (>=2)' : `${internalCount}/2 Tautan`}
          </span>
        </div>

        {/* Status Box */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Distribusi Link Equity</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {internalCount >= 2
                  ? 'Sinyal SEO kuat: terdapat 2 atau lebih tautan internal.'
                  : internalCount === 1
                  ? 'Disarankan menambah 1 tautan internal lagi.'
                  : 'Belum ada tautan ke artikel internal lain di artikel ini.'}
              </p>
            </div>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                internalCount >= 2
                  ? 'bg-teal-50 text-teal-700 border border-teal-300'
                  : internalCount === 1
                  ? 'bg-amber-50 text-amber-700 border border-amber-300'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {internalCount}
            </div>
          </div>

          {/* Accordion tautan yang sudah terpasang */}
          {detectedLinks.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExistingLinksOpen(!isExistingLinksOpen)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-teal-700 cursor-pointer"
              >
                <span>Lihat Tautan Terpasang ({detectedLinks.length})</span>
                {isExistingLinksOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isExistingLinksOpen && (
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {detectedLinks.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 text-[10px]"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-700 truncate">"{item.text}"</p>
                        <p className="text-slate-400 font-mono truncate">{item.href}</p>
                      </div>
                      <span className="shrink-0 text-[9px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari artikel internal (judul / topik)..."
            className="w-full text-xs pl-8.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Kategori Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {debouncedQuery || selectedCategory ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
              }}
              className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold shrink-0 cursor-pointer"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. Hasil Pencarian / Daftar Artikel */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-0.5">
          <span>Rekomendasi Artikel</span>
          {!isLoading && <span>{posts.length} artikel</span>}
        </div>

        {isLoading ? (
          <div className="bg-white p-6 rounded-xl border border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <p className="text-xs">Mencari artikel publik...</p>
          </div>
        ) : hasError ? (
          <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-100 flex items-start gap-2.5 text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">Gagal memuat artikel</p>
              <p className="text-[11px] text-rose-600 mt-0.5">Silakan periksa koneksi lalu coba kembali.</p>
              <button
                type="button"
                onClick={fetchPosts}
                className="mt-2 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-100 text-center text-slate-400 space-y-1">
            <BookOpen className="w-6 h-6 mx-auto text-slate-300 mb-1" />
            <p className="text-xs font-semibold text-slate-700">Tidak ada artikel ditemukan</p>
            <p className="text-[11px] text-slate-400">Coba gunakan kata kunci pencarian yang lebih umum.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {posts.map((post) => {
              const isCurrent = post.slug === currentSlug;
              const isAlreadyLinked = linkedSlugs.has(post.slug.toLowerCase());
              const isEditingAnchor = editingPostId === post.id;

              return (
                <div
                  key={post.id}
                  className={`bg-white p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-slate-200 bg-slate-50/60 opacity-80'
                      : isAlreadyLinked
                      ? 'border-teal-200 bg-teal-50/20'
                      : 'border-slate-100 hover:border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Judul & Meta info */}
                  <div className="space-y-1 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                        {post.title}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {post.category_name && (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {post.category_name}
                        </span>
                      )}
                      {isCurrent ? (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          Artikel Saat Ini
                        </span>
                      ) : isAlreadyLinked ? (
                        <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Terhubung
                        </span>
                      ) : null}
                      <span className="text-slate-400 font-mono text-[9px] truncate max-w-[140px]">
                        /blog/{post.slug}
                      </span>
                    </div>
                  </div>

                  {/* Form Custom Anchor (jika aktif) */}
                  {isEditingAnchor && (
                    <div className="mb-2.5 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-600 block">
                        Teks Jangkar (Anchor Text):
                      </label>
                      <input
                        type="text"
                        value={customAnchorInput}
                        onChange={(e) => setCustomAnchorInput(e.target.value)}
                        placeholder={`Default: "${post.title.slice(0, 30)}..."`}
                        className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-teal-500"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(null);
                            setCustomAnchorInput('');
                          }}
                          className="px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTriggerInsert(post, customAnchorInput.trim() || undefined)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors cursor-pointer"
                        >
                          Sisipkan Sekarang
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-50">
                    {/* Primary Insert Button */}
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => handleTriggerInsert(post)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : isAlreadyLinked
                          ? 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                          : 'bg-teal-600 text-white hover:bg-teal-700 shadow-xs'
                      }`}
                      title={
                        isCurrent
                          ? 'Tidak disarankan menautkan artikel ke dirinya sendiri'
                          : 'Sisipkan link ke kursor atau teks yang sedang diseleksi di editor'
                      }
                    >
                      <Link2 className="w-3 h-3" />
                      <span>{isAlreadyLinked ? 'Sisipkan Lagi' : 'Sisipkan'}</span>
                    </button>

                    {/* Toggle Edit Anchor Text */}
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingAnchor) {
                            setEditingPostId(null);
                          } else {
                            setEditingPostId(post.id);
                            setCustomAnchorInput('');
                          }
                        }}
                        className={`p-1.5 rounded-lg border text-slate-500 transition-colors cursor-pointer ${
                          isEditingAnchor
                            ? 'bg-teal-50 border-teal-300 text-teal-700'
                            : 'border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                        title="Sesuaikan teks jangkar (anchor text) sebelum menyisipkan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Copy Relative Path */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyPath(post.slug, e)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Salin path relatif: /blog/slug"
                    >
                      {copiedType === `path-${post.slug}` ? (
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* External Link */}
                    <a
                      href={`https://asisten-guru.id/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-teal-700 hover:bg-slate-50 transition-colors"
                      title="Buka artikel live di tab baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
