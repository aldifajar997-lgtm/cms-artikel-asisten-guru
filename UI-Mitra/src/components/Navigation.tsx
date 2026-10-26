import React, { useState } from 'react';
import { 
  LayoutDashboard, Package, History, Store, Plus, 
  Menu, X, LogOut, ExternalLink, ShieldCheck, AlertTriangle, Palette 
} from 'lucide-react';
import { UserProfile } from '../types';
import { getMediaUrl } from '../utils/mediaUrl';

export type ActiveTab = 'dashboard' | 'list-produk' | 'buat-produk' | 'transaksi' | 'komplain' | 'profil-toko' | 'tampilan-toko';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewProduct: () => void;
  onLogout: () => void;
  profile: UserProfile;
  productCount: number;
  complaintCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onNewProduct,
  onLogout,
  profile,
  productCount,
  complaintCount = 0,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard Mitra',
      icon: LayoutDashboard,
    },
    {
      id: 'list-produk' as ActiveTab,
      label: 'Katalog Produk',
      icon: Package,
      badge: productCount,
    },
    {
      id: 'transaksi' as ActiveTab,
      label: 'Riwayat Penjualan',
      icon: History,
    },
    {
      id: 'komplain' as ActiveTab,
      label: 'Komplain Pembeli',
      icon: AlertTriangle,
      badge: complaintCount > 0 ? complaintCount : undefined,
      badgeColor: 'bg-rose-500 text-white animate-pulse',
    },
    {
      id: 'tampilan-toko' as ActiveTab,
      label: 'Tampilan Toko',
      icon: Palette,
    },
    {
      id: 'profil-toko' as ActiveTab,
      label: 'Profil Toko',
      icon: Store,
    },
  ];

  const handleSelect = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-stone-200/80 shrink-0 z-40">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Asisten Guru" className="w-8 h-8 object-contain" />
          <div>
            <span className="font-extrabold text-sm tracking-tight text-brand-teal block leading-none font-sans">
              Asisten Guru
            </span>
            <span className="text-[10px] text-stone-500 font-semibold tracking-wider uppercase">
              Portal Mitra
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewProduct}
            className="p-2 bg-brand-teal text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            title="Tambah Produk Baru"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-stone-950/40 z-40 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Sidebar (Desktop Fixed / Mobile Drawer) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-stone-200/80 flex flex-col shrink-0 h-full transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header (Asisten Guru Hub Look) */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center p-1.5 border border-teal-100">
              <img src="/logo.svg" alt="Asisten Guru Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-stone-900 block leading-tight font-sans">
                Asisten Guru
              </span>
              <span className="text-[10px] font-bold text-brand-teal tracking-wider uppercase">
                Portal Mitra Seller
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-stone-400 hover:text-stone-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CTA Tambah Produk */}
        <div className="px-5 pt-5 pb-2">
          <button
            onClick={() => {
              onNewProduct();
              setMobileOpen(false);
            }}
            className="w-full py-2.5 px-4 bg-brand-teal hover:bg-brand-teal-light active:bg-brand-teal-dark text-white rounded-2xl text-xs font-bold shadow-md shadow-brand-teal/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk Baru</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (item.id === 'list-produk' && activeTab === 'buat-produk');
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-teal-50/80 text-brand-teal border border-teal-100 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-teal' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    item.badgeColor 
                      ? item.badgeColor 
                      : (isActive ? 'bg-brand-teal text-white' : 'bg-stone-100 text-stone-600')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile & Logout */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50">
          <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-white transition border border-transparent hover:border-stone-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-100/70 text-brand-teal flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-teal-200">
                {profile.avatarUrl ? (
                  <img src={getMediaUrl(profile.avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{profile.name ? profile.name.slice(0, 2).toUpperCase() : 'MT'}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900 truncate">
                  {profile.name || 'Mitra Seller'}
                </p>
                <p className="text-[10px] text-stone-400 truncate">
                  {profile.email}
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Keluar"
              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Legalitas Platform Mitra */}
          <div className="mt-2.5 pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px] text-stone-400 font-medium">
            <a
              href="/tos"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-teal transition underline-offset-2 hover:underline"
              title="Buka Syarat & Ketentuan di tab baru"
            >
              Syarat & Ketentuan
            </a>
            <span>•</span>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-teal transition underline-offset-2 hover:underline"
              title="Buka Kebijakan Privasi di tab baru"
            >
              Kebijakan Privasi
            </a>
          </div>
        </div>

      </aside>
    </>
  );
};
