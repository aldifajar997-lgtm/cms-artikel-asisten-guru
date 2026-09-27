# Graph Report - CMS3  (2026-09-27)

## Corpus Check
- 87 files · ~69,889 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 326 nodes · 618 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend APIs and Middlewares
- Frontend Authentication and Settings UI
- Frontend Dashboard and Product UI
- UI DevDependencies and Scripts
- UI Dependencies
- Backend Dependencies
- UI TSConfig
- Backend TSConfig
- UI Toast and Confirm Dialogs
- UI Build Scripts
- Tests for TS Fixes
- Tests for Roles
- Tests for Delete Avatar

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
- `ArticleEditor()` --calls--> `useToast()`  [EXTRACTED]
  UI/src/components/ArticleEditor.tsx → UI/src/context/ToastContext.tsx
- `ArticleEditor()` --calls--> `generateSlug()`  [EXTRACTED]
  UI/src/components/ArticleEditor.tsx → UI/src/utils/seoAnalyzer.ts
- `CategorySettingsProps` --references--> `Category`  [EXTRACTED]
  UI/src/components/CategorySettings.tsx → UI/src/types.ts
- `NavigationProps` --references--> `UserProfile`  [EXTRACTED]
  UI/src/components/Navigation.tsx → UI/src/types.ts
- `ProductListProps` --references--> `Product`  [EXTRACTED]
  UI/src/components/ProductList.tsx → UI/src/types.ts

## Import Cycles
- None detected.

## Communities (20 total, 3 thin omitted)

### Community 0 - "Backend APIs and Middlewares"
Cohesion: 0.07
Nodes (52): app, AppContext, authMiddleware(), requirePermission(), errorHandler(), notFoundHandler(), rateLimit(), auth (+44 more)

### Community 1 - "Frontend Authentication and Settings UI"
Cohesion: 0.11
Nodes (31): App(), CategorySettings(), ForgotPassword(), ForgotPasswordProps, Glosarium(), Login(), LoginProps, EDITOR_OPTIONS (+23 more)

### Community 2 - "Frontend Dashboard and Product UI"
Cohesion: 0.09
Nodes (33): ArticleEditor(), ArticleEditorProps, countOccurrences(), EDITOR_OPTIONS, excerptFallback(), ArticleList(), ArticleListProps, CategorySettingsProps (+25 more)

### Community 3 - "UI DevDependencies and Scripts"
Cohesion: 0.06
Nodes (34): autoprefixer, esbuild, tailwindcss, @tailwindcss/typography, tsx, @types/express, @types/node, @types/react (+26 more)

### Community 4 - "UI Dependencies"
Cohesion: 0.07
Nodes (29): axios, dotenv, express, @google/genai, lucide-react, motion, react, react-dom (+21 more)

### Community 5 - "Backend Dependencies"
Cohesion: 0.07
Nodes (28): bcryptjs, @cloudflare/workers-types, hono, @hono/zod-validator, isomorphic-dompurify, dependencies, bcryptjs, hono (+20 more)

### Community 6 - "UI TSConfig"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 7 - "Backend TSConfig"
Cohesion: 0.15
Nodes (12): @cloudflare/workers-types, ESNext, compilerOptions, jsx, jsxImportSource, lib, module, moduleResolution (+4 more)

### Community 8 - "UI Toast and Confirm Dialogs"
Cohesion: 0.23
Nodes (9): toastConfig, ToastContainer(), ToastContainerProps, ConfirmProvider(), ToastContext, ToastContextType, ToastMessage, ToastProvider() (+1 more)

### Community 9 - "UI Build Scripts"
Cohesion: 0.40
Nodes (4): alStr, appStr, fs, typesStr

## Knowledge Gaps
- **114 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `UI Dependencies` to `UI DevDependencies and Scripts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend APIs and Middlewares` be split into smaller, more focused modules?**
  _Cohesion score 0.07279562542720437 - nodes in this community are weakly interconnected._
- **Should `Frontend Authentication and Settings UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1147086031452359 - nodes in this community are weakly interconnected._
- **Should `Frontend Dashboard and Product UI` be split into smaller, more focused modules?**
  _Cohesion score 0.09268292682926829 - nodes in this community are weakly interconnected._
- **Should `UI DevDependencies and Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `UI Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._