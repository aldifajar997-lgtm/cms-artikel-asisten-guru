/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve?: (value: boolean) => void;
}

interface ConfirmContextType {
  confirm: {
    show: (title: string, message: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
  };
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const show = useCallback((title: string, message: string, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal') => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  return (
    <ConfirmContext.Provider value={{ confirm: { show } }}>
      {children}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel || 'Konfirmasi'}
        cancelLabel={confirmState.cancelLabel || 'Batal'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};
