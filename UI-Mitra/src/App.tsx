import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Product, Category, UserProfile } from './types';
import { Navigation, ActiveTab } from './components/Navigation';
import { ToastProvider, useToast } from './context/ToastContext';
import { ConfirmProvider, useConfirm } from './context/ConfirmContext';
import api, { setAccessToken, handleApiError, onAuthExpired } from './utils/api';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

// Code-splitting via React.lazy: Hanya unduh modul saat halaman/tab dibutuhkan
const DashboardMitra = lazy(() => import('./components/DashboardMitra').then(m => ({ default: m.DashboardMitra })));
const ProductList = lazy(() => import('./components/ProductList').then(m => ({ default: m.ProductList })));
const ProductEditor = lazy(() => import('./components/ProductEditor').then(m => ({ default: m.ProductEditor })));
const TransactionLedger = lazy(() => import('./components/TransactionLedger').then(m => ({ default: m.TransactionLedger })));
const BuyerComplaints = lazy(() => import('./components/BuyerComplaints').then(m => ({ default: m.BuyerComplaints })));
const StoreProfile = lazy(() => import('./components/StoreProfile').then(m => ({ default: m.StoreProfile })));
const StoreAppearanceStudio = lazy(() => import('./components/StoreAppearanceStudio').then(m => ({ default: m.StoreAppearanceStudio })));
const LoginMitra = lazy(() => import('./components/LoginMitra').then(m => ({ default: m.LoginMitra })));
const MitraOnboardingForm = lazy(() => import('./components/MitraOnboardingForm').then(m => ({ default: m.MitraOnboardingForm })));
const ApprovalStatusPage = lazy(() => import('./components/ApprovalStatusPage').then(m => ({ default: m.ApprovalStatusPage })));
const SellerTermsModal = lazy(() => import('./components/SellerTermsModal').then(m => ({ default: m.SellerTermsModal })));
const StandaloneLegalPage = lazy(() => import('./components/StandaloneLegalPage').then(m => ({ default: m.StandaloneLegalPage })));

function TabLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
      <p className="text-xs text-stone-400 font-medium tracking-wide">Memuat modul...</p>
    </div>
  );
}

const DEFAULT_EMPTY_PROFILE: UserProfile = {
  name: '',
  email: '',
  role: '',
  avatarUrl: '',
  bio: '',
  portfolioUrl: '',
  primaryNiche: '',
  bankDetails: '',
  personal_address: '',
  gender: '',
  birth_date: '',
  store_name: '',
  store_description: '',
  store_address: '',
  phone_number: '',
  seller_status: 'none',
  seller_sample_photos: [],
  coverUrl: '',
  bank_name: '',
  bank_account_number: '',
  bank_account_holder: '',
  socialInstagram: '',
  socialLinkedin: '',
  socialTwitter: '',
  socialTiktok: ''
};

