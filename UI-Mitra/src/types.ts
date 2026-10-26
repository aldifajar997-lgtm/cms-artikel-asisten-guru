export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'needs_revision' | 'rejected' | 'archived';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  bio?: string;
  portfolioUrl?: string;
  primaryNiche?: string;
  socialLinkedin?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialFacebook?: string;
  socialTiktok?: string;
  coverUrl?: string;
  bankDetails?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  seller_status?: 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
  seller_rejection_reason?: string;
  seller_applied_at?: string;
  seller_sample_photos?: string[];
  personal_address?: string;
  gender?: 'Laki-laki' | 'Perempuan' | string;
  birth_date?: string;
  store_name?: string;
  store_description?: string;
  store_address?: string;
  store_slug?: string;
  store_appearance?: StoreAppearanceConfig;
  phone_number?: string;
}

export type SectionBlockType = 
  | 'profile'
  | 'social_links'
  | 'video_teaser'
  | 'featured_product'
  | 'catalog'
  | 'faq';

export interface SocialLinksConfig {
  enabled: boolean;
  style: 'colored' | 'monochrome' | 'pill';
  whatsapp?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  facebook?: string | null;
}

export interface VideoTeaserConfig {
  enabled: boolean;
  title?: string | null;
  videoUrl?: string | null;
  aspectRatio: '16:9' | '9:16';
}

export interface FeaturedProductConfig {
  enabled: boolean;
  productId?: string | null;
  badgeText: string;
  animationStyle: 'none' | 'pulse' | 'glow' | 'jiggle';
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqConfig {
  enabled: boolean;
  title: string;
  items: FaqItem[];
}

export interface StoreAppearanceConfig {
  preset: 'emerald-scholar' | 'academic-navy' | 'warm-terracotta' | 'minimal-slate' | 'pastel-mint' | 'custom';
  background: {
    type: 'color' | 'gradient' | 'image';
    value: string;
    imageUrl?: string | null;
  };
  button: {
    style: 'fill' | 'outline' | 'shadow-soft' | 'shadow-hard' | 'glassmorphism';
    radius: 'sharp' | 'rounded' | 'pill';
    bgColor: string;
    textColor: string;
    borderColor?: string | null;
  };
  typography: {
    fontFamily: string;
    headingColor: string;
    bioColor: string;
    cardStyle?: 'none' | 'glass' | 'solid' | 'soft';
    cardBgColor?: string;
    cardOpacity?: number; // 0 - 100
    cardBlur?: 'none' | 'sm' | 'md' | 'lg';
    textShadow?: 'none' | 'soft' | 'glow';
  };
  catalogLayout: 'grid' | 'list' | 'compact';
  socialLinksStyle: 'colored' | 'monochrome' | 'pill';

  // Ekstensi Blok Modular Etalase Toko Guru
  sectionsOrder?: SectionBlockType[];
  socialLinks?: SocialLinksConfig;
  videoTeaser?: VideoTeaserConfig;
  featuredProduct?: FeaturedProductConfig;
  faq?: FaqConfig;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  cover_image_key?: string | null;
  cover_image_alt?: string;
  detail_image_1_key?: string | null;
  detail_image_1_alt?: string;
  detail_image_2_key?: string | null;
  detail_image_2_alt?: string;
  detail_image_3_key?: string | null;
  detail_image_3_alt?: string;
  file_r2_key?: string | null;
  status: ProductStatus;
  category_id?: string | null;
  meta_title?: string;
  meta_description?: string;
  review_notes?: string;
  submitted_for_review_at?: string;
  reviewed_at?: string;
  sales_count?: number;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  type?: string;
  description?: string;
  color?: string;
  productCount?: number;
}
export interface FeePolicy {
  id?: string;
  fee_percent: string;
  fee_bps?: number;
  creator_share_percent?: string;
  min_fee: number | null;
  max_fee: number | null;
  min_withdrawal_amount?: number;
  min_product_price?: number;
  bank_disbursement_fee?: number;
  midtrans?: {
    payer: 'buyer' | 'platform' | 'seller';
    payer_label: string;
    qris_rate_percent: string;
    qris_rate_bps: number;
    va_fee: number;
    note: string;
  };
}

export interface EarningsSummary {
  total_transactions: number;
  total_gross: number;
  total_admin_fee: number;
  total_net: number;
  holding_payout: number;
  available_payout: number;
  pending_payout: number; // alias to available_payout for backward compatibility
  processing_payout: number;
  paid_out: number;
  holding_count: number;
  available_count: number;
  pending_count: number;
  processing_count: number;
  transferred_count: number;
  disputed_count?: number;
}

export interface OrderComplaint {
  id: string;
  transaction_id: string;
  hub_transaction_id: string;
  buyer_hub_id?: string;
  category: 'corrupt_file' | 'broken_link' | 'content_mismatch' | 'other';
  reason: string;
  evidence_urls?: string | null;
  status: 'open' | 'seller_replied' | 'under_review' | 'resolved_refunded' | 'resolved_rejected';
  seller_response?: string | null;
  seller_replacement_url?: string | null;
  seller_responded_at?: string | null;
  admin_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
  product_title?: string;
  product_slug?: string;
  gross_amount?: number;
  seller_net_amount?: number;
  paid_at?: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  bank_details: string;
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  created_at: string;
  processed_at: string | null;
  admin_note: string | null;
  transfer_receipt_url: string | null;
}

export interface ProductTrendItem {
  period: string;
  name: string;
  sales: number;
  earnings: number;
  gross: number;
}

export interface StatusDistributionItem {
  name: string;
  value: number;
  color?: string;
}

export interface TopProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  original_price?: number;
  status: ProductStatus;
  view_count: number;
  sales_count: number;
  created_at: string;
}

