import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ProductTrendItem } from '../../types';
import { DollarSign } from 'lucide-react';

interface EarningsBarChartProps {
  title?: string;
  data?: ProductTrendItem[];
  loading?: boolean;
}

const formatIDR = (value: number) => {
  if (value >= 1000000) return `Rp${(value / 1000000).toFixed(1)}Jt`;
  if (value >= 1000) return `Rp${(value / 1000).toFixed(0)}rb`;
  return `Rp${value}`;
};

export const EarningsBarChart: React.FC<EarningsBarChartProps> = ({ 
  title = "Tren Pendapatan Produk (6 Bulan Terakhir)", 
  data = [], 
  loading = false 
}) => {
  const chartData = data.length > 0 ? data : [
    { period: '', name: 'Bulan 1', earnings: 0, sales: 0, gross: 0 },
    { period: '', name: 'Bulan 2', earnings: 0, sales: 0, gross: 0 },
    { period: '', name: 'Bulan 3', earnings: 0, sales: 0, gross: 0 },
    { period: '', name: 'Bulan 4', earnings: 0, sales: 0, gross: 0 },
    { period: '', name: 'Bulan 5', earnings: 0, sales: 0, gross: 0 },
    { period: '', name: 'Bulan 6', earnings: 0, sales: 0, gross: 0 }
  ];

  const totalEarningsInPeriod = chartData.reduce((acc, curr) => acc + (curr.earnings || 0), 0);
  const totalSalesInPeriod = chartData.reduce((acc, curr) => acc + (curr.sales || 0), 0);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" /> {title}
          </h3>
          <p className="text-[11px] text-slate-400">Total {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalEarningsInPeriod)} • {totalSalesInPeriod} transaksi berhasil</p>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
          <span>Net Hak Seller</span>
        </div>
      </div>

      <div className="w-full h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs animate-pulse">
            Memuat data pendapatan...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatIDR} />
              <Tooltip 
                formatter={(value: any, name: any) => {
                  if (name === 'earnings') return [new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(value)), 'Pendapatan Bersih'];
                  return [value, name];
                }}
                labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="earnings" name="earnings" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => {
                  const isLast = index === chartData.length - 1;
                  const hasValue = (entry.earnings || 0) > 0;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={hasValue ? (isLast ? '#059669' : '#10b981') : '#e2e8f0'} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {totalEarningsInPeriod === 0 && !loading && (
        <p className="text-center text-[11px] text-slate-400 mt-2 bg-slate-50 py-1.5 rounded-lg border border-slate-100">
          Belum ada riwayat transaksi penjualan pada 6 bulan terakhir.
        </p>
      )}
    </div>
  );
};
