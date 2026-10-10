import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = [
  { name: 'Senin', views: 4000 },
  { name: 'Selasa', views: 3000 },
  { name: 'Rabu', views: 2000 },
  { name: 'Kamis', views: 2780 },
  { name: 'Jumat', views: 1890 },
  { name: 'Sabtu', views: 2390 },
  { name: 'Minggu', views: 3490 },
];

export const ContentTrendChart: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Tren Pengunjung (7 Hari Terakhir)</h3>
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area type="monotone" dataKey="views" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
