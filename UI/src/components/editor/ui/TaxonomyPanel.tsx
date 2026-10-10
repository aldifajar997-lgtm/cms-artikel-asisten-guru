import React from 'react';
import { Category, Tag as TagType } from '../../../types';
import api from '../../../utils/api';
import { useToast } from '../../../context/ToastContext';

interface TaxonomyPanelProps {
  categories: Category[];
  tags: TagType[];
  categoryId: string;
  setCategoryId: (id: string) => void;
  tagIds: string[];
  setTagIds: (ids: string[]) => void;
  generateSlug: (text: string) => string;
  onTagsChange: (newTags: TagType[]) => void;
}

export const TaxonomyPanel: React.FC<TaxonomyPanelProps> = ({
  categories,
  tags,
  categoryId,
  setCategoryId,
  tagIds,
  setTagIds,
  generateSlug,
  onTagsChange
}) => {
  const { error: showError } = useToast();
  const currentCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="space-y-6">
      {/* Category Selection */}
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
            {categories.filter(c => !c.parentId && (!c.type || c.type === 'article')).map((parentCat) => {
              const subCats = categories.filter(c => c.parentId === parentCat.id && (!c.type || c.type === 'article'));
              return (
                <optgroup key={parentCat.id} label={parentCat.name}>
                  {categoryId == parentCat.id && (
                    <option value={parentCat.id} className="text-rose-600 font-bold">
                      {parentCat.name} ⚠️ (Harap Pindah ke Sub-Kategori)
                    </option>
                  )}
                  {subCats.map((subCat) => (
                    <option key={subCat.id} value={subCat.id}>
                      -- {subCat.name} ({subCat.targetKeywords.length} pilar KW)
                    </option>
                  ))}
                </optgroup>
              );
            })}
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
                  const target = e.currentTarget;
                  const val = target.value.trim();
                  if (val) {
                    const newSlug = generateSlug(val);
                    const existingLocal = tags.find(t => t.slug === newSlug || t.name.toLowerCase() === val.toLowerCase());
                    if (existingLocal) {
                      if (!tagIds.includes(existingLocal.id)) {
                        setTagIds([...tagIds, existingLocal.id]);
                      }
                      target.value = '';
                      return;
                    }
                    
                    try {
                      const res = await api.post('/tags', { name: val, slug: newSlug });
                      const newTag = { id: res.data.id, name: val, slug: newSlug };
                      onTagsChange([...tags, newTag]);
                      setTagIds([...tagIds, newTag.id]);
                      target.value = '';
                    } catch (err: any) {
                      showError(err.response?.data?.message || 'Gagal menambahkan tag baru');
                    }
                  }
                }
              }}
            />
          </div>
          <p className="text-[10px] text-slate-400 italic mt-1">
            Tekan Enter untuk membuat dan menambahkan tag baru secara langsung ke server.
          </p>
        </div>
      </div>
    </div>
  );
};
