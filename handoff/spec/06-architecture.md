# Architecture and integration

## Source base

Use [Magic UI Portfolio](https://github.com/magicuidesign/portfolio) as the base. Audited commit: `5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b`. The component audit uses library commit `d7207e5692d14c00dceafa8488d6d01f197fa0e4`.

The base's inspected package manifest uses Next.js 16.1.1, React 19.2, Tailwind 4.1, Motion 12, TypeScript 5.9 and content-collections with trusted local MDX. The README's version labels are not sufficient evidence for implementation. The recorded versions are a source snapshot, not an instruction to deploy old dependencies with known security problems. Inspect maintained compatible releases and security advisories, then commit a tested lockfile.

Use a supported Node runtime compatible with the chosen Next.js release. Next's documented baseline is newer than the template's loose Node 18 engine declaration. Use a maintained Node 22 or 24 release after checking exact compatibility; record the actual version and package manager. Do not leave runtime selection ambiguous in CI.

Sources: [base manifest](https://github.com/magicuidesign/portfolio/blob/5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b/package.json), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Magic UI installation](https://magicui.design/docs/installation).

## Repository integration

Inspect `src/app/page.tsx`, `src/app/layout.tsx`, `src/data/resume.tsx`, `src/components/section/`, existing navigation/theme components, `components.json`, `content-collections.ts`, the lockfile and configuration before editing. Some filenames beyond those directly audited may differ; use repository discovery rather than fabricating imports.

Keep the useful starter scaffolding, theme/provider structure, MDX build pipeline and card patterns. Recompose them for research content. Do not retain the template owner's projects, social links, hackathons, example blog posts, media or metadata. Do not rebuild an unrelated application and merely claim that it came from the Portfolio Template.

Place content in a central typed data layer, for example `src/content-data/portfolio.json` plus a validation module. The handoff remains outside the web-served directory. Copy only intended public assets to `public/`. Never copy the entire handoff into `public`.

Suggested local organisation: `components/site/` for shell and navigation, `components/research/` for content presentation, `components/visuals/` for the five signature integrations, `components/ui/` for installed registry components, `lib/` for validation/citations/metadata and `content/research/` for prose, `components/photography/` for albums and viewer, and a build-generated public photography manifest. Use clear ownership; avoid several components with the same name and uncertain source.

## Install only the selected components

Use the template's package manager and preserve one lockfile. The audited base contains a pnpm lockfile. Do not run a fresh project initializer over an already configured application.

The official namespaced installation pattern is:

```bash
pnpm dlx shadcn@latest add @magicui/globe
pnpm dlx shadcn@latest add @magicui/icon-cloud
pnpm dlx shadcn@latest add @magicui/terminal
pnpm dlx shadcn@latest add @magicui/animated-beam
pnpm dlx shadcn@latest add @magicui/dotted-map
```

These are registry installation instructions, not commands already executed for the eventual website. Record the CLI version actually used. Inspect the existing Dock, Blur Fade and other starter components before installing a same-named component that could overwrite them.

When the registry requires explicit configuration, merge `"@magicui": "https://magicui.design/r/{name}.json"` into the existing `registries` map. Preserve other entries such as the starter's `@svgl` configuration. The resulting files may be under `components/ui`, while the template contains files under `components/magicui`. Resolve imports from actual installation output. Do not use the documentation site's internal `@/registry/...` aliases.

Inspect registry CSS additions as well as TSX files. Some components require keyframes and theme variables. Do not paste Tailwind v3 configuration into a Tailwind v4 CSS setup. Use `motion/react` consistently with the selected source rather than installing two animation runtimes to satisfy inconsistent snippets.

The source catalogue includes more components than the site needs. The required support set is Dock, Bento Grid, Magic Card, Blur Fade, Grid Pattern and Scroll Progress. Safari is gated on a real screenshot. Standard buttons, links, separators, cards, accessible dialogs and form controls can use shadcn primitives. A command palette, external CMS and authentication are outside the initial scope.

## Client/server boundary

Use App Router server components for the shell, biography, project metadata, publication lists, programme entries, navigation links and article content. Small client components handle motion, theme controls, filters and interactive displays. Do not mark the entire layout or every page as a client component to silence import errors.

Browser-only renderers belong in client modules. Where `dynamic(..., { ssr: false })` is needed, place it within an appropriate client boundary; do not put that option in a server component. Reserve the renderer's space in CSS so lazy loading does not shift text. The content and ordinary links remain present independently of that renderer.

Use stable props and memoised configurations. Avoid nondeterministic server/client markup from random numbers, current time or browser dimensions. An illustrative random pattern must have a deterministic seed or be generated only in a deliberate client visual layer; never use it as scientific evidence.

Do not hide critical content with an animation component whose initial server markup is transparent. Test the actual zero-JavaScript page. A nominal server component can still render invisible content when wrapped by a client animation component.

## Content model and MDX

Use the data seed's stable IDs for projects, publications, programmes and software. Validate all fields and relations at build time. Maintain status as an explicit enum rather than inferring it from the venue string. Unknown values remain null or absent UI, not guessed placeholder strings. The data contract lists required checks.

Keep the existing content-collections approach for trusted local MDX. Add a project collection or an appropriate content type with a `projectId` relation. Do not expose arbitrary remotely supplied MDX to compilation or invent an admin interface. Generate research pages through static params from known slugs and return a real 404 otherwise.

The four project MDX files contain only prose and a stable ID. Titles, dates, status, related publications and links come from the central data layer. Notes/blog content remains unexposed until supplied, with sample author content removed from builds and feeds.

Generate citation exports and metadata from the same source. Use careful name handling for BibTeX rather than splitting strings at every space. Preserve full bibliographic names in HTML. If an export field cannot be derived safely, implement a deliberate validated representation without fabricating missing metadata.

## Photography data and asset boundary

Validate the owner’s copy of `data/photography.json` with [the reference model](../reference/photography-model.ts), then generate an allowlisted public manifest before the app build. Keep the authored manifest and original files outside the deployable application tree. App routes import only generated public content, never the raw manifest; server-only imports alone do not prevent private data entering server bundles. Country confirmation, privacy, album publication and image approval are different fields. Generate country and full-photo routes from the public projection; unpublished or private items must return 404 and must not appear in sitemap, metadata, search data, serialized props or client bundles.

Use `spec/10-photography.md` for the map, image import and lightbox contracts. Only published owner-approved images enter `public/photography/media/`; original files stay in a private input directory outside the tracked application. An unlinked file in `public/` is still public. Generate clean derivatives in a fresh staging directory and replace the managed media output only after validation succeeds. Reject missing files, unsafe paths, broken relations and unapproved media with actionable errors.

Prefer a server-rendered Dotted Map with pulse disabled and ordinary adjacent country links. If the installed renderer needs a client boundary, its verified HTML count and country list stay server-rendered. The map source uses `svg-dotted-map`; inspect and lock its resolved dependency. Do not import a heavy GIS package or send source image metadata to the browser.

Photo detail routes are the canonical navigation targets. A small client viewer may intercept unmodified same-tab photo-link activation within an album. Modified clicks and direct URLs retain ordinary route behaviour. Add accessible dialog handling and truthful browser Back/Forward behaviour rather than fake fragment routes.

## Theme and motion

Use one theme provider, normally the template's next-themes setup. System/light/dark is a theme preference; pause/system is a distinct motion preference. Do not let a fancy toggle mutate DOM classes behind a conflicting provider state. A conventional theme toggle is adequate unless the animated toggler passes the same compatibility and accessibility tests.

A site-level motion policy and local renderer lifecycle produce the intended behaviour. They are not a generic error-catching layer that substitutes unrelated visuals. Core content is a first-class HTML representation in every state.

## Assets, loading and external services

Serve icons, images and the CV locally. All images have dimensions or a reserved aspect ratio. Prefer SVG for simple illustrative art and compressed raster formats for authentic screenshots. Do not hotlink third-party logos or avatars and assume they will load forever.

Do not install an entire icon package or send it to the browser for 15 symbols. Extract the selected licensed assets at build time or use a small set of explicit imports. Keep local SVGs simple and inspect them before use.

No database, auth system, email backend, analytics SDK, chatbot, live GitHub counter or external CMS is needed. Contact is mailto. External links use normal anchors and appropriate security attributes when opening a new tab. Embeds load only when relevant and must be justified by supplied content.

## Metadata and discoverability

Set unique page titles, descriptions, canonical URLs and social metadata. Use `https://qtj.me` as the CV-backed intended site origin, but allow a single deployment configuration value rather than spreading the domain across the code. Preview deployments should not be indexed as competing canonical sites.

Provide a sitemap and robots configuration that include only public content. Use factual Person and, where useful, ScholarlyArticle JSON-LD derived from the seed. Photography can use ImageGallery and ImageObject metadata only for published, approved media, with exact creator and dimensions from the public image projection. Do not invent ratings, hiring status, citation counts, institutional endorsements or structured-data fields merely to improve SEO.

Keep headings, publication metadata, links and CV content indexable and selectable. Ensure a crawler or user without JavaScript can read the essential pages.

## Deployment and the existing domain

Build a normal Next.js application first. Do not assume that `qtj.me` currently uses Vercel, GitHub Pages or a particular reverse proxy. Choose a deployment adapter only after inspecting the actual hosting arrangement or receiving a clear instruction.

A static export is possible only if all chosen features and asset paths support it. Next.js documents limitations such as server-only capabilities and default image optimisation; validate the concrete configuration rather than toggling `output: "export"` and hoping. [Static export reference](https://nextjs.org/docs/app/guides/static-exports).

Inventory and preserve `https://qtj.me/NetForge` and its assets. The personal site's source should be kept separate from any existing project application or documentation bundle. Document a tested routing plan before publishing. No deployment, DNS change, repository overwrite or paid service signup is authorised by this handoff.

## Agent tooling

The official [Magic UI MCP documentation](https://magicui.design/docs/mcp) and [shadcn MCP documentation](https://ui.shadcn.com/docs/mcp) can assist discovery when the coding environment supports them. They are not prerequisites and do not replace reading the installed source. Do not invent a Codex-specific Magic UI installer or require API credentials for a free registry.

Keep the application-root AGENTS instructions short and use explicit linked reading paths. Codex's agent-instruction discovery does not mean that every file in a sibling handoff directory is read automatically. [Agent instruction reference](https://developers.openai.com/codex/guides/agents-md).
