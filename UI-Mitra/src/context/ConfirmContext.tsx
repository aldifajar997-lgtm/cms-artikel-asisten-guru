import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

interface ConfirmContextType {
  show: (
    title: string,
    message: string,
    confirmText?: string,
    cancelText?: string,
    isDangerous?: boolean
  ) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
  });

  const show = (
    title: string,
    message: string,
    confirmText = 'Lanjutkan',
    cancelText = 'Batal',
    isDangerous = false
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options: { title, message, confirmText, cancelText, isDangerous },
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <ConfirmContext.Provider value={{ show }}>
      {children}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full card-shadow border border-stone-200/80 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                dialogState.options.isDangerous ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              }`}>
                {dialogState.options.isDangerous ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
              <h3 className="text-base font-bold text-stone-900 tracking-tight">
                {dialogState.options.title}
              </h3>
            </div>
            
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed mb-6">
              {dialogState.options.message}
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer"
              >
                {dialogState.options.cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition cursor-pointer ${
                  dialogState.options.isDangerous
                    ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-600/20'
                    : 'bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark shadow-brand-teal/20'
                }`}
              >
                {dialogState.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};
