import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Tag,
  FolderPlus,
  Lightbulb,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Category } from '../types';
import { generateSlug } from '../utils/seoAnalyzer';
import { handleApiError } from '../utils/api';

interface CategorySettingsProps {
  categories: Category[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onAddCategory: (category: Category) => Promise<void>;
  onUpdateCategory: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onFilterCategoryArticles?: (categoryId: string) => void;
}

export const CategorySettings: React.FC<CategorySettingsProps> = ({
  categories,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onFilterCategoryArticles,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [color, setColor] = useState('#0d9488');
  const [parentId, setParentId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingCategoryId(null);
    setName('');
    setSlug('');
    setDescription('');
    setKeywordsText('');
    setColor('#0d9488');
    setParentId('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description);
    setKeywordsText(cat.targetKeywords.join(', '));
    setColor(cat.color || '#0d9488');
    setParentId(cat.parentId || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!editingCategoryId || !slug) {
      setSlug(generateSlug(newName));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama kategori tidak boleh kosong.');
      return;
    }

    const targetKeywords = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      if (editingCategoryId) {
        const existing = categories.find((c) => c.id === editingCategoryId);
        if (existing) {
          await onUpdateCategory({
            ...existing,
            name: name.trim(),
            slug: slug.trim() || generateSlug(name),
            description: description.trim(),
            targetKeywords,
            color,
            parentId: parentId || undefined,
            parentName: parentId ? categories.find(c => c.id === parentId)?.name : undefined,
          });
          setSuccessMessage('Kategori berhasil diperbarui!');
        }
      } else {
        const newCategory: Category = {
          id: `cat-${Date.now()}`,
          name: name.trim(),
          slug: slug.trim() || generateSlug(name),
          description: description.trim(),
          targetKeywords,
          color,
          parentId: parentId || undefined,
          parentName: parentId ? categories.find(c => c.id === parentId)?.name : undefined,
          articleCount: 0,
        };
        await onAddCategory(newCategory);
        setSuccessMessage('Kategori baru berhasil ditambahkan!');
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 bg-teal-900 text-white text-sm font-medium rounded-xl shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Kategori</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola topik pilar dan struktur hierarki SEO (Topic Cluster) untuk memaksimalkan otoritas situs.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kategori Baru</span>
        </button>
      </div>

      {/* SEO Silo Info Card */}
      <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-teal-600/20">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-teal-950">Prinsip SEO Silo & Topic Clusters</h3>
          <p className="text-xs text-teal-900/85 leading-relaxed">
            Kategori bertindak sebagai halaman pilar (*pillar page*). Mengelompokkan artikel ke dalam kategori yang jelas dengan target kata kunci terfokus membantu Google memahami keahlian tematik (*topical authority*) situs Anda.
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs hover:shadow-md hover:border-teal-200 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Category Title & Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#0d9488' }}
                  />
                  <h2 className="text-base font-bold text-slate-800">{cat.name}</h2>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {cat.articleCount || 0} artikel
                </span>
              </div>
              
              {cat.parentName && (
                <div className="flex items-center text-[10px] text-teal-700 bg-teal-50/80 border border-teal-100 px-2 py-0.5 rounded-md w-fit">
                  <Layers className="w-3 h-3 mr-1" />
                  Sub-kategori dari: {cat.parentName}
                </div>
              )}

              {/* Slug */}
              <div className="text-xs font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                /{cat.slug}
              </div>

              {/* Description */}
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {cat.description || 'Tidak ada deskripsi kategori.'}
              </p>

              {/* Target Keywords / LSI */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Kata Kunci Pilar:
                </p>
                <div className="flex flex-wrap gap-1">
                  {cat.targetKeywords.length > 0 ? (
                    cat.targetKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-100 font-medium"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Belum ada target kata kunci</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Silo Kluster SEO</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEditModal(cat)}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Kategori"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`)) {
                      try {
                        await onDeleteCategory(cat.id);
                      } catch (err: any) {
                        alert(handleApiError(err));
                      }
                    }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Kategori"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && onLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-xs hover:bg-slate-50 hover:border-teal-200 hover:text-teal-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memuat...
              </>
            ) : (
              'Muat Lebih Banyak Kategori'
            )}
          </button>
        </div>
      )}

      {/* Modal Add / Edit Category */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">
                  {editingCategoryId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Kategori</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="contoh: Teknologi & Artificial Intelligence"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Slug URL (Permalink)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="teknologi-ai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Target Kata Kunci Pilar (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="contoh: tools ai gratis, prompt engineering indonesia, tutorial ai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Kategori Induk (Opsional)
                </label>
                {(() => {
                  const hasChildren = editingCategoryId ? categories.some(c => c.parentId === editingCategoryId) : false;
                  return (
                    <>
                      <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        disabled={hasChildren}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Tidak Ada (Jadikan Kategori Pilar)</option>
                        {categories.filter(c => !c.parentId && c.id !== editingCategoryId).map(parentCat => (
                          <option key={parentCat.id} value={parentCat.id}>{parentCat.name}</option>
                        ))}
                      </select>
                      {hasChildren && (
                        <p className="text-[10px] text-amber-600 mt-1 font-medium">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          Kategori ini memiliki sub-kategori, sehingga tidak bisa dijadikan sub-kategori dari kategori lain.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Warna Kategori (Badge)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-0.5 bg-slate-50 border border-slate-200/80 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-500 uppercase">{color}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Deskripsi Kategori (Meta Description Arsip)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan cakupan topik kategori ini untuk membantu mesin pencari..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200/80 rounded-xl text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
