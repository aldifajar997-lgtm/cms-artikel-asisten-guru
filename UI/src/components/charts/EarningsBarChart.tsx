import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const mockData = [
  { name: 'Minggu 1', earnings: 1500000 },
  { name: 'Minggu 2', earnings: 2300000 },
  { name: 'Minggu 3', earnings: 1800000 },
  { name: 'Minggu 4', earnings: 3200000 },
];

const formatIDR = (value: number) => {
  if (value >= 1000000) return `Rp${(value / 1000000).toFixed(1)}Jt`;
  if (value >= 1000) return `Rp${(value / 1000).toFixed(0)}rb`;
  return `Rp${value}`;
};

export const EarningsBarChart: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Tren Pendapatan (Bulan Ini)</h3>
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={formatIDR} />
            <Tooltip 
              formatter={(value: number) => [new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value), 'Pendapatan']}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f8fafc' }}
            />
            <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
              {mockData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === mockData.length - 1 ? '#059669' : '#a7f3d0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
