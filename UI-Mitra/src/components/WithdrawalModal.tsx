import React, { useState } from 'react';
import { Landmark, X, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils/dateFormatter';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingPayout: number;
  holdingPayout?: number;
  initialBankDetails?: string;
  minWithdrawalAmount?: number;
  bankDisbursementFee?: number;
  onSuccess: () => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  pendingPayout,
  holdingPayout = 0,
  initialBankDetails = '',
  minWithdrawalAmount = 50000,
  bankDisbursementFee = 2500,
  onSuccess,
}) => {
  const { success, error: showError } = useToast();
  const [bankDetails, setBankDetails] = useState(
    initialBankDetails || localStorage.getItem('seller_default_bank_details') || ''
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedBank = bankDetails.trim();
    if (!trimmedBank || trimmedBank.length < 5) {
      showError('Detail rekening tidak valid. Harap isi nama bank, nomor rekening, dan nama pemilik (contoh: BCA 123456789 a/n Nama Anda).');
      return;
    }

    if (trimmedBank.length > 500) {
      showError('Detail rekening terlalu panjang (maksimal 500 karakter).');
      return;
    }

    if (pendingPayout < minWithdrawalAmount) {
      showError(`Saldo minimum penarikan dana platform adalah ${formatCurrency(minWithdrawalAmount)}.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/earnings/withdrawals', { bank_details: trimmedBank });
      localStorage.setItem('seller_default_bank_details', trimmedBank);
      success('Permintaan penarikan dana berhasil diajukan! Admin akan memproses transfer Anda.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Withdrawal submission error', err);
      showError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-stone-200/80 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-brand-teal flex items-center justify-center border border-emerald-100">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-stone-900 leading-tight">Tarik Saldo Penjualan</h3>
              <p className="text-[11px] text-stone-500">Pencairan hak bersih hasil penjualan produk digital</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-2xl p-5 mb-4 border border-emerald-100/80 text-center relative overflow-hidden">
            <p className="text-xs font-semibold text-brand-teal uppercase tracking-wider mb-1">
              Saldo Bersih Siap Ditarik
            </p>
            <p className="text-3xl font-extrabold text-stone-900 tracking-tight">
              {formatCurrency(pendingPayout)}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" /> Bebas potongan tambahan saat pencairan
            </p>
          </div>

          {holdingPayout > 0 && (
            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 mb-5 flex items-start gap-2.5 text-left">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-900 leading-snug">
                <span className="font-bold">Saldo Tertahan: {formatCurrency(holdingPayout)}</span>
                <p className="text-amber-800/80 mt-0.5">
                  Dana transaksi baru ditahan selama 3x24 jam untuk perlindungan komplain pembeli. Saldo ini akan otomatis siap ditarik setelah masa kliring selesai.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Informasi Rekening Tujuan Transfer <span className="text-rose-500">*</span>
              </label>
              <textarea 
                required
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="Contoh: Bank BCA 123456789 a/n Nama Lengkap Anda (atau e-Wallet DANA/GoPay/OVO)"
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-brand-teal focus:border-brand-teal bg-stone-50/50 resize-none font-sans placeholder:text-stone-400"
              ></textarea>
              <p className="text-[11px] text-stone-500 mt-1.5 flex items-start gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>Pastikan nama pemilik rekening sesuai dengan identitas Anda untuk kelancaran transfer.</span>
              </p>
              {bankDisbursementFee > 0 && (
                <p className="text-[10.5px] text-stone-400 mt-1">
                  * Biaya transfer antar-bank (BI-Fast {formatCurrency(bankDisbursementFee)}) dipotong saat pencairan apabila rekening berbeda dengan bank operasional platform.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="submit" 
                disabled={submitting || pendingPayout < minWithdrawalAmount} 
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Memproses...' : (
                  <>
                    <span>Ajukan Penarikan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};
