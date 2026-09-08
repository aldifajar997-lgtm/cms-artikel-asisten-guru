const fs = require('fs');

let typesStr = fs.readFileSync('src/types.ts', 'utf8');
if (!typesStr.includes('ArticleStats')) {
  typesStr += '\nexport interface ArticleStats {\n  totalArticles: number;\n  totalWords: number;\n  avgScore: number;\n  publishedCount: number;\n  draftCount: number;\n}\n';
  fs.writeFileSync('src/types.ts', typesStr);
}

let appStr = fs.readFileSync('src/App.tsx', 'utf8');
appStr = appStr.replace(/import \{ Article, Category, UserProfile, Tag \} from '\.\/types';/, "import { Article, Category, UserProfile, Tag, ArticleStats } from './types';");

appStr = appStr.replace(/const \[articles, setArticles\] = useState<Article\[\]>\(\[\]\);/, 
  "const [articles, setArticles] = useState<Article[]>([]);\n" +
  "  const [globalStats, setGlobalStats] = useState<ArticleStats>({\n" +
  "    totalArticles: 0,\n" +
  "    totalWords: 0,\n" +
  "    avgScore: 0,\n" +
  "    publishedCount: 0,\n" +
  "    draftCount: 0\n" +
  "  });\n" +
  "  const [currentFilters, setCurrentFilters] = useState({ search: '', categoryId: 'all', status: 'all', sort: 'newest' });");

const fetchFunctions = `  const fetchGlobalStats = async () => {
    try {
      const res = await api.get('/posts/admin/stats');
      if (res.data?.data) {
        setGlobalStats({
          totalArticles: res.data.data.total_articles || 0,
          totalWords: res.data.data.total_words || 0,
          avgScore: Math.round(res.data.data.avg_score || 0),
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
        const fetchedArticles = postsRes.data.data.map((p: any) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || '',
          content: p.content || '',
          categoryId: p.category_id || '',
          focusKeyword: p.focus_keyword || '',
          secondaryKeywords: p.secondary_keywords ? JSON.parse(p.secondary_keywords) : [],
          metaTitle: p.meta_title || '',
          metaDescription: p.meta_description || '',
          status: p.status,
          seoScore: p.seo_score || 0,
          wordCount: p.word_count || 0,
          readingTimeMinutes: p.reading_time_minutes || 0,
          featuredImage: p.featured_image || '',
          featuredImageAlt: p.featured_image_alt || '',
          featuredImageCaption: p.featured_image_caption || '',
          tagIds: p.tag_ids ? JSON.parse(p.tag_ids) : [],
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
`;

appStr = appStr.replace(/const \[currentArticle, setCurrentArticle\] = useState<Article \| null>\(null\);/, 
  "const [currentArticle, setCurrentArticle] = useState<Article | null>(null);\n\n" + fetchFunctions);

appStr = appStr.replace(/\/\/ Fetch articles[\s\S]*?\/\/ Fetch categories/, 
  "// Fetch stats and initial articles\n          await fetchGlobalStats();\n          await fetchArticlesList(currentFilters);\n\n          // Fetch categories");

appStr = appStr.replace(/const handleLoadMore = async \(\) => \{[\s\S]*?  \};/, 
  "const handleLoadMore = async () => {\n    if (isLoadingMore || !hasMoreArticles) return;\n    setIsLoadingMore(true);\n    await fetchArticlesList(currentFilters, true, articleOffset);\n    setIsLoadingMore(false);\n  };");

appStr = appStr.replace(/<ArticleList[\s\S]*?\/>/, 
  `<ArticleList
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
                  onPreviewArticle={(art) => setPreviewArticle(art)}
                />`);

appStr = appStr.replace(/const totalArticlesWritten = articles.length;/, 
  "const totalArticlesWritten = globalStats.totalArticles;");
appStr = appStr.replace(/const totalWordsWritten = articles.reduce\(\(sum, a\) => sum \+ \(a\.wordCount \|\| 0\), 0\);/, 
  "const totalWordsWritten = globalStats.totalWords;");
appStr = appStr.replace(/articleCount=\{articles.length\}/, "articleCount={globalStats.totalArticles}");

fs.writeFileSync('src/App.tsx', appStr);

let alStr = fs.readFileSync('src/components/ArticleList.tsx', 'utf8');

alStr = alStr.replace(/import \{ Article, Category, ArticleStatus, UserProfile \} from '\.\.\/types';/, 
  "import { Article, Category, ArticleStatus, UserProfile, ArticleStats } from '../types';\nimport { useEffect } from 'react';");

alStr = alStr.replace(/interface ArticleListProps \{[\s\S]*?onPreviewArticle: \(article: Article\) => void;\n\}/, 
  `interface ArticleListProps {
  articles: Article[];
  categories: Category[];
  profile: UserProfile;
  stats: ArticleStats;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onFilterChange: (filters: { search: string; categoryId: string; status: string; sort: string }) => void;
  onSelectArticle: (article: Article) => void;
  onNewArticle: () => void;
  onDeleteArticle: (id: string) => void;
  onDuplicateArticle: (article: Article) => void;
  onPreviewArticle: (article: Article) => void;
}`);

alStr = alStr.replace(/export const ArticleList: React.FC<ArticleListProps> = \(\{[\s\S]*?\}\) => \{/, 
  `export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  categories,
  profile,
  stats,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onFilterChange,
  onSelectArticle,
  onNewArticle,
  onDeleteArticle,
  onDuplicateArticle,
  onPreviewArticle,
}) => {`);

alStr = alStr.replace(/\/\/ Summary Metrics[\s\S]*?\/\/ Filter & Sort[\s\S]*?\}, \[articles, searchQuery, selectedCategory, selectedStatus, sortBy\]\);/, 
  `  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFilterChange({
        search: searchQuery,
        categoryId: selectedCategory,
        status: selectedStatus,
        sort: sortBy
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, selectedStatus, sortBy]);`);

alStr = alStr.replace(/filteredArticles\.length/g, 'articles.length');
alStr = alStr.replace(/filteredArticles\.map/g, 'articles.map');

fs.writeFileSync('src/components/ArticleList.tsx', alStr);
console.log('Update script executed successfully');
