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

Footprint photographs are organized by country and hosted in Cloudflare R2. See [PHOTOGRAPHY.md](PHOTOGRAPHY.md) for image preparation, publishing and hosting.

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

With the production preview running, `node scripts/profile-globe.mjs /tmp/globe-profile.json` measures Home and ATLAS during rotation, in workspace mode, with reduced motion and offscreen. It reports median main-thread, script, style and layout time across three three-second samples using [Chromium performance metrics](https://chromedevtools.github.io/devtools-protocol/tot/Performance/). Run it without concurrent browser tests. These local measurements do not represent total desktop-app CPU usage or GPU utilization.

## ATLAS export

### ATLAS UI releases

ATLAS UI is the experimental interface for visualizing ATLAS exports. Its release metadata lives in [`src/lib/atlas-ui.ts`](src/lib/atlas-ui.ts) and supplies the version and status badges in About ATLAS. UI versions are independent of the website package version, ATLAS export contract versions and dataset releases. Publishing a dataset alone does not increment the UI version.

Use `0.MINOR.PATCH` during experimental development:

- Increment PATCH for fixes, performance improvements and visual polish without a new capability, such as `0.1.0` → `0.1.1`.
- Increment MINOR and reset PATCH for new capabilities or breaking interface or export compatibility changes, such as `0.1.1` → `0.2.0`. Record any required export contract version with that release.
- Keep the status `Experimental` throughout `0.x`. Assign `1.0.0` and `Stable` only after an explicit stable release decision with documented compatibility and completed release checks. After `1.0.0`, use major versions for breaking changes, minor versions for compatible features and patches for fixes.

For each UI release, set the metadata, add a dated entry below describing its scope and supported export contracts, and run type, lint and relevant browser checks before publishing. Increment once per release, rather than for every edit.

**0.2.0 · Experimental · 28 September 2026** — One Health networks, evidence, timelines, sampling and environmental context; reporting attention; responsive workspace panels; loading and rendering improvements. Export contracts: `1.0.0` through `1.5.0`. One Health analytical panels require `1.5.0`. See [release checks and dataset activation](evidence/release-preflight-2026-09-28.md).

**0.1.0 · Experimental · 27 September 2026** — Interactive globe, evidence panels, reporting filters, observation plots and journey maps. Export contracts: `1.0.0`, `1.1.0` and `1.2.0`; reviewed journey maps require `1.2.0`. This entry identifies the local UI baseline and does not certify a production deployment.

### Dataset delivery

ATLAS data is hosted in the private Cloudflare R2 bucket `qtj-atlas` and served through its read-only Worker. The browser loads a checksum-verified release at runtime. The repository contains the frontend, trusted selector, types, validation and publication scripts; data bundles are excluded from Git. `pnpm atlas:sync --project /path/to/EpiWeekly` publishes only after ATLAS reports all three weekly jobs complete for the same Wednesday cycle. Publication within a supported contract requires no frontend build or Git push. A higher contract must wait for a compatible website deployment. Add `--stage-only` to upload and verify immutable assets without changing `current.json`. Cloudflare credentials stay in Wrangler's local OAuth configuration.

ATLAS's supplied selector applies evidence eligibility and compact figure selection to the interface's selected record set. Callouts display up to two contexts, retaining competing values. Reports expose the reviewed measurements in scope. Observation plots use the supplied series membership and show unconnected points.

Source comparisons use ATLAS assertion IDs, section labels, exact quotes and reviewed relationship kinds. Contradictions have separate open branches; scope differences and repeated reporting have distinct badges. Evidence actions use the report paginator. A relationship appears only when all supporting records are selected. The exported review state and scope remain available in each comparison.

The export responsibilities and geographic conventions are documented in [ATLAS_EXPORT_CONTRACT.md](ATLAS_EXPORT_CONTRACT.md).

## GitHub Pages

`pnpm build` produces a static website in `out/`. `pnpm start` serves that directory on port 3000 using Python 3. Images are served directly from the export; no Next.js server is required. `pnpm check:export` checks local links and asset paths.

The repository workflow `.github/workflows/pages.yml` validates and builds changes under `site/`. Pull requests run the checks; pushes to `main` also publish the artifact through GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source and retain **qtj.me** as the custom domain. The export includes `CNAME` and `.nojekyll`. DNS must continue pointing to GitHub Pages.

The build uses `SITE_ORIGIN=https://qtj.me` and `SITE_INDEXABLE=true`. Without `SITE_INDEXABLE=true`, robots rules disallow indexing. Blog and Footprint are public sections. The sitemap includes technical notes, interactive explorations, albums and individual photographs.

`/NetForge/` is a separate project documentation site on the same domain. This workflow publishes only `site/out` and makes no changes to that project. Confirm that its URL remains reachable after deployment.

Set `NEXT_PUBLIC_SHOW_APPEARANCE=false` when building to hide the theme switcher. Generated output, browser screenshots and local caches are excluded from Git.

## Visitor statistics

Cloudflare Web Analytics provides a private dashboard at https://dash.cloudflare.com/?to=/:account/web-analytics. In Web Analytics, add `qtj.me` and copy the public token from the site's JavaScript snippet. GitHub Pages remains the host; no DNS change is required.

The Pages workflow supplies the public qtj.me beacon token through `CLOUDFLARE_WEB_ANALYTICS_TOKEN`. It is included in the site's HTML and is not a Cloudflare API key. Push to main or run the Publish website to GitHub Pages workflow to deploy tracking.

The shared layout loads analytics once, with SPA navigation tracking enabled. The loader runs only on the configured `SITE_ORIGIN` hostname, so localhost and preview hosts do not send visits. Builds without the token do not load analytics. Use manual snippet installation in Cloudflare rather than also enabling automatic injection.

Open Web Analytics → qtj.me to see visits, page views, referrers and geographic breakdowns. Counts begin after deployment and may take a few minutes to appear. Browser blocking can prevent visits from being counted; these figures are not an exact count of distinct people.

Setup reference: https://developers.cloudflare.com/web-analytics/get-started/

### Private One Health preview

The local UI supports sealed site 1.3.0 and One Health 1.4.0 candidates as well as the public 1.2.0 release. The publication configuration remains pinned to 1.2.0. One Health interface work and candidate validation do not authorize publication.

Set `NEXT_PUBLIC_ATLAS_DATA_ORIGIN` to a loopback data service with the candidate release pointer and checksum-matched assets. Keep candidate bundles outside Git. Run `ATLAS_ONE_HEALTH_CANDIDATE=/path/to/candidate pnpm test` to include the actual-data checks; the candidate directory contains `structured/` and `snapshot.json`. Run `tests/atlas-one-health.spec.ts` against that private preview for evidence selection, filters, phone and workspace layouts, accessibility and public-release compatibility.

One Health includes Network, Evidence and Overview views under the shared reporting filters. The figure methods dialog contains literature references and interpretation limits. The [citation verification record](evidence/one-health-design-citations-2026-09-28.md) documents the papers and their relevance; the [producer boundary](ATLAS_EXPORT_CONTRACT.md#one-health-presentation-and-producer-workflow) identifies features that require a versioned ATLAS export.
