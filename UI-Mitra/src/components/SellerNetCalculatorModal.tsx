import React, { useState, useEffect } from 'react';
import {
  Calculator,
  X,
  Coins,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Check,
  ArrowRight,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Target,
  QrCode,
  CreditCard,
  Building2,
  Info
} from 'lucide-react';
import { FeePolicy } from '../types';
import { formatCurrency } from '../utils/dateFormatter';
import {
  calculateProductEarningsWithPolicy,
  calculateGrossFromTargetNet,
  getPsychologicalPriceOptions,
  calculateVolumeEarnings
} from '../utils/financialCalculations';

interface SellerNetCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrice: number;
  onApplyPrice: (price: number) => void;
  policy: FeePolicy | null;
}

export const SellerNetCalculatorModal: React.FC<SellerNetCalculatorModalProps> = ({
  isOpen,
  onClose,
  currentPrice,
  onApplyPrice,
  policy
}) => {
  // Mode kalkulator: 'from_price' (Dari Harga Jual) vs 'from_net' (Dari Target Bersih)
  const [activeTab, setActiveTab] = useState<'from_price' | 'from_net'>('from_price');

  // Pilihan metode pembayaran untuk simulasi: 'qris' vs 'va'
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'va'>('qris');

  // Nilai simulasi harga kotor (gross)
  const [simPrice, setSimPrice] = useState<number>(currentPrice > 0 ? currentPrice : 50000);
  
  // Nilai target bersih yang diinginkan
  const [targetNet, setTargetNet] = useState<number>(50000);

  // Multiplier volume simulasi penjualan
  const [selectedVolume, setSelectedVolume] = useState<number>(10);
  const [customVolume, setCustomVolume] = useState<string>('10');

  useEffect(() => {
    if (isOpen) {
      if (currentPrice > 0) {
        setSimPrice(currentPrice);
      } else {
        setSimPrice(50000);
      }
    }
  }, [isOpen, currentPrice]);

  if (!isOpen) return null;

  const minProductPrice = policy?.min_product_price ?? 10000;
  const bankDisbursementFee = policy?.bank_disbursement_fee ?? 2500;
  const minWithdrawalAmount = policy?.min_withdrawal_amount ?? 50000;

  // 1. Kalkulasi dinamis berdasarkan konfigurasi Super Admin
  const priceEarnings = calculateProductEarningsWithPolicy(simPrice, policy, paymentMethod);

  // 2. Kalkulasi Mode Target Bersih
  const calculatedGross = calculateGrossFromTargetNet(targetNet, policy, paymentMethod);
  const targetEarnings = calculateProductEarningsWithPolicy(calculatedGross, policy, paymentMethod);
  const psychologicalOptions = getPsychologicalPriceOptions(calculatedGross);

  // Harga terpilih yang akan diaplikasikan ke form produk
  const effectivePriceToApply = activeTab === 'from_price' ? simPrice : calculatedGross;

  // 3. Kalkulasi Volume Penjualan
  const volumeQty = Math.max(1, parseInt(customVolume, 10) || selectedVolume);
  const volumeStats = calculateVolumeEarnings(
    effectivePriceToApply,
    volumeQty,
    policy,
    paymentMethod
  );

  // Quick preset chips
  const pricePresets = [15000, 25000, 50000, 75000, 100000, 150000, 200000];
  const targetPresets = [20000, 35000, 50000, 75000, 100000, 150000];
  const volumePresets = [1, 5, 10, 25, 50, 100];

  const handleApply = (priceToSet: number) => {
    onApplyPrice(priceToSet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-stone-200/90 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center border border-teal-100/80 shadow-xs">
              <Calculator className="w-5 h-5 text-brand-teal" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 leading-tight">
                  Kalkulator Pendapatan Bersih Mitra
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100/80 text-brand-teal-dark border border-teal-200">
                  <Sparkles className="w-2.5 h-2.5" /> Terhubung Pengaturan Admin
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Perhitungan real-time mengikuti kebijakan potongan platform & aturan Midtrans dari Super Admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
          
          {/* Card Status Kebijakan Super Admin Aktif */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-teal" />
                <span>Pengaturan Resmi Super Admin yang Diterapkan:</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Aktif
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-stone-200/70">
              <div className="p-2 bg-white rounded-xl border border-stone-100">
                <p className="text-stone-400 font-medium">Bagi Hasil Kreator</p>
                <p className="font-extrabold text-brand-teal text-sm">
                  {policy?.creator_share_percent || `${(100 - priceEarnings.feeBps / 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="p-2 bg-white rounded-xl border border-stone-100">
                <p className="text-stone-400 font-medium">Komisi Platform</p>
                <p className="font-extrabold text-stone-800 text-sm">
                  {policy?.fee_percent || `${(priceEarnings.feeBps / 100).toFixed(1)}%`}
                </p>
              </div>
              <div className="p-2 bg-white rounded-xl border border-stone-100">
                <p className="text-stone-400 font-medium">Penanggung Midtrans</p>
                <p className="font-extrabold text-indigo-700 text-xs capitalize truncate" title={priceEarnings.midtransPayerLabel}>
                  {priceEarnings.midtransPayer === 'seller' 
                    ? 'Dipotong Seller' 
                    : (priceEarnings.midtransPayer === 'platform' ? 'Platform' : 'Pembeli')}
                </p>
              </div>
              <div className="p-2 bg-white rounded-xl border border-stone-100">
                <p className="text-stone-400 font-medium">Tarif Gateway</p>
                <p className="font-bold text-stone-700 text-xs">
                  QRIS {priceEarnings.midtransQrisPercent} • VA {formatCurrency(priceEarnings.midtransVaFee)}
                </p>
              </div>
            </div>
          </div>

          {/* Selector Metode Pembayaran (QRIS vs VA) */}
          <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-brand-teal" />
                <span>Simulasikan Berdasarkan Metode Pembayaran Pembeli:</span>
              </label>
              <span className="text-[10px] text-stone-500">
                Biaya Midtrans berbeda per metode
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'qris'
                    ? 'bg-white border-brand-teal shadow-xs'
                    : 'bg-white/60 border-stone-200 hover:bg-white text-stone-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-brand-teal" />
                  <div>
                    <p className="text-xs font-bold text-stone-900">QRIS ({priceEarnings.midtransQrisPercent})</p>
                    <p className="text-[10px] text-stone-500">GoPay, ShopeePay, BCA, Mandiri</p>
                  </div>
                </div>
                {paymentMethod === 'qris' && <Check className="w-4 h-4 text-brand-teal" />}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('va')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                  paymentMethod === 'va'
                    ? 'bg-white border-brand-teal shadow-xs'
                    : 'bg-white/60 border-stone-200 hover:bg-white text-stone-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-teal" />
                  <div>
                    <p className="text-xs font-bold text-stone-900">Virtual Account ({formatCurrency(priceEarnings.midtransVaFee)})</p>
                    <p className="text-[10px] text-stone-500">Transfer Bank Otomatis</p>
                  </div>
                </div>
                {paymentMethod === 'va' && <Check className="w-4 h-4 text-brand-teal" />}
              </button>
            </div>
          </div>

          {/* Tab Navigasi Mode */}
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-2xl border border-stone-200/70 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('from_price')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'from_price'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-brand-teal" />
              <span>1. Mulai dari Rencana Harga Jual</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('from_net')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl transition cursor-pointer ${
                activeTab === 'from_net'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-brand-teal" />
              <span>2. Hitung dari Target Bersih</span>
            </button>
          </div>

          {/* TAB 1: DARI HARGA JUAL */}
          {activeTab === 'from_price' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Input Harga Jual dengan Preset Cepat */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-stone-500" />
                    <span>Masukkan Rencana Harga Jual Produk</span>
                  </label>
                  <span className="text-[11px] font-extrabold text-brand-teal bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                    {formatCurrency(simPrice)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={simPrice || ''}
                    onChange={(e) => setSimPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Contoh: 50000"
                    className="w-full pl-11 pr-4 py-2.5 text-base font-extrabold text-stone-900 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                  />
                </div>

                {/* Slider Cepat */}
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-stone-400 font-semibold mb-1">
                    <span>Rp 10.000</span>
                    <span>Rp 150.000</span>
                    <span>Rp 300.000+</span>
                  </div>
                  <input
                    type="range"
                    min={10000}
                    max={300000}
                    step={5000}
                    value={Math.min(300000, Math.max(10000, simPrice))}
                    onChange={(e) => setSimPrice(parseInt(e.target.value, 10))}
                    className="w-full accent-brand-teal cursor-pointer"
                  />
                </div>

                {/* Quick Preset Chips */}
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                    Pilihan Cepat Harga:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pricePresets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSimPrice(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          simPrice === p
                            ? 'bg-brand-teal text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {formatCurrency(p)}
                      </button>
                    ))}
                  </div>
                </div>

                {simPrice > 0 && simPrice < minProductPrice && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Harga minimum platform adalah <strong>{formatCurrency(minProductPrice)}</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSimPrice(minProductPrice)}
                      className="ml-auto underline font-bold hover:text-amber-950 cursor-pointer"
                    >
                      Set ke Min
                    </button>
                  </div>
                )}
              </div>

              {/* Hasil Rincian Per Penjualan Berdasarkan Aturan Admin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Uang Bersih Seller */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white border border-emerald-200 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-brand-teal" />
                      Hak Bersih Seller
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-teal text-white">
                      {priceEarnings.netPercent}%
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight my-1">
                    {formatCurrency(priceEarnings.net)}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Masuk langsung ke Saldo Dompet Mitra per 1 unit terjual
                  </p>
                  
                  {/* Perbandingan Langsung QRIS vs VA */}
                  <div className="mt-3 pt-2.5 border-t border-emerald-200/80 text-[11px] space-y-1">
                    <div className="flex justify-between text-stone-600">
                      <span>Jika dibayar via QRIS:</span>
                      <strong className="text-emerald-900">{formatCurrency(priceEarnings.netQRIS)}</strong>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Jika dibayar via Virtual Account:</span>
                      <strong className="text-emerald-900">{formatCurrency(priceEarnings.netVA)}</strong>
                    </div>
                  </div>
                </div>

                {/* Potongan Platform & Midtrans */}
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-800 pb-1 border-b border-stone-200">
                      <span>Rincian Potongan & Biaya</span>
                      <span className="text-rose-600 font-extrabold">
                        {`-${formatCurrency(priceEarnings.fee)}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-600">
                      <span>{`Komisi Platform (${priceEarnings.adminFeePercent}%):`}</span>
                      <strong className="text-stone-900">{`-${formatCurrency(priceEarnings.adminFee)}`}</strong>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-600">
                        {`Biaya Midtrans (${paymentMethod === 'qris' ? priceEarnings.midtransQrisPercent : formatCurrency(priceEarnings.midtransVaFee)}):`}
                      </span>
                      {priceEarnings.midtransPayer === 'seller' ? (
                        <strong className="text-rose-600">
                          {`-${formatCurrency(paymentMethod === 'qris' ? priceEarnings.sellerDeductionMidtransQris : priceEarnings.sellerDeductionMidtransVa)}`}
                        </strong>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[10.5px]">
                          {`Rp 0 (Ditanggung ${priceEarnings.midtransPayer === 'platform' ? 'Platform' : 'Pembeli'})`}
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-stone-200/80 text-[10.5px] text-stone-600 leading-relaxed">
                      {priceEarnings.midtransPayer === 'seller' ? (
                        <div className="flex items-start gap-1.5 text-amber-800 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>Sesuai kebijakan Super Admin, biaya gateway Midtrans dipotong dari pendapatan seller.</span>
                        </div>
                      ) : priceEarnings.midtransPayer === 'platform' ? (
                        <div className="flex items-start gap-1.5 text-emerald-800 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Sesuai kebijakan Super Admin, biaya gateway Midtrans diserap penuh oleh platform.</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5 text-stone-600 font-medium">
                          <Info className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                          <span>{`Sesuai kebijakan Super Admin, biaya gateway Midtrans dibebankan ke pembeli saat checkout (total tagihan pembeli: ${formatCurrency(priceEarnings.buyerPays)}).`}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {Boolean(policy?.min_fee) && (
                    <p className="text-[10px] text-stone-400 italic">
                      {`* Minimal potongan komisi platform: ${formatCurrency(policy?.min_fee)}`}
                    </p>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: DARI TARGET BERSIH */}
          {activeTab === 'from_net' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Input Target Uang Bersih */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Berapa uang bersih yang ingin Anda terima per penjualan?</span>
                  </label>
                  <span className="text-[11px] font-extrabold text-brand-teal bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                    Target: {formatCurrency(targetNet)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={targetNet || ''}
                    onChange={(e) => setTargetNet(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Contoh: 50000"
                    className="w-full pl-11 pr-4 py-2.5 text-base font-extrabold text-stone-900 border border-stone-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-teal focus:border-brand-teal transition"
                  />
                </div>

                {/* Preset Chips Target Bersih */}
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                    Pilihan Target Cepat:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {targetPresets.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTargetNet(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          targetNet === t
                            ? 'bg-brand-teal text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {formatCurrency(t)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rekomendasi Harga Jual Produk */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-white border border-teal-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                    <Sparkles className="w-4 h-4 text-brand-teal" />
                    <span>Rekomendasi Harga Jual Produk ({paymentMethod.toUpperCase()})</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Tepat Target
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <p className="text-3xl font-extrabold text-stone-900 tracking-tight">
                    {formatCurrency(calculatedGross)}
                  </p>
                  <p className="text-xs text-stone-600">
                    Hasil Bersih Aktual: <strong className="text-brand-teal font-extrabold">{formatCurrency(targetEarnings.net)}</strong>
                  </p>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  Jika Anda memasang harga <strong>{formatCurrency(calculatedGross)}</strong>, setelah dipotong komisi platform ({targetEarnings.adminFeePercent}%: -{formatCurrency(targetEarnings.adminFee)})
                  {targetEarnings.midtransPayer === 'seller' ? ` dan biaya gateway Midtrans (-${formatCurrency(targetEarnings.fee - targetEarnings.adminFee)})` : ''},
                  Anda akan menerima bersih <strong>{formatCurrency(targetEarnings.net)}</strong>.
                </p>

                {/* Opsi Harga Psikologis / Pembulatan */}
                {psychologicalOptions.length > 1 && (
                  <div className="pt-2 border-t border-teal-100/80">
                    <span className="text-[11px] font-bold text-stone-700 block mb-2">
                      Pilihan Angka Rapi & Psikologis yang Disukai Pembeli:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {psychologicalOptions.map((optPrice) => {
                        const optEarnings = calculateProductEarningsWithPolicy(optPrice, policy, paymentMethod);
                        return (
                          <button
                            type="button"
                            key={optPrice}
                            onClick={() => handleApply(optPrice)}
                            className="w-full text-left p-2.5 rounded-xl border border-stone-200 bg-white hover:border-brand-teal hover:bg-teal-50/40 transition cursor-pointer flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-xs font-extrabold text-stone-900 group-hover:text-brand-teal">
                                {formatCurrency(optPrice)}
                              </p>
                              <p className="text-[10px] text-stone-500">
                                {`Bersih: ${formatCurrency(optEarnings.net)}`}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-brand-teal group-hover:underline flex items-center gap-1">
                              Pilih <ArrowRight className="w-3 h-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* SIMULASI MULTIPEL PENJUALAN (PROYEKSI VOLUME) */}
          <div className="p-4 rounded-2xl bg-stone-50/90 border border-stone-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-teal" />
                <span className="text-xs font-bold text-stone-900">
                  Simulasi Proyeksi Akumulasi Penjualan
                </span>
              </div>
              <span className="text-[10px] text-stone-500">
                Harga: {formatCurrency(effectivePriceToApply)} • Metode: {paymentMethod.toUpperCase()}
              </span>
            </div>

            {/* Selector Jumlah Penjualan */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-stone-500 mr-1">Target Laku:</span>
              {volumePresets.map((vol) => (
                <button
                  key={vol}
                  type="button"
                  onClick={() => {
                    setSelectedVolume(vol);
                    setCustomVolume(vol.toString());
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    volumeQty === vol
                      ? 'bg-stone-900 text-white'
                      : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {vol}x
                </button>
              ))}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={customVolume}
                  onChange={(e) => {
                    setCustomVolume(e.target.value);
                    const parsed = parseInt(e.target.value, 10);
                    if (parsed > 0) setSelectedVolume(parsed);
                  }}
                  className="w-16 px-2 py-0.5 text-xs font-bold border border-stone-200 rounded-md bg-white text-center"
                />
                <span className="text-[11px] text-stone-500">unit</span>
              </div>
            </div>

            {/* Ringkasan Hasil Proyeksi */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-stone-200/80 text-center">
              <div>
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Total Omset</p>
                <p className="text-xs sm:text-sm font-bold text-stone-800 mt-0.5">
                  {formatCurrency(volumeStats.totalGross)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-stone-400 font-semibold uppercase">Total Potongan</p>
                <p className="text-xs sm:text-sm font-bold text-rose-600 mt-0.5">
                  {`-${formatCurrency(volumeStats.totalFee)}`}
                </p>
              </div>
              <div className="bg-teal-50/70 rounded-lg py-1 border border-teal-100/70">
                <p className="text-[10px] text-brand-teal font-extrabold uppercase">Total Bersih</p>
                <p className="text-xs sm:text-sm font-extrabold text-brand-teal mt-0.5">
                  {formatCurrency(volumeStats.totalNet)}
                </p>
              </div>
            </div>

            {volumeStats.totalNet >= minWithdrawalAmount && (
              <p className="text-[11px] text-emerald-800 flex items-center gap-1.5 pl-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Hasil bersih ini memenuhi ambang batas penarikan dana ({formatCurrency(minWithdrawalAmount)}). Setelah dikurangi biaya kliring transfer bank {formatCurrency(bankDisbursementFee)}, Anda menerima bersih <strong>{formatCurrency(volumeStats.totalNet - bankDisbursementFee)}</strong> di rekening bank.
                </span>
              </p>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-200/60 transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={() => handleApply(effectivePriceToApply)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-teal/20 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Terapkan Harga {formatCurrency(effectivePriceToApply)} ke Produk</span>
          </button>
        </div>

      </div>
    </div>
  );
};