export interface SaleTransaction {
  id: string;
  hub_transaction_id?: string;
  gross_amount: number;
  admin_fee_amount: number;
  seller_net_amount: number;
  applied_fee_bps: number;
  payment_method?: string | null;
  status?: 'settled' | 'refunded';
  payout_status: 'pending' | 'transferred' | 'skipped';
  paid_at: string;
  processed_at?: string;
  payout_at?: string;
  hold_until?: string | null;
  dispute_status?: 'none' | 'complained' | 'under_review' | 'resolved' | 'refunded';
  is_holding?: number | boolean;
  product_id?: string;
  product_title?: string;
  product_slug?: string;
}

export interface ProductEarningStat {
  product_id: string;
  product_title: string;
  product_slug: string;
  current_price: number;
  total_sales: number;
  total_gross: number;
  total_admin_fee: number;
  total_net: number;
  first_sale_at?: string;
  last_sale_at?: string;
}

export interface PaymentMethodDistributionItem {
  method: string;
  name: string;
  count: number;
  gross: number;
  net: number;
  percentage: number;
}

export interface TrafficSourceItem {
  source: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DeviceTypeItem {
  device_type: string;
  name: string;
  count: number;
  percentage: number;
}

export interface StoreTrafficAnalytics {
  total_views: number;
  store_views: number;
  product_views: number;
  checkout_intents: number;
  sources: TrafficSourceItem[];
  devices: DeviceTypeItem[];
}

export interface FunnelStepItem {
  key: 'store_view' | 'product_view' | 'checkout_intent' | 'completed_sale';
  name: string;
  count: number;
  step_conversion_rate: number;
  overall_conversion_rate: number;
  color: string;
}

export interface StoreConversionFunnel {
  total_impressions: number;
  store_views: number;
  product_views: number;
  checkout_intents: number;
  completed_sales: number;
  overall_cvr: number;
  steps: FunnelStepItem[];
}

export interface ActionableInsightItem {
  id: string;
  category: 'traffic' | 'conversion' | 'catalog' | 'pricing' | 'rating';
  type: 'success' | 'warning' | 'info' | 'tip';
  title: string;
  message: string;
  metric_highlight?: string;
  action_label?: string;
  action_type?: 'navigate_products' | 'navigate_new_product' | 'share_wa' | 'none';
}

export interface SellerDashboardAnalytics {
  role_profile?: {
    is_super_admin: boolean;
    is_admin: boolean;
    is_seller: boolean;
    primary_role: string;
  };
  traffic?: StoreTrafficAnalytics;
  funnel?: StoreConversionFunnel;
  insights?: ActionableInsightItem[];
  seller_metrics: {
    conversion_rate: number;
    pending_payout: number;
    is_withdrawal_eligible: boolean;
    total_sales: number;
    total_views: number;
    aov?: number;
    store_rating?: number;
    total_reviews?: number;
    selected_period?: string;
    payment_methods?: PaymentMethodDistributionItem[];
  } | null;
  products: {
    total_products: number;
    published_count: number;
    draft_count: number;
    archived_count: number;
    total_views: number;
    total_sales: number;
    lifetime_sales?: number;
    avg_price: number;
    aov?: number;
    store_rating?: number;
    total_reviews?: number;
    total_gross_revenue: number;
    total_net_revenue: number;
    lifetime_gross_revenue?: number;
    lifetime_net_revenue?: number;
    pending_payout: number;
    paid_out: number;
    status_distribution: StatusDistributionItem[];
    trend: ProductTrendItem[];
    top_products: TopProduct[];
    payment_methods?: PaymentMethodDistributionItem[];
    selected_period?: string;
  };
}

