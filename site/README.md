# Tianjian Qin

A personal research website built from the free Magic UI Portfolio template. The site uses Next.js, React, TypeScript, Tailwind and trusted local MDX.

## Run

Use Node 24.19 and pnpm 11.19.

```sh
cd site
pnpm install
pnpm dev
```

For the production preview:

```sh
pnpm build
pnpm start
```

The six destinations are Home, Research, Publications, Software, Blog and Footprint. Home contains the identity, globe and timelines; `/about` redirects to Home. Blog collects six technical notes and four interactive explorations. Article documents live in `public/reading`, with server-rendered article bodies in `content/writing`. Simulations live in `public/explorations`, and their shared assets live in `public/notebook-assets`. These routes build and run entirely from the site directory.

## Content

Professional facts live in `src/content-data/portfolio.json`. Research prose lives in `content/research/`. The supplied September 2026 CV is served at `/Tianjian-Qin-CV.pdf`. Build preparation validates references and produces individual BibTeX downloads and an allowlist for browser components.

Photography samples have explicit labels and photographer credits. They do not contribute to personal travel totals. See [PHOTOGRAPHY.md](PHOTOGRAPHY.md) for the private import workflow.

Generated project illustrations are conceptual identifiers. They are not application screenshots or scientific results. Source pins, licences and asset credits are in [PROVENANCE.md](PROVENANCE.md).

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
# In another terminal:
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests use the static preview server at port 3000. `CHROMIUM_PATH` can select an installed Chromium executable. Screenshots and test reports are stored in `evidence/`.

## GitHub Pages

`pnpm build` produces a static website in `out/`. `pnpm start` serves that directory on port 3000 using Python 3. Images are served directly from the export; no Next.js server is required. `pnpm check:export` checks local links and asset paths.

The repository workflow `.github/workflows/pages.yml` validates and builds changes under `site/`. Pull requests run the checks; pushes to `main` also publish the artifact through GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source and retain **qtj.me** as the custom domain. The export includes `CNAME` and `.nojekyll`. DNS must continue pointing to GitHub Pages.

The build uses `SITE_ORIGIN=https://qtj.me` and `SITE_INDEXABLE=true`. Without `SITE_INDEXABLE=true`, robots rules disallow indexing. Blog and Footprint navigation entries are marked **Migrating** and have no navigation target. Their direct routes remain available for review with indexing disabled. Change their `migrating` fields in `src/content-data/portfolio.json` and remove the route-level noindex layouts when publishing those sections. Include their detail routes in `src/app/sitemap.ts` at that point.

`/NetForge/` is a separate project documentation site on the same domain. This workflow publishes only `site/out` and makes no changes to that project. Confirm that its URL remains reachable after deployment.

Set `NEXT_PUBLIC_SHOW_APPEARANCE=false` when building to hide the theme switcher. Generated output, browser screenshots and local caches are excluded from Git.
