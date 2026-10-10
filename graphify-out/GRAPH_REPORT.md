# Graph Report - CMS3  (2026-10-10)

## Corpus Check
- 33 files · ~86,024 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 487 nodes · 847 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend Routes & Auth
- Article Editor & Hooks
- Frontend Core & Auth
- Backend Config & Deps
- SEO Glossary
- Admin Dashboard & Charts
- Frontend Build Tools
- Frontend Libraries
- UI TSConfig
- API Documentation
- Project Documentation
- Security Checklists
- Error Boundary
- Update Tools
- TypeScript Tests
- Role Tests
- Avatar Deletion Tests

## God Nodes (most connected - your core abstractions)
1. `Category` - 18 edges
2. `useToast()` - 17 edges
3. `Bindings` - 16 edges
4. `Variables` - 16 edges
5. `handleApiError()` - 16 edges
6. `compilerOptions` - 15 edges
7. `authMiddleware()` - 14 edges
8. `UserProfile` - 14 edges
9. `rateLimit()` - 12 edges
10. `requirePermission()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `UserSettings()` --calls--> `useToast()`  [EXTRACTED]
  UI/src/components/UserSettings.tsx → UI/src/context/ToastContext.tsx
- `types` --extends--> `@cloudflare/workers-types`  [EXTRACTED]
  tsconfig.json → package.json
- `CategorySettingsProps` --references--> `Category`  [EXTRACTED]
  UI/src/components/CategorySettings.tsx → UI/src/types.ts
- `UseSeoGeoProps` --references--> `UserProfile`  [EXTRACTED]
  UI/src/components/editor/hooks/useSeoGeoAnalysis.ts → UI/src/types.ts
- `SerpPreviewProps` --references--> `Category`  [EXTRACTED]
  UI/src/components/editor/ui/SerpPreview.tsx → UI/src/types.ts

## Import Cycles
- None detected.

## Communities (25 total, 3 thin omitted)

### Community 0 - "Backend Routes & Auth"
Cohesion: 0.06
Nodes (58): app, AppContext, authMiddleware(), requirePermission(), errorHandler(), notFoundHandler(), rateLimit(), auth (+50 more)

### Community 1 - "Article Editor & Hooks"
Cohesion: 0.06
Nodes (48): ArticleEditor, ArticleEditor(), ArticleEditorProps, CategorySettingsProps, useArticleForm(), UseArticleFormProps, useLiveTrends(), useSeoGeoAnalysis() (+40 more)

### Community 2 - "Frontend Core & Auth"
Cohesion: 0.07
Nodes (42): App(), CategorySettings, ForgotPassword, Glosarium, Login, ProductEditor, ProfileSettings, ResetPassword (+34 more)

### Community 3 - "Backend Config & Deps"
Cohesion: 0.05
Nodes (40): bcryptjs, @cloudflare/workers-types, hono, @hono/zod-validator, isomorphic-dompurify, dependencies, bcryptjs, hono (+32 more)

### Community 4 - "SEO Glossary"
Cohesion: 0.05
Nodes (38): 10. SERP (Search Engine Results Page), 11. Crawling (Perayapan), 12. Indexing (Pengindeksan), 13. Sitemap (Peta Situs), 14. Robots.txt, 15. Canonical URL (Canonical Tag), 16. Structured Data / Schema Markup, 17. Internal Link (+30 more)

### Community 5 - "Admin Dashboard & Charts"
Cohesion: 0.08
Nodes (27): ArticleList, Dashboard, EarningsAdminPanel, ProductList, ArticleList(), ArticleListProps, ArticleStatusChart(), ArticleStatusChartProps (+19 more)

### Community 6 - "Frontend Build Tools"
Cohesion: 0.06
Nodes (32): autoprefixer, esbuild, tailwindcss, @tailwindcss/typography, tsx, @types/express, @types/node, @types/react (+24 more)

### Community 7 - "Frontend Libraries"
Cohesion: 0.06
Nodes (31): axios, dotenv, express, @google/genai, lucide-react, motion, react, react-dom (+23 more)

### Community 8 - "UI TSConfig"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 9 - "API Documentation"
Cohesion: 0.12
Nodes (16): Dokumentasi Endpoint API Backend (CMS), Endpoint Administratif (CMS), Endpoint Administratif (Super Admin), Endpoint Internal (Khusus Ekosistem Hub), Endpoint Profil Sendiri (Personal), Endpoint Publik (Katalog), Endpoint Publik (Untuk Pembaca), 📝 Modul Artikel & Postingan (`/api/posts`) (+8 more)

### Community 10 - "Project Documentation"
Cohesion: 0.15
Nodes (12): 1. Deploy Backend (Cloudflare Workers), 1. Menjalankan Backend API, 2. Deploy Frontend UI (Cloudflare Pages), 2. Menjalankan Admin UI Dashboard, ✨ Fitur Unggulan, 🚀 Ikhtisar Arsitektur, 📄 Lisensi, 🚢 Panduan Deployment ke Production (+4 more)

### Community 11 - "Security Checklists"
Cohesion: 0.22
Nodes (8): AI-Specific Guidelines, Backend Security, Deployment Checklist, Frontend Security, General Architecture, Maintenance Checklist, Security Checklist for AI Coding Agents, Testing Checklist

### Community 12 - "Error Boundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 13 - "Update Tools"
Cohesion: 0.40
Nodes (4): alStr, appStr, fs, typesStr

## Knowledge Gaps
- **197 isolated node(s):** `AppContext`, `ForgotPasswordProps`, `LoginProps`, `ResetPasswordProps`, `SiteSettingsData` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 6` to `Community 3`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 7` to `Community 6`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `AppContext`, `ForgotPasswordProps`, `LoginProps` to the rest of the system?**
  _197 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06001021450459653 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06490384615384616 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06775956284153005 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._