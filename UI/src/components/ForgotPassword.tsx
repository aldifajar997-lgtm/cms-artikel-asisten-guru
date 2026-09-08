import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api, { handleApiError } from '../utils/api';
import { TurnstileWidget } from './TurnstileWidget';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const turnstileTokenElement = (e.target as HTMLFormElement).elements.namedItem('cf-turnstile-response') as HTMLInputElement | null;
      const turnstileToken = turnstileTokenElement ? turnstileTokenElement.value : '';

      if (!turnstileToken) {
        setError("Silakan selesaikan verifikasi keamanan (CAPTCHA) terlebih dahulu.");
        setIsLoading(false);
        return;
      }

      await api.post('/auth/forgot-password', { 
        email,
        'cf-turnstile-response': turnstileToken
      });
      setSuccess(true);
    } catch (err) {
      setError(handleApiError(err));
      if (window.turnstile) {
        window.turnstile.reset();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-8 sm:p-10">
          
          <button
            onClick={onBackToLogin}
            className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Login
          </button>

          <div className="flex flex-col items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 text-center tracking-tight">Lupa Password?</h1>
            <p className="text-slate-500 mt-2 text-sm text-center leading-relaxed">
              Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang password.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-start gap-3 border border-red-100/50"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex items-start gap-3 border border-emerald-100/50"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
                  Jika email tersebut terdaftar, kami telah mengirimkan instruksi reset password. Silakan periksa kotak masuk (atau folder spam) Anda.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">Email Anda</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    placeholder="nama@email.com"
                    required
                  />
                </div>
              </div>

              <TurnstileWidget action="forgot_password" />

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-medium shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/50 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <span>Kirim Tautan Reset</span>
                )}
              </motion.button>
            </form>
          )}
          
        </div>
      </motion.div>
    </div>
  );
}
