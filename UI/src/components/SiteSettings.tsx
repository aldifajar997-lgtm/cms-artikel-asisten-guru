import React, { useState, useEffect } from 'react';
import api, { handleApiError } from '../utils/api';
import { Settings, Image, Globe, Mail, Palette, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface SiteSettingsData {
  site_title: string;
  site_description: string;
  logo_url: string;
  contact_email: string;
  theme_color: string;
}

const DEFAULT_SETTINGS: SiteSettingsData = {
  site_title: 'Asisten Guru',
  site_description: 'Platform belajar dan mengajar untuk guru dan siswa Indonesia',
  logo_url: 'https://asisten-guru.id/web-app-manifest-512x512.png',
  contact_email: '',
  theme_color: '#0D5B52',
};

export function SiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // GET /api/settings mengembalikan flat JSON: {site_title, logo_url, ...}
      const res = await api.get('/settings');
      const data = res.data;
      if (data && typeof data === 'object') {
        setSettings({
          site_title:       data.site_title       || DEFAULT_SETTINGS.site_title,
          site_description: data.site_description || DEFAULT_SETTINGS.site_description,
          logo_url:         data.logo_url         || DEFAULT_SETTINGS.logo_url,
          contact_email:    data.contact_email    || DEFAULT_SETTINGS.contact_email,
          theme_color:      data.theme_color      || DEFAULT_SETTINGS.theme_color,
        });
      }
    } catch (e) {
      console.error('Gagal memuat pengaturan situs:', e);
      setErrorMsg('Gagal memuat pengaturan. Pastikan koneksi stabil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMsg('');

    // Validasi logo_url harus berupa URL valid
    if (settings.logo_url && !isValidUrl(settings.logo_url)) {
      setErrorMsg('URL Logo tidak valid. Harus dimulai dengan https://');
      setSaveStatus('error');
      setIsSaving(false);
      return;
    }

    try {
      // PUT /api/settings menerima array of {key, value}
      const payload = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await api.put('/settings', payload);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Gagal menyimpan pengaturan:', err);
      setErrorMsg(handleApiError(err));
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mr-2" />
        <span className="text-slate-500">Memuat pengaturan...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-teal-50 rounded-lg">
          <Settings className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Pengaturan Situs</h1>
          <p className="text-sm text-slate-500">
            Konfigurasi global yang digunakan oleh Hub dan halaman blog untuk Google SERP
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Logo URL — field terpenting untuk SEO */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Image className="w-4 h-4 text-teal-600" />
            <label className="text-sm font-medium text-slate-700">
              URL Logo Situs <span className="text-red-400">*</span>
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Digunakan di JSON-LD Organization dan Article (schema Google SERP). 
            Gunakan PNG 512×512 untuk hasil terbaik. 
            <span className="font-medium text-teal-600"> Pastikan URL ini dapat diakses publik.</span>
          </p>
          <input
            type="url"
            value={settings.logo_url}
            onChange={(e) => {
              setSettings(s => ({ ...s, logo_url: e.target.value }));
              setLogoPreviewError(false);
            }}
            placeholder="https://asisten-guru.id/web-app-manifest-512x512.png"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
          />
          {/* Preview logo */}
          {settings.logo_url && isValidUrl(settings.logo_url) && (
            <div className="mt-3 flex items-center gap-3">
              <div className="w-16 h-16 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                {logoPreviewError ? (
                  <AlertCircle className="w-6 h-6 text-slate-300" />
                ) : (
                  <img
                    src={settings.logo_url}
                    alt="Preview Logo"
                    className="w-full h-full object-contain"
                    onError={() => setLogoPreviewError(true)}
                  />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600">Preview</p>
                {logoPreviewError && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    ⚠ Gambar tidak dapat dimuat. Pastikan URL dapat diakses publik.
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Tombol cepat ke logo default Hub */}
          <button
            type="button"
            onClick={() => {
              setSettings(s => ({ ...s, logo_url: 'https://asisten-guru.id/web-app-manifest-512x512.png' }));
              setLogoPreviewError(false);
            }}
            className="mt-2 text-xs text-teal-600 hover:text-teal-700 underline"
          >
            Gunakan logo default Hub (512×512)
          </button>
        </div>

        {/* Judul Situs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-teal-600" />
            <label className="text-sm font-medium text-slate-700">Nama Situs</label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Muncul di judul halaman blog dan meta tags. Key: <code className="bg-slate-100 px-1 rounded">site_title</code>
          </p>
          <input
            type="text"
            value={settings.site_title}
            onChange={(e) => setSettings(s => ({ ...s, site_title: e.target.value }))}
            placeholder="Asisten Guru"
            maxLength={100}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Deskripsi Situs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-teal-600" />
            <label className="text-sm font-medium text-slate-700">Deskripsi Situs</label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Meta description halaman utama blog. Key: <code className="bg-slate-100 px-1 rounded">site_description</code>
          </p>
          <textarea
            value={settings.site_description}
            onChange={(e) => setSettings(s => ({ ...s, site_description: e.target.value }))}
            placeholder="Platform belajar dan mengajar untuk guru dan siswa Indonesia"
            maxLength={160}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{settings.site_description.length}/160</p>
        </div>

        {/* Email Kontak */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-teal-600" />
            <label className="text-sm font-medium text-slate-700">Email Kontak</label>
          </div>
          <input
            type="email"
            value={settings.contact_email}
            onChange={(e) => setSettings(s => ({ ...s, contact_email: e.target.value }))}
            placeholder="halo@asisten-guru.id"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>

        {/* Theme Color */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-4 h-4 text-teal-600" />
            <label className="text-sm font-medium text-slate-700">Warna Tema</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.theme_color}
              onChange={(e) => setSettings(s => ({ ...s, theme_color: e.target.value }))}
              className="w-10 h-10 rounded cursor-pointer border border-slate-300"
            />
            <input
              type="text"
              value={settings.theme_color}
              onChange={(e) => setSettings(s => ({ ...s, theme_color: e.target.value }))}
              placeholder="#0D5B52"
              maxLength={7}
              className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
            />
          </div>
        </div>

        {/* Info sinkronisasi dengan Hub */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs text-teal-700 font-medium mb-1">ℹ️ Cara Kerja Sinkronisasi dengan Hub</p>
          <ul className="text-xs text-teal-600 space-y-1 list-disc list-inside">
            <li>Hub membaca pengaturan ini setiap halaman blog di-render (SSR) via <code className="bg-teal-100 px-1 rounded">GET /api/settings</code></li>
            <li><strong>logo_url</strong> digunakan di JSON-LD schema.org Article.publisher.logo untuk semua artikel blog</li>
            <li><strong>site_title</strong> digunakan sebagai nama publisher di JSON-LD dan judul tab blog</li>
            <li>Perubahan berlaku langsung setelah disimpan — tidak perlu deploy ulang</li>
          </ul>
        </div>

        {/* Status pesan */}
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Pengaturan berhasil disimpan dan langsung aktif di halaman blog.
          </div>
        )}
        {saveStatus === 'error' && errorMsg && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {errorMsg}
          </div>
        )}

        {/* Tombol simpan */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={isLoading || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}
