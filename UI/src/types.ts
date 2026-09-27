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
