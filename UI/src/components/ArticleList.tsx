import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  PenSquare,
  Eye,
  Trash2,
  Copy,
  Sparkles,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  Calendar,
  BarChart3,
  Image as ImageIcon
} from 'lucide-react';
import { Article, Category, ArticleStatus, UserProfile, ArticleStats } from '../types';
import { useEffect } from 'react';

interface ArticleListProps {
  articles: Article[];
  categories: Category[];
  profile: UserProfile;
  stats: ArticleStats;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onFilterChange: (filters: { search: string; categoryId: string; status: string; sort: string }) => void;
  onSelectArticle: (article: Article) => void;
  onNewArticle: () => void;
  onDeleteArticle: (id: string) => void;
  onDuplicateArticle: (article: Article) => void;
  onPreviewArticle: (article: Article) => void;
}

export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  categories,
  profile,
  stats,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onFilterChange,
  onSelectArticle,
  onNewArticle,
  onDeleteArticle,
  onDuplicateArticle,
  onPreviewArticle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'score' | 'words'>('newest');

    useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFilterChange({
        search: searchQuery,
        categoryId: selectedCategory,
        status: selectedStatus,
        sort: sortBy
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, selectedStatus, sortBy]);

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || 'Umum';
  };

  const getStatusBadge = (status: ArticleStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Terbit</span>
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Perlu Review</span>
          </span>
        );
      case 'revision':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Revisi</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            List Artikel yang Pernah Dibuat
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola, edit, dan pantau performa skor SEO seluruh konten yang telah Anda tulis.
          </p>
        </div>

        <button
          onClick={onNewArticle}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Artikel Baru</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Artikel</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalArticles}</p>
            <p className="text-[11px] text-teal-600 font-medium">{stats.publishedCount} Terpublikasi</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rata-rata Skor SEO</p>
            <p className="text-2xl font-bold text-slate-800">{stats.avgScore}/100</p>
            <p className="text-[11px] text-teal-600 font-medium">Kondisi Sangat Optimal</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Kata Ditulis</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalWords.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-teal-600 font-medium">~{Math.round(stats.totalWords / Math.max(1, stats.totalArticles))} kata/artikel</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Draf / Menunggu</p>
            <p className="text-2xl font-bold text-slate-800">{stats.draftCount}</p>
            <p className="text-[11px] text-slate-400 font-medium">Dalam Pengerjaan</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, kata kunci utama, atau konten..."
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-600 font-medium focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-600 font-medium focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="published">Terbit</option>
              <option value="review">Perlu Review</option>
              <option value="draft">Draft</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-2 text-slate-600 font-medium focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="newest">Terbaru Diperbarui</option>
              <option value="oldest">Terlama</option>
              <option value="score">Skor SEO Tertinggi</option>
              <option value="words">Jumlah Kata Terbanyak</option>
            </select>
          </div>
        </div>
      </div>

      {/* Articles List / Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {articles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-700">Tidak ada artikel ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Cobalah ubah kata kunci pencarian atau buat artikel baru untuk memulai penulisan.
            </p>
            <button
              onClick={onNewArticle}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Mulai Tulis Artikel</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((article) => (
              <div
                key={article.id}
                className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Thumbnail + Article Info */}
                <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
                  {/* Featured Image Thumbnail */}
                  <div
                    onClick={() => onSelectArticle(article)}
                    className="relative w-full sm:w-32 md:w-36 h-36 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100 cursor-pointer group"
                  >
                    {article.featuredImage ? (
                      <img
                        src={article.featuredImage}
                        alt={article.featuredImageAlt || article.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-1 p-2 text-center">
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-medium">Tanpa Sampul</span>
                      </div>
                    )}
                  </div>

                  {/* Article Info */}
                  <div className="space-y-2 flex-1 min-w-0 pr-0 sm:pr-4">
                    {/* Category, Status & Keyword pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-100">
                        {getCategoryName(article.categoryId)}
                      </span>
                      {getStatusBadge(article.status)}
                      {article.focusKeyword && (
                        <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md font-mono">
                          Target KW: <strong className="text-slate-700">{article.focusKeyword}</strong>
                        </span>
                      )}
                      {profile.role === 'super_admin' && article.authorName && (
                        <span className="px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100 text-[11px]">
                          Oleh: {article.authorName}
                        </span>
                      )}
                    </div>

                    {/* Title & Excerpt */}
                    <div>
                      <h3
                        onClick={() => onSelectArticle(article)}
                        className="text-base sm:text-lg font-bold text-slate-800 hover:text-teal-600 cursor-pointer transition-colors leading-snug line-clamp-2"
                      >
                        {article.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {article.excerpt || article.content.slice(0, 150)}...
                      </p>
                    </div>

                    {/* Meta footer: Words, read time, date */}
                    <div className="flex flex-wrap items-center space-x-4 text-xs text-slate-400 pt-1">
                      <span className="flex items-center space-x-1 text-slate-500">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{article.wordCount} kata</span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>~{article.readingTimeMinutes} mnt baca</span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Diperbarui{' '}
                          {new Date(article.updatedAt).toLocaleDateString('id-ID', {
                            timeZone: 'Asia/Jakarta',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })} WIB
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: SEO Score & Quick Actions */}
                <div className="flex items-center justify-between lg:justify-end space-x-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {/* SEO Score Badge */}
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        article.seoScore >= 85
                          ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
                          : article.seoScore >= 70
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {article.seoScore}
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Skor SEO</p>
                      <p className="text-xs font-semibold text-slate-800">
                        {article.seoScore >= 85
                          ? 'Optimal'
                          : article.seoScore >= 70
                          ? 'Cukup'
                          : 'Perlu Revisi'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectArticle(article)}
                      className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      title="Edit artikel di Editor"
                    >
                      <PenSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPreviewArticle(article)}
                      className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      title="Pratinjau tampilan artikel"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDuplicateArticle(article)}
                      className="p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      title="Duplikasi artikel"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteArticle(article.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Hapus artikel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="p-6 text-center border-t border-slate-100">
                <button
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
