import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ProductTrendItem } from '../../types';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/dateFormatter';

interface EarningsBarChartProps {
  title?: string;
  data?: ProductTrendItem[];
  loading?: boolean;
}

const formatIDRCompact = (value: number) => {
  if (value >= 1000000) return `Rp${(value / 1000000).toFixed(1)}Jt`;
  if (value >= 1000) return `Rp${(value / 1000).toFixed(0)}rb`;
  return `Rp${value}`;
};

export const EarningsBarChart: React.FC<EarningsBarChartProps> = ({ 
  title = "Tren Penjualan Produk (6 Bulan Terakhir)", 
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

  const totalEarningsInPeriod = chartData.reduce((acc, curr) => acc + (Number(curr.earnings) || 0), 0);
  const totalGrossInPeriod = chartData.reduce((acc, curr) => acc + (Number(curr.gross) || 0), 0);
  const totalSalesInPeriod = chartData.reduce((acc, curr) => acc + (Number(curr.sales) || 0), 0);
  const averageMarginPercent = totalGrossInPeriod > 0 
    ? ((totalEarningsInPeriod / totalGrossInPeriod) * 100).toFixed(1) 
    : '90.0';

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 card-shadow flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-brand-teal flex items-center justify-center border border-emerald-100">
              <DollarSign className="w-4 h-4" />
            </div>
            <span>{title}</span>
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Akumulasi bersih: <strong className="text-brand-teal font-bold">{formatCurrency(totalEarningsInPeriod)}</strong> ({averageMarginPercent}% margin) • {totalSalesInPeriod} transaksi berhasil
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand-teal bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse"></span>
          <span>Hak Bersih Seller</span>
        </div>
      </div>

      <div className="w-full h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-stone-400 text-xs animate-pulse">
            Memuat data pendapatan...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={formatIDRCompact} />
              <Tooltip 
                formatter={(value: any, name: any, item: any) => {
                  const payload = item?.payload;
                  if (name === 'earnings') {
                    const gross = Number(payload?.gross) || 0;
                    const net = Number(value) || 0;
                    const margin = gross > 0 ? ` (${((net / gross) * 100).toFixed(1)}% net)` : '';
                    return [`${formatCurrency(net)}${margin}`, 'Hak Bersih'];
                  }
                  if (name === 'gross') return [formatCurrency(Number(value)), 'Omset Kotor'];
                  if (name === 'sales') return [`${value} unit`, 'Terjual'];
                  return [value, name];
                }}
                labelStyle={{ fontWeight: 700, color: '#1c1917' }}
                contentStyle={{ borderRadius: '16px', border: '1px solid #e7e5e4', boxShadow: '0 10px 25px -5px rgba(13, 91, 82, 0.08)' }}
                cursor={{ fill: '#fafaf9' }}
              />
              <Bar dataKey="earnings" name="earnings" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => {
                  const isLast = index === chartData.length - 1;
                  const hasValue = (entry.earnings || 0) > 0;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={hasValue ? (isLast ? '#0D5B52' : '#3D9E8F') : '#e7e5e4'} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {totalEarningsInPeriod === 0 && !loading && (
        <p className="text-center text-xs text-stone-400 mt-3 bg-stone-50 py-2 rounded-xl border border-stone-200/60">
          Belum ada riwayat transaksi penjualan pada 6 bulan terakhir.
        </p>
      )}
    </div>
  );
};
