/**
 * Financial and Percentage Calculations Utility
 * Sinkron 1:1 dengan formula dinamis backend CMS3 (src/routes/earnings.ts & src/routes/products.ts)
 * Seluruh potongan platform dan biaya gateway Midtrans mengikuti konfigurasi Super Admin
 */

import { FeePolicy } from '../types';

export interface DetailedProductEarnings {
  gross: number;
  
  // Konfigurasi Platform Fee
  adminFee: number;
  adminFeePercent: number;
  feeBps: number;
  
  // Konfigurasi Midtrans dari Admin
  midtransPayer: 'buyer' | 'platform' | 'seller';
  midtransPayerLabel: string;
  midtransQrisRateBps: number;
  midtransQrisPercent: string;
  midtransVaFee: number;
  
  // Nominal Biaya Gateway Midtrans per Metode
  midtransQrisAmount: number;
  midtransVaAmount: number;
  
  // Potongan Biaya Midtrans dari Seller (Hanya jika admin set midtrans_fee_payer: 'seller')
  sellerDeductionMidtransQris: number;
  sellerDeductionMidtransVa: number;
  
  // Uang Bersih Seller
  netQRIS: number;
  netVA: number;
  netPercentQRIS: number;
  netPercentVA: number;
  
  // Nilai aktif berdasarkan metode terpilih
  method: 'qris' | 'va';
  net: number;
  netPercent: number;
  feePercent: number;
  fee: number; // Total potongan dari seller (Admin Fee + Midtrans jika seller yang menanggung)
  
  // Total yang dibayarkan pembeli saat checkout
  buyerPaysQRIS: number;
  buyerPaysVA: number;
  buyerPays: number;
}

/**
 * Menghitung potongan admin platform sesuai konfigurasi dinamis super admin
 * @param grossAmount Omset kotor penjualan (Rp)
 * @param feeBps Basis poin potongan (misal 1500 = 15%, 1000 = 10%)
 * @param minFee Batas minimal potongan (jika ada)
 * @param maxFee Batas maksimal potongan (jika ada)
 */
export const calculateAdminFee = (
  grossAmount: number,
  feeBps: number = 1500,
  minFee: number | null = null,
  maxFee: number | null = null
): number => {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const bps = Math.max(0, Number(feeBps) || 0);
  
  let fee = Math.floor((gross * bps) / 10000);

  if (minFee != null && fee < minFee) {
    fee = minFee;
  }
  if (maxFee != null && fee > maxFee) {
    fee = maxFee;
  }

  // Fee tidak boleh melebihi gross
  return Math.min(fee, gross);
};

/**
 * Menghitung hak bersih seller dasar (Gross - Admin Fee)
 */
export const calculateSellerNet = (grossAmount: number, adminFee: number): number => {
  const gross = Math.max(0, Number(grossAmount) || 0);
  const fee = Math.max(0, Number(adminFee) || 0);
  return Math.max(0, gross - fee);
};

/**
 * Menghitung persentase potongan admin aktual
 */
export const calculateFeePercentage = (
  adminFee: number,
  grossAmount: number,
  fallbackBps: number = 1500
): number => {
  const gross = Number(grossAmount) || 0;
  const fee = Number(adminFee) || 0;

  if (gross > 0) {
    return Number(((fee / gross) * 100).toFixed(1));
  }

  return Number((fallbackBps / 100).toFixed(1));
};

/**
 * Menghitung persentase hak bersih seller (Net / Gross)
 */
export const calculateNetPercentage = (
  sellerNet: number,
  grossAmount: number,
  fallbackNetPercent: number = 85.0
): number => {
  const gross = Number(grossAmount) || 0;
  const net = Number(sellerNet) || 0;

  if (gross > 0) {
    return Number(((net / gross) * 100).toFixed(1));
  }

  return fallbackNetPercent;
};

/**
 * Menghitung rasio konversi (CVR / Conversion Rate): (Total Penjualan / Total Tayangan) * 100%
 */
export const calculateConversionRate = (sales: number, views: number): number => {
  const totalSales = Number(sales) || 0;
  const totalViews = Number(views) || 0;

  if (totalViews <= 0) return 0;
  return Number(((totalSales / totalViews) * 100).toFixed(1));
};

/**
 * Menghitung persentase diskon harga normal vs harga jual
 */
export const calculateDiscountPercentage = (
  originalPrice?: number | null,
  currentPrice?: number | null
): number => {
  const original = Number(originalPrice) || 0;
  const current = Number(currentPrice) || 0;

  if (original <= 0 || current <= 0 || original <= current) {
    return 0;
  }

  return Math.round(((original - current) / original) * 100);
};

/**
 * Mengonversi basis point (BPS) ke string persentase format rapi
 */
