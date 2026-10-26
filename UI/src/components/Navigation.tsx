import React, { useState } from 'react';
import { 
  FileText, Layers, Plus, Menu, X, Users, LogOut, 
  BookOpen, Settings, LayoutDashboard, ShoppingBag, 
  DollarSign, UserCheck, Scale, FileCheck
} from 'lucide-react';
import { UserProfile } from '../types';
import { getMediaUrl } from '../utils/mediaUrl';

export type ActiveTab = 'dashboard' | 'buat-artikel' | 'list-artikel' | 'pengaturan-kategori' | 'pengaturan-profile' | 'pengaturan-user' | 'glosarium' | 'pengaturan-situs' | 'list-produk' | 'buat-produk' | 'kurasi-produk' | 'pengaturan-pendapatan' | 'persetujuan-seller' | 'pengaturan-legal';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewArticle: () => void;
  onLogout: () => void;
  profile: UserProfile;
  articleCount: number;
  curationCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onNewArticle,
  onLogout,
  profile,
  articleCount,
  curationCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = profile.role ? profile.role.split(',').map(r => r.trim().toLowerCase()) : [];
  const isSuperAdmin = roles.includes('super admin') || roles.includes('super_admin');
  const isAdminOrEditor = isSuperAdmin || roles.includes('admin') || roles.includes('editor');
  const isWriter = roles.includes('writer');
  const isSeller = roles.includes('seller');
  
  const canSeeArticles = isAdminOrEditor || isWriter;
  const canSeeProducts = isAdminOrEditor || isSeller;

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ElementType; badge?: number }> = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    }
  ];

  if (canSeeArticles) {
    navItems.push({
      id: 'list-artikel' as ActiveTab,
      label: 'List Artikel',
      icon: FileText,
      badge: articleCount,
    });
  }

  if (canSeeProducts) {
    navItems.push({
      id: 'list-produk' as ActiveTab,
      label: 'Produk Digital',
      icon: ShoppingBag,
    });
  }

  const isSuperAdminOrAdmin = isSuperAdmin || roles.includes('admin');

  if (isSuperAdminOrAdmin) {
    navItems.push({
      id: 'kurasi-produk' as ActiveTab,
      label: 'Kurasi Produk',
      icon: FileCheck,
      badge: curationCount,
    });
  }

  if (isSuperAdmin) {
    navItems.push({
      id: 'persetujuan-seller' as ActiveTab,
      label: 'Persetujuan Seller',
      icon: UserCheck,
    });
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
    navItems.push({
      id: 'pengaturan-pendapatan' as ActiveTab,
      label: 'Keuangan & Fee',
      icon: DollarSign,
    });
    navItems.push({
      id: 'pengaturan-legal' as ActiveTab,
      label: 'Dokumen Legal',
      icon: Scale,
    });
  }

  // Pengaturan Situs (logo, judul, deskripsi) — untuk super_admin dan Admin
  if (isSuperAdmin || roles.includes('admin')) {
    navItems.push({
      id: 'pengaturan-situs' as ActiveTab,
      label: 'Pengaturan Situs',
      icon: Settings,
    });
  }

  // Glosarium SEO (dimasukkan ke daftar menu agar sidebar rapi & compact)
  navItems.push({
    id: 'glosarium' as ActiveTab,
    label: 'Glosarium SEO',
    icon: BookOpen,
  });

  const handleSelect = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SA';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
          {canSeeArticles && (
            <button
              onClick={onNewArticle}
              className="p-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold"
              title="Tulis Artikel"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
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

      {/* Sleek Compact Sidebar (Komposisi UI-Mitra) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col shrink-0 h-full transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center p-1.5 border border-teal-100 shrink-0">
              <img src="/logo3.svg" alt="SEOAsisten Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight font-sans">
                SEOAsisten
              </span>
              <span className="text-[10px] font-bold text-teal-600 tracking-wider uppercase">
                Writer Studio
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Button */}
        {canSeeArticles && (
          <div className="px-4 pt-4 pb-1">
            <button
              id="btn-quick-new-article"
              onClick={() => {
                onNewArticle();
                setMobileOpen(false);
              }}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-2xl text-xs font-bold shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tulis Artikel Baru</span>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 px-3">
            Main Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'list-artikel' && activeTab === 'buat-artikel') ||
              (item.id === 'list-produk' && activeTab === 'buat-produk');
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-teal-50/80 text-teal-700 border border-teal-100 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-teal-600' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-teal-600 text-white'
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

        {/* Bottom User Profile & Logout (Komposisi Serupa UI-Mitra) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div
            className={`flex items-center justify-between p-2 rounded-2xl hover:bg-white transition border ${
              activeTab === 'pengaturan-profile'
                ? 'bg-white border-teal-200 shadow-xs'
                : 'border-transparent hover:border-slate-200/80'
            }`}
          >
            <button
              onClick={() => handleSelect('pengaturan-profile')}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
              title="Buka Pengaturan Profile"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-100/70 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-teal-200">
                {profile.avatarUrl ? (
                  <img
                    src={getMediaUrl(profile.avatarUrl)}
                    alt={profile.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(profile.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                  {profile.name || 'Admin'}
                </p>
                <p className="text-[10px] text-teal-600 font-semibold tracking-wider uppercase truncate">
                  {profile.role || 'Super Admin'}
                </p>
              </div>
            </button>

            <button
              onClick={onLogout}
              title="Keluar"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer ml-1 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
