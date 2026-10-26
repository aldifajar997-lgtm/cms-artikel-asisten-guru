import React from 'react';
import { MessageCircle } from 'lucide-react';
import { StoreAppearanceConfig } from '../../../types';

interface SocialLinksSectionProps {
  socialLinks: StoreAppearanceConfig['socialLinks'];
  setAppearance: React.Dispatch<React.SetStateAction<StoreAppearanceConfig>>;
}

export const SocialLinksSection: React.FC<SocialLinksSectionProps> = ({
  socialLinks,
  setAppearance
}) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
            6. Media Sosial & Kontak Guru
          </h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={socialLinks.enabled}
            onChange={(e) => setAppearance(prev => ({
              ...prev,
              preset: 'custom',
              socialLinks: { ...prev.socialLinks, enabled: e.target.checked }
            }))}
            className="rounded text-brand-teal focus:ring-teal-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs font-bold text-stone-700">Tampilkan</span>
        </label>
      </div>

      {socialLinks.enabled ? (
        <div className="space-y-4 pt-1">
          {/* Gaya Ikon Medsos */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 block">Gaya Tampilan Ikon</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'colored', label: 'Warna Brand Asli' },
                { id: 'monochrome', label: 'Monokrom Teks' },
                { id: 'pill', label: 'Tombol Kapsul' }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setAppearance(prev => ({
                    ...prev,
                    preset: 'custom',
                    socialLinks: { ...prev.socialLinks, style: st.id as any }
                  }))}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                    socialLinks.style === st.id
                      ? 'border-brand-teal bg-teal-50 text-teal-900'
                      : 'border-stone-200 text-stone-600 bg-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Input Kontak & Medsos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                WhatsApp (Tanya Guru)
              </label>
              <input
                type="text"
                maxLength={30}
                value={socialLinks.whatsapp || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, whatsapp: e.target.value.replace(/[^0-9]/g, '') }
                }))}
                placeholder="Contoh: 6281234567890"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">Format: diawali kode negara (62)</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                Instagram
              </label>
              <input
                type="text"
                maxLength={100}
                value={socialLinks.instagram || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                }))}
                placeholder="@username atau URL profil"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                TikTok
              </label>
              <input
                type="text"
                maxLength={100}
                value={socialLinks.tiktok || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, tiktok: e.target.value }
                }))}
                placeholder="@username atau link TikTok"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                YouTube
              </label>
              <input
                type="text"
                maxLength={150}
                value={socialLinks.youtube || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, youtube: e.target.value }
                }))}
                placeholder="Link channel / profil YouTube"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                LinkedIn
              </label>
              <input
                type="text"
                maxLength={150}
                value={socialLinks.linkedin || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
                }))}
                placeholder="Link profil LinkedIn"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                Facebook
              </label>
              <input
                type="text"
                maxLength={150}
                value={socialLinks.facebook || ''}
                onChange={(e) => setAppearance(prev => ({
                  ...prev,
                  preset: 'custom',
                  socialLinks: { ...prev.socialLinks, facebook: e.target.value }
                }))}
                placeholder="Link profil Facebook"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-brand-teal"
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-stone-400 italic">
          Bar media sosial dinonaktifkan. Centang "Tampilkan" untuk mengaktifkan kembali.
        </p>
      )}
    </div>
  );
};
