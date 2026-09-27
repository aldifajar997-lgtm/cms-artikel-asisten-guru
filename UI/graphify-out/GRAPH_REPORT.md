# Graph Report - UI  (2026-09-27)

## Corpus Check
- 32 files · ~37,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 229 nodes · 394 edges · 12 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b913a43f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Terminologi Dasar
- App.tsx
- types.ts
- dependencies
- devDependencies
- compilerOptions
- ToastContext.tsx
- package.json
- ProductEditor.tsx
- update.cjs

## God Nodes (most connected - your core abstractions)
1. `handleApiError()` - 17 edges
2. `compilerOptions` - 15 edges
3. `useToast()` - 13 edges
4. `UserProfile` - 12 edges
5. `useConfirm()` - 11 edges
6. `api` - 11 edges
7. `Category` - 10 edges
8. `generateSlug()` - 8 edges
9. `Terminologi Dasar` - 8 edges
10. `Terminologi Teknis SEO & Indexing` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ArticleEditorProps` --references--> `Category`  [EXTRACTED]
  src/components/ArticleEditor.tsx → src/types.ts
- `ArticleEditor()` --calls--> `useToast()`  [EXTRACTED]
  src/components/ArticleEditor.tsx → src/context/ToastContext.tsx
- `ArticleEditor()` --calls--> `generateSlug()`  [EXTRACTED]
  src/components/ArticleEditor.tsx → src/utils/seoAnalyzer.ts
- `ArticleListProps` --references--> `Category`  [EXTRACTED]
  src/components/ArticleList.tsx → src/types.ts
- `CategorySettingsProps` --references--> `Category`  [EXTRACTED]
  src/components/CategorySettings.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Terminologi Dasar"
Cohesion: 0.05
Nodes (38): 10. SERP (Search Engine Results Page), 11. Crawling (Perayapan), 12. Indexing (Pengindeksan), 13. Sitemap (Peta Situs), 14. Robots.txt, 15. Canonical URL (Canonical Tag), 16. Structured Data / Schema Markup, 17. Internal Link (+30 more)

### Community 1 - "App.tsx"
Cohesion: 0.15
Nodes (25): App(), CategorySettings(), ForgotPassword(), ForgotPasswordProps, Glosarium(), Login(), LoginProps, ProductEditor() (+17 more)

### Community 2 - "types.ts"
Cohesion: 0.11
Nodes (26): ArticleEditor(), ArticleEditorProps, countOccurrences(), EDITOR_OPTIONS, excerptFallback(), ArticleList(), ArticleListProps, Dashboard() (+18 more)

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (29): axios, dotenv, express, @google/genai, lucide-react, motion, dependencies, axios (+21 more)

### Community 4 - "devDependencies"
Cohesion: 0.08
Nodes (24): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, @tailwindcss/typography (+16 more)

### Community 5 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 6 - "ToastContext.tsx"
Cohesion: 0.14
Nodes (14): ConfirmDialog(), ConfirmDialogProps, toastConfig, ToastContainer(), ToastContainerProps, ConfirmContext, ConfirmContextType, ConfirmProvider() (+6 more)

### Community 7 - "package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, clean, dev, lint, preview (+2 more)

### Community 8 - "ProductEditor.tsx"
Cohesion: 0.29
Nodes (8): CategorySettingsProps, EDITOR_OPTIONS, ProductEditorProps, ProductList(), ProductListProps, Category, Product, ProductStatus

### Community 9 - "update.cjs"
Cohesion: 0.40
Nodes (4): alStr, appStr, fs, typesStr

## Knowledge Gaps
- **104 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+99 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `devDependencies`, `package.json`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _104 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Terminologi Dasar` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1465149359886202 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11363636363636363 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._