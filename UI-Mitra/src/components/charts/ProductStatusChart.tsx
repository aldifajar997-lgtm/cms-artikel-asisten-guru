import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { StatusDistributionItem } from '../../types';
import { PieChart as PieIcon } from 'lucide-react';

interface ProductStatusChartProps {
  title?: string;
  data?: StatusDistributionItem[];
  published?: number;
  draft?: number;
  archived?: number;
  loading?: boolean;
}

// Skema warna Hub: Brand Teal, Amber, Stone Neutral
const THEME_COLORS = ['#0D5B52', '#f59e0b', '#a8a29e', '#3D9E8F'];

export const ProductStatusChart: React.FC<ProductStatusChartProps> = ({ 
  title = "Rasio Status Katalog", 
  data, 
  published = 0, 
  draft = 0, 
  archived = 0, 
  loading = false 
}) => {
  let chartData: StatusDistributionItem[] = [];

  if (data && data.length > 0) {
    chartData = data;
  } else {
    chartData = [
      { name: 'Terpublikasi', value: published, color: '#0D5B52' },
      { name: 'Draf', value: draft, color: '#f59e0b' }
    ];
    if (archived > 0) {
      chartData.push({ name: 'Diarsipkan', value: archived, color: '#a8a29e' });
    }
  }

  const total = chartData.reduce((acc, curr) => acc + (curr.value || 0), 0);

  const renderData = total > 0 
    ? chartData.filter(d => d.value > 0) 
    : [{ name: 'Belum Ada Data', value: 1, color: '#e7e5e4' }];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 card-shadow flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
            <PieIcon className="w-4 h-4" />
          </div>
          <span>{title}</span>
        </h3>
        <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-xl border border-stone-200/80">
          Total: {total} Produk
        </span>
      </div>

      <div className="w-full h-[280px] flex items-center justify-center relative">
        {loading ? (
          <div className="text-stone-400 text-xs animate-pulse">Memuat rasio status...</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={renderData}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={total > 0 ? 4 : 0}
                  dataKey="value"
                  stroke="none"
                >
                  {renderData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || THEME_COLORS[index % THEME_COLORS.length]} 
                    />
                  ))}
                </Pie>
                {total > 0 && (
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${value} produk (${Math.round((Number(value) / total) * 100)}%)`,
                      name
                    ]}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e7e5e4', boxShadow: '0 10px 25px -5px rgba(13, 91, 82, 0.08)' }}
                  />
                )}
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8} 
                  wrapperStyle={{ fontSize: '11px', color: '#78716c' }} 
                  formatter={(value) => {
                    const item = chartData.find(d => d.name === value);
                    const count = item ? Number(item.value) || 0 : 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return <span className="text-stone-700 font-semibold">{value} ({count} • {pct}%)</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Indicator in Middle of Donut */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-xl font-extrabold text-stone-900 leading-none">{total}</span>
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Produk</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
