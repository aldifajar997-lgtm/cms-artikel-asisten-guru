# Graph Report - CMS3  (2026-09-27)

## Corpus Check
- 83 files · ~70,159 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 692 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b913a43f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- users.ts
- Terminologi Dasar
- App.tsx
- devDependencies
- dependencies
- dependencies
- compilerOptions
- compilerOptions
- ToastContext.tsx
- update.cjs
- fix-ts.js
- test-role.js
- test-delete-avatar.js
- Dokumentasi Endpoint API Backend (CMS)
- README.md
- Security Checklist for AI Coding Agents

## God Nodes (most connected - your core abstractions)
1. `handleApiError()` - 17 edges
2. `compilerOptions` - 15 edges
3. `Bindings` - 14 edges
4. `Variables` - 14 edges
5. `useToast()` - 13 edges
6. `UserProfile` - 12 edges
7. `authMiddleware()` - 12 edges
8. `useConfirm()` - 11 edges
9. `api` - 11 edges
10. `rateLimit()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `CategorySettingsProps` --references--> `Category`  [EXTRACTED]
  UI/src/components/CategorySettings.tsx → UI/src/types.ts
- `NavigationProps` --references--> `UserProfile`  [EXTRACTED]
  UI/src/components/Navigation.tsx → UI/src/types.ts
- `ProductListProps` --references--> `Product`  [EXTRACTED]
  UI/src/components/ProductList.tsx → UI/src/types.ts
- `ProfileSettingsProps` --references--> `UserProfile`  [EXTRACTED]
  UI/src/components/ProfileSettings.tsx → UI/src/types.ts
- `App()` --calls--> `useConfirm()`  [EXTRACTED]
  UI/src/App.tsx → UI/src/context/ConfirmContext.tsx

## Import Cycles
- None detected.

## Communities (23 total, 3 thin omitted)

### Community 0 - "users.ts"
Cohesion: 0.07
Nodes (52): app, AppContext, authMiddleware(), requirePermission(), errorHandler(), notFoundHandler(), rateLimit(), auth (+44 more)

### Community 1 - "Terminologi Dasar"
Cohesion: 0.05
Nodes (38): 10. SERP (Search Engine Results Page), 11. Crawling (Perayapan), 12. Indexing (Pengindeksan), 13. Sitemap (Peta Situs), 14. Robots.txt, 15. Canonical URL (Canonical Tag), 16. Structured Data / Schema Markup, 17. Internal Link (+30 more)

### Community 2 - "App.tsx"
Cohesion: 0.07
Nodes (59): App(), ArticleEditor(), ArticleEditorProps, countOccurrences(), EDITOR_OPTIONS, excerptFallback(), ArticleList(), ArticleListProps (+51 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (34): autoprefixer, esbuild, tailwindcss, @tailwindcss/typography, tsx, @types/express, @types/node, @types/react (+26 more)

### Community 4 - "dependencies"
Cohesion: 0.07
Nodes (29): axios, dotenv, express, @google/genai, lucide-react, motion, react, react-dom (+21 more)

### Community 5 - "dependencies"
Cohesion: 0.07
Nodes (28): bcryptjs, @cloudflare/workers-types, hono, @hono/zod-validator, isomorphic-dompurify, dependencies, bcryptjs, hono (+20 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 7 - "compilerOptions"
Cohesion: 0.15
Nodes (12): @cloudflare/workers-types, ESNext, compilerOptions, jsx, jsxImportSource, lib, module, moduleResolution (+4 more)

### Community 8 - "ToastContext.tsx"
Cohesion: 0.14
Nodes (14): ConfirmDialog(), ConfirmDialogProps, toastConfig, ToastContainer(), ToastContainerProps, ConfirmContext, ConfirmContextType, ConfirmProvider() (+6 more)

### Community 9 - "update.cjs"
Cohesion: 0.40
Nodes (4): alStr, appStr, fs, typesStr

### Community 20 - "Dokumentasi Endpoint API Backend (CMS)"
Cohesion: 0.12
Nodes (16): Dokumentasi Endpoint API Backend (CMS), Endpoint Administratif (CMS), Endpoint Administratif (Super Admin), Endpoint Internal (Khusus Ekosistem Hub), Endpoint Profil Sendiri (Personal), Endpoint Publik (Katalog), Endpoint Publik (Untuk Pembaca), 📝 Modul Artikel & Postingan (`/api/posts`) (+8 more)

### Community 21 - "README.md"
Cohesion: 0.15
Nodes (12): 1. Deploy Backend (Cloudflare Workers), 1. Menjalankan Backend API, 2. Deploy Frontend UI (Cloudflare Pages), 2. Menjalankan Admin UI Dashboard, ✨ Fitur Unggulan, 🚀 Ikhtisar Arsitektur, 📄 Lisensi, 🚢 Panduan Deployment ke Production (+4 more)

### Community 22 - "Security Checklist for AI Coding Agents"
Cohesion: 0.22
Nodes (8): AI-Specific Guidelines, Backend Security, Deployment Checklist, Frontend Security, General Architecture, Maintenance Checklist, Security Checklist for AI Coding Agents, Testing Checklist

## Knowledge Gaps
- **174 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+169 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _174 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `users.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07279562542720437 - nodes in this community are weakly interconnected._
- **Should `Terminologi Dasar` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0712962962962963 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._