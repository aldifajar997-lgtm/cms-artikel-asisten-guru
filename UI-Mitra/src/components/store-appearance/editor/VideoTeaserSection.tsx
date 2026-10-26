import React from 'react';
import { Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { StoreAppearanceConfig } from '../../../types';

interface VideoTeaserSectionProps {
  videoTeaser: StoreAppearanceConfig['videoTeaser'];
  youtubeVideoId: string | null;
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
}

export const VideoTeaserSection: React.FC<VideoTeaserSectionProps> = ({
  videoTeaser,
  youtubeVideoId,
  setAppearance
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            7. Video Pengantar / Teaser
          </h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={videoTeaser.enabled}
            onChange={(e) => setAppearance(prev => ({
              ...prev,
              preset: 'custom',
              videoTeaser: { ...prev.videoTeaser, enabled: e.target.checked }
            }))}
            className="rounded text-brand-teal focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-bold text-stone-700">Tampilkan</span>
        </label>
      </div>

      {videoTeaser.enabled ? (
        <div className="space-y-3.5 pt-1">
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Judul Video (Opsional)
            </label>
            <input
              type="text"
              maxLength={80}
              value={videoTeaser.title || ''}
              onChange={(e) => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                videoTeaser: { ...prev.videoTeaser, title: e.target.value.slice(0, 80) }
              }))}
              placeholder="Contoh: Video Pengantar Modul Ajar Kami"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Tautan Video YouTube
            </label>
            <input
              type="url"
              maxLength={300}
              value={videoTeaser.videoUrl || ''}
              onChange={(e) => setAppearance(prev => ({
                ...prev,
                preset: 'custom',
                videoTeaser: { ...prev.videoTeaser, videoUrl: e.target.value }
              }))}
              placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
            />
            {youtubeVideoId ? (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ID Video terdeteksi: <code className="font-mono bg-emerald-50 px-1 py-0.5 rounded">{youtubeVideoId}</code></span>
              </div>
            ) : videoTeaser.videoUrl ? (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Format tautan YouTube tidak dikenali. Pastikan salin link resmi dari browser Anda.</span>
              </div>
            ) : (
              <span className="text-[10px] text-stone-400 mt-1 block">
                Mendukung video biasa maupun YouTube Shorts
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1.5">
              Format Pemutar Video
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  videoTeaser: { ...prev.videoTeaser, aspectRatio: '16:9' }
                }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  videoTeaser.aspectRatio === '16:9'
                    ? 'border-brand-teal bg-teal-50 text-teal-900'
                    : 'border-stone-200 text-stone-600 bg-white'
                }`}
              >
                Standar 16:9 (Horizontal)
              </button>

              <button
                type="button"
                onClick={() => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  videoTeaser: { ...prev.videoTeaser, aspectRatio: '9:16' }
                }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  videoTeaser.aspectRatio === '9:16'
                    ? 'border-brand-teal bg-teal-50 text-teal-900'
                    : 'border-stone-200 text-stone-600 bg-white'
                }`}
              >
                Shorts 9:16 (Vertikal)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic">
          Seksi video dinonaktifkan. Centang "Tampilkan" untuk menyematkan video pengantar.
        </p>
      )}
    </div>
  );
};