function AppContent() {
  const { success, error: showError, warning } = useToast();
  const { show: showConfirm } = useConfirm();

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // User & Store State
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_EMPTY_PROFILE);

  // Product State
  const [products, setProducts] = useState<Product[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [hasMoreProducts, setHasMoreProducts] = useState<boolean>(false);
  const [productOffset, setProductOffset] = useState<number>(0);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState<boolean>(false);
  const [productsLoaded, setProductsLoaded] = useState<boolean>(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Categories State
  const [categories, setCategories] = useState<Category[]>([]);

  // Complaints State (for navigation badge)
  const [complaintCount, setComplaintCount] = useState<number>(0);

  // Sesi Inisialisasi Cepat: Hanya verifikasi sesi & profil user tanpa memblokir ratusan KB produk
  useEffect(() => {
    const initSession = async () => {
      try {
        // 1. Cek Callback SSO dari Hub Asisten Guru
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token') || urlParams.get('token');
        const ssoState = urlParams.get('state');

        if (ssoToken && ssoState) {
          try {
            const ssoRes = await api.post('/auth/sso/hub/callback', {
              token: ssoToken,
              state: ssoState
            });
            if (ssoRes.data?.access_token) {
              setAccessToken(ssoRes.data.access_token);
              setIsAuthenticated(true);
              window.history.replaceState({}, document.title, window.location.pathname);
              await loadUserProfile();
              return;
            }
          } catch (ssoErr) {
            console.error('SSO Callback error', ssoErr);
            showError(handleApiError(ssoErr));
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        // 2. Fallback: Cek Sesi Cookie HttpOnly Refresh Token
        const response = await api.post('/auth/refresh', {});
        if (response.data?.access_token) {
          setAccessToken(response.data.access_token);
          setIsAuthenticated(true);
          await loadUserProfile();
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initSession();

    // Listener sesi kadaluarsa / 401 unrecoverable
    const unsubscribe = onAuthExpired(() => {
      setAccessToken(null);
      setIsAuthenticated(false);
      setProfile(DEFAULT_EMPTY_PROFILE);
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      showError('Sesi Anda telah berakhir. Silakan login kembali.');
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profileRes = await api.get('/users/me');
      if (profileRes.data) {
        const u = profileRes.data;
        let samplePhotos: string[] = [];
        if (Array.isArray(u.seller_sample_photos)) {
          samplePhotos = u.seller_sample_photos;
        } else if (typeof u.seller_sample_photos === 'string') {
          try {
            const parsed = JSON.parse(u.seller_sample_photos);
            if (Array.isArray(parsed)) samplePhotos = parsed;
          } catch {}
        }

        setProfile({
          id: u.id || '',
          name: u.name || '',
          email: u.email || '',
          role: u.role || 'seller',
          avatarUrl: u.avatar_url || '',
          bio: u.bio || '',
          portfolioUrl: u.portfolio_url || '',
          primaryNiche: u.primary_niche || '',
          socialLinkedin: u.social_linkedin || '',
          socialTwitter: u.social_twitter || '',
          socialInstagram: u.social_instagram || '',
          socialFacebook: u.social_facebook || '',
          socialTiktok: u.social_tiktok || '',
          coverUrl: u.cover_url || '',
          bankDetails: u.bank_details || '',
          bank_name: u.bank_name || '',
          bank_account_number: u.bank_account_number || '',
          bank_account_holder: u.bank_account_holder || '',
          seller_status: u.seller_status || 'none',
          seller_rejection_reason: u.seller_rejection_reason || '',
          seller_applied_at: u.seller_applied_at || '',
          seller_sample_photos: samplePhotos,
          personal_address: u.personal_address || '',
          gender: u.gender || '',
          birth_date: u.birth_date || '',
          store_name: u.store_name || '',
          store_description: u.store_description || '',
          store_address: u.store_address || '',
          store_appearance: u.store_appearance || undefined,
          store_slug: u.store_slug || '',
          phone_number: u.phone_number || ''
        });
      }
    } catch (err) {
      console.error('Failed to load user profile', err);
    }
  };

  // Background fetch non-blocking untuk notifikasi badge komplain
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/earnings/complaints?status=open&limit=1')
      .then(res => {
        const cData = res.data;
        if (cData?.total !== undefined) {
          setComplaintCount(cData.total);
        } else if (Array.isArray(cData?.data)) {
          setComplaintCount(cData.data.length);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Lazy data loading: Ambil produk saat pengguna membuka tab 'list-produk'
  useEffect(() => {
    if (isAuthenticated && activeTab === 'list-produk' && !productsLoaded && !isLoadingProducts) {
      setIsLoadingProducts(true);
      fetchProductsList().finally(() => {
        setIsLoadingProducts(false);
        setProductsLoaded(true);
      });
    }
  }, [isAuthenticated, activeTab, productsLoaded, isLoadingProducts]);

  // Sinkronisasi data real-time: Ambil data profil segar & kategori saat pengguna membuka profil toko atau tampilan toko
  useEffect(() => {
    if (isAuthenticated && (activeTab === 'profil-toko' || activeTab === 'tampilan-toko')) {
      loadUserProfile();
    }
  }, [isAuthenticated, activeTab]);

  // Lazy data loading: Ambil kategori saat pengguna membuka formulir buat produk atau profil toko
  useEffect(() => {
    if (isAuthenticated && (activeTab === 'buat-produk' || activeTab === 'profil-toko') && categories.length === 0) {
      api.get('/categories?type=product&limit=100&offset=0')
        .then(res => {
          if (res.data?.data) {
            setCategories(res.data.data);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, activeTab, categories.length]);

  const fetchProductsList = async (isLoadMore = false, overrideOffset?: number) => {
    const offset = isLoadMore ? (overrideOffset !== undefined ? overrideOffset : productOffset) : 0;
    try {
      const res = await api.get(`/products/admin/all?limit=50&offset=${offset}`);
      if (res.data?.data) {
        const fetched = res.data.data;
        if (isLoadMore) {
          setProducts(prev => [...prev, ...fetched]);
        } else {
          setProducts(fetched);
        }
        setHasMoreProducts(fetched.length === 50);
        setProductOffset(offset + 50);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const handleLoadMoreProducts = async () => {
    if (isLoadingMoreProducts || !hasMoreProducts) return;
    setIsLoadingMoreProducts(true);
    await fetchProductsList(true, productOffset);
    setIsLoadingMoreProducts(false);
  };

  const handleNewProduct = () => {
    const fresh: Product = {
      id: `prod-${Date.now()}`,
      slug: '',
      title: '',
      description: '',
      price: 0,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    setCurrentProduct(fresh);
    setActiveTab('buat-produk');
  };

  const handleSelectProduct = async (product: Product) => {
    if (activeTab === 'buat-produk' && hasUnsavedChanges) {
      const confirmed = await showConfirm('Perubahan Belum Disimpan', 'Ada perubahan formulir yang belum disimpan. Yakin ingin beralih?');
      if (!confirmed) return;
    }

    try {
      const res = await api.get(`/products/admin/${product.id}`);
      if (res.data?.data) {
        setCurrentProduct(res.data.data);
      } else {
        setCurrentProduct(product);
      }
    } catch {
      setCurrentProduct(product);
    }
    setActiveTab('buat-produk');
  };

  const handleSaveProduct = async (savedProduct: Product): Promise<string> => {
    try {
      const payload = {
        title: savedProduct.title,
        slug: savedProduct.slug,
        description: savedProduct.description,
        price: savedProduct.price,
        original_price: savedProduct.original_price,
        cover_image_key: savedProduct.cover_image_key,
        cover_image_alt: savedProduct.cover_image_alt,
        detail_image_1_key: savedProduct.detail_image_1_key,
        detail_image_1_alt: savedProduct.detail_image_1_alt,
        detail_image_2_key: savedProduct.detail_image_2_key,
        detail_image_2_alt: savedProduct.detail_image_2_alt,
        detail_image_3_key: savedProduct.detail_image_3_key,
        detail_image_3_alt: savedProduct.detail_image_3_alt,
        file_r2_key: savedProduct.file_r2_key,
        status: savedProduct.status,
        category_id: savedProduct.category_id,
        meta_title: savedProduct.meta_title,
        meta_description: savedProduct.meta_description,
      };

      const isNew = savedProduct.id.startsWith('prod-');
      let finalId = savedProduct.id;

      if (isNew) {
        const response = await api.post('/products', payload);
        const newId = response.data.id;
        savedProduct.id = newId;
        finalId = newId;
        setProducts(prev => [savedProduct, ...prev]);
      } else {
        await api.put(`/products/${savedProduct.id}`, payload);
        setProducts(prev => prev.map(p => p.id === savedProduct.id ? savedProduct : p));
      }
      
      setCurrentProduct(savedProduct);
      setHasUnsavedChanges(false);
      return finalId;
    } catch (err: any) {
      console.error('Failed to save product:', err);
      showError(handleApiError(err));
      throw err;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const confirmed = await showConfirm(
      'Hapus Draf Produk',
      'Hapus draf rancangan produk ini? Rancangan produk yang belum diterbitkan akan dihapus dari akun Anda.',
      'Hapus Draf',
      'Batal',
      true
    );

    if (confirmed) {
      if (!id.startsWith('prod-')) {
        try {
          await api.delete(`/products/${id}`);
          setProducts(prev => prev.filter(p => p.id !== id));
          success('Produk berhasil dihapus permanen.');
        } catch (err) {
          showError(handleApiError(err));
          return;
        }
      } else {
        setProducts(prev => prev.filter(p => p.id !== id));
      }

      if (currentProduct?.id === id) {
        handleNewProduct();
      }
    }
  };

  const handleArchiveProduct = async (id: string) => {
    const confirmed = await showConfirm(
      'Arsipkan Produk',
      'Arsipkan produk ini? Produk tidak akan muncul di etalase pembeli baru, namun pembeli lama tetap bisa mengakses file.',
      'Arsipkan',
      'Batal'
    );

    if (confirmed) {
      if (!id.startsWith('prod-')) {
        try {
          await api.put(`/products/${id}/archive`);
          setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'archived' } : p));
          success('Produk berhasil diarsipkan.');
        } catch (err) {
          showError(handleApiError(err));
        }
      }
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm('Konfirmasi Keluar', 'Yakin ingin keluar dari Portal Mitra?', 'Keluar', 'Batal');
    if (confirmed) {
      try {
        await api.post('/auth/logout');
      } catch {
        // Abaikan error logout dari server
      } finally {
        setAccessToken(null);
        setIsAuthenticated(false);
        setProfile(DEFAULT_EMPTY_PROFILE);
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
      }
    }
  };

  // Rute Khusus Halaman Legal Mandiri (/tos dan /privacy)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase().replace(/\/$/, '') : '';
  const isLegalRoute = currentPath === '/tos' || currentPath === '/privacy';

  if (isLegalRoute) {
    const initialTab = currentPath === '/privacy' ? 'privacy' : 'terms';
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <StandaloneLegalPage initialTab={initialTab} />
      </Suspense>
    );
  }

  // Loading Splash Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-brand-teal mb-4" />
        <p className="text-stone-500 font-medium text-xs tracking-wider animate-pulse uppercase">
          Memuat Sesi Mitra...
        </p>
      </div>
    );
  }

  // Login View jika belum login
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <LoginMitra />
      </Suspense>
    );
  }

  // Middleware Guard Status Mitra (Aturan 3, 4, 5, 6)
  const isSuperAdminOrAdmin = profile.role === 'super_admin' || profile.role === 'Admin';
  const isApproved = isSuperAdminOrAdmin || profile.seller_status === 'approved';
  const isPending = profile.seller_status === 'pending';
  const isRejected = profile.seller_status === 'rejected';
  const isSuspended = profile.seller_status === 'suspended';
  const isNewUser = !isApproved && !isPending && !isRejected && !isSuspended;

  // Kasus 1: User Baru -> Tahan & alihkan ke form pengisian data khusus, JANGAN beri tampilan dashboard (Aturan 4)
  if (isNewUser) {
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <MitraOnboardingForm
          profile={profile}
          initialCategories={categories}
          onRegistrationSuccess={(updated) => {
            setProfile(updated);
          }}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  // Kasus 2: User dalam tahap verifikasi -> Tahan & alihkan ke halaman pemberitahuan approval (Aturan 5)
  if (isPending) {
    return (
      <Suspense fallback={<TabLoadingSkeleton />}>
        <ApprovalStatusPage
          profile={profile}
          onRefreshStatus={async () => {
            await loadUserProfile();
          }}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  // Kasus 3: Pendaftaran Ditolak Kurator
  if (isRejected) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-stone-200 card-shadow text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight font-sans">
            Pendaftaran Kemitraan Memerlukan Penyesuaian
          </h2>
          <p className="text-xs text-stone-600 mt-2 leading-relaxed">
            {profile.seller_rejection_reason ? (
              <span><strong>Catatan Kurator:</strong> "{profile.seller_rejection_reason}"</span>
            ) : (
              "Data identitas atau foto contoh produk Anda belum memenuhi standar mutu kurasi Asisten Guru."
            )}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                setProfile(prev => ({ ...prev, seller_status: 'none' }));
              }}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Perbarui Formulir Pendaftaran
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 border border-stone-200 text-stone-600 hover:bg-stone-100 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Kasus 4: Akun Ditangguhkan
  if (isSuspended) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-stone-900 text-white rounded-3xl p-8 card-shadow text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Akses Mitra Ditangguhkan
          </h2>
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            Akun kemitraan Anda dinonaktifkan sementara oleh pengelola ekosistem Asisten Guru. Silakan hubungi tim kami untuk bantuan lebih lanjut.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  // Kasus 5: User Terverifikasi (Approved) -> Masuk ke Halaman Utama Workspace (Aturan 6)
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-stone-50 font-sans text-stone-900 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={async (tab) => {
          if (activeTab === 'buat-produk' && tab !== activeTab && hasUnsavedChanges) {
            const confirmed = await showConfirm('Perubahan Belum Disimpan', 'Ada perubahan data produk yang belum disimpan. Yakin ingin keluar?');
            if (!confirmed) return;
          }
          setActiveTab(tab);
        }}
        onNewProduct={() => {
          handleNewProduct();
        }}
        onLogout={handleLogout}
        profile={profile}
        productCount={products.length}
        complaintCount={complaintCount}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden min-w-0">

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<TabLoadingSkeleton />}>
            {activeTab === 'dashboard' && (
              <DashboardMitra
                profile={profile}
                onNavigateToProducts={() => setActiveTab('list-produk')}
                onNavigateToNewProduct={handleNewProduct}
                onNavigateToComplaints={() => setActiveTab('komplain')}
                onNavigateToProfile={() => setActiveTab('profil-toko')}
              />
            )}

            {activeTab === 'list-produk' && (
              <ProductList
                products={products}
                hasMore={hasMoreProducts}
                isLoadingMore={isLoadingMoreProducts}
                onLoadMore={handleLoadMoreProducts}
                onSelectProduct={handleSelectProduct}
                onNewProduct={handleNewProduct}
                onDeleteProduct={handleDeleteProduct}
                onArchiveProduct={handleArchiveProduct}
                userRole={profile.role}
                isLoading={isLoadingProducts}
              />
            )}

            {activeTab === 'buat-produk' && currentProduct && (
              <ProductEditor
                key={currentProduct.id}
                product={currentProduct}
                categories={categories}
                onSave={handleSaveProduct}
                onBack={() => setActiveTab('list-produk')}
                setHasUnsavedChanges={setHasUnsavedChanges}
              />
            )}

            {activeTab === 'transaksi' && (
              <TransactionLedger onNavigateToComplaints={() => setActiveTab('komplain')} />
            )}

            {activeTab === 'komplain' && (
              <BuyerComplaints onComplaintCountChange={(count) => setComplaintCount(count)} />
            )}

            {activeTab === 'tampilan-toko' && (
              <StoreAppearanceStudio
                profile={profile}
                onUpdateProfile={(updated) => setProfile(updated)}
                onNavigateToProducts={() => setActiveTab('list-produk')}
              />
            )}

            {activeTab === 'profil-toko' && (
              <StoreProfile
                profile={profile}
                initialCategories={categories}
                onUpdateProfile={(updated) => setProfile(updated)}
                onNavigateToAppearance={() => setActiveTab('tampilan-toko')}
              />
            )}
          </Suspense>
        </div>
      </main>

      {/* Modal Syarat & Ketentuan Kemitraan */}
      <Suspense fallback={null}>
        {isTermsModalOpen && (
          <SellerTermsModal
            isOpen={isTermsModalOpen}
            onClose={() => setIsTermsModalOpen(false)}
          />
        )}
      </Suspense>

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppContent />
      </ConfirmProvider>
    </ToastProvider>
  );
}
