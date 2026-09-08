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
  createdAt: string;
  updatedAt: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  featuredImageCaption?: string;
  tagIds?: string[];
  authorName?: string;
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
  description: string;
  targetKeywords: string[];
  color: string;
  articleCount?: number;
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

export interface ArticleStats {
  totalArticles: number;
  totalWords: number;
  avgScore: number;
  publishedCount: number;
  draftCount: number;
}
