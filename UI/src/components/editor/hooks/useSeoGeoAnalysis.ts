import { useMemo } from 'react';
import { calculateSEOAnalysis } from '../../../utils/seoAnalyzer';
import { calculateGEOAnalysis } from '../../../utils/geoAnalyzer';
import { UserProfile } from '../../../types';

interface UseSeoGeoProps {
  title: string;
  content: string;
  focusKeyword: string;
  metaTitle: string;
  metaDescription: string;
  secondaryKeywords: string[];
  featuredImage: string;
  featuredImageAlt: string;
  hasOriginalAngle: boolean;
  isComprehensive: boolean;
  profile: UserProfile;
}

export const useSeoGeoAnalysis = ({
  title,
  content,
  focusKeyword,
  metaTitle,
  metaDescription,
  secondaryKeywords,
  featuredImage,
  featuredImageAlt,
  hasOriginalAngle,
  isComprehensive,
  profile
}: UseSeoGeoProps) => {

  const seoAnalysis = useMemo(() => {
    return calculateSEOAnalysis(
      title,
      content,
      focusKeyword,
      metaTitle,
      metaDescription,
      profile.targetMinWords || 1200,
      featuredImage,
      featuredImageAlt,
      secondaryKeywords
    );
  }, [title, content, focusKeyword, metaTitle, metaDescription, profile.targetMinWords, featuredImage, featuredImageAlt, secondaryKeywords]);

  const geoAnalysis = useMemo(() => {
    const internalLinksRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(?:\/|http[s]?:\/\/(?:www\.)?asisten-guru\.id)[^"']*\1/gi;
    const internalLinksMatch = content ? content.match(internalLinksRegex) : null;
    const internalLinksCount = internalLinksMatch ? internalLinksMatch.length : 0;

    return calculateGEOAnalysis(
      content,
      internalLinksCount,
      !!featuredImage,
      !!featuredImageAlt,
      hasOriginalAngle,
      isComprehensive
    );
  }, [content, featuredImage, featuredImageAlt, hasOriginalAngle, isComprehensive]);

  return { seoAnalysis, geoAnalysis };
};
