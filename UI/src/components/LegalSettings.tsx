import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { handleApiError } from '../utils/api';
import { 
  Scale, 
  FileText, 
  Save, 
  History, 
  RotateCcw, 
  Eye, 
  Edit3, 
  Columns, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  ShieldCheck, 
  X,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Table as TableIcon,
  ExternalLink
} from 'lucide-react';

interface LegalDoc {
  id: string;
  title: string;
  content: string;
  version: number;
  is_published: number;
  updated_at: string;
  updated_by_name?: string;
}

interface Revision {
  id: number;
  document_id: string;
  version: number;
  title: string;
  content: string;
  change_summary?: string;
  created_at: string;
  created_by_name?: string;
}

export function LegalSettings() {
  const [activeDocId, setActiveDocId] = useState<'seller_terms' | 'seller_privacy'>('seller_terms');
  const [documents, setDocuments] = useState<Record<string, LegalDoc>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editor states
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');

  // Confirmation Modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // Revisions Modal
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/legal/admin/documents');
      const docsList: LegalDoc[] = res.data?.data || [];
      const docsMap: Record<string, LegalDoc> = {};
      docsList.forEach((d) => {
        docsMap[d.id] = d;
      });
      setDocuments(docsMap);

      // Sinkronisasi form dengan dokumen aktif
      const cur = docsMap[activeDocId];
      if (cur) {
        setTitleInput(cur.title);
        setContentInput(cur.content);
        setHasUnsavedChanges(false);
      }
    } catch (err: any) {
      console.error('Gagal memuat dokumen legal:', err);
      setErrorMsg('Gagal memuat dokumen legal. Pastikan Anda memiliki hak akses Super Admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDoc = (id: 'seller_terms' | 'seller_privacy') => {
    if (hasUnsavedChanges) {
      const confirmSwitch = window.confirm('Ada perubahan yang belum disimpan. Yakin ingin berganti dokumen? Perubahan akan dibatalkan.');
      if (!confirmSwitch) return;
    }

    setActiveDocId(id);
    const targetDoc = documents[id];
    if (targetDoc) {
      setTitleInput(targetDoc.title);
      setContentInput(targetDoc.content);
      setHasUnsavedChanges(false);
    }
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleContentChange = (val: string) => {
    setContentInput(val);
    setHasUnsavedChanges(true);
  };

  const handleTitleChange = (val: string) => {
    setTitleInput(val);
    setHasUnsavedChanges(true);
  };

  const handleResetToCurrent = () => {
    const cur = documents[activeDocId];
    if (cur) {
      setTitleInput(cur.title);
      setContentInput(cur.content);
      setHasUnsavedChanges(false);
    }
  };

  // Insert formatting helper to textarea
  const insertFormatting = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = contentInput.substring(start, end) || defaultText;
    const replacement = prefix + selected + suffix;

    const newContent = contentInput.substring(0, start) + replacement + contentInput.substring(end);
    setContentInput(newContent);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  // Simpan & Publikasikan
  const handlePublish = async () => {
    if (!titleInput.trim()) {
      setErrorMsg('Judul dokumen tidak boleh kosong.');
      return;
    }
    if (!contentInput.trim() || contentInput.trim().length < 20) {
      setErrorMsg('Konten naskah terlalu pendek (minimal 20 karakter).');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        title: titleInput.trim(),
        content: contentInput,
        change_summary: changeSummary.trim() || 'Pembaruan naskah melalui dashboard super admin'
      };

      const res = await api.put(`/legal/admin/documents/${activeDocId}`, payload);
      setSuccessMsg(res.data?.message || 'Dokumen legal berhasil diperbarui dan dipublikasikan.');
      setShowPublishModal(false);
      setChangeSummary('');
      setHasUnsavedChanges(false);

      // Refresh data
      await fetchDocuments();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Gagal memperbarui dokumen:', err);
      setErrorMsg(handleApiError(err) || 'Gagal menyimpan dokumen legal. Silakan coba kembali.');
    } finally {
      setIsSaving(false);
    }
  };

  // Buka Modal Riwayat Revisi
  const handleOpenRevisions = async () => {
    setShowRevisionsModal(true);
    setIsLoadingRevisions(true);
    setSelectedRevision(null);
    try {
      const res = await api.get(`/legal/admin/documents/${activeDocId}/revisions`);
      setRevisions(res.data?.data || []);
    } catch (err: any) {
      console.error('Gagal memuat riwayat revisi:', err);
    } finally {
      setIsLoadingRevisions(false);
    }
  };

  // Rollback ke versi masa lalu
  const handleRollback = async (revId: number, targetVersion: number) => {
    const confirmRollback = window.confirm(
      `Yakin ingin mengembalikan dokumen ke Versi ${targetVersion}? Versi naskah saat ini akan diarsipkan sebagai revisi baru.`
    );
    if (!confirmRollback) return;

    setIsRollingBack(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/legal/admin/documents/${activeDocId}/rollback/${revId}`);
      setSuccessMsg(res.data?.message || `Dokumen berhasil dikembalikan ke versi ${targetVersion}.`);
      setShowRevisionsModal(false);
      await fetchDocuments();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Gagal melakukan rollback:', err);
      setErrorMsg(handleApiError(err) || 'Gagal mengembalikan dokumen ke versi sebelumnya.');
    } finally {
      setIsRollingBack(false);
    }
  };

  const currentDoc = documents[activeDocId];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mb-3" />
        <span className="text-slate-500 font-medium text-sm">Memuat dokumen legal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Dokumen Legal & Kebijakan Platform</h1>
              <p className="text-sm text-slate-500">
                Kelola naskah resmi Syarat & Ketentuan dan Kebijakan Privasi mitra yang tampil di formulir pendaftaran.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={activeDocId === 'seller_terms' ? 'https://mitra.asisten-guru.id/tos' : 'https://mitra.asisten-guru.id/privacy'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
              title="Buka halaman naskah publik resmi di mitra.asisten-guru.id (HTML statis)"
            >
              <ExternalLink className="w-4 h-4 text-teal-600" />
              <span>Lihat Halaman Publik</span>
            </a>
            <button
              onClick={handleOpenRevisions}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <History className="w-4 h-4 text-slate-600" />
              <span>Riwayat Revisi</span>
            </button>
            <button
              onClick={() => setShowPublishModal(true)}
              disabled={isSaving || !hasUnsavedChanges}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl shadow-sm transition-all ${
                hasUnsavedChanges
                  ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Simpan & Terbitkan</span>
            </button>
          </div>
        </div>

        {/* Notifikasi Status */}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Tabs Pilihan Dokumen */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelectDoc('seller_terms')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeDocId === 'seller_terms'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Syarat & Ketentuan Mitra</span>
          </button>
          <button
            onClick={() => handleSelectDoc('seller_privacy')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeDocId === 'seller_privacy'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Kebijakan Privasi & PDP</span>
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'split' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Split-Screen (Editor & Pratinjau)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split View</span>
          </button>
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'edit' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Hanya Editor"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Editor Saja</span>
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'preview' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Hanya Pratinjau"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pratinjau Saja</span>
          </button>
        </div>
      </div>

      {/* Metadata Bar & Judul Dokumen */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              Versi {currentDoc?.version || 1}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              Aktif & Terbit
            </span>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                * Ada perubahan belum disimpan
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Terakhir Diperbarui:{' '}
                {currentDoc?.updated_at
                  ? new Date(currentDoc.updated_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '-'}
              </span>
            </div>
            {currentDoc?.updated_by_name && (
              <span className="hidden md:inline">Oleh: {currentDoc.updated_by_name}</span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Judul Resmi Dokumen
          </label>
          <input
            type="text"
            value={titleInput}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Masukkan judul resmi dokumen legal..."
            className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-slate-800"
          />
        </div>
      </div>

      {/* Editor & Live Preview Area */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Markdown Formatting Toolbar */}
        {viewMode !== 'preview' && (
          <div className="flex flex-wrap items-center gap-1 p-2.5 bg-slate-50 border-b border-slate-200">
            <button
              onClick={() => insertFormatting('**', '**', 'teks tebal')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Tebal (Bold)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('*', '*', 'teks miring')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Miring (Italic)"
            >
              <Italic className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 mx-1"></span>

            <button
              onClick={() => insertFormatting('# ', '', 'Judul H1')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('## ', '', 'Judul H2')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('### ', '', 'Judul H3')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 mx-1"></span>

            <button
              onClick={() => insertFormatting('* ', '', 'Item daftar')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Daftar Bullet"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('1. ', '', 'Item bernomor')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Daftar Berurutan"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('> ', '', 'Kutipan penting')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Kutipan (Blockquote)"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('\n\n---\n\n', '', '')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Garis Pemisah (Horizontal Line)"
            >
              <Minus className="w-4 h-4" />
            </button>

            <span className="w-px h-5 bg-slate-300 mx-1"></span>

            <button
              onClick={() => insertFormatting('[', '](https://asisten-guru.id)', 'Teks tautan')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Tautan Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormatting('\n| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Data 1 | Data 2 |\n', '', '')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Sisipkan Tabel"
            >
              <TableIcon className="w-4 h-4" />
            </button>

            {hasUnsavedChanges && (
              <button
                onClick={handleResetToCurrent}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Batal perubahan dan kembalikan ke naskah asli"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Content Panes */}
        <div className={`grid ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200' : 'grid-cols-1'}`}>
          {/* Kolom Editor */}
          {viewMode !== 'preview' && (
            <div className="flex flex-col h-[600px] bg-white">
              <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-600">Editor Naskah (Markdown)</span>
                <span>{contentInput.length} karakter</span>
              </div>
              <textarea
                ref={textareaRef}
                value={contentInput}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Tulis naskah dokumen legal dalam format Markdown..."
                className="w-full flex-1 p-4 font-mono text-xs leading-relaxed text-slate-800 resize-none outline-none focus:bg-slate-50/30 overflow-y-auto"
                spellCheck={false}
              />
            </div>
          )}

          {/* Kolom Pratinjau (Live Preview) */}
          {viewMode !== 'edit' && (
            <div className="flex flex-col h-[600px] bg-slate-50/40">
              <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-600 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  Pratinjau Langsung (Sama dengan Tampilan Mitra)
                </span>
                <span className="text-teal-700 font-medium">Tampilan Publik</span>
              </div>
              <div className="flex-1 p-6 overflow-y-auto prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {contentInput || '_Naskah kosong. Ketik teks di sisi kiri untuk melihat pratinjau._'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Publikasi */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <Save className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Konfirmasi Publikasi Dokumen</h3>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Anda akan mempublikasikan pembaruan dokumen legal ini ke <strong>Versi {(currentDoc?.version || 1) + 1}</strong>. Naskah saat ini akan otomatis diarsipkan ke riwayat revisi dan perubahan akan langsung berlaku bagi mitra yang membuka portal.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Catatan Ringkasan Perubahan (Opsional)
              </label>
              <textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Contoh: Penyesuaian persentase bagi hasil pada Pasal 4..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handlePublish}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mempublikasikan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Ya, Terbitkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Riwayat Revisi */}
      {showRevisionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Riwayat Revisi Dokumen Legal</h3>
                  <p className="text-xs text-slate-500">
                    Daftar seluruh versi terdahulu yang pernah dipublikasikan beserta catatan perubahannya.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRevisionsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Isi Riwayat */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingRevisions ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mb-2" />
                  <span className="text-xs text-slate-500">Memuat catatan riwayat revisi...</span>
                </div>
              ) : revisions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Belum ada catatan riwayat revisi sebelumnya.
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-teal-200 transition-colors space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Versi {rev.version}
                          </span>
                          <span className="text-xs font-medium text-slate-800">{rev.title}</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>
                            {new Date(rev.created_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {rev.created_by_name && (
                            <span className="hidden sm:inline">oleh {rev.created_by_name}</span>
                          )}
                          <button
                            onClick={() => handleRollback(rev.id, rev.version)}
                            disabled={isRollingBack}
                            className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rollback</span>
                          </button>
                        </div>
                      </div>

                      {rev.change_summary && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <strong className="text-slate-700 font-semibold">Catatan Perubahan:</strong>{' '}
                          {rev.change_summary}
                        </p>
                      )}

                      {/* Toggle Lihat Cuplikan Naskah */}
                      <div>
                        {selectedRevision?.id === rev.id ? (
                          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                              <span className="text-xs font-bold text-slate-700">Snapshot Naskah Versi {rev.version}</span>
                              <button
                                onClick={() => setSelectedRevision(null)}
                                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                              >
                                Tutup
                              </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto prose prose-slate prose-xs max-w-none text-xs text-slate-700">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {rev.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedRevision(rev)}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat Cuplikan Versi Ini</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowRevisionsModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default LegalSettings;
