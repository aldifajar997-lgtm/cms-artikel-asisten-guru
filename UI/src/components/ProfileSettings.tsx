import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Award,
  Target,
  FileCheck,
  CheckCircle2,
  Sparkles,
  Save,
  Globe,
  Feather, 
  BookOpen, 
  Loader2, 
  Lock,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Link2
} from 'lucide-react';
import { UserProfile } from '../types';
import api, { handleApiError } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

interface ProfileSettingsProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  totalArticlesWritten: number;
  totalWordsWritten: number;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  profile,
  onUpdateProfile,
  totalArticlesWritten,
  totalWordsWritten,
}) => {
  const { success, error: showError, warning } = useToast();
  const { show: showConfirm } = useConfirm();
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Password states
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '' });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // FIX Bug #6: Re-sync formData ketika profile prop berubah (misal setelah token refresh)
  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  // FIX Bug #7: Cleanup blob URL saat unmount untuk mencegah memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    try {
      let finalAvatarUrl = formData.avatarUrl;

      // 1. Jika ada file foto yang dipilih, unggah terlebih dahulu
      if (avatarFile) {
        // Validasi client-side
        if (avatarFile.size > 2 * 1024 * 1024) {
          throw new Error('Ukuran file foto maksimal 2MB.');
        }
        const data = new FormData();
        data.append('avatar', avatarFile);
        
        // Axios butuh kita secara eksplisit mendeklarasikan multipart agar menimpa default application/json
        const res = await api.post('/users/me/avatar', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        // Biarkan response dari server (relative URL) yang dikirim kembali ke PUT /users/me
        // agar backend tidak kebingungan dan menganggap URL berubah lalu menghapusnya
        finalAvatarUrl = res.data.avatar_url;
      }

      // Pastikan kita hanya mengirimkan URL relatif ke backend
      if (finalAvatarUrl && finalAvatarUrl.startsWith('http')) {
        const baseUrl = api.defaults.baseURL || 'http://localhost:8787/api';
        const origin = baseUrl.replace('/api', '');
        if (finalAvatarUrl.startsWith(origin)) {
          finalAvatarUrl = finalAvatarUrl.substring(origin.length);
        }
      }

      // 2. Simpan profil teks ke Backend
      await api.put('/users/me', {
        name: formData.name,
        avatar_url: finalAvatarUrl,
        bio: formData.bio,
        portfolioUrl: formData.portfolioUrl,
        targetMinWords: formData.targetMinWords,
        targetKeywordDensity: formData.targetKeywordDensity,
        preferredTone: formData.preferredTone,
        mainLanguage: formData.mainLanguage,
        monthlyArticleGoal: formData.monthlyArticleGoal,
        monthlyWordGoal: formData.monthlyWordGoal,
        primaryNiche: formData.primaryNiche,
        socialLinkedin: formData.socialLinkedin,
        socialTwitter: formData.socialTwitter,
        socialInstagram: formData.socialInstagram,
        socialFacebook: formData.socialFacebook,
        socialTiktok: formData.socialTiktok
      });
      
      // 3. Simpan keseluruhan form ke Local Storage (untuk sinkronisasi state UI)
      const updatedProfile = { ...formData, avatarUrl: finalAvatarUrl };
      onUpdateProfile(updatedProfile);
      setFormData(updatedProfile);
      setAvatarFile(null); // Reset setelah sukses
      
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPassword(true);
    try {
      await api.put('/users/me/password', passwordData);
      success('Password berhasil diperbarui! Sesi di perangkat lain (jika ada) telah dihentikan.');
      setPasswordData({ old_password: '', new_password: '' });
    } catch (err) {
      showError(handleApiError(err));
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {showSavedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 bg-teal-900 text-white text-sm font-medium rounded-xl shadow-lg animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>Pengaturan profil berhasil disimpan!</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Konfigurasi identitas penulis SEO, kredensial E-E-A-T, dan preferensi parameter penulisan artikel.
        </p>
      </div>

      {/* Author Card & Quick Stats */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 text-center sm:text-left">
          <img
            src={previewUrl || (formData.avatarUrl ? (formData.avatarUrl.startsWith('http') ? formData.avatarUrl : `${(api.defaults.baseURL || 'http://localhost:8787/api').replace('/api', '')}${formData.avatarUrl}`) : null) || 'https://ui-avatars.com/api/?name=' + formData.name}
            alt={formData.name}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover ring-4 ring-teal-500/10 shadow-sm"
          />
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-lg font-bold text-slate-800">{formData.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                SEO Verified Worker
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{formData.role}</p>
            <p className="text-xs text-teal-600 font-medium mt-1 flex items-center justify-center sm:justify-start space-x-1">
              <Mail className="w-3.5 h-3.5" />
              <span>{formData.email}</span>
            </p>
          </div>
        </div>

        {/* Lifetime Productivity Stats */}
        <div className="flex items-center space-x-4 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
          <div className="text-center sm:text-left">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Ditulis</p>
            <p className="text-xl font-bold text-slate-800">{totalArticlesWritten} Artikel</p>
            <p className="text-[11px] text-teal-600 font-medium">{totalWordsWritten.toLocaleString('id-ID')} kata</p>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Profil Penulis & E-E-A-T */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Identitas Penulis (E-E-A-T Google)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Nama Lengkap Penulis</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Peran / Gelar Profesi</label>
              <input
                type="text"
                value={formData.role}
                disabled
                title="Hubungi Super Admin untuk mengubah peran Anda."
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Email Kerja</label>
              <input
                type="email"
                value={formData.email}
                disabled
                title="Email tidak dapat diubah."
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="font-semibold text-slate-700">Ganti Foto Avatar (Max 2MB)</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2 * 1024 * 1024) {
                        warning('Ukuran file tidak boleh lebih dari 2MB');
                        e.target.value = '';
                        return;
                      }
                      // FIX Bug #7: Revoke blob URL lama sebelum membuat yang baru
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setAvatarFile(file);
                      setPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-all cursor-pointer"
                />
                {(previewUrl || formData.avatarUrl) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await showConfirm('Hapus Foto', 'Foto akan dihapus dari form. Jangan lupa klik "Simpan Profil" di bawah untuk memanenkannya!', 'Hapus', 'Batal');
                      if (confirmed) {
                        setAvatarFile(null);
                        // FIX Bug #7: Revoke blob URL saat hapus foto
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        setFormData({ ...formData, avatarUrl: '' });
                      }
                    }}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl border border-transparent hover:border-red-100 whitespace-nowrap transition-colors"
                  >
                    Hapus Foto
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold text-slate-700">
                Bio Penulis (Disertakan dalam schema author & akhir artikel)
              </label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) => handleChange('bio', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 leading-relaxed"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold text-slate-700">URL Portfolio / Website</label>
              <input
                type="url"
                placeholder="https://"
                value={formData.portfolioUrl}
                onChange={(e) => handleChange('portfolioUrl', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold text-slate-700">Niche Utama (Topik Keahlian)</label>
              <input
                type="text"
                placeholder="Contoh: Teknologi & SaaS"
                value={formData.primaryNiche}
                onChange={(e) => handleChange('primaryNiche', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 1.5: Tautan Media Sosial */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Globe className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Tautan Media Sosial (Opsional)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* LinkedIn */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Linkedin className="w-3.5 h-3.5 text-blue-600" /> LinkedIn
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="username_linkedin"
                  value={formData.socialLinkedin || ''}
                  onChange={(e) => handleChange('socialLinkedin', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
                />
                {formData.socialLinkedin && (
                  <a href={`https://linkedin.com/in/${formData.socialLinkedin}`} target="_blank" rel="noopener noreferrer" className="p-2 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Kunjungi Tautan">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Twitter */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Twitter className="w-3.5 h-3.5 text-blue-400" /> Twitter / X
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@username"
                  value={formData.socialTwitter || ''}
                  onChange={(e) => handleChange('socialTwitter', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
                />
                {formData.socialTwitter && (
                  <a href={`https://twitter.com/${formData.socialTwitter.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Kunjungi Tautan">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Instagram */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-600" /> Instagram
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@username"
                  value={formData.socialInstagram || ''}
                  onChange={(e) => handleChange('socialInstagram', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
                />
                {formData.socialInstagram && (
                  <a href={`https://instagram.com/${formData.socialInstagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Kunjungi Tautan">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Facebook */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-700" /> Facebook
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="username_facebook"
                  value={formData.socialFacebook || ''}
                  onChange={(e) => handleChange('socialFacebook', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
                />
                {formData.socialFacebook && (
                  <a href={`https://facebook.com/${formData.socialFacebook}`} target="_blank" rel="noopener noreferrer" className="p-2 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Kunjungi Tautan">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* TikTok */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-900" /> TikTok
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@username"
                  value={formData.socialTiktok || ''}
                  onChange={(e) => handleChange('socialTiktok', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800 font-medium"
                />
                {formData.socialTiktok && (
                  <a href={`https://tiktok.com/@${formData.socialTiktok.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 flex shrink-0 items-center justify-center bg-teal-50 text-teal-600 rounded-xl hover:bg-teal-100 transition-colors" title="Kunjungi Tautan">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Preferensi Standar SEO */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Feather className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Preferensi Standar Penulisan SEO</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Target Minimal Kata per Artikel</label>
              <input
                type="number"
                min="500"
                step="100"
                value={formData.targetMinWords}
                onChange={(e) => handleChange('targetMinWords', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white font-medium"
              />
              <p className="text-[11px] text-slate-400">Digunakan sebagai patokan audit panjang artikel.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Target Densitas Kata Kunci (%)</label>
              <input
                type="number"
                min="0.5"
                max="3"
                step="0.1"
                value={formData.targetKeywordDensity}
                onChange={(e) => handleChange('targetKeywordDensity', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white font-medium"
              />
              <p className="text-[11px] text-slate-400">Rekomendasi aman: 1.0% - 2.0%.</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Tone of Voice Default</label>
              <input
                type="text"
                value={formData.preferredTone}
                onChange={(e) => handleChange('preferredTone', e.target.value)}
                placeholder="contoh: Informatif, Otoritatif, & Santai"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Bahasa Utama</label>
              <select
                value={formData.mainLanguage}
                onChange={(e) => handleChange('mainLanguage', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-medium text-slate-800"
              >
                <option value="Bahasa Indonesia (ID) & English (US)">
                  Bahasa Indonesia (ID) & English (US)
                </option>
                <option value="Bahasa Indonesia (ID)">Bahasa Indonesia (ID) Murni</option>
                <option value="English (US)">English (US)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Target Bulanan Worker */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Target className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Target Bulanan SEO Worker</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Target Jumlah Artikel per Bulan</label>
              <input
                type="number"
                min="1"
                value={formData.monthlyArticleGoal}
                onChange={(e) => handleChange('monthlyArticleGoal', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Target Total Kata per Bulan</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={formData.monthlyWordGoal}
                onChange={(e) => handleChange('monthlyWordGoal', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmittingProfile}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-70"
          >
            {isSubmittingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Simpan Perubahan Profile</span>
          </button>
        </div>
      </form>

      {/* Section 4: Ganti Password (Terpisah dari Profile Form) */}
      {/* FIX Bug #9: Sembunyikan untuk super_admin karena backend menolak perubahan password via UI */}
      {profile.role !== 'super_admin' && (
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl border border-red-100 p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-red-50 pb-3">
            <Lock className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-800">Ubah Password & Keamanan</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Password Lama</label>
              <input
                required
                type="password"
                value={passwordData.old_password}
                onChange={(e) => setPasswordData(prev => ({...prev, old_password: e.target.value}))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-red-500 focus:bg-white font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700">Password Baru</label>
              <input
                required
                type="password"
                minLength={6}
                value={passwordData.new_password}
                onChange={(e) => setPasswordData(prev => ({...prev, new_password: e.target.value}))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-red-500 focus:bg-white font-medium"
              />
              <p className="text-[11px] text-slate-400">Minimal 6 karakter.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmittingPassword}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-600/20 transition-all cursor-pointer disabled:opacity-70"
            >
              {isSubmittingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Ubah Password</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
