import React from 'react';
import { FileText, Sparkles, BarChart3, MousePointerClick, Layers } from 'lucide-react';
import { UserProfile, ArticleStats } from '../types';

interface DashboardProps {
  profile: UserProfile;
  stats: ArticleStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, stats }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-teal-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Selamat datang, {profile.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-teal-100 text-lg max-w-2xl">
            Berikut adalah ringkasan performa konten Anda. Mari buat karya hebat lainnya hari ini!
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-4">
          Status Analitik
        </h2>
        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tayangan</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalViews?.toLocaleString('id-ID') || 0}</p>
              <p className="text-[11px] text-teal-600 font-medium">Pengunjung Pembaca</p>
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
      </div>
    </div>
  );
};
