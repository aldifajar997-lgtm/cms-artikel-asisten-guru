import { useState, useEffect, useCallback } from 'react';
import { Article, Category, ArticleStatus } from '../../../types';
import { generateSlug } from '../../../utils/seoAnalyzer';

interface UseArticleFormProps {
  article: Article;
  categories: Category[];
  setHasUnsavedChanges?: (hasChanges: boolean) => void;
}

export const useArticleForm = ({ article, categories, setHasUnsavedChanges }: UseArticleFormProps) => {
  const [title, setTitle] = useState(article.title || '');
  const [slug, setSlug] = useState(article.slug || '');
  const [content, setContent] = useState(article.content || '');
  const [categoryId, setCategoryId] = useState(article.categoryId || categories[0]?.id || '');
  const [focusKeyword, setFocusKeyword] = useState(article.focusKeyword || '');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(article.secondaryKeywords || []);
  const [newSecondaryKeyword, setNewSecondaryKeyword] = useState('');
  const [metaTitle, setMetaTitle] = useState(article.metaTitle || article.title || '');
  const [metaDescription, setMetaDescription] = useState(article.metaDescription || '');
  const [status, setStatus] = useState<ArticleStatus>(article.status || 'draft');
  const [featuredImage, setFeaturedImage] = useState(article.featuredImage || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState(article.featuredImageAlt || '');
  const [featuredImageCaption, setFeaturedImageCaption] = useState(article.featuredImageCaption || '');
  const [tagIds, setTagIds] = useState<string[]>(article.tagIds || []);
  
  // GEO Manual States
  const [hasOriginalAngle, setHasOriginalAngle] = useState(article.geoOriginalAngle || false);
  const [isComprehensive, setIsComprehensive] = useState(article.geoComprehensive || false);

  const [localHasUnsavedChanges, setLocalHasUnsavedChanges] = useState(false);

  // Keep slug in sync if untouched or user requests
  const handleAutoSlug = useCallback(() => {
    setSlug(generateSlug(title));
  }, [title]);

  // Sync meta title with title if meta title is blank
  useEffect(() => {
    if (!metaTitle && title) {
      setMetaTitle(title.length > 55 ? `${title.slice(0, 55)}...` : title);
    }
  }, [title, metaTitle]);

  // Deteksi perubahan belum disimpan
  useEffect(() => {
    const isChanged = 
      title !== article.title ||
      content !== article.content ||
      slug !== article.slug ||
      categoryId !== (article.categoryId || categories[0]?.id || '') ||
      focusKeyword !== article.focusKeyword ||
      JSON.stringify(secondaryKeywords) !== JSON.stringify(article.secondaryKeywords || []) ||
      metaTitle !== (article.metaTitle || article.title) ||
      metaDescription !== (article.metaDescription || '') ||
      featuredImage !== (article.featuredImage || '') ||
      featuredImageAlt !== (article.featuredImageAlt || '') ||
      featuredImageCaption !== (article.featuredImageCaption || '') ||
      JSON.stringify(tagIds) !== JSON.stringify(article.tagIds || []) ||
      hasOriginalAngle !== (article.geoOriginalAngle || false) ||
      isComprehensive !== (article.geoComprehensive || false);

    setLocalHasUnsavedChanges(isChanged);
    if (setHasUnsavedChanges) {
      setHasUnsavedChanges(isChanged);
    }
  }, [
    title, content, slug, categoryId, focusKeyword, secondaryKeywords, 
    metaTitle, metaDescription, featuredImage, featuredImageAlt, 
    featuredImageCaption, tagIds, hasOriginalAngle, isComprehensive,
    article, categories, setHasUnsavedChanges
  ]);

  // Handle Before Unload (Refresh/Tutup Tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (localHasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser behavior
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [localHasUnsavedChanges]);

  return {
    formState: {
      title, slug, content, categoryId, focusKeyword, secondaryKeywords, newSecondaryKeyword,
      metaTitle, metaDescription, status, featuredImage, featuredImageAlt, featuredImageCaption,
      tagIds, hasOriginalAngle, isComprehensive
    },
    setters: {
      setTitle, setSlug, setContent, setCategoryId, setFocusKeyword, setSecondaryKeywords, setNewSecondaryKeyword,
      setMetaTitle, setMetaDescription, setStatus, setFeaturedImage, setFeaturedImageAlt, setFeaturedImageCaption,
      setTagIds, setHasOriginalAngle, setIsComprehensive
    },
    localHasUnsavedChanges,
    handleAutoSlug
  };
};
