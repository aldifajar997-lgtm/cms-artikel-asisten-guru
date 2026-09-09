import React, { useState } from 'react';
import { PenTool, FileText, Layers, User, Plus, Sparkles, Menu, X, Users, LogOut, BookOpen } from 'lucide-react';
import { UserProfile } from '../types';

export type ActiveTab = 'buat-artikel' | 'list-artikel' | 'pengaturan-kategori' | 'pengaturan-profile' | 'pengaturan-user' | 'glosarium';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewArticle: () => void;
  onLogout: () => void;
  profile: UserProfile;
  articleCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onNewArticle,
  onLogout,
  profile,
  articleCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ElementType; badge?: number }> = [
    {
      id: 'list-artikel' as ActiveTab,
      label: 'List Artikel',
      icon: FileText,
      badge: articleCount,
    }
  ];

  if (profile.role === 'super_admin') {
    navItems.push({
      id: 'pengaturan-kategori' as ActiveTab,
      label: 'Pengaturan Kategori',
      icon: Layers,
    });
    navItems.push({
      id: 'pengaturan-user' as ActiveTab,
      label: 'Pengaturan User',
      icon: Users,
    });
  }

  const handleSelect = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 shrink-0 z-40">
        <div className="flex items-center gap-2.5">
          <img src="/logo3.svg" alt="SEOAsisten Logo" className="w-7 h-7" />
          <span className="font-bold text-base tracking-tight text-teal-900">SEOAsisten</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewArticle}
            className="p-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold"
            title="Tulis Artikel"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/30 z-40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sleek Sidebar (Desktop Fixed / Mobile Slide-over) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo3.svg" alt="SEOAsisten Logo" className="w-8 h-8" />
            <div>
              <span className="font-bold text-xl tracking-tight text-teal-900 block leading-none">
                SEOAsisten
              </span>
              <span className="text-[10px] text-teal-600 font-semibold tracking-wider uppercase">
                Writer Studio
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button */}
        <div className="px-4 pt-4">
          <button
            id="btn-quick-new-article"
            onClick={() => {
              onNewArticle();
              setMobileOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:bg-teal-800 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Artikel Baru</span>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3 px-2">
            Main Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-teal-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-teal-200/80 text-teal-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sleek User Profile Card */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={() => handleSelect('glosarium')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left shadow-sm mb-2 ${
              activeTab === 'glosarium'
                ? 'bg-teal-50 border border-teal-200 text-teal-700'
                : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
            }`}
            title="Buka Glosarium SEO"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              activeTab === 'glosarium' ? 'bg-teal-200/50 text-teal-700' : 'bg-teal-50 text-teal-600'
            }`}>
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${activeTab === 'glosarium' ? 'text-teal-800' : 'text-slate-700'}`}>Glosarium SEO</p>
            </div>
          </button>

          <button
            onClick={() => handleSelect('pengaturan-profile')}
            className="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl transition-all text-left cursor-pointer border border-transparent hover:border-slate-200/60"
            title="Buka Pengaturan Profile"
          >
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-teal-500/20">
              <img
                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=0d9488&color=fff`}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{profile.name}</p>
              <p className="text-[10px] text-teal-600 font-semibold tracking-wider uppercase truncate">
                {profile.role || 'SEO Expert'}
              </p>
            </div>
          </button>
          
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-colors cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};
