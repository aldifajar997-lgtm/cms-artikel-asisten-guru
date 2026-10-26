import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PaymentMethodDistributionItem } from '../../types';
import { CreditCard, QrCode, Building2, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/dateFormatter';

interface PaymentMethodChartProps {
  title?: string;
  data?: PaymentMethodDistributionItem[];
  loading?: boolean;
}

// Skema warna harmonis bernuansa fintech modern Asisten Guru
const METHOD_COLORS: { [key: string]: string } = {
  qris: '#0D5B52', // Brand Teal
  bca_va: '#0284c7', // Sky Blue
  bni_va: '#059669', // Emerald
  bri_va: '#2563eb', // Blue
  mandiri_bill: '#1e40af', // Navy
  permata_va: '#7c3aed', // Purple
  gopay: '#06b6d4', // Cyan
  shopeepay: '#ea580c', // Orange
  wallet: '#8b5cf6', // Indigo
  credit_card: '#475569', // Slate
  other: '#a8a29e' // Stone
};

const PALETTE = ['#0D5B52', '#0284c7', '#059669', '#2563eb', '#7c3aed', '#ea580c', '#06b6d4', '#f59e0b', '#78716c'];

const getMethodIcon = (method: string) => {
  const m = method.toLowerCase();
  if (m === 'qris') return <QrCode className="w-3.5 h-3.5 text-teal-600" />;
  if (m.includes('va') || m.includes('bill') || m.includes('bank')) return <Building2 className="w-3.5 h-3.5 text-sky-600" />;
  if (m === 'wallet' || m.includes('pay')) return <Wallet className="w-3.5 h-3.5 text-emerald-600" />;
  return <CreditCard className="w-3.5 h-3.5 text-stone-500" />;
};

export const PaymentMethodChart: React.FC<PaymentMethodChartProps> = ({
  title = "Kanal Pembayaran Terfavorit",
  data = [],
  loading = false
}) => {
  const chartData = data && data.length > 0 ? data : [];
  const totalTransactions = chartData.reduce((acc, curr) => acc + (curr.count || 0), 0);
  const totalGross = chartData.reduce((acc, curr) => acc + (curr.gross || 0), 0);

  const renderData = totalTransactions > 0
    ? chartData.map((d, index) => ({
        ...d,
        color: METHOD_COLORS[d.method.toLowerCase()] || PALETTE[index % PALETTE.length]
      }))
    : [{ name: 'Belum Ada Transaksi', count: 1, gross: 0, percentage: 100, color: '#e7e5e4', method: 'none' }];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 card-shadow flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100">
              <CreditCard className="w-4 h-4" />
            </div>
            <span>{title}</span>
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Preferensi gerbang pembayaran pelanggan toko Anda
          </p>
        </div>
        <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-xl border border-stone-200/80">
          {totalTransactions} Transaksi
        </span>
      </div>

      {loading ? (
        <div className="h-[280px] flex items-center justify-center text-stone-400 text-xs animate-pulse">
          Memuat kanal pembayaran...
        </div>
      ) : totalTransactions === 0 ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-stone-50/60 rounded-2xl border border-stone-100">
          <CreditCard className="w-10 h-10 text-stone-300 mb-2 stroke-[1.5]" />
          <p className="text-xs font-bold text-stone-600">Belum Ada Transaksi di Periode Ini</p>
          <p className="text-[11px] text-stone-400 mt-1 max-w-xs">
            Distribusi metode pembayaran (QRIS, VA Bank, dll) akan otomatis muncul saat pesanan berhasil terbayar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Donut Chart */}
          <div className="md:col-span-5 h-[200px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={renderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="count"
                  stroke="none"
                >
                  {renderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, item: any) => {
                    const payload = item?.payload;
                    return [
                      `${value} transaksi (${payload?.percentage || 0}%) • ${formatCurrency(payload?.gross || 0)}`,
                      payload?.name || name
                    ];
                  }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid #e7e5e4',
                    boxShadow: '0 10px 25px -5px rgba(13, 91, 82, 0.08)',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total Center Indicator */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-lg font-black text-stone-900 leading-none">
                {totalTransactions}
              </span>
              <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">
                Order
              </span>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="md:col-span-7 space-y-2">
            {chartData.slice(0, 4).map((item, idx) => {
              const color = METHOD_COLORS[item.method.toLowerCase()] || PALETTE[idx % PALETTE.length];
              return (
                <div 
                  key={item.method} 
                  className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-stone-50 transition flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    <div className="truncate">
                      <p className="font-bold text-stone-800 truncate flex items-center gap-1.5">
                        {getMethodIcon(item.method)}
                        <span>{item.name}</span>
                      </p>
                      <p className="text-[10px] text-stone-400">
                        {formatCurrency(item.gross)} ({item.count} order)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-white border border-stone-200 text-stone-900 shadow-2xs">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
            {chartData.length > 4 && (
              <p className="text-[10px] text-center text-stone-400 italic">
                +{chartData.length - 4} metode pembayaran lainnya
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer Insight */}
      <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
        <span>Total Omset di Periode Ini:</span>
        <strong className="text-stone-900 font-bold">{formatCurrency(totalGross)}</strong>
      </div>
    </div>
  );
};
