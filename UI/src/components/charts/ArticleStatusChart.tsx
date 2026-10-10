import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ArticleStatusChartProps {
  published: number;
  draft: number;
}

export const ArticleStatusChart: React.FC<ArticleStatusChartProps> = ({ published, draft }) => {
  // If no data, use some fallback or show 0
  const data = [
    { name: 'Terpublikasi', value: published },
    { name: 'Draf', value: draft },
  ];

  const COLORS = ['#0ea5e9', '#cbd5e1']; // sky-500 and slate-300

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Rasio Status Artikel</h3>
      <div className="w-full h-[300px] flex items-center justify-center relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[-20px]">
          <div className="text-center">
            <span className="block text-2xl font-bold text-slate-800">{published + draft}</span>
            <span className="block text-[10px] text-slate-400 font-semibold uppercase">Total</span>
          </div>
        </div>
      </div>
    </div>
  );
};
