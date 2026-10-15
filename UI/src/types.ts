export type ArticleStatus = 'draft' | 'published' | 'review' | 'revision';

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  categoryId: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  status: ArticleStatus;
  seoScore: number;
  geoScore: number;
  geoOriginalAngle?: boolean;
  geoComprehensive?: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  viewCount: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  featuredImageCaption?: string;
  tagIds?: string[];
  sessionMediaKeys?: string[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  type?: 'article' | 'product';
  description: string;
  targetKeywords: string[];
  color: string;
  articleCount?: number;
  productCount?: number;
  parentId?: string;
  parentName?: string;
}

export interface UserProfile {
  name: string;
  role: string;
  email: string;
  avatarUrl: string;
  coverUrl?: string;
  bio: string;
  primaryNiche: string;
  mainLanguage: string;
  preferredTone: string;
  targetMinWords: number;
  targetKeywordDensity: number;
  monthlyArticleGoal: number;
  monthlyWordGoal: number;
  portfolioUrl: string;
  socialLinkedin?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTiktok?: string;
}

export interface SEOCheckItem {
  id: string;
  label: string;
  status: 'good' | 'warning' | 'bad';
  detail: string;
}

export interface SEOAnalysis {
  score: number;
  keywordDensity: number;
  keywordCount: number;
  wordCount: number;
  readingTime: number;
  h2Count: number;
  h3Count: number;
  checks: SEOCheckItem[];
}

export interface UserAdmin {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role?: string;
  is_active: number;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface ArticleFilters {
  status?: ArticleStatus | 'all';
  categoryId?: string | 'all';
  sort?: 'newest' | 'oldest' | 'score' | 'words' | 'popular';
}

export interface ArticleStats {
  totalArticles: number;
  totalWords: number;
  totalViews: number;
  avgScore: number;
  avgGeoScore: number;
  publishedCount: number;
  draftCount: number;
}

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface Product {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  price: number;
  original_price?: number | null;
  cover_image_key?: string | null;
  cover_image_alt?: string | null;
  detail_image_1_key?: string | null;
  detail_image_1_alt?: string | null;
  detail_image_2_key?: string | null;
  detail_image_2_alt?: string | null;
  detail_image_3_key?: string | null;
  detail_image_3_alt?: string | null;
  cover_image_url?: string | null;
  detail_image_1_url?: string | null;
  detail_image_2_url?: string | null;
  detail_image_3_url?: string | null;
  file_r2_key?: string | null;
  status: ProductStatus;
  category_id?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  view_count?: number;
  sales_count?: number;
  created_at: string;
}

export interface StatusDistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface ArticleTrendItem {
  period: string;
  name: string;
  count: number;
  views: number;
}

export interface ProductTrendItem {
  period: string;
  name: string;
  sales: number;
  earnings: number;
  gross?: number;
}

export interface TopArticleItem {
  id: string;
  title: string;
  slug: string;
  view_count: number;
  word_count: number;
  seo_score: number;
  geo_score?: number;
  status: string;
  published_at?: string;
}

export interface TopProductItem {
  id: string;
  title: string;
  slug: string;
  price: number;
  original_price?: number;
  sales_count: number;
  view_count: number;
  status: string;
  created_at?: string;
}

export interface ExecutiveMetrics {
  total_gross_gmv: number;
  total_platform_fee_collected: number;
  total_pending_seller_payout: number;
  active_authors_count: number;
  active_sellers_count: number;
  total_users_count: number;
  total_media_count: number;
  sync_queue_status: 'healthy' | 'degraded';
}

export interface EditorialReviewItem {
  id: string;
  title: string;
  slug: string;
  word_count: number;
  seo_score: number;
  geo_score?: number;
  updated_at: string;
  author_name?: string;
  author_avatar_url?: string;
}

export interface AuthorLeaderboardItem {
  author_id: string;
  author_name: string;
  avatar_url?: string;
  published_count: number;
  total_words: number;
  avg_seo_score: number;
}

export interface EditorialDeskData {
  pending_drafts_count: number;
  pending_review_queue: EditorialReviewItem[];
  author_leaderboard: AuthorLeaderboardItem[];
}

export interface CreatorGoalsData {
  monthly_article_goal: number;
  articles_published_this_month: number;
  article_goal_percentage: number;
  monthly_word_goal: number;
  words_written_this_month: number;
  word_goal_percentage: number;
  target_min_words: number;
}

export interface SellerMetricsData {
  conversion_rate: number;
  pending_payout: number;
  is_withdrawal_eligible: boolean;
  total_sales: number;
  total_views: number;
}

export interface RoleProfileData {
  is_super_admin: boolean;
  is_admin: boolean;
  is_editor: boolean;
  is_seller: boolean;
  is_writer: boolean;
  primary_role: 'super_admin' | 'admin' | 'editor' | 'seller' | 'writer';
}

export interface DashboardAnalytics {
  role_profile?: RoleProfileData;
  executive_metrics?: ExecutiveMetrics | null;
  editorial_desk?: EditorialDeskData | null;
  creator_goals?: CreatorGoalsData | null;
  seller_metrics?: SellerMetricsData | null;
  articles: {
    total_articles: number;
    published_count: number;
    draft_count: number;
    total_words: number;
    avg_words: number;
    avg_score: number;
    avg_geo_score: number;
    total_views: number;
    status_distribution: StatusDistributionItem[];
    trend: ArticleTrendItem[];
    top_articles: TopArticleItem[];
  };
  products: {
    total_products: number;
    published_count: number;
    draft_count: number;
    archived_count: number;
    total_views: number;
    total_sales: number;
    avg_price: number;
    total_gross_revenue: number;
    total_net_revenue: number;
    pending_payout: number;
    paid_out: number;
    status_distribution: StatusDistributionItem[];
    trend: ProductTrendItem[];
    top_products: TopProductItem[];
  };
  overview: {
    total_content: number;
    total_views: number;
    total_sales: number;
    total_earnings: number;
  };
}
