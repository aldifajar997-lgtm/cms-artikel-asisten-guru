import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  File,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  Search,
  Grid,
  List,
  Eye,
  Download,
  Info,
  ShieldAlert,
  ShieldCheck,
  HardDrive,
  Images,
  ExternalLink,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Loader2
} from 'lucide-react';
import api, { handleApiError } from '../utils/api';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  folder: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  extension: string;
  category: 'document' | 'image' | 'audio' | 'video' | 'archive' | 'code' | 'presentation' | 'spreadsheet' | 'executable' | 'other';
  isSuspicious: boolean;
  suspiciousReason?: string;
  canPreview: boolean;
  previewType?: 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'none';
  modifiedAt?: string;
  sourceType: 'zip_entry' | 'main' | 'gallery' | 'sample';
  previewUrl?: string;
}

interface FileExplorerProps {
  productId: string;
  productTitle: string;
  mainFileMeta: {
    exists: boolean;
    name?: string;
    size?: number;
    type?: string;
    isArchive?: boolean;
    uploaded?: string;
  };
  zipEntries?: FileItem[];
  galleryImages?: Array<{ type: string; name: string; key: string; alt?: string }>;
  samplePhotos?: Array<{ id: string; r2_key: string; file_name: string; mime_type: string; size_bytes: number; created_at: string }>;
  malwareReport?: {
    scanned?: boolean;
    isClean?: boolean;
    threats?: Array<{ type: string; severity: string; message?: string; description?: string; file?: string; fileName?: string }>;
    warnings?: Array<{ type: string; severity: string; message?: string; description?: string; file?: string; fileName?: string }>;
    stats?: { totalChecked: number; threatCount: number; warningCount: number };
  };
  onDownloadMainFile?: () => void;
  isDownloadingMainFile?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  productId,
  productTitle,
  mainFileMeta,
  zipEntries = [],
  galleryImages = [],
  samplePhotos = [],
  malwareReport,
  onDownloadMainFile,
  isDownloadingMainFile = false,
}) => {
  // Navigation State
  const [activeSection, setActiveSection] = useState<'product_files' | 'gallery' | 'samples'>('product_files');
  const [currentFolder, setCurrentFolder] = useState<string>(''); // path folder relatif di dalam ZIP
  const [folderHistory, setFolderHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'details' | 'list'>('details');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(false);

  // Bersihkan URL Object blob saat komponen unmount atau saat URL blob berganti untuk mencegah memory leak
  useEffect(() => {
    return () => {
      if (previewMediaUrl && previewMediaUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(previewMediaUrl);
      }
    };
  }, [previewMediaUrl]);

  const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8787/api');

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Kumpulkan list item berdasarkan activeSection
  const currentItems = useMemo(() => {
    if (activeSection === 'gallery') {
      return galleryImages.map((img, idx) => ({
        id: `gallery-${idx}`,
        name: img.name || img.key,
        path: img.key,
        folder: '',
        isDirectory: false,
        size: 0,
        extension: img.key.split('.').pop() || 'jpg',
        category: 'image' as const,
        isSuspicious: false,
        canPreview: true,
        previewType: 'image' as const,
        sourceType: 'gallery' as const,
        previewUrl: `${baseUrl}/media/${img.key}`
      }));
    }

    if (activeSection === 'samples') {
      return samplePhotos.map((s) => ({
        id: s.id,
        name: s.file_name,
        path: s.r2_key,
        folder: '',
        isDirectory: false,
        size: s.size_bytes,
        extension: s.file_name.split('.').pop() || 'jpg',
        category: 'image' as const,
        isSuspicious: false,
        canPreview: true,
        previewType: 'image' as const,
        modifiedAt: s.created_at,
        sourceType: 'sample' as const,
        previewUrl: `${baseUrl}/media/${s.r2_key}`
      }));
    }

    // activeSection === 'product_files'
    if (mainFileMeta.type === 'pdf') {
      // Produk file tunggal PDF
      return [{
        id: 'main-pdf',
        name: mainFileMeta.name || 'document.pdf',
        path: mainFileMeta.name || 'document.pdf',
        folder: '',
        isDirectory: false,
        size: mainFileMeta.size || 0,
        extension: 'pdf',
        category: 'document' as const,
        isSuspicious: false,
        canPreview: true,
        previewType: 'pdf' as const,
        modifiedAt: mainFileMeta.uploaded,
        sourceType: 'main' as const,
        previewUrl: `${baseUrl}/products/admin/${productId}/files/preview?source=main`
      }];
    }

    if (mainFileMeta.type === 'rar') {
      return [{
        id: 'main-rar',
        name: mainFileMeta.name || 'archive.rar',
        path: mainFileMeta.name || 'archive.rar',
        folder: '',
        isDirectory: false,
        size: mainFileMeta.size || 0,
        extension: 'rar',
        category: 'archive' as const,
        isSuspicious: false,
        canPreview: false,
        previewType: 'none' as const,
        modifiedAt: mainFileMeta.uploaded,
        sourceType: 'main' as const
      }];
    }

    // Dapatkan daftar subfolder unik di dalam currentFolder
    const subfolderSet = new Set<string>();
    const filesInCurrentFolder: FileItem[] = [];

    // Map ancaman malware scanner ke file spesifik (mendukung field fileName/file & description/message)
    const threatMap = new Map<string, string>();
    if (malwareReport?.threats) {
      malwareReport.threats.forEach((t: any) => {
        const fname = t.fileName || t.file;
        const desc = t.description || t.message;
        if (fname) threatMap.set(fname.toLowerCase(), desc || 'Ancaman keamanan terdeteksi');
      });
    }

    const decorateItem = (item: FileItem): FileItem => {
      const matchReason = threatMap.get(item.name.toLowerCase()) || threatMap.get(item.path.toLowerCase());
      if (matchReason) {
        return {
          ...item,
          isSuspicious: true,
          suspiciousReason: matchReason
        };
      }
      return item;
    };

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return zipEntries
        .filter(e => !e.isDirectory && (e.name.toLowerCase().includes(q) || e.extension.toLowerCase().includes(q)))
        .map(decorateItem);
    }

    zipEntries.forEach(entry => {
      const entryFolder = entry.folder;
      
      if (currentFolder === '') {
        // Root directory
        if (entry.isDirectory && entry.folder === '') {
          subfolderSet.add(entry.name);
        } else if (entryFolder === '') {
          if (!entry.isDirectory) filesInCurrentFolder.push(decorateItem(entry));
        } else {
          const topFolder = entryFolder.split('/')[0];
          subfolderSet.add(topFolder);
        }
      } else {
        // Di dalam folder tertentu
        if (entry.isDirectory && entry.folder === currentFolder) {
          subfolderSet.add(entry.name);
        } else if (entryFolder === currentFolder) {
          if (!entry.isDirectory) filesInCurrentFolder.push(decorateItem(entry));
        } else if (entryFolder.startsWith(currentFolder + '/')) {
          const remainder = entryFolder.slice(currentFolder.length + 1);
          const nextSub = remainder.split('/')[0];
          subfolderSet.add(nextSub);
        }
      }
    });

    const folderItems: FileItem[] = Array.from(subfolderSet).map(folderName => {
      const folderPath = currentFolder ? `${currentFolder}/${folderName}` : folderName;
      return {
        id: `folder-${folderPath}`,
        name: folderName,
        path: folderPath,
        folder: currentFolder,
        isDirectory: true,
        size: 0,
        extension: 'folder',
        category: 'archive' as const,
        isSuspicious: false,
        canPreview: false,
        sourceType: 'zip_entry' as const
      };
    });

    // Urutkan: Folder selalu di atas, kemudian berkas berdasarkan nama
    return [...folderItems, ...filesInCurrentFolder];
  }, [activeSection, currentFolder, searchQuery, zipEntries, galleryImages, samplePhotos, mainFileMeta, productId, baseUrl, malwareReport]);

  const [isDownloadingSingle, setIsDownloadingSingle] = useState<boolean>(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState<boolean>(false);

  const isOfficeFile = (item: FileItem) => {
    const ext = (item.extension || '').toLowerCase();
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'odt', 'ods', 'odp'].includes(ext);
  };

  const handleDownloadSpecificFile = async (item: FileItem) => {
    setIsDownloadingSingle(true);
    try {
      const url = `/products/admin/${productId}/files/preview?source=${item.sourceType}&path=${encodeURIComponent(item.path)}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', item.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Gagal mengunduh berkas satuan:', err);
      alert('Gagal mengunduh berkas ini: ' + handleApiError(err));
    } finally {
      setIsDownloadingSingle(false);
    }
  };

  const handleOpenPdf = async (item: FileItem) => {
    setIsOpeningPdf(true);
    let newWindow: Window | null = null;
    try {
      newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write('<p style="font-family:sans-serif;padding:24px;color:#475569;">Memuat dokumen PDF...</p>');
      }
      const url = `/products/admin/${productId}/files/preview?source=${item.sourceType}&path=${encodeURIComponent(item.path)}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      if (newWindow) {
        newWindow.location.href = blobUrl;
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err: any) {
      if (newWindow) newWindow.close();
      console.error('Gagal membuka PDF:', err);
      alert('Gagal membuka dokumen PDF: ' + handleApiError(err));
    } finally {
      setIsOpeningPdf(false);
    }
  };

  // Handle navigasi folder
  const handleNavigateToFolder = (targetFolder: string) => {
    setCurrentFolder(targetFolder);
    const newHistory = folderHistory.slice(0, historyIndex + 1);
    newHistory.push(targetFolder);
    setFolderHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prev = historyIndex - 1;
      setHistoryIndex(prev);
      setCurrentFolder(folderHistory[prev]);
    }
  };

  const handleForward = () => {
    if (historyIndex < folderHistory.length - 1) {
      const next = historyIndex + 1;
      setHistoryIndex(next);
      setCurrentFolder(folderHistory[next]);
    }
  };

  const handleUpFolder = () => {
    if (!currentFolder) return;
    const parts = currentFolder.split('/');
    parts.pop();
    const parent = parts.join('/');
    handleNavigateToFolder(parent);
  };

  // Handle klik item berkas & pemuatan preview terotentikasi
  const handleItemClick = (item: FileItem) => {
    if (item.isDirectory) {
      handleNavigateToFolder(item.path);
      return;
    }

    setSelectedFile(item);

    // Bersihkan URL blob media sebelumnya untuk mencegah kebocoran memori
    if (previewMediaUrl && previewMediaUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewMediaUrl);
      setPreviewMediaUrl(null);
    }

    // 1. Pratinjau Teks
    if (item.previewType === 'text') {
      setIsLoadingPreview(true);
      const url = `/products/admin/${productId}/files/preview?source=${item.sourceType}&path=${encodeURIComponent(item.path)}`;
      api.get(url, { responseType: 'text' })
        .then(res => {
          const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
          setPreviewContent(txt.slice(0, 10000));
        })
        .catch(err => {
          setPreviewContent('Gagal memuat pratinjau teks: ' + handleApiError(err));
        })
        .finally(() => setIsLoadingPreview(false));
    } else {
      setPreviewContent(null);
    }

    // 2. Pratinjau Media (Gambar, Audio, Video)
    if (item.previewType === 'image' || item.previewType === 'audio' || item.previewType === 'video') {
      if (item.sourceType === 'gallery' || item.sourceType === 'sample') {
        setPreviewMediaUrl(item.previewUrl || null);
      } else {
        // Berkas di dalam arsip ZIP memerlukan akses terotentikasi Bearer token
        setIsLoadingMedia(true);
        const url = `/products/admin/${productId}/files/preview?source=${item.sourceType}&path=${encodeURIComponent(item.path)}`;
        api.get(url, { responseType: 'blob' })
          .then(res => {
            const rawContentType = res.headers?.['content-type'];
            const contentType = typeof rawContentType === 'string' ? rawContentType : (item.previewType === 'audio' ? 'audio/mpeg' : item.previewType === 'video' ? 'video/mp4' : 'image/jpeg');
            const blob = (res.data instanceof Blob && res.data.type) ? res.data : new Blob([res.data], { type: contentType });
            const blobUrl = window.URL.createObjectURL(blob);
            setPreviewMediaUrl(blobUrl);
          })
          .catch(err => {
            console.error('Gagal memuat pratinjau media:', err);
            setPreviewMediaUrl(null);
          })
          .finally(() => setIsLoadingMedia(false));
      }
    } else {
      setPreviewMediaUrl(null);
    }
  };

  // Helper render file icon
  const renderFileIcon = (item: FileItem, sizeClass = 'w-6 h-6') => {
    if (item.isDirectory) {
      return <Folder className={`${sizeClass} text-amber-500 fill-amber-100`} />;
    }
    if (item.isSuspicious) {
      return <ShieldAlert className={`${sizeClass} text-rose-600 animate-pulse`} />;
    }

    switch (item.category) {
      case 'document':
        if (item.extension === 'pdf') {
          return <FileText className={`${sizeClass} text-rose-500`} />;
        }
        return <FileText className={`${sizeClass} text-blue-500`} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={`${sizeClass} text-emerald-600`} />;
      case 'presentation':
        return <FileText className={`${sizeClass} text-orange-500`} />;
      case 'image':
        return <FileImage className={`${sizeClass} text-violet-500`} />;
      case 'audio':
        return <FileAudio className={`${sizeClass} text-cyan-500`} />;
      case 'video':
        return <FileVideo className={`${sizeClass} text-pink-500`} />;
      case 'archive':
        return <FileArchive className={`${sizeClass} text-amber-600`} />;
      case 'code':
        return <FileCode className={`${sizeClass} text-indigo-500`} />;
      case 'executable':
        return <AlertTriangle className={`${sizeClass} text-rose-600`} />;
      default:
        return <File className={`${sizeClass} text-slate-400`} />;
    }
  };

  // Breadcrumbs generator
  const breadcrumbParts = currentFolder ? currentFolder.split('/') : [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col h-[750px] select-none">
      {/* 1. TOP WINDOW TITLEBAR (Microsoft Explorer Style) */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-medium">
          <HardDrive className="w-4 h-4 text-teal-400" />
          <span className="text-slate-300">File Explorer Kurasi:</span>
          <span className="font-semibold text-white tracking-wide truncate max-w-md">{productTitle}</span>
          <span className="bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 rounded-full border border-teal-500/30">
            {mainFileMeta.type ? mainFileMeta.type.toUpperCase() : 'UNKNOWN'}
          </span>
        </div>

        {onDownloadMainFile && (
          <button
            onClick={onDownloadMainFile}
            disabled={isDownloadingMainFile}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            title="Unduh seluruh file asli produk untuk pemeriksaan offline"
          >
            {isDownloadingMainFile ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isDownloadingMainFile ? 'Mengunduh...' : 'Unduh Berkas Asli'}</span>
            {mainFileMeta.size ? (
              <span className="text-[10px] opacity-80">({formatBytes(mainFileMeta.size)})</span>
            ) : null}
          </button>
        )}
      </div>

      {/* 2. TOOLBAR & ADDRESS BAR RIBBON */}
      <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Arrows */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Kembali (Back)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex >= folderHistory.length - 1}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Maju (Forward)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleUpFolder}
            disabled={!currentFolder || activeSection !== 'product_files'}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Ke Folder Induk (Up)"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCurrentFolder('');
              setSearchQuery('');
            }}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
            title="Refresh / Ke Root"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Address Bar / Breadcrumbs */}
        <div className="flex-1 min-w-[200px] flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-inner">
          <HardDrive className="w-3.5 h-3.5 text-teal-600 mr-2 shrink-0" />
          <button
            onClick={() => {
              setActiveSection('product_files');
              setCurrentFolder('');
            }}
            className="hover:underline font-semibold text-slate-800 shrink-0 cursor-pointer"
          >
            {activeSection === 'product_files'
              ? 'Berkas Produk'
              : activeSection === 'gallery'
              ? 'Galeri Sampul'
              : 'Portofolio Seller'}
          </button>

          {activeSection === 'product_files' && breadcrumbParts.map((part, index) => {
            const pathUpToThis = breadcrumbParts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={pathUpToThis}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-1 shrink-0" />
                <button
                  onClick={() => handleNavigateToFolder(pathUpToThis)}
                  className="hover:underline text-slate-600 truncate max-w-[120px] cursor-pointer"
                  title={part}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 sm:w-48 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:w-56 transition-all"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
            <button
              onClick={() => setViewMode('details')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'details' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Tampilan Detail"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Ikon Besar (Grid)"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Tampilan List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN EXPLORER SPLIT VIEW (Sidebar Tree + File View + Preview Pane) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tree Pane (Quick Access) */}
        <div className="w-56 bg-slate-50/80 border-r border-slate-200 p-3 flex flex-col space-y-1 shrink-0 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Struktur Paket Produk
          </div>

          <button
            onClick={() => {
              setActiveSection('product_files');
              setCurrentFolder('');
              setSelectedFile(null);
            }}
            className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
              activeSection === 'product_files'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span className="truncate">Berkas Utama</span>
            {zipEntries.length > 0 && (
              <span className={`ml-auto text-[10px] px-1.5 py-0.2 rounded-md ${
                activeSection === 'product_files' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {zipEntries.filter(e => !e.isDirectory).length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveSection('gallery');
              setCurrentFolder('');
              setSelectedFile(null);
            }}
            className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
              activeSection === 'gallery'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Images className="w-4 h-4 shrink-0" />
            <span className="truncate">Sampul & Galeri</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.2 rounded-md ${
              activeSection === 'gallery' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-600'
            }`}>
              {galleryImages.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSection('samples');
              setCurrentFolder('');
              setSelectedFile(null);
            }}
            className={`w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
              activeSection === 'samples'
                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <FileImage className="w-4 h-4 shrink-0" />
            <span className="truncate">Portofolio Seller</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.2 rounded-md ${
              activeSection === 'samples' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-600'
            }`}>
              {samplePhotos.length}
            </span>
          </button>

          {/* Security Status Box */}
          <div className="mt-auto pt-4 border-t border-slate-200/80">
            <div className={`p-2.5 rounded-2xl border shadow-xs space-y-1.5 ${
              malwareReport && !malwareReport.isClean
                ? 'bg-rose-50 border-rose-300'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                {(malwareReport && !malwareReport.isClean) || zipEntries.some(e => e.isSuspicious) ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                    <span className="text-rose-600">
                      {malwareReport && !malwareReport.isClean
                        ? 'Malware Terdeteksi!'
                        : 'Ada File Berisiko!'}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span className="text-teal-700">Pindaian Bersih</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {malwareReport && !malwareReport.isClean
                  ? `Ditemukan ${malwareReport.threats?.length || 0} ancaman keamanan pada berkas ini.`
                  : zipEntries.some(e => e.isSuspicious)
                  ? 'Ditemukan ekstensi skrip/program (.exe/.bat/.sh) yang mencurigakan di dalam arsip.'
                  : 'Seluruh berkas terverifikasi bebas dari script executable dan ancaman malware.'}
              </p>
            </div>
          </div>
        </div>

        {/* Center File List / Grid View */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {currentItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Folder className="w-12 h-12 text-slate-200 stroke-1 mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                {!mainFileMeta.exists && activeSection === 'product_files'
                  ? 'Berkas digital belum diunggah'
                  : 'Folder ini kosong'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {!mainFileMeta.exists && activeSection === 'product_files'
                  ? 'Produk ini belum memiliki arsip digital (.zip, .pdf, .rar) di penyimpanan atau proses unggah belum tuntas.'
                  : 'Tidak ada berkas atau subfolder di lokasi ini.'}
              </p>
            </div>
          ) : viewMode === 'details' ? (
            /* Details Table View */
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Nama</th>
                    <th className="py-2.5 px-3">Jenis</th>
                    <th className="py-2.5 px-3">Ukuran</th>
                    {activeSection === 'product_files' && <th className="py-2.5 px-3">Kompresi</th>}
                    <th className="py-2.5 px-3">Keamanan</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentItems.map((item) => {
                    const isSelected = selectedFile?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? 'bg-teal-50/70 border-l-4 border-l-teal-600' : ''
                        } ${item.isSuspicious ? 'bg-rose-50/60' : ''}`}
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-800 flex items-center space-x-2.5">
                          {renderFileIcon(item, 'w-4 h-4 shrink-0')}
                          <span className={`truncate max-w-xs ${item.isSuspicious ? 'text-rose-700 font-bold' : ''}`}>
                            {item.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 uppercase font-mono text-[10px]">
                          {item.isDirectory ? 'Folder' : item.extension || 'File'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.isDirectory ? '-' : formatBytes(item.size)}
                        </td>
                        {activeSection === 'product_files' && (
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {item.compressedSize ? formatBytes(item.compressedSize) : '-'}
                          </td>
                        )}
                        <td className="py-2.5 px-3">
                          {item.isSuspicious ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> Berisiko
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.canPreview && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              className="px-2 py-1 text-teal-600 hover:bg-teal-50 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Pratinjau
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'grid' ? (
            /* Large Icons / Grid View */
            <div className="flex-1 overflow-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentItems.map((item) => {
                const isSelected = selectedFile?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex flex-col items-center p-3 rounded-2xl border text-center transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-500 shadow-md ring-2 ring-teal-500/30'
                        : item.isSuspicious
                        ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:shadow-xs'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2">
                      {renderFileIcon(item, 'w-8 h-8')}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 line-clamp-2 w-full break-all leading-tight">
                      {item.name}
                    </span>
                    {!item.isDirectory && (
                      <span className="text-[10px] text-slate-400 mt-1">
                        {formatBytes(item.size)}
                      </span>
                    )}
                    {item.isSuspicious && (
                      <span className="mt-1 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-md uppercase">
                        Bahaya
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="flex-1 overflow-auto p-3 space-y-1">
              {currentItems.map((item) => {
                const isSelected = selectedFile?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 border-teal-400 text-teal-900 font-medium'
                        : item.isSuspicious
                        ? 'bg-rose-50/70 border-rose-300 text-rose-800'
                        : 'border-transparent hover:bg-slate-100/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {renderFileIcon(item, 'w-4 h-4 shrink-0')}
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] shrink-0 ml-2">
                      {item.isDirectory ? 'Folder' : formatBytes(item.size)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status Bar Bawah */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{currentItems.length} item di lokasi ini</span>
            {selectedFile && (
              <span>Terpilih: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})</span>
            )}
          </div>
        </div>

        {/* Right Preview Pane (Pratinjau Berkas & Metadata) */}
        {selectedFile && !selectedFile.isDirectory && (
          <div className={`border-l border-slate-200 bg-slate-50/50 flex flex-col shrink-0 transition-all duration-300 ${
            isPreviewExpanded ? 'w-[450px]' : 'w-80'
          }`}>
            {/* Header Preview Pane */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-slate-800">Pratinjau Berkas</span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                  title={isPreviewExpanded ? 'Perkecil Pane' : 'Perlebar Pane'}
                >
                  {isPreviewExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Live Viewer Content */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* Box Preview Media */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col items-center justify-center min-h-[160px]">
                {selectedFile.previewType === 'image' ? (
                  isLoadingMedia ? (
                    <div className="py-8 text-center text-xs text-slate-400 animate-pulse flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                      <span>Memuat pratinjau gambar...</span>
                    </div>
                  ) : (previewMediaUrl || selectedFile.previewUrl) ? (
                    <div className="w-full flex flex-col items-center space-y-2">
                      <img
                        src={previewMediaUrl || selectedFile.previewUrl!}
                        alt={selectedFile.name}
                        className="max-h-60 w-auto object-contain rounded-xl shadow-xs border border-slate-100"
                      />
                      <a
                        href={previewMediaUrl || selectedFile.previewUrl!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline pt-1"
                      >
                        <span>Buka resolusi penuh</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 space-y-1">
                      <FileImage className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs text-slate-500">Pratinjau gambar tidak dapat dimuat</p>
                    </div>
                  )
                ) : selectedFile.previewType === 'pdf' ? (
                  <div className="w-full flex flex-col items-center space-y-3 py-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Dokumen PDF Terverifikasi</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Siap diinspeksi secara langsung</p>
                    </div>
                    <button
                      onClick={() => handleOpenPdf(selectedFile)}
                      disabled={isOpeningPdf}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                      {isOpeningPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>Buka PDF di Tab Baru</span>
                    </button>
                  </div>
                ) : selectedFile.previewType === 'text' ? (
                  <div className="w-full">
                    {isLoadingPreview ? (
                      <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                        Memuat pratinjau teks...
                      </div>
                    ) : (
                      <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                        {previewContent || 'Konten teks kosong.'}
                      </pre>
                    )}
                  </div>
                ) : selectedFile.previewType === 'audio' ? (
                  isLoadingMedia ? (
                    <div className="py-4 text-center text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Memuat audio...</span>
                    </div>
                  ) : previewMediaUrl ? (
                    <div className="w-full space-y-2 py-2">
                      <audio
                        controls
                        className="w-full h-8"
                        src={previewMediaUrl}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Berkas audio tidak dapat diputar.</p>
                  )
                ) : selectedFile.previewType === 'video' ? (
                  isLoadingMedia ? (
                    <div className="py-4 text-center text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Memuat video...</span>
                    </div>
                  ) : previewMediaUrl ? (
                    <div className="w-full space-y-2">
                      <video
                        controls
                        className="w-full rounded-xl max-h-48 bg-black"
                        src={previewMediaUrl}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Berkas video tidak dapat diputar.</p>
                  )
                ) : isOfficeFile(selectedFile) ? (
                  /* KARTU KHUSUS MICROSOFT OFFICE (METADATA + UNDUH, TANPA PREVIEW INLINE) */
                  <div className="w-full flex flex-col items-center space-y-3 py-3 text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs ${
                      ['xls', 'xlsx', 'csv', 'ods'].includes(selectedFile.extension.toLowerCase())
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : ['ppt', 'pptx', 'odp'].includes(selectedFile.extension.toLowerCase())
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {renderFileIcon(selectedFile, 'w-8 h-8')}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Dokumen Microsoft Office (.{selectedFile.extension.toUpperCase()})
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] leading-relaxed">
                        Sesuai standar kurasi, pratinjau inline office tidak diaktifkan. Periksa metadata di bawah atau unduh berkas untuk pemeriksaan offline.
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadSpecificFile(selectedFile)}
                      disabled={isDownloadingSingle}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                        ['xls', 'xlsx', 'csv', 'ods'].includes(selectedFile.extension.toLowerCase())
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          : ['ppt', 'pptx', 'odp'].includes(selectedFile.extension.toLowerCase())
                          ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                      }`}
                    >
                      {isDownloadingSingle ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Unduh Berkas Ini (.{selectedFile.extension})</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 space-y-2">
                    {renderFileIcon(selectedFile, 'w-10 h-10 mx-auto text-slate-300')}
                    <p className="text-xs font-medium text-slate-600">Pratinjau tidak tersedia langsung</p>
                    <p className="text-[10px] text-slate-400 max-w-[200px]">
                      Format berkas ini dapat diperiksa dengan mengunduh berkas asli.
                    </p>
                  </div>
                )}
              </div>

              {/* Warning Banner Jika File Berisiko */}
              {selectedFile.isSuspicious && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>PERINGATAN RISIKO KEAMANAN</span>
                  </div>
                  <p className="text-[11px] text-rose-600 leading-relaxed">
                    {selectedFile.suspiciousReason || 'Berkas ini memiliki potensi kode berbahaya dan tidak memenuhi standar marketplace pendidikan.'}
                  </p>
                </div>
              )}

              {/* Metadata Details Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 text-xs">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                  Informasi Berkas
                </h4>

                <div className="space-y-1.5">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Nama:</span>
                    <span className="font-medium text-slate-800 text-right truncate max-w-[160px]" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Lokasi Folder:</span>
                    <span className="font-mono text-slate-600 text-right truncate max-w-[160px]">
                      /{selectedFile.folder || 'root'}
                    </span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Ukuran Asli:</span>
                    <span className="font-semibold text-slate-800">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  {selectedFile.compressedSize && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Ukuran Terkompresi:</span>
                      <span className="font-mono text-slate-600">
                        {formatBytes(selectedFile.compressedSize)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Format:</span>
                    <span className="uppercase font-mono text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                      .{selectedFile.extension}
                    </span>
                  </div>
                  {selectedFile.modifiedAt && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Dimodifikasi:</span>
                      <span className="text-slate-600">
                        {new Date(selectedFile.modifiedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tombol Unduh Universal untuk Berkas Terpilih */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleDownloadSpecificFile(selectedFile)}
                    disabled={isDownloadingSingle}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isDownloadingSingle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Unduh Berkas Ini ({formatBytes(selectedFile.size)})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
