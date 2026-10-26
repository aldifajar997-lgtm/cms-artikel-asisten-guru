import React from 'react';
import { AlertTriangle, RefreshCw, Lock } from 'lucide-react';

interface ConfirmSlugModalProps {
  isOpen: boolean;
  storeSlugInput: string;
  isSavingSlug: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmSlugModal: React.FC<ConfirmSlugModalProps> = ({
  isOpen,
  storeSlugInput,
  isSavingSlug,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-stone-200/80 rounded-3xl max-w-md w-full p-6 text-stone-900 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-base font-bold text-stone-900">Konfirmasi Tautan Toko Permanen</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Anda akan menetapkan alamat berikut sebagai identitas toko permanen Anda:
          </p>
          <div className="p-3 bg-stone-50 rounded-xl border border-teal-200 font-mono text-sm text-brand-teal font-bold">
            asisten-guru.id/{storeSlugInput.trim().toLowerCase()}
          </div>
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-left text-[11px] text-amber-900 leading-relaxed">
            ⚠️ <strong>PERINGATAN:</strong> Tindakan ini hanya dapat dilakukan <strong>1 kali seumur hidup</strong>. Tautan ini tidak dapat diubah, dihapus, atau dialihkan (redirect) di kemudian hari.
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingSlug}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
          >
            Batal & Cek Lagi
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSavingSlug}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-brand-teal hover:bg-brand-teal-light text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            {isSavingSlug ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Ya, Tetapkan Permanen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
