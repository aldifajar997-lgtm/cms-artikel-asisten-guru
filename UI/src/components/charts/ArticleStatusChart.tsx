import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { StatusDistributionItem } from '../../types';
import { PieChart as PieIcon } from 'lucide-react';

interface ArticleStatusChartProps {
  title?: string;
  data?: StatusDistributionItem[];
  published?: number;
  draft?: number;
  archived?: number;
  loading?: boolean;
}

const DEFAULT_COLORS = ['#0d9488', '#f59e0b', '#94a3b8', '#6366f1'];

export const ArticleStatusChart: React.FC<ArticleStatusChartProps> = ({ 
  title = "Rasio Status Konten", 
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
      { name: 'Terpublikasi', value: published, color: '#0d9488' },
      { name: 'Draf', value: draft, color: '#94a3b8' }
    ];
    if (archived > 0) {
      chartData.push({ name: 'Diarsipkan', value: archived, color: '#64748b' });
    }
  }

  const total = chartData.reduce((acc, curr) => acc + (curr.value || 0), 0);

  // If completely 0, provide placeholder slice so donut still renders cleanly
  const renderData = total > 0 
    ? chartData.filter(d => d.value > 0) 
    : [{ name: 'Belum Ada Data', value: 1, color: '#e2e8f0' }];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <PieIcon className="w-4 h-4 text-teal-600" /> {title}
        </h3>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
          Total: {total}
        </span>
      </div>

      <div className="w-full h-[280px] flex items-center justify-center relative">
        {loading ? (
          <div className="text-slate-400 text-xs animate-pulse">Memuat rasio status...</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={renderData}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={total > 0 ? 4 : 0}
                  dataKey="value"
                  stroke="none"
                >
                  {renderData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
                    />
                  ))}
                </Pie>
                {total > 0 && (
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${value} item (${Math.round((Number(value) / total) * 100)}%)`,
                      name
                    ]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                )}
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8} 
                  wrapperStyle={{ fontSize: '11px', color: '#64748b' }} 
                  formatter={(value, entry: any) => {
                    const item = chartData.find(d => d.name === value);
                    const count = item ? item.value : 0;
                    return <span className="text-slate-600 font-medium">{value} ({count})</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[-35px]">
              <div className="text-center">
                <span className="block text-2xl font-extrabold text-slate-800 leading-none">{total}</span>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Total Unit</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
