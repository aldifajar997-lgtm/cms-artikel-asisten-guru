import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import api from '../utils/api';

interface FeaturedImageUploaderProps {
  imageUrl: string;
  altText: string;
  caption: string;
  focusKeyword: string;
  onImageChange: (url: string) => void;
  onAltTextChange: (alt: string) => void;
  onCaptionChange: (caption: string) => void;
  onRemoveImage: () => void;
}

export const FeaturedImageUploader: React.FC<FeaturedImageUploaderProps> = ({
  imageUrl,
  altText,
  caption,
  focusKeyword,
  onImageChange,
  onAltTextChange,
  onCaptionChange,
  onRemoveImage,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'featured'); // mark as featured image

      const response = await api.post('/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data?.result?.[0]?.url) {
        let uploadedUrl = response.data.result[0].url;
        const baseUrl = api.defaults.baseURL || 'http://localhost:8787/api';
        const origin = baseUrl.replace(/\/api\/?$/, '');
        uploadedUrl = `${origin}${uploadedUrl}`;

        onImageChange(uploadedUrl);
        // Automatically suggest alt text based on keyword if alt text is empty
        if (!altText && focusKeyword) {
          onAltTextChange(focusKeyword);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengunggah gambar cover.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-8">
      {!imageUrl ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 sm:h-64 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-colors group relative overflow-hidden"
        >
          {isUploading ? (
            <div className="flex flex-col items-center text-teal-600">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-sm font-semibold">Mengunggah...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 group-hover:text-teal-600 group-hover:scale-110 transition-all mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Unggah Cover Artikel</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, atau WEBP (Max 5MB)</p>
            </>
          )}
          {error && <p className="text-xs text-rose-500 mt-2 font-medium">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative w-full aspect-video sm:h-80 rounded-2xl overflow-hidden bg-slate-100 group border border-slate-200">
            <img src={imageUrl} alt={altText} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={onRemoveImage}
                className="bg-white/90 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-white transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Hapus Cover
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Alt Text (SEO)</label>
              <input
                type="text"
                value={altText}
                onChange={(e) => onAltTextChange(e.target.value)}
                placeholder="Deskripsi gambar untuk SEO..."
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500"
              />
              {focusKeyword && !altText.toLowerCase().includes(focusKeyword.toLowerCase()) && (
                <p className="text-[10px] text-amber-600 mt-1 font-medium">💡 Saran: Masukkan keyword "{focusKeyword}" ke dalam alt text.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Caption (Opsional)</label>
              <input
                type="text"
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                placeholder="Teks keterangan di bawah gambar..."
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />
    </div>
  );
};
