import React from 'react';
import { X, Clock, Calendar, FolderOpen, Tag, Sparkles, User, ArrowLeft } from 'lucide-react';
import { Article, Category, UserProfile } from '../types';

interface ArticlePreviewModalProps {
  article: Article | null;
  categories: Category[];
  profile: UserProfile;
  onClose: () => void;
  onEdit: (article: Article) => void;
}

export const ArticlePreviewModal: React.FC<ArticlePreviewModalProps> = ({
  article,
  categories,
  profile,
  onClose,
  onEdit,
}) => {
  if (!article) return null;

  const category = categories.find((c) => c.id === article.categoryId);


  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Mode Pratinjau Pembaca
            </span>
            <span className="text-xs text-slate-500 font-mono">/{article.slug}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onEdit(article);
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-medium transition-colors"
            >
              Buka di Editor
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Tutup pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Reader Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-6">
          {/* Category & Date Header */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {category && (
              <span className="flex items-center space-x-1 px-3 py-1 rounded-full bg-teal-50 text-teal-800 font-semibold border border-teal-200">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{category.name}</span>
              </span>
            )}
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{article.readingTimeMinutes} menit baca</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <time dateTime={article.updatedAt || article.createdAt} className="text-gray-500">
                {new Date(article.updatedAt || article.createdAt).toLocaleDateString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })} WIB
              </time>
            </span>
          </div>

          {/* Article Title */}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Focus Keyword Pill */}
          {article.focusKeyword && (
            <div className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
              <Sparkles className="w-3 h-3 text-teal-600" />
              <span>
                Fokus Keyword: <strong>{article.focusKeyword}</strong>
              </span>
            </div>
          )}

          {/* Excerpt / Lead */}
          {article.excerpt && (
            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed border-l-2 border-teal-500 pl-4 italic">
              {article.excerpt}
            </p>
          )}

          {/* Featured Cover Image in Reader Preview */}
          {article.featuredImage && (
            <figure className="my-6 space-y-2">
              <div className="overflow-hidden rounded-2xl bg-slate-100 border border-slate-100 shadow-sm max-h-[440px] flex items-center justify-center">
                <img
                  src={article.featuredImage}
                  alt={article.featuredImageAlt || article.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover max-h-[440px]"
                />
              </div>
              {(article.featuredImageCaption || article.featuredImageAlt) && (
                <figcaption className="text-center text-xs text-slate-400 italic">
                  {article.featuredImageCaption || article.featuredImageAlt}
                </figcaption>
              )}
            </figure>
          )}

          <hr className="border-slate-100" />

          {/* Body */}
          <div 
            className="sun-editor-editable !bg-transparent !p-0 !text-slate-800"
            dangerouslySetInnerHTML={{ __html: article.content }} 
          />

          {/* Author Box at Bottom (E-E-A-T) */}
          <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5">
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover ring-2 ring-teal-500/20"
            />
            <div className="text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <p className="text-sm font-bold text-slate-900">{profile.name}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                  Penulis Terverifikasi
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{profile.role}</p>
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{profile.bio}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
