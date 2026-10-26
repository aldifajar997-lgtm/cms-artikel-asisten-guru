import React from 'react';
import { StoreAppearanceConfig } from '../../types';

// Smart Contrast Guard: Otomatis menghitung warna teks kontras berbasis luminansi
export function calculateContrastTextColor(hexColor: string): string {
  try {
    const cleanHex = hexColor.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    // Standar koefisien kecerahan ITU-R BT.601
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance > 140 ? '#0f172a' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}

export function isColorLight(hexColor: string): boolean {
  try {
    const cleanHex = hexColor.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance > 140;
  } catch {
    return false;
  }
}

// Normalisasi Hex 3-digit ke 6-digit
export function normalizeHex(hex: string): string {
  if (!hex) return '#0d9488';
  const clean = hex.trim();
  if (clean.length === 4 && clean.startsWith('#')) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

// Helper untuk styling tombol pada preview
export function getButtonRadiusClass(radius: string): string {
  switch (radius) {
    case 'sharp': return 'rounded-md';
    case 'pill': return 'rounded-full';
    case 'rounded':
    default:
      return 'rounded-2xl';
  }
}

export function getButtonStyleProps(btn: StoreAppearanceConfig['button']) {
  const fullHex = normalizeHex(btn.bgColor);
  const outlineBorder = btn.borderColor ? normalizeHex(btn.borderColor) : fullHex;
  switch (btn.style) {
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: fullHex,
        border: `1.5px solid ${outlineBorder}`
      };
    case 'shadow-soft':
      return {
        backgroundColor: fullHex,
        color: btn.textColor,
        boxShadow: `0 8px 20px -4px ${fullHex}80`
      };
    case 'shadow-hard':
      return {
        backgroundColor: fullHex,
        color: btn.textColor,
        boxShadow: `3px 3px 0px #000000`,
        border: '1.5px solid #000000'
      };
    case 'glassmorphism':
      return {
        backgroundColor: `${fullHex}dd`,
        color: btn.textColor,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${btn.borderColor || '#ffffff33'}`
      };
    case 'fill':
    default:
      return {
        backgroundColor: fullHex,
        color: btn.textColor
      };
  }
}

export function getFeaturedAnimationClass(style: string): string {
  switch (style) {
    case 'pulse': return 'anim-featured-pulse';
    case 'glow': return 'anim-featured-glow ring-2 ring-teal-400/80';
    case 'jiggle': return 'anim-featured-jiggle';
    case 'none':
    default:
      return '';
  }
}

// Helper: Gaya visual wadah profil (Glassmorphism / Soft / Solid / None)
export function getProfileCardStyle(typo: StoreAppearanceConfig['typography']): React.CSSProperties {
  const style = typo.cardStyle || 'none';
  if (style === 'none') return {};

  const hex = typo.cardBgColor || '#ffffff';
  const opacity = (typo.cardOpacity !== undefined ? typo.cardOpacity : 85) / 100;
  
  // Konversi Hex ke RGBA
  let r = 255, g = 255, b = 255;
  if (hex.startsWith('#')) {
    const cleanHex = hex.slice(1);
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16) || 255;
      g = parseInt(cleanHex[1] + cleanHex[1], 16) || 255;
      b = parseInt(cleanHex[2] + cleanHex[2], 16) || 255;
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.slice(0, 2), 16) || 255;
      g = parseInt(cleanHex.slice(2, 4), 16) || 255;
      b = parseInt(cleanHex.slice(4, 6), 16) || 255;
    }
  }
  const rgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;

  const blurMap = {
    none: 'none',
    sm: 'blur(6px)',
    md: 'blur(12px)',
    lg: 'blur(20px)'
  };
  const blurValue = blurMap[typo.cardBlur || 'md'];

  if (style === 'glass') {
    const isLightCard = (r * 299 + g * 587 + b * 114) / 1000 > 150;
    return {
      backgroundColor: rgba,
      backdropFilter: blurValue !== 'none' ? blurValue : 'blur(12px)',
      WebkitBackdropFilter: blurValue !== 'none' ? blurValue : 'blur(12px)',
      border: isLightCard ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.18)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.12)'
    };
  }

  if (style === 'soft') {
    return {
      backgroundColor: rgba,
      backdropFilter: blurValue !== 'none' ? blurValue : undefined,
      WebkitBackdropFilter: blurValue !== 'none' ? blurValue : undefined,
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)'
    };
  }

  // solid
  return {
    backgroundColor: hex,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
  };
}

// Helper: Gaya efek bayangan teks (Soft Shadow / Glow Contrast Halo)
export function getTextShadowStyle(shadow?: 'none' | 'soft' | 'glow', headingColor = '#1c1917'): React.CSSProperties {
  if (shadow === 'soft') {
    const isLightText = isColorLight(headingColor);
    return {
      textShadow: isLightText
        ? '0 1px 4px rgba(0, 0, 0, 0.8), 0 0 2px rgba(0, 0, 0, 0.5)'
        : '0 1px 3px rgba(255, 255, 255, 0.85), 0 0 1px rgba(255, 255, 255, 0.6)'
    };
  }
  if (shadow === 'glow') {
    const isLightText = isColorLight(headingColor);
    return {
      textShadow: isLightText
        ? '0 0 10px rgba(0, 0, 0, 0.85), 0 0 4px rgba(0, 0, 0, 0.95)'
        : '0 0 8px rgba(255, 255, 255, 0.95), 0 0 3px rgba(255, 255, 255, 0.9)'
    };
  }
  return {};
}

// Helper WhatsApp: Normalisasi format nomor lokal 08... menjadi 628... untuk wa.me link
export function getCleanWhatsAppUrl(waInput: string | null | undefined, storeTitle: string): string | null {
  if (!waInput) return null;
  const digits = waInput.replace(/[^0-9]/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }
  if (normalized.length < 9) return null;
  const textMsg = encodeURIComponent(`Halo ${storeTitle}, saya tertarik dengan modul di etalase toko Anda...`);
  return `https://wa.me/${normalized}?text=${textMsg}`;
}

// Helper Medsos: Deteksi URL, www., atau username @handle (Anti-Phishing Guard)
export function resolveSocialUrl(platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'facebook', val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('www.')) {
    return resolveSocialUrl(platform, `https://${trimmed}`);
  }

  const cleanHandle = trimmed.replace(/^@/, '');
  switch (platform) {
    case 'instagram': return `https://instagram.com/${cleanHandle}`;
    case 'tiktok': return `https://tiktok.com/@${cleanHandle}`;
    case 'youtube': return cleanHandle.includes('/') ? `https://youtube.com/${cleanHandle}` : `https://youtube.com/@${cleanHandle}`;
    case 'linkedin': return cleanHandle.includes('/') ? `https://linkedin.com/${cleanHandle}` : `https://linkedin.com/in/${cleanHandle}`;
    case 'facebook': return `https://facebook.com/${cleanHandle}`;
  }
}
