import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen } from 'lucide-react';

export const Glosarium: React.FC = () => {
  const [content, setContent] = useState<string>('Memuat Glosarium...');

  useEffect(() => {
    fetch('/glosarium.md')
      .then(res => {
        if (!res.ok) throw new Error('Gagal memuat glosarium');
        return res.text();
      })
      .then(text => setContent(text))
      .catch(err => setContent('Gagal memuat glosarium. Pastikan file glosarium.md ada di folder public.'));
  }, []);
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-teal-600" />
              Glosarium SEO & CMS
            </h1>
            <p className="text-slate-500 mt-1">Panduan lengkap istilah-istilah penting dalam SEO dan manajemen konten.</p>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm prose prose-teal max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
