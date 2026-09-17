import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../context/ToastContext';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800'
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800'
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800'
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-500" />,
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800'
  }
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start p-4 border rounded-xl shadow-lg backdrop-blur-sm ${config.bg}`}
            >
              <div className="flex-shrink-0 mr-3 mt-0.5">
                {config.icon}
              </div>
              <div className={`flex-1 text-sm font-medium ${config.text}`}>
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 ml-4 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
