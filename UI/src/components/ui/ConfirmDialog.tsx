import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {title}
                  </h3>
                </div>
                <button
                  onClick={onCancel}
                  className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 text-slate-600">
                <p>{message}</p>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-slate-200 outline-none"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className="px-4 py-2 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:ring-2 focus:ring-red-200 outline-none"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
