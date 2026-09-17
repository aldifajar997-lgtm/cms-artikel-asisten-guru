import React, { useState, useEffect } from 'react';
import { Article, Category, UserProfile, Tag, ArticleStats } from './types';
import { Navigation, ActiveTab } from './components/Navigation';
import { ArticleEditor } from './components/ArticleEditor';
import { ArticleList } from './components/ArticleList';
import { CategorySettings } from './components/CategorySettings';
import { ProfileSettings } from './components/ProfileSettings';
import { UserSettings } from './components/UserSettings';
import { SiteSettings } from './components/SiteSettings';
import { Glosarium } from './components/Glosarium';
import { generateSlug } from './utils/seoAnalyzer';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import api, { setAccessToken, handleApiError } from './utils/api';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [authView, setAuthView] = useState<'login' | 'forgot-password' | 'reset-password'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  // Data state
  const [articles, setArticles] = useState<Article[]>([]);
  const [globalStats, setGlobalStats] = useState<ArticleStats>({
    totalArticles: 0,
    totalWords: 0,
    avgScore: 0,
    totalViews: 0,
    publishedCount: 0,
    draftCount: 0
  });
  const [currentFilters, setCurrentFilters] = useState({ search: '', categoryId: 'all', status: 'all', sort: 'newest' });
  const [hasMoreArticles, setHasMoreArticles] = useState<boolean>(false);
  const [articleOffset, setArticleOffset] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasMoreCategories, setHasMoreCategories] = useState<boolean>(false);
  const [categoryOffset, setCategoryOffset] = useState<number>(0);
  const [isLoadingMoreCategories, setIsLoadingMoreCategories] = useState<boolean>(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Admin',
    email: '',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    role: 'Admin',
    targetMinWords: 1200,
    targetKeywordDensity: 1.5,
    monthlyArticleGoal: 10,
    monthlyWordGoal: 12000,
    preferredTone: 'Profesional & Inspiratif',
    mainLanguage: 'id-ID',
    bio: '',
    primaryNiche: '',
    portfolioUrl: ''
  });
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);

  const fetchGlobalStats = async () => {
    try {
      const res = await api.get('/posts/admin/stats');
      if (res.data?.data) {
        setGlobalStats({
          totalArticles: res.data.data.total_articles || 0,
          totalWords: res.data.data.total_words || 0,
          avgScore: Math.round(res.data.data.avg_score || 0),
          totalViews: res.data.data.total_views || 0,
          publishedCount: res.data.data.published_count || 0,
          draftCount: res.data.data.draft_count || 0
        });
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  const fetchArticlesList = async (filters: { search: string; categoryId: string; status: string; sort: string }, isLoadMore = false, overrideOffset?: number) => {
    const offset = isLoadMore ? (overrideOffset !== undefined ? overrideOffset : articleOffset) : 0;
    const queryParams = new URLSearchParams();
    queryParams.append('limit', '50');
    queryParams.append('offset', offset.toString());
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.categoryId !== 'all') queryParams.append('category_id', filters.categoryId);
    if (filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.sort) queryParams.append('sort', filters.sort);

    try {
      const postsRes = await api.get('/posts/admin/all?' + queryParams.toString());
      if (postsRes.data?.data) {
        const safeParse = (val: any) => {
          if (!val) return [];
          try { return JSON.parse(val); } catch (e) { return []; }
        };

        const fetchedArticles = postsRes.data.data.map((p: any) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || '',
          content: p.content || '',
          categoryId: p.category_id || '',
          focusKeyword: p.focus_keyword || '',
          secondaryKeywords: safeParse(p.secondary_keywords),
          metaTitle: p.meta_title || '',
          metaDescription: p.meta_description || '',
          status: p.status,
          seoScore: p.seo_score || 0,
          wordCount: p.word_count || 0,
          readingTimeMinutes: p.reading_time_minutes || 0,
          viewCount: p.view_count || 0,
          featuredImage: p.featured_image || '',
          featuredImageAlt: p.featured_image_alt || '',
          featuredImageCaption: p.featured_image_caption || '',
          tagIds: safeParse(p.tag_ids),
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString(),
          authorName: p.author_name || undefined
        }));
        if (isLoadMore) {
          setArticles(prev => [...prev, ...fetchedArticles]);
        } else {
          setArticles(fetchedArticles);
          if (fetchedArticles.length > 0) setCurrentArticle(fetchedArticles[0]);
        }
        setHasMoreArticles(fetchedArticles.length === 50);
        setArticleOffset(offset + 50);
        setCurrentFilters(filters);
      }
    } catch (postsErr) {
      console.error('Failed to fetch articles', postsErr);
    }
  };


  // Initialization: Check URL tokens and Auth status
  useEffect(() => {
    const initializeApp = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset_token');
      
      if (token) {
        setResetToken(token);
        setAuthView('reset-password');
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsInitializing(false);
        return; // Hentikan proses inisialisasi auth, fokus ke reset password
      }

      try {
        const response = await api.post('/auth/refresh', {});
        if (response.data?.access_token) {
          setAccessToken(response.data.access_token);
          setIsAuthenticated(true);
          
          await fetchProfileAndData();
        }
      } catch (err) {
        // Not authenticated or session expired
        setIsAuthenticated(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  const fetchProfileAndData = async () => {
    try {
      const profileRes = await api.get('/users/me');
      let finalAvatarUrl = profileRes.data.avatar_url ?? '';
      if (finalAvatarUrl && finalAvatarUrl.startsWith('/api/')) {
        const baseUrl = api.defaults.baseURL || 'http://localhost:8787/api';
        const origin = baseUrl.replace(/\/api\/?$/, '');
        finalAvatarUrl = `${origin}${finalAvatarUrl}`;
      }

      setProfile(prev => ({
        ...prev,
        name: profileRes.data.name ?? prev.name,
        email: profileRes.data.email ?? prev.email,
        role: profileRes.data.role ?? prev.role,
        avatarUrl: finalAvatarUrl,
        bio: profileRes.data.bio ?? '',
        portfolioUrl: profileRes.data.portfolio_url ?? '',
        targetMinWords: profileRes.data.target_min_words ?? 0,
        targetKeywordDensity: profileRes.data.target_keyword_density ?? 0,
        preferredTone: profileRes.data.preferred_tone ?? '',
        mainLanguage: profileRes.data.main_language ?? '',
        monthlyArticleGoal: profileRes.data.monthly_article_goal ?? 0,
        monthlyWordGoal: profileRes.data.monthly_word_goal ?? 0,
        primaryNiche: profileRes.data.primary_niche ?? '',
        socialLinkedin: profileRes.data.social_linkedin ?? '',
        socialTwitter: profileRes.data.social_twitter ?? '',
        socialInstagram: profileRes.data.social_instagram ?? '',
        socialFacebook: profileRes.data.social_facebook ?? '',
        socialTiktok: profileRes.data.social_tiktok ?? ''
      }));
    } catch (profileErr) {
      console.error('Failed to fetch profile', profileErr);
    }

    // Fetch stats and initial articles
    await fetchGlobalStats();
    await fetchArticlesList(currentFilters);

    // Fetch categories
    try {
      const catRes = await api.get('/categories?limit=100&offset=0');
      if (catRes.data?.data) {
        const fetchedCategories = catRes.data.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          targetKeywords: c.target_keywords ? JSON.parse(c.target_keywords) : [],
          color: c.color || '#0d9488',
          articleCount: c.article_count || 0,
          parentId: c.parent_id || undefined,
          parentName: c.parent_name || undefined
        }));
        setCategories(fetchedCategories);
        setHasMoreCategories(fetchedCategories.length === 100);
        setCategoryOffset(100);
      }
    } catch (catErr) {
      console.error('Failed to fetch categories', catErr);
    }

    // Fetch tags
    try {
      const tagsRes = await api.get('/tags?limit=100');
      if (tagsRes.data?.data) {
        setTags(tagsRes.data.data);
      }
    } catch (tagsErr) {
      console.error('Failed to fetch tags', tagsErr);
    }
  };


  // Handle Load More Categories
  const handleLoadMoreCategories = async () => {
    if (isLoadingMoreCategories || !hasMoreCategories) return;
    setIsLoadingMoreCategories(true);
    try {
      const catRes = await api.get(`/categories?limit=100&offset=${categoryOffset}`);
      if (catRes.data?.data) {
        const fetchedCategories = catRes.data.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          targetKeywords: c.target_keywords ? JSON.parse(c.target_keywords) : [],
          color: c.color || '#0d9488',
          articleCount: c.article_count || 0,
          parentId: c.parent_id || undefined,
          parentName: c.parent_name || undefined
        }));
        setCategories(prev => [...prev, ...fetchedCategories]);
        setHasMoreCategories(fetchedCategories.length === 100);
        setCategoryOffset(prev => prev + 100);
      }
    } catch (catErr) {
      console.error('Failed to fetch more categories', catErr);
    } finally {
      setIsLoadingMoreCategories(false);
    }
  };

  // Active navigation tab (user requested: buat artikel, pengaturan profile, pengaturan kategori, list artikel)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Handle Preview
  const handlePreviewArticle = async (article: Article) => {
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'https://asisten-guru.id';

    try {
      const res = await api.get(`/posts/admin/preview-token/${article.id}`);
      const token = res.data.data;
      // Pass the slug to the frontend instead of the ID so the Next.js/Frontend routing doesn't say "unidentified slug"
      window.open(`${frontendUrl}/blog/preview/${article.slug}?token=${token}`, '_blank');
    } catch (err: any) {
      console.error('Gagal membuat preview token:', err);
      alert('Gagal membuat tautan pratinjau. ' + handleApiError(err));
    }
  };

  // Handle Load More
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreArticles) return;
    setIsLoadingMore(true);
    await fetchArticlesList(currentFilters, true, articleOffset);
    setIsLoadingMore(false);
  };

  // Handle Save / Update Article from Editor
  const handleSaveArticle = async (savedArticle: Article) => {
    try {
      const payload = {
        title: savedArticle.title,
        slug: savedArticle.slug,
        excerpt: savedArticle.excerpt,
        content: savedArticle.content,
        category_id: savedArticle.categoryId,
        focus_keyword: savedArticle.focusKeyword,
        secondary_keywords: savedArticle.secondaryKeywords,
        meta_title: savedArticle.metaTitle,
        meta_description: savedArticle.metaDescription,
        status: savedArticle.status,
        seo_score: savedArticle.seoScore,
        word_count: savedArticle.wordCount,
        reading_time_minutes: savedArticle.readingTimeMinutes,
        featured_image: savedArticle.featuredImage,
        featured_image_alt: savedArticle.featuredImageAlt,
        featured_image_caption: savedArticle.featuredImageCaption,
        tag_ids: savedArticle.tagIds || []
      };

      const isNew = savedArticle.id.startsWith('art-'); // Generated frontend ID prefix

      if (isNew) {
        const response = await api.post('/posts', payload);
        const newId = response.data.id;
        savedArticle.id = newId;
        setArticles(prev => [savedArticle, ...prev]);
      } else {
        await api.put(`/posts/${savedArticle.id}`, payload);
        setArticles(prev => prev.map(a => a.id === savedArticle.id ? savedArticle : a));
      }
      
      setCurrentArticle(savedArticle);
      fetchGlobalStats();
    } catch (err: any) {
      console.error('Gagal menyimpan artikel:', err);
      alert(handleApiError(err));
      throw err; // So the editor can stop loading
    }
  };

  // Handle New Article Creation
  const handleNewArticle = () => {
    const freshArticle: Article = {
      id: `art-${Date.now()}`,
      title: '',
      slug: '',
      content: `<h2>Judul Artikel Anda</h2><p>Tuliskan paragraf pembuka yang langsung menjawab pertanyaan pembaca dan menyertakan kata kunci utama secara alami.</p><h3>1. Sub-Topik Pertama</h3><p>Jelaskan pembahasan secara mendalam dengan contoh kasus atau langkah terstruktur.</p><h3>2. Sub-Topik Kedua</h3><p>Tambahkan wawasan tambahan atau data pendukung.</p><h3>Kesimpulan</h3><p>Berikan rangkuman dan ajakan bertindak (call to action).</p>`,
      excerpt: '',
      categoryId: categories[0]?.id || '',
      focusKeyword: '',
      secondaryKeywords: [],
      metaTitle: '',
      metaDescription: '',
      status: 'draft',
      seoScore: 40,
      wordCount: 80,
      readingTimeMinutes: 1,
      viewCount: 0,
      tagIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCurrentArticle(freshArticle);
    setActiveTab('buat-artikel');
  };

  // Handle Select Article from List
  const handleSelectArticleFromList = async (article: Article) => {
    if (activeTab === 'buat-artikel' && hasUnsavedChanges) {
      if (!window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) return;
    }

    try {
      const res = await api.get(`/posts/admin/${article.id}`);
      if (res.data?.data) {
        const p = res.data.data;
        let currentTagIds = article.tagIds;
        
        if (p.tags_json) {
          try {
            const parsedTags = JSON.parse(p.tags_json);
            currentTagIds = Array.isArray(parsedTags) ? parsedTags.filter(Boolean).map((t: any) => t.id) : [];
            
            // Injeksi tag tersembunyi ke state global tags agar Editor bisa me-rendernya
            if (currentTagIds.length > 0) {
              setTags(prevTags => {
                const newTags = [...prevTags];
                let modified = false;
                parsedTags.forEach((pt: any) => {
                  if (pt && pt.id && !newTags.find(t => t.id === pt.id)) {
                    newTags.push({ id: pt.id, name: pt.name, slug: pt.slug });
                    modified = true;
                  }
                });
                return modified ? newTags : prevTags;
              });
            }
          } catch { }
        }

        const fullArticle: Article = {
          ...article,
          content: p.content || '',
          tagIds: currentTagIds,
        };
        setCurrentArticle(fullArticle);
      } else {
        setCurrentArticle(article);
      }
    } catch (err) {
      console.error('Gagal mengambil detail artikel:', err);
      alert('Gagal mengambil detail artikel. Terbuka dengan konten kosong.');
      setCurrentArticle(article);
    }

    setActiveTab('buat-artikel');
  };

  // Handle Duplicate Article
  const handleDuplicateArticle = async (article: Article) => {
    try {
      // Ambil konten penuh terlebih dahulu agar tidak menduplikasi artikel kosong
      const detailRes = await api.get(`/posts/admin/${article.id}`);
      const fullContent = detailRes.data?.data?.content || article.content || '';

      const duplicatedPayload = {
        title: `${article.title} (Copy)`,
        slug: `${article.slug}-copy`,
        excerpt: article.excerpt,
        content: fullContent,
        category_id: article.categoryId,
        focus_keyword: article.focusKeyword,
        secondary_keywords: article.secondaryKeywords,
        meta_title: article.metaTitle,
        meta_description: article.metaDescription,
        status: 'draft',
        seo_score: article.seoScore,
        word_count: article.wordCount,
        reading_time_minutes: article.readingTimeMinutes,
        featured_image: article.featuredImage,
        featured_image_alt: article.featuredImageAlt,
        featured_image_caption: article.featuredImageCaption,
        tag_ids: article.tagIds || []
      };

      const response = await api.post('/posts', duplicatedPayload);
      const newId = response.data.id;

      const duplicatedArticle: Article = {
        ...article,
        id: newId,
        title: `${article.title} (Copy)`,
        slug: `${article.slug}-copy`,
        status: 'draft',
        viewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setArticles(prev => [duplicatedArticle, ...prev]);
      fetchGlobalStats();
    } catch (err: any) {
      console.error('Gagal menduplikasi artikel:', err);
      alert('Gagal menduplikasi artikel. ' + handleApiError(err));
    }
  };

  // Handle Delete Article
  const handleDeleteArticle = async (id: string) => {
    if (confirm('Hapus artikel ini secara permanen dari daftar?')) {
      if (!id.startsWith('art-')) {
        try {
          await api.delete(`/posts/${id}`);
        } catch (err) {
          console.error('Gagal menghapus artikel:', err);
          alert('Gagal menghapus artikel. Silakan coba lagi.');
          return;
        }
      }
      
      setArticles((prev) => prev.filter((a) => a.id !== id));
      if (currentArticle?.id === id) {
        handleNewArticle();
      }
      fetchGlobalStats();
    }
  };

  // Handle Category operations
  const handleAddCategory = async (newCat: Category) => {
    try {
      const payload = {
        name: newCat.name,
        slug: newCat.slug,
        description: newCat.description,
        target_keywords: newCat.targetKeywords,
        color: newCat.color,
        parent_id: newCat.parentId || null
      };
      const res = await api.post('/categories', payload);
      setCategories([...categories, { ...newCat, id: res.data.id }]);
    } catch (err) {
      console.error('Gagal menambahkan kategori', err);
      throw err;
    }
  };

  const handleUpdateCategory = async (updatedCat: Category) => {
    try {
      const payload = {
        name: updatedCat.name,
        slug: updatedCat.slug,
        description: updatedCat.description,
        target_keywords: updatedCat.targetKeywords,
        color: updatedCat.color,
        parent_id: updatedCat.parentId || null
      };
      await api.put(`/categories/${updatedCat.id}`, payload);
      setCategories(categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
    } catch (err) {
      console.error('Gagal memperbarui kategori', err);
      throw err;
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!catId.startsWith('cat-')) {
      try {
        await api.delete(`/categories/${catId}`);
      } catch (err) {
        console.error('Gagal menghapus kategori', err);
        throw err;
      }
    }
    setCategories(categories.filter((c) => c.id !== catId));
  };

  // Handle Profile update
  const handleUpdateProfile = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Terjadi kesalahan saat logout dari server:', error);
    } finally {
      setAccessToken(null);
      setIsAuthenticated(false);
    }
  };

  // Total stats for profile calculation
  const totalArticlesWritten = globalStats.totalArticles;
  const totalWordsWritten = globalStats.totalWords;

  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500">Memuat sesi...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'reset-password' && resetToken) {
      return (
        <ResetPassword 
          token={resetToken} 
          onSuccessRedirect={() => setAuthView('login')} 
        />
      );
    }

    if (authView === 'forgot-password') {
      return <ForgotPassword onBackToLogin={() => setAuthView('login')} />;
    }

    return (
      <Login 
        onLoginSuccess={async () => {
          setIsInitializing(true);
          await fetchProfileAndData();
          setIsAuthenticated(true);
          setIsInitializing(false);
        }} 
        onForgotPassword={() => setAuthView('forgot-password')}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        onLogout={() => {
          if (activeTab === 'buat-artikel' && hasUnsavedChanges) {
            if (!window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) return;
          }
          handleLogout();
        }}
        onSelectTab={(tab) => {
          if (activeTab === 'buat-artikel' && tab !== 'buat-artikel' && hasUnsavedChanges) {
            if (!window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) return;
          }
          if (tab === 'buat-artikel' && !currentArticle) {
            handleNewArticle();
          } else {
            setActiveTab(tab);
          }
        }}
        onNewArticle={() => {
          if (activeTab === 'buat-artikel' && hasUnsavedChanges) {
            if (!window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) return;
          }
          handleNewArticle();
        }}
        profile={profile}
        articleCount={globalStats.totalArticles}
      />

      {/* Main Workspace based on Active Tab */}
      <main className="flex-1 flex flex-col h-full bg-white overflow-hidden min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {activeTab === 'buat-artikel' ? (
              currentArticle ? (
                <ArticleEditor
                  key={currentArticle.id}
                  article={currentArticle}
                  categories={categories}
                  tags={tags}
                  profile={profile}
                  onSave={handleSaveArticle}
                  onBack={() => {
                    if (hasUnsavedChanges) {
                      if (!window.confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?')) return;
                    }
                    setActiveTab('list-artikel');
                  }}
                  onPreview={handlePreviewArticle}
                  onTagsChange={(newTags) => setTags(newTags)}
                  setHasUnsavedChanges={setHasUnsavedChanges}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-4" />
                  <p className="text-slate-500">Memuat editor...</p>
                </div>
              )
            ) : (
              <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                  {activeTab === 'dashboard' && (
                    <Dashboard profile={profile} stats={globalStats} />
                  )}

                  {activeTab === 'list-artikel' && (
                    <ArticleList
                      articles={articles}
                      categories={categories}
                      profile={profile}
                      stats={globalStats}
                      hasMore={hasMoreArticles}
                      isLoadingMore={isLoadingMore}
                      onLoadMore={handleLoadMore}
                      onFilterChange={(filters) => fetchArticlesList(filters)}
                      onSelectArticle={handleSelectArticleFromList}
                      onNewArticle={handleNewArticle}
                      onDeleteArticle={handleDeleteArticle}
                      onDuplicateArticle={handleDuplicateArticle}
                      onPreviewArticle={handlePreviewArticle}
                    />
                  )}

                  {activeTab === 'pengaturan-kategori' && (
                    <CategorySettings
                      categories={categories}
                      hasMore={hasMoreCategories}
                      isLoadingMore={isLoadingMoreCategories}
                      onLoadMore={handleLoadMoreCategories}
                      onAddCategory={handleAddCategory}
                      onUpdateCategory={handleUpdateCategory}
                      onDeleteCategory={handleDeleteCategory}
                    />
                  )}

                  {activeTab === 'pengaturan-profile' && (
                    <ProfileSettings
                      profile={profile}
                      onUpdateProfile={handleUpdateProfile}
                      totalArticlesWritten={totalArticlesWritten}
                      totalWordsWritten={totalWordsWritten}
                    />
                  )}

                  {activeTab === 'pengaturan-user' && (
                    <UserSettings />
                  )}

                  {activeTab === 'pengaturan-situs' && (
                    <SiteSettings />
                  )}

                  {activeTab === 'glosarium' && (
                    <Glosarium />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
