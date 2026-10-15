import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArticleTrendItem } from '../../types';
import { Sparkles } from 'lucide-react';

interface ContentTrendChartProps {
  title?: string;
  data?: ArticleTrendItem[];
  loading?: boolean;
}

export const ContentTrendChart: React.FC<ContentTrendChartProps> = ({ 
  title = "Tren Aktivitas & Tayangan Artikel (6 Bulan Terakhir)", 
  data = [], 
  loading = false 
}) => {
  const chartData = data.length > 0 ? data : [
    { period: '', name: 'Bulan 1', count: 0, views: 0 },
    { period: '', name: 'Bulan 2', count: 0, views: 0 },
    { period: '', name: 'Bulan 3', count: 0, views: 0 },
    { period: '', name: 'Bulan 4', count: 0, views: 0 },
    { period: '', name: 'Bulan 5', count: 0, views: 0 },
    { period: '', name: 'Bulan 6', count: 0, views: 0 }
  ];

  const totalViewsInPeriod = chartData.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalCountInPeriod = chartData.reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-600" /> {title}
          </h3>
          <p className="text-[11px] text-slate-400">Total {totalViewsInPeriod.toLocaleString('id-ID')} tayangan • {totalCountInPeriod} artikel terbit</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
            <span>Tayangan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span>Artikel Terbit</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs animate-pulse">
            Memuat data tren...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any) => {
                  if (name === 'views') return [`${Number(value).toLocaleString('id-ID')} tayangan`, 'Tayangan'];
                  if (name === 'count') return [`${value} artikel`, 'Artikel Terbit'];
                  return [value, name];
                }}
                labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area type="monotone" dataKey="views" name="views" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorViews)" />
              <Area type="monotone" dataKey="count" name="count" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {totalViewsInPeriod === 0 && totalCountInPeriod === 0 && !loading && (
        <p className="text-center text-[11px] text-slate-400 mt-2 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
          Belum ada riwayat aktivitas artikel pada 6 bulan terakhir.
        </p>
      )}
    </div>
  );
};
