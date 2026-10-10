import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Terjadi kesalahan yang tidak tertangani:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Biasanya untuk error chunk lazy load, refresh halaman adalah solusi terbaik.
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-8 text-center bg-slate-50 rounded-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">
            Ups! Terjadi Kesalahan
          </h2>
          <p className="text-slate-600 mb-8 max-w-md leading-relaxed">
            {this.props.fallbackMessage || 'Sistem tidak dapat memuat modul ini. Hal ini mungkin karena masalah jaringan atau versi aplikasi yang baru diperbarui.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            <RefreshCcw className="w-5 h-5" />
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