export const formatBpsToPercent = (bps: number): string => {
  const percent = (Number(bps) || 0) / 100;
  return percent % 1 === 0 ? `${percent}%` : `${percent.toFixed(1)}%`;
};

/**
 * Kalkulasi lengkap penghasilan produk berdasarkan konfigurasi dinamis Super Admin
 * Termasuk pengecekan Midtrans Payer ('buyer', 'platform', atau 'seller')
 */
export const calculateProductEarningsWithPolicy = (
  price: number,
  policy: FeePolicy | null,
  method: 'qris' | 'va' = 'qris'
): DetailedProductEarnings => {
  const gross = Math.max(0, Number(price) || 0);

  // 1. Ekstrak konfigurasi fee platform yang diatur Super Admin
  let feeBps = 1500;
  if (typeof policy?.fee_bps === 'number') {
    feeBps = policy.fee_bps;
  } else if (policy?.fee_percent) {
    const parsed = parseFloat(policy.fee_percent);
    if (!isNaN(parsed)) feeBps = Math.round(parsed * 100);
  }

  const minFee = policy?.min_fee ?? null;
  const maxFee = policy?.max_fee ?? null;

  // 2. Ekstrak konfigurasi Midtrans yang diatur Super Admin
  const midtransPayer = policy?.midtrans?.payer || 'buyer';
  const midtransPayerLabel = policy?.midtrans?.payer_label || (
    midtransPayer === 'buyer' 
      ? 'Dibebankan kepada Pembeli saat Checkout' 
      : (midtransPayer === 'platform' ? 'Ditanggung oleh Platform' : 'Dipotong dari Penjual')
  );
  const qrisRateBps = typeof policy?.midtrans?.qris_rate_bps === 'number' ? policy.midtrans.qris_rate_bps : 70;
  const qrisPercent = policy?.midtrans?.qris_rate_percent || `${(qrisRateBps / 100).toFixed(1)}%`;
  const vaFee = typeof policy?.midtrans?.va_fee === 'number' ? policy.midtrans.va_fee : 4000;

  // 3. Potongan Komisi Platform (Admin Fee)
  const adminFee = calculateAdminFee(gross, feeBps, minFee, maxFee);
  const adminFeePercent = calculateFeePercentage(adminFee, gross, feeBps);

  // 4. Biaya Payment Gateway Midtrans (QRIS vs VA)
  const midtransQrisAmount = gross > 0 ? Math.floor((gross * qrisRateBps) / 10000) : 0;
  const midtransVaAmount = gross > 0 ? vaFee : 0;

  // 5. Cek siapa penanggung biaya Midtrans menurut Admin
  let sellerDeductionMidtransQris = 0;
  let sellerDeductionMidtransVa = 0;

  if (midtransPayer === 'seller') {
    // Admin menentukan: Biaya gateway dipotong dari hak seller
    sellerDeductionMidtransQris = Math.min(gross - adminFee, midtransQrisAmount);
    sellerDeductionMidtransVa = Math.min(gross - adminFee, midtransVaAmount);
  }

  // 6. Uang Bersih Seller (Net)
  const netQRIS = Math.max(0, gross - adminFee - sellerDeductionMidtransQris);
  const netVA = Math.max(0, gross - adminFee - sellerDeductionMidtransVa);
  const netPercentQRIS = calculateNetPercentage(netQRIS, gross);
  const netPercentVA = calculateNetPercentage(netVA, gross);

  // 7. Nilai aktif berdasarkan metode yang dipilih di UI
  const activeMidtransDeduction = method === 'va' ? sellerDeductionMidtransVa : sellerDeductionMidtransQris;
  const net = method === 'va' ? netVA : netQRIS;
  const netPercent = method === 'va' ? netPercentVA : netPercentQRIS;
  const totalDeduction = adminFee + activeMidtransDeduction;
  const feePercent = gross > 0 ? Number(((totalDeduction / gross) * 100).toFixed(1)) : adminFeePercent;

  // 8. Total yang dibayar pembeli saat checkout
  let buyerPaysQRIS = gross;
  let buyerPaysVA = gross;
  if (midtransPayer === 'buyer') {
    buyerPaysQRIS = gross + midtransQrisAmount;
    buyerPaysVA = gross + midtransVaAmount;
  }
  const buyerPays = method === 'va' ? buyerPaysVA : buyerPaysQRIS;

  return {
    gross,
    adminFee,
    adminFeePercent,
    feeBps,
    midtransPayer,
    midtransPayerLabel,
    midtransQrisRateBps: qrisRateBps,
    midtransQrisPercent: qrisPercent,
    midtransVaFee: vaFee,
    midtransQrisAmount,
    midtransVaAmount,
    sellerDeductionMidtransQris,
    sellerDeductionMidtransVa,
    netQRIS,
    netVA,
    netPercentQRIS,
    netPercentVA,
    method,
    net,
    netPercent,
    feePercent,
    fee: totalDeduction,
    buyerPaysQRIS,
    buyerPaysVA,
    buyerPays
  };
};

