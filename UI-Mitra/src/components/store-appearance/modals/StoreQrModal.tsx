import React from 'react';
import { QrCode, X, Download } from 'lucide-react';

interface StoreQrModalProps {
  isOpen: boolean;
  qrCodeUrl: string;
  activeUrl: string;
  onClose: () => void;
  onDownloadQr: () => void;
  onCopyLink: () => void;
}

export const StoreQrModal: React.FC<StoreQrModalProps> = ({
  isOpen,
  qrCodeUrl,
  activeUrl,
  onClose,
  onDownloadQr,
  onCopyLink
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-stone-900 border border-stone-200">
        
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-brand-teal" />
            <h3 className="text-sm font-bold">QR Code Etalase Toko</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-stone-50 rounded-2xl flex flex-col items-center justify-center border border-stone-200/80">
          <img
            src={qrCodeUrl}
            alt="QR Code Toko"
            className="w-52 h-52 rounded-xl shadow-xs border border-white"
          />
          <span className="text-[11px] font-mono text-stone-500 mt-3 truncate max-w-full px-2">
            {activeUrl}
          </span>
        </div>

        <p className="text-xs text-stone-500 text-center leading-relaxed">
          Cetak atau tampilkan QR Code ini pada slide presentasi MGMP, banner seminar guru, atau kartu nama edukasi Anda.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onDownloadQr}
            className="flex-1 py-2.5 px-4 rounded-xl bg-brand-teal hover:bg-brand-teal-light text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Gambar QR</span>
          </button>

          <button
            type="button"
            onClick={onCopyLink}
            className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition cursor-pointer"
          >
            Salin Link
          </button>
        </div>

      </div>
    </div>
  );
};
