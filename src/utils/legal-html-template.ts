import { parseMarkdownToHtml, TocItem, escapeHtml } from './markdown-to-html'

export interface LegalDocumentData {
  id: string
  title: string
  content: string
  version: number
  updated_at: string
}

export interface RenderLegalHtmlOptions {
  doc: LegalDocumentData
  activeSlug: 'tos' | 'privacy'
  canonicalUrl: string
  portalUrl?: string
}

const formatIndonesianDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d)
  } catch {
    return dateStr
  }
}

export function renderLegalHtmlPage(options: RenderLegalHtmlOptions): string {
  const { doc, activeSlug, canonicalUrl, portalUrl = 'https://mitra.asisten-guru.id' } = options

  const parsed = parseMarkdownToHtml(doc.content)
  const displayTitle = doc.title || parsed.title
  const lastUpdatedFormatted = formatIndonesianDate(doc.updated_at)
  const isoDate = new Date(doc.updated_at).toISOString()

  const isTos = activeSlug === 'tos'
  const pageMetaTitle = isTos
    ? `${displayTitle} — Portal Mitra Asisten Guru`
    : `${displayTitle} — Perlindungan Data Sensitif Asisten Guru`

  const metaDesc = parsed.excerpt || (isTos
    ? 'Syarat dan Ketentuan resmi Program Kemitraan Kreator dan Konsinyasi Karya Digital di platform edukasi Asisten Guru.'
    : 'Kebijakan Privasi dan komitmen perlindungan data sensitif kemitraan kreator berdasarkan UU Pelindungan Data Pribadi (UU PDP).')

  const escapedMetaTitle = escapeHtml(pageMetaTitle)
  const escapedMetaDesc = escapeHtml(metaDesc)

  // Generate Table of Contents HTML
  const tocHtml = parsed.toc
    .map((item: TocItem) => {
      const indentClass = item.level === 3 ? 'toc-sub' : item.level === 1 ? 'toc-h1' : 'toc-h2'
      return `<li class="toc-item ${indentClass}">
        <a href="#${item.id}" class="toc-link" data-target="${item.id}">
          <span class="toc-bullet"></span>
          <span class="toc-text">${item.title}</span>
        </a>
      </li>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedMetaTitle}</title>
  <meta name="description" content="${escapedMetaDesc}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="author" content="Asisten Guru">
  <meta name="theme-color" content="#0d5b52">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Sinyal Geografis & Bahasa (Indonesia) -->
  <meta name="geo.region" content="ID">
  <meta name="geo.placename" content="Indonesia">
  <meta name="content-language" content="id-ID">
  <meta name="language" content="Indonesian">

  <!-- Open Graph / Facebook / LinkedIn / WhatsApp -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="id_ID">
  <meta property="og:site_name" content="Portal Mitra Asisten Guru">
  <meta property="og:title" content="${escapedMetaTitle}">
  <meta property="og:description" content="${escapedMetaDesc}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://asisten-guru.id/og-image.png">
  <meta property="og:image:width" content="1024">
  <meta property="og:image:height" content="484">
  <meta property="article:published_time" content="2026-10-17T00:00:00+07:00">
  <meta property="article:modified_time" content="${isoDate}">
  <meta property="article:section" content="Legalitas & Kebijakan Platform">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@asisten_guru24">
  <meta name="twitter:title" content="${escapedMetaTitle}">
  <meta name="twitter:description" content="${escapedMetaDesc}">
  <meta name="twitter:image" content="https://asisten-guru.id/og-image.png">

  <!-- Favicon Resmi Asisten Guru (Inline Vector & Data URI: 100% Anti-Broken) -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='100%25' height='100%25'%3E%3Cdefs%3E%3ClinearGradient id='tealGrad' x1='0%25' y1='100%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23074e44'/%3E%3Cstop offset='50%25' stop-color='%230e6f62'/%3E%3Cstop offset='100%25' stop-color='%23229a8a'/%3E%3C/linearGradient%3E%3ClinearGradient id='arrowGrad' x1='0%25' y1='100%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%230e6f62'/%3E%3Cstop offset='50%25' stop-color='%232ca191'/%3E%3Cstop offset='100%25' stop-color='%2354beae'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M 20,65 Q 40,78 60,71 Q 80,78 100,65 L 100,69 Q 80,82 60,75 Q 40,82 20,69 Z' fill='%23074e44'/%3E%3Cpath d='M 22,63 Q 40,76 60,69 Q 80,76 98,63 L 98,66 Q 80,79 60,72 Q 40,79 22,66 Z' fill='%2314524a' opacity='0.3'/%3E%3Cpath d='M 22,61 Q 40,74 60,67 L 60,70 Q 40,77 22,64 Z' fill='%232ca191'/%3E%3Cpath d='M 60,67 Q 80,74 98,61 L 98,64 Q 80,77 60,70 Z' fill='%232ca191'/%3E%3Ccircle cx='52' cy='33' r='7' fill='none' stroke='%230e6f62' stroke-width='3'/%3E%3Cpath d='M 52,40 C 44,40 40,51 51,62 C 51,63 50,65 49,68 C 50,66 52,62 53,60' fill='none' stroke='%230e6f62' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M 48,58 Q 68,54 80,41 Q 86,34 88,27' fill='none' stroke='url(%23arrowGrad)' stroke-width='4.5' stroke-linecap='round'/%3E%3Cpath d='M 88,27 L 85,34 L 81,32 Z' fill='%230e6f62'/%3E%3Cpath d='M 88,27 L 80,29 L 82,33 Z' fill='%230e6f62'/%3E%3Cpath d='M 64,31 C 64,31 65,37 68,36 C 71,35 69,28 69,28 C 69,28 66,28 64,31 Z' fill='%234fa597'/%3E%3Cpath d='M 64,31 C 66,31 68,33 68,36' fill='none' stroke='%23229a8a' stroke-width='0.5'/%3E%3Cpath d='M 48,46 C 48,46 51,50 55,47 C 59,44 54,41 54,41 C 54,41 51,42 48,46 Z' fill='%234fa597'/%3E%3Cpath d='M 78,51 C 74,51 73,56 78,56 C 83,56 82,51 78,51 Z' fill='%231b5a51'/%3E%3Cpath d='M 84,41 Q 84,44 87,44 Q 84,44 84,47 Q 84,44 81,44 Q 84,44 84,41 Z' fill='%230e6f62'/%3E%3C/svg%3E">
  <link rel="shortcut icon" href="https://asisten-guru.id/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="https://asisten-guru.id/apple-touch-icon.png">

  <!-- Preconnect & Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <!-- Schema.org JSON-LD Structured Data untuk Mesin Pencari & AI Search Bots -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": ${JSON.stringify(displayTitle)},
    "headline": ${JSON.stringify(displayTitle)},
    "description": ${JSON.stringify(metaDesc)},
    "url": ${JSON.stringify(canonicalUrl)},
    "inLanguage": "id-ID",
    "datePublished": "2026-10-17T00:00:00+07:00",
    "dateModified": ${JSON.stringify(isoDate)},
    "publisher": {
      "@type": "Organization",
      "name": "Asisten Guru",
      "url": "https://asisten-guru.id",
      "logo": {
        "@type": "ImageObject",
        "url": "https://asisten-guru.id/logo.svg"
      }
    },
    "mainEntity": {
      "@type": "DigitalDocument",
      "name": ${JSON.stringify(displayTitle)},
      "version": ${JSON.stringify(String(doc.version))},
      "encodingFormat": "text/html",
      "dateModified": ${JSON.stringify(isoDate)}
    }
  }
  </script>

  <style>
    /* CSS Reset & Variables */
    :root {
      --color-brand-primary: #0d5b52;
      --color-brand-dark: #083c36;
      --color-brand-light: #14b8a6;
      --color-brand-surface: #f0fdfa;
      --color-brand-surface-2: #ccfbf1;
      
      --color-text-main: #1c1917;
      --color-text-muted: #57534e;
      --color-text-subtle: #78716c;
      
      --color-bg-body: #fafaf9;
      --color-bg-card: #ffffff;
      --color-border: #e7e5e4;
      --color-border-subtle: #f5f5f4;
      
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.07);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--color-bg-body);
      color: var(--color-text-main);
      line-height: 1.7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Reading Progress Bar */
    #progress-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: transparent;
      z-index: 1000;
    }
    #progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-light));
      transition: width 0.1s ease-out;
    }

    /* Top Navigation Bar */
    .site-nav {
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-border);
      z-index: 900;
      padding: 0.75rem 1.5rem;
    }

    .nav-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      object-fit: contain;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-weight: 800;
      font-size: 0.95rem;
      letter-spacing: -0.02em;
      color: var(--color-brand-dark);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .brand-badge {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      background-color: var(--color-brand-surface-2);
      color: var(--color-brand-dark);
    }

    .brand-subtitle {
      font-size: 0.72rem;
      color: var(--color-text-subtle);
      font-weight: 500;
    }

    /* Document Tabs Switcher */
    .tabs-group {
      display: flex;
      align-items: center;
      background-color: #f5f5f4;
      padding: 0.25rem;
      border-radius: 0.75rem;
      border: 1px solid var(--color-border);
    }

    .tab-link {
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 700;
      border-radius: 0.55rem;
      text-decoration: none;
      color: var(--color-text-muted);
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .tab-link:hover {
      color: var(--color-text-main);
    }

    .tab-link.active {
      background-color: #ffffff;
      color: var(--color-brand-primary);
      box-shadow: var(--shadow-sm);
    }

    /* Nav Actions */
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.85rem;
      font-size: 0.78rem;
      font-weight: 600;
      font-family: inherit;
      border-radius: 0.65rem;
      border: 1px solid var(--color-border);
      background-color: #ffffff;
      color: var(--color-text-muted);
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background-color: #f5f5f4;
      color: var(--color-text-main);
      border-color: #d6d3d1;
    }

    .action-btn-primary {
      background-color: var(--color-brand-primary);
      color: #ffffff;
      border-color: var(--color-brand-primary);
    }

    .action-btn-primary:hover {
      background-color: var(--color-brand-dark);
      color: #ffffff;
      border-color: var(--color-brand-dark);
    }

    /* Main Container */
    .main-wrapper {
      flex: 1;
      max-width: 1280px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem 4rem;
      width: 100%;
    }

    /* Hero Document Header */
    .doc-hero {
      background: linear-gradient(135deg, #ffffff 0%, var(--color-brand-surface) 100%);
      border: 1px solid var(--color-border);
      border-radius: 1.5rem;
      padding: 2.25rem;
      margin-bottom: 2rem;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }

    .doc-hero::after {
      content: '';
      position: absolute;
      right: -40px;
      top: -40px;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-subtle);
      margin-bottom: 0.85rem;
      flex-wrap: wrap;
    }

    .breadcrumb a {
      color: var(--color-text-subtle);
      text-decoration: none;
    }
    .breadcrumb a:hover {
      color: var(--color-brand-primary);
      text-decoration: underline;
    }
    .breadcrumb-sep {
      color: #d6d3d1;
    }

    .hero-badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      background-color: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .version-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.65rem;
      border-radius: 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      background-color: var(--color-brand-surface-2);
      color: var(--color-brand-dark);
      border: 1px solid #99f6e4;
      font-family: var(--font-mono);
    }

    .doc-hero-title {
      font-size: 1.85rem;
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: -0.03em;
      color: #0f172a;
      margin-bottom: 1rem;
    }

    .meta-strip {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(231, 229, 228, 0.8);
      font-size: 0.78rem;
      color: var(--color-text-muted);
      flex-wrap: wrap;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .meta-item strong {
      color: var(--color-text-main);
      font-weight: 600;
    }

    /* Content Layout Grid */
    .layout-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 2.5rem;
      align-items: start;
    }

    /* Sidebar Table of Contents */
    .sidebar-toc {
      position: sticky;
      top: 5rem;
      background: #ffffff;
      border: 1px solid var(--color-border);
      border-radius: 1.25rem;
      padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      max-height: calc(100vh - 6.5rem);
      overflow-y: auto;
    }

    .toc-title {
      font-size: 0.82rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-subtle);
      margin-bottom: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toc-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .toc-item {
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .toc-item.toc-sub {
      padding-left: 0.85rem;
      font-size: 0.75rem;
    }

    .toc-link {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.4rem 0.5rem;
      border-radius: 0.45rem;
      color: var(--color-text-muted);
      text-decoration: none;
      transition: all 0.15s ease;
      font-weight: 500;
    }

    .toc-link:hover {
      background-color: var(--color-brand-surface);
      color: var(--color-brand-primary);
    }

    .toc-bullet {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: #cbd5e1;
      flex-shrink: 0;
      transform: translateY(-2px);
    }

    .toc-link:hover .toc-bullet {
      background-color: var(--color-brand-primary);
    }

    .sidebar-support {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border-subtle);
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }
    .sidebar-support a {
      color: var(--color-brand-primary);
      text-decoration: none;
      font-weight: 600;
    }
    .sidebar-support a:hover {
      text-decoration: underline;
    }

    /* Article Body Styling */
    .article-container {
      background-color: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 1.5rem;
      padding: 3rem 2.5rem;
      box-shadow: var(--shadow-sm);
      min-width: 0;
    }

    .legal-content {
      font-size: 0.95rem;
      color: #334155;
      line-height: 1.85;
    }

    .legal-heading {
      color: #0f172a;
      font-weight: 800;
      letter-spacing: -0.02em;
      position: relative;
      scroll-margin-top: 6rem;
    }

    .legal-heading span {
      display: inline;
    }

    .anchor-link {
      opacity: 0;
      margin-left: 0.4rem;
      color: var(--color-brand-light);
      text-decoration: none;
      font-weight: 400;
      transition: opacity 0.15s ease;
    }
    .legal-heading:hover .anchor-link {
      opacity: 1;
    }

    .legal-h1 {
      font-size: 1.6rem;
      margin-bottom: 1.5rem;
      display: none; /* Sudah tampil di Hero Section */
    }

    .legal-h2 {
      font-size: 1.25rem;
      margin-top: 2.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .legal-h3 {
      font-size: 1.05rem;
      margin-top: 1.75rem;
      margin-bottom: 0.75rem;
      color: #1e293b;
    }

    .legal-h4 {
      font-size: 0.95rem;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: #334155;
    }

    .legal-p {
      margin-bottom: 1.25rem;
    }

    .legal-divider {
      border: none;
      border-top: 1px dashed var(--color-border);
      margin: 2.5rem 0;
    }

    .legal-quote {
      background-color: #f8fafc;
      border-left: 4px solid var(--color-brand-primary);
      padding: 1rem 1.25rem;
      border-radius: 0 0.75rem 0.75rem 0;
      margin: 1.5rem 0;
      font-style: italic;
      color: #475569;
    }

    .legal-list {
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
    }

    .legal-list li {
      margin-bottom: 0.5rem;
    }

    .legal-ul {
      list-style-type: disc;
    }

    .legal-ol {
      list-style-type: decimal;
    }

    .legal-code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 0.15rem 0.35rem;
      border-radius: 0.35rem;
      border: 1px solid #e2e8f0;
    }

    .legal-link {
      color: var(--color-brand-primary);
      text-decoration: underline;
      text-underline-offset: 3px;
      font-weight: 600;
    }
    .legal-link:hover {
      color: var(--color-brand-dark);
    }

    /* Responsive Tables */
    .legal-table-wrapper {
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
    }

    .legal-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .legal-table th {
      background-color: #f8fafc;
      font-weight: 700;
      color: #0f172a;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border);
    }

    .legal-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border-subtle);
      color: #334155;
    }

    .legal-table tr:last-child td {
      border-bottom: none;
    }

    /* Document Footer */
    .site-footer {
      background-color: #ffffff;
      border-top: 1px solid var(--color-border);
      padding: 3rem 1.5rem 2.5rem;
      margin-top: auto;
    }

    .footer-container {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .footer-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .footer-legal-notice {
      font-size: 0.75rem;
      color: var(--color-text-subtle);
      max-width: 720px;
      line-height: 1.6;
    }

    .footer-bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.75rem;
      color: var(--color-text-subtle);
    }

    .footer-links {
      display: flex;
      gap: 1rem;
    }
    .footer-links a {
      color: var(--color-text-muted);
      text-decoration: none;
      font-weight: 500;
    }
    .footer-links a:hover {
      color: var(--color-brand-primary);
      text-decoration: underline;
    }

    /* Toast Notification */
    #copy-toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #0f172a;
      color: #ffffff;
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      box-shadow: var(--shadow-lg);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
      transition: all 0.2s ease;
      z-index: 2000;
    }
    #copy-toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* Responsive Queries */
    @media (max-width: 1024px) {
      .layout-grid {
        grid-template-columns: 1fr;
      }
      .sidebar-toc {
        display: none; /* Hide sticky sidebar on mobile/tablet */
      }
      .article-container {
        padding: 2rem 1.5rem;
      }
      .doc-hero {
        padding: 1.75rem 1.25rem;
      }
      .doc-hero-title {
        font-size: 1.45rem;
      }
    }

    @media (max-width: 640px) {
      .site-nav {
        padding: 0.6rem 1rem;
      }
      .tabs-group {
        order: 3;
        width: 100%;
        justify-content: center;
        margin-top: 0.5rem;
      }
      .nav-container {
        flex-wrap: wrap;
      }
      .main-wrapper {
        padding: 1.5rem 1rem 3rem;
      }
    }

    /* Print Stylesheet (Khusus Cetak / Simpan PDF Resmi) */
    @media print {
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        font-size: 11pt;
        line-height: 1.5;
      }
      #progress-container,
      .site-nav,
      .sidebar-toc,
      .action-btn,
      .anchor-link,
      .site-footer,
      #copy-toast {
        display: none !important;
      }
      .main-wrapper {
        max-width: 100% !important;
        padding: 0 !important;
      }
      .doc-hero {
        background: none !important;
        border: 1px solid #000000 !important;
        box-shadow: none !important;
        padding: 1.5rem !important;
        margin-bottom: 1.5rem !important;
      }
      .doc-hero::after {
        display: none !important;
      }
      .article-container {
        background: none !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      .legal-h2 {
        page-break-before: auto;
        border-bottom: 1px solid #000000 !important;
      }
      a {
        text-decoration: none !important;
        color: #000000 !important;
      }
      .legal-table th, .legal-table td {
        border-color: #000000 !important;
      }
    }
  </style>
</head>
<body>

  <!-- Reading Progress Bar -->
  <div id="progress-container">
    <div id="progress-bar"></div>
  </div>

  <!-- Header Navigasi Resmi -->
  <header class="site-nav">
    <div class="nav-container">
      <a href="${portalUrl}" class="brand-link" title="Menuju Beranda Portal Mitra">
        <svg class="brand-logo" viewBox="0 0 120 120" width="32" height="32" aria-label="Logo Asisten Guru">
          <defs>
            <linearGradient id="navTealGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#074e44" />
              <stop offset="50%" stop-color="#0e6f62" />
              <stop offset="100%" stop-color="#229a8a" />
            </linearGradient>
            <linearGradient id="navArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#0e6f62" />
              <stop offset="50%" stop-color="#2ca191" />
              <stop offset="100%" stop-color="#54beae" />
            </linearGradient>
          </defs>
          <path d="M 20,65 Q 40,78 60,71 Q 80,78 100,65 L 100,69 Q 80,82 60,75 Q 40,82 20,69 Z" fill="#074e44" />
          <path d="M 22,63 Q 40,76 60,69 Q 80,76 98,63 L 98,66 Q 80,79 60,72 Q 40,79 22,66 Z" fill="#14524a" opacity="0.3" />
          <path d="M 22,61 Q 40,74 60,67 L 60,70 Q 40,77 22,64 Z" fill="#2ca191" />
          <path d="M 60,67 Q 80,74 98,61 L 98,64 Q 80,77 60,70 Z" fill="#2ca191" />
          <circle cx="52" cy="33" r="7" fill="none" stroke="#0e6f62" stroke-width="3" />
          <path d="M 52,40 C 44,40 40,51 51,62 C 51,63 50,65 49,68 C 50,66 52,62 53,60" fill="none" stroke="#0e6f62" stroke-width="3" stroke-linecap="round" />
          <path d="M 48,58 Q 68,54 80,41 Q 86,34 88,27" fill="none" stroke="url(#navArrowGrad)" stroke-width="4.5" stroke-linecap="round" />
          <path d="M 88,27 L 85,34 L 81,32 Z" fill="#0e6f62" />
          <path d="M 88,27 L 80,29 L 82,33 Z" fill="#0e6f62" />
          <path d="M 64,31 C 64,31 65,37 68,36 C 71,35 69,28 69,28 C 69,28 66,28 64,31 Z" fill="#4fa597" />
          <path d="M 64,31 C 66,31 68,33 68,36" fill="none" stroke="#229a8a" stroke-width="0.5" />
          <path d="M 48,46 C 48,46 51,50 55,47 C 59,44 54,41 54,41 C 54,41 51,42 48,46 Z" fill="#4fa597" />
          <path d="M 78,51 C 74,51 73,56 78,56 C 83,56 82,51 78,51 Z" fill="#1b5a51" />
          <path d="M 84,41 Q 84,44 87,44 Q 84,44 84,47 Q 84,44 81,44 Q 84,44 84,41 Z" fill="#0e6f62" />
        </svg>
        <div class="brand-text">
          <div class="brand-title">
            <span>Asisten Guru</span>
            <span class="brand-badge">Legal</span>
          </div>
          <span class="brand-subtitle">Portal Kemitraan Kreator</span>
        </div>
      </a>

      <!-- Switcher Syarat & Ketentuan vs Kebijakan Privasi -->
      <nav class="tabs-group" aria-label="Pilihan Dokumen Legalitas">
        <a href="/tos" class="tab-link ${isTos ? 'active' : ''}" ${isTos ? 'aria-current="page"' : ''}>
          Syarat & Ketentuan
        </a>
        <a href="/privacy" class="tab-link ${!isTos ? 'active' : ''}" ${!isTos ? 'aria-current="page"' : ''}>
          Kebijakan Privasi
        </a>
      </nav>

      <!-- Tombol Aksi Cepat -->
      <div class="nav-actions">
        <button type="button" class="action-btn" onclick="window.print()" title="Cetak atau Simpan Dokumen sebagai PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          <span>Cetak</span>
        </button>

        <button type="button" class="action-btn" onclick="copyDocumentLink()" title="Salin Tautan Resmi Dokumen Ini">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Salin</span>
        </button>

        <a href="${portalUrl}" class="action-btn action-btn-primary" title="Buka Dashboard / Formulir Pendaftaran Mitra">
          <span>← Masuk Portal</span>
        </a>
      </div>
    </div>
  </header>

  <!-- Konten Utama Dokumen -->
  <main class="main-wrapper">

    <!-- Hero Header Dokumen -->
    <header class="doc-hero">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${portalUrl}">Portal Mitra</a>
        <span class="breadcrumb-sep">/</span>
        <span>Dokumen Hukum Resmi</span>
        <span class="breadcrumb-sep">/</span>
        <span aria-current="page">${isTos ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}</span>
      </nav>

      <div class="hero-badges">
        <span class="version-badge">Versi ${doc.version}</span>
        <span class="status-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Aktif & Berlaku Mengikat
        </span>
      </div>

      <h1 class="doc-hero-title">${displayTitle}</h1>

      <div class="meta-strip">
        <div class="meta-item">
          <span>Terakhir Diperbarui:</span>
          <strong>${lastUpdatedFormatted}</strong>
        </div>
        <div class="meta-item">
          <span>Entitas:</span>
          <strong>Pengelola Platform Asisten Guru</strong>
        </div>
        <div class="meta-item">
          <span>Yurisdiksi:</span>
          <strong>Republik Indonesia</strong>
        </div>
      </div>
    </header>

    <!-- Layout Grid: Table of Contents + Artikel Naskah -->
    <div class="layout-grid">

      <!-- Sidebar Daftar Isi / Navigasi Cepat -->
      <aside class="sidebar-toc" aria-label="Daftar Isi Dokumen">
        <div class="toc-title">
          <span>Daftar Isi</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        </div>
        <ul class="toc-list">
          ${tocHtml}
        </ul>

        <div class="sidebar-support">
          <p>Ada pertanyaan mengenai ketentuan hukum kemitraan?</p>
          <p style="margin-top: 0.35rem;">
            <a href="mailto:legal@asisten-guru.id">Hubungi Tim Legalitas →</a>
          </p>
        </div>
      </aside>

      <!-- Naskah Lengkap Dokumen Hukum -->
      <article class="article-container" itemscope itemtype="https://schema.org/DigitalDocument">
        <div class="legal-content">
          ${parsed.html}
        </div>
      </article>

    </div>

  </main>

  <!-- Footer Resmi -->
  <footer class="site-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-legal-notice">
          <strong>Pemberitahuan Hukum:</strong> Dokumen ini mengikat secara hukum bagi seluruh mitra kreator yang mendaftar atau menyalurkan karya digital di platform Asisten Guru. Seluruh ketentuan disusun dengan mengacu pada peraturan perundang-undangan Republik Indonesia, termasuk Undang-Undang Nomor 27 Tahun 2022 (Pelindungan Data Pribadi), Undang-Undang Nomor 28 Tahun 2014 (Hak Cipta), dan peraturan perniagaan elektronik yang berlaku.
        </div>
        <button type="button" class="action-btn" onclick="window.scrollTo({top: 0, behavior: 'smooth'})">
          <span>↑ Kembali ke Atas</span>
        </button>
      </div>

      <div class="footer-bottom">
        <div>
          © 2026 Asisten Guru — PT Asisten Guru Indonesia. Seluruh hak cipta dilindungi undang-undang.
        </div>
        <nav class="footer-links" aria-label="Tautan Terkait">
          <a href="https://asisten-guru.id">Beranda Utama</a>
          <a href="/tos">Syarat & Ketentuan</a>
          <a href="/privacy">Kebijakan Privasi</a>
          <a href="https://asisten-guru.id/bantuan">Pusat Bantuan</a>
        </nav>
      </div>
    </div>
  </footer>

  <!-- Toast Notifikasi Copy -->
  <div id="copy-toast" role="status" aria-live="polite">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>Tautan dokumen berhasil disalin ke clipboard!</span>
  </div>

  <script>
    // 1. Reading Progress Bar
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      const bar = document.getElementById('progress-bar');
      if (bar) bar.style.width = scrolled + '%';
    });

    // 2. Salin Tautan Dokumen
    function copyDocumentLink() {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('copy-toast');
        if (toast) {
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2500);
        }
      }).catch(() => {
        alert('Tautan: ' + url);
      });
    }

    // 3. Highlight Aktif Daftar Isi saat scroll
    document.addEventListener('DOMContentLoaded', () => {
      const headings = document.querySelectorAll('.legal-heading');
      const tocLinks = document.querySelectorAll('.toc-link');

      if (!headings.length || !tocLinks.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            tocLinks.forEach(link => {
              if (link.getAttribute('data-target') === id) {
                link.classList.add('active');
                link.style.backgroundColor = 'var(--color-brand-surface)';
                link.style.color = 'var(--color-brand-primary)';
                link.style.fontWeight = '700';
              } else {
                link.classList.remove('active');
                link.style.backgroundColor = '';
                link.style.color = '';
                link.style.fontWeight = '';
              }
            });
          }
        });
      }, {
        rootMargin: '-20% 0px -70% 0px'
      });

      headings.forEach(h => observer.observe(h));
    });
  </script>
</body>
</html>`
}