/**
 * Backward compatibility wrapper
 */
export const estimateProductEarnings = (
  price: number,
  feeBps: number = 1500,
  minFee: number | null = null,
  maxFee: number | null = null
) => {
  const gross = Math.max(0, Number(price) || 0);
  const fee = calculateAdminFee(gross, feeBps, minFee, maxFee);
  const net = calculateSellerNet(gross, fee);
  const feePercent = calculateFeePercentage(fee, gross, feeBps);
  const netPercent = calculateNetPercentage(net, gross, 100 - feePercent);

  return {
    gross,
    fee,
    net,
    feePercent,
    netPercent
  };
};

/**
 * Menghitung rekomendasi harga kotor (gross) dari target uang bersih yang ingin diterima seller
 * Memperhitungkan potongan komisi platform DAN potongan Midtrans (jika admin set midtrans_fee_payer: 'seller')
 */
export const calculateGrossFromTargetNet = (
  targetNet: number,
  policy: FeePolicy | null,
  method: 'qris' | 'va' = 'qris'
): number => {
  const net = Math.max(0, Number(targetNet) || 0);
  if (net <= 0) return 0;

  let feeBps = 1500;
  if (typeof policy?.fee_bps === 'number') {
    feeBps = policy.fee_bps;
  } else if (policy?.fee_percent) {
    const parsed = parseFloat(policy.fee_percent);
    if (!isNaN(parsed)) feeBps = Math.round(parsed * 100);
  }

  const midtransPayer = policy?.midtrans?.payer || 'buyer';
  const qrisRateBps = typeof policy?.midtrans?.qris_rate_bps === 'number' ? policy.midtrans.qris_rate_bps : 70;
  const vaFee = typeof policy?.midtrans?.va_fee === 'number' ? policy.midtrans.va_fee : 4000;

  // Perkiraan kasar awal
  let gross = net;
  if (midtransPayer === 'seller') {
    if (method === 'va') {
      gross = Math.ceil((net + vaFee) / Math.max(0.01, 1 - feeBps / 10000));
    } else {
      const totalBps = feeBps + qrisRateBps;
      gross = Math.ceil(net / Math.max(0.01, 1 - totalBps / 10000));
    }
  } else {
    gross = Math.ceil(net / Math.max(0.01, 1 - feeBps / 10000));
  }

  // Iterasi presisi untuk memastikan net >= targetNet sesuai aturan min_fee/max_fee
  let safety = 0;
  while (safety < 1000) {
    const calc = calculateProductEarningsWithPolicy(gross, policy, method);
    if (calc.net >= net) break;
    gross += 50;
    safety++;
  }

  return gross;
};

/**
 * Menghasilkan opsi harga psikologis dan pembulatan yang menarik bagi pembeli
 */
export const getPsychologicalPriceOptions = (grossPrice: number): number[] => {
  if (grossPrice <= 0) return [];
  const roundedThousand = Math.ceil(grossPrice / 1000) * 1000;
  const roundedFiveThousand = Math.ceil(grossPrice / 5000) * 5000;
  
  const tenThousandFloor = Math.floor(grossPrice / 10000) * 10000;
  const candidateNine = tenThousandFloor + 9000;
  const nextCandidateNine = tenThousandFloor + 19000;
  const psychologicalNine = candidateNine >= grossPrice ? candidateNine : nextCandidateNine;

  const set = new Set([grossPrice, roundedThousand, roundedFiveThousand, psychologicalNine]);
  return Array.from(set).filter(p => p >= grossPrice).sort((a, b) => a - b);
};

/**
 * Menghitung simulasi proyeksi akumulasi penjualan multipel (misal 5x, 10x, 25x, 50x, 100x)
 */
export const calculateVolumeEarnings = (
  price: number,
  quantity: number,
  policy: FeePolicy | null,
  method: 'qris' | 'va' = 'qris'
) => {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const single = calculateProductEarningsWithPolicy(price, policy, method);
  const totalGross = single.gross * qty;
  const totalFee = single.fee * qty;
  const totalAdminFee = single.adminFee * qty;
  const totalMidtransFee = (single.fee - single.adminFee) * qty;
  const totalNet = single.net * qty;

  return {
    quantity: qty,
    single,
    totalGross,
    totalFee,
    totalAdminFee,
    totalMidtransFee,
    totalNet
  };
};
