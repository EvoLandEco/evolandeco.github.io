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

## ATLAS

### ATLAS UI releases

ATLAS UI is the experimental interface for visualizing ATLAS exports. Its release metadata lives in [`src/lib/atlas-ui.ts`](src/lib/atlas-ui.ts) and supplies the version and status badges in About ATLAS. UI versions are independent of the website package version, ATLAS export contract versions and dataset releases. Publishing a dataset alone does not increment the UI version.

Use `0.MINOR.PATCH` during experimental development:

- Increment PATCH for fixes, performance improvements and visual polish without a new capability, such as `0.1.0` → `0.1.1`.
- Increment MINOR and reset PATCH for new capabilities or breaking interface or export compatibility changes, such as `0.1.1` → `0.2.0`. Record any required export contract version with that release.
- Keep the status `Experimental` throughout `0.x`. Assign `1.0.0` and `Stable` only after an explicit stable release decision with documented compatibility and completed release checks. After `1.0.0`, use major versions for breaking changes, minor versions for compatible features and patches for fixes.

For each UI release, set the metadata, add a dated entry below describing its scope and supported export contracts, and run type, lint and relevant browser checks before publishing. Increment once per release, rather than for every edit.

**0.6.1 · Experimental · 9 October 2026** — Analysis groups signals, spatial links, report relationships and risk assessments with shared selectors, filters and expandable cards. Journeys includes event sequences and evidence digests. One Health has refined network routing, timeline layer switches and responsive observation lists. Report disclosures use a quieter style; narrow layouts retain compact controls. Supports site contract `1.8.0`, metrics `0.4.0`, Browser transport `0.3.0`, daily contracts `0.2.1` and `0.2.2`, and watch method `daily-watch-1.0.2`.

**0.5.3 · Experimental · 8 October 2026** — Searchable Journeys, Models and Signals series selectors share One Health menu styling, keyboard controls and structured choices. Requires site contract `1.8.0`, metrics `0.4.0`, Browser transport `0.3.0` and daily contract `0.2.1`.

**0.5.2 · Experimental · 8 October 2026** — Complete Latest reports chronology, daily capture dates, Next review labels, report navigation across pages and compact fullscreen source controls. Publication checks validate daily references and timestamp order; scientific staging supports attachment preparation. Requires site contract `1.8.0`, metrics `0.4.0`, Browser transport `0.3.0` and daily contract `0.2.1`. See [release checks](evidence/release-preflight-0.5.2.md).

**0.5.0 · Experimental · 7 October 2026** — Daily report chronology and Outbreak watch, source risk assessments, source quotations and translations, searchable source coverage, and responsive briefing columns. Requires site contract `1.8.0`, metrics `0.4.0` and Browser transport `0.3.0`. See [release checks and push preparation](evidence/release-preflight-0.5.0.md).

**0.4.2 · Experimental · 2 October 2026** — Compact data loading with on-demand evidence, GPU globe markers and routes, free globe rotation with tilt reset in fullscreen, and a brief centered drag hint. Export contracts: `1.0.0` through `1.5.0`; compact loading uses Browser transport `0.1.0`. See [release checks and manual push](evidence/release-preflight-0.4.2.md).

**0.3.1 · Experimental · 1 October 2026** — Searchable Place and Disease filters with multiple selections, report entry counts, shared evidence selection and compact rules. Export contracts: `1.0.0` through `1.5.0`; separate Place and Disease controls require the reviewed disease fields in `1.3.0` or later. See [release checks and manual push](evidence/release-filters-0.3.1.md).

**0.3.0 · Experimental · 1 October 2026** — Analysis signals and model evaluation with a median ensemble; Reports with chronology, assessments and source coverage; persistent tab choices; unified About dialogs; compact controls and empty-data fixes. Export contracts: `1.0.0` through `1.5.0`; analytical results require a checksum-verified Intelligence `0.2.0` export bound to the selected dataset. See [release checks and manual push](evidence/release-preflight-2026-10-01.md).

**0.2.0 · Experimental · 28 September 2026** — One Health networks, evidence, timelines, sampling and environmental context; reporting attention; responsive workspace panels; loading and rendering improvements. Export contracts: `1.0.0` through `1.5.0`. One Health analytical panels require `1.5.0`. See [release checks and dataset activation](evidence/release-preflight-2026-09-28.md).

**0.1.0 · Experimental · 27 September 2026** — Interactive globe, evidence panels, reporting filters, observation plots and journey maps. Export contracts: `1.0.0`, `1.1.0` and `1.2.0`; reviewed journey maps require `1.2.0`. This entry identifies the local UI baseline and does not certify a production deployment.

### Dataset delivery

ATLAS data is hosted in the private Cloudflare R2 bucket `qtj-atlas` and served through its read-only Worker. The browser loads checksum-verified releases at runtime. The repository contains the frontend, trusted selectors, types, validation and publication scripts; data bundles are excluded from Git. The UI requires site contract `1.8.0`, metrics `0.4.0` and Browser transport `0.3.0`. Daily reports accept contracts `0.2.1` and `0.2.2` with watch method `daily-watch-1.0.2`.

Scientific and daily publication use separate pointers. `pnpm atlas:sync --project /path/to/EpiWeekly --stage-only` requires all three weekly jobs to be complete for the same Wednesday cycle, then uploads and verifies the reviewed scientific base without changing `current.json`. Staging can precede attachment delivery; activation requires the complete release and its matching presentation attachments. Public handoffs exclude source supplements and collections. Complete an authorized correction through the [full publication procedure](ATLAS_EXPORT_CONTRACT.md#analysis-delivery), using the same content-bound authorization for base staging and the final publisher. Publication within the supported contracts needs no frontend build or Git push; a different contract needs a compatible website deployment. Cloudflare credentials stay in Wrangler's local OAuth configuration.

ATLAS's supplied selector applies evidence eligibility and compact figure selection to the interface's selected record set. Callouts display up to two contexts, retaining competing values. Reports expose the reviewed measurements in scope. Observation plots use the supplied series membership and show unconnected points.

Source comparisons use ATLAS assertion IDs, section labels, exact quotes and reviewed relationship kinds. Contradictions have separate open branches; scope differences and repeated reporting have distinct badges. Evidence actions use the report paginator. A relationship appears only when all supporting records are selected. The exported review state and scope remain available in each comparison.

The export responsibilities and geographic conventions are documented in [ATLAS_EXPORT_CONTRACT.md](ATLAS_EXPORT_CONTRACT.md).

### Daily reports and Outbreak watch

The producer's daily heartbeat runs at 06:00 Europe/Amsterdam. It collects and reviews source reports, prepares the daily export and owns publication under the recorded standing approval. The website chat validates the sealed candidate and checks the live interface. The producer invokes the website's `scripts/publish-atlas-daily.ts` after those consumer checks pass; daily work does not run scientific integration or change the weekly scientific pointer.

From `site/`, validate and retain a candidate locally with:

```sh
pnpm atlas:daily \
  --directory /path/to/sealed-daily-release \
  --release /path/to/public-scientific-pointer.json \
  --browser-manifest /path/to/browser/manifest.json
```

This command verifies the producer manifest, schema, selector, evidence bindings and validation receipt, then saves `.cache/atlas-daily/<daily_id>/`. The browser manifest must sit in its complete transport directory so the publisher can verify and decode its named core asset and check weekly document and source/channel references. The daily payload must match the exact scientific export, site, map and manifest. The command does not upload or activate data. The [daily publication procedure](ATLAS_EXPORT_CONTRACT.md#daily-source-reports) specifies the content-bound authorization, upload and activation checks.

Daily reports enter Trends and the shared Reports chronology. Outbreak watch displays producer selections and links to their supporting reports. A review deadline does not hide a card; the producer must replace or retire it through review. Daily reports retain “Weekly review pending” until their exact review versions have a validated reconciliation with the loaded weekly export. Scientific counts and analysis remain separate from daily findings.

Run `pnpm exec playwright test tests/atlas-daily.spec.ts tests/atlas-daily-navigation.spec.ts tests/atlas-briefing.spec.ts tests/atlas-connection-cards.spec.ts` against a local preview for daily reports, shared report navigation, briefing layout and expandable evidence cards. The Pages workflow runs these checks with the pinned browser fixture; exact candidate checks remain a separate local validation step. For the sealed candidate checks, supply `ATLAS_DAILY_PREVIEW` as the matching preview URL and `ATLAS_DAILY_FILE` as its validated `daily.json`. Record the exact file hashes and consumer results with the candidate. After publication, verify the public daily pointer and payload, phone and desktop report navigation, and the unchanged scientific pointer.

Reports require a source-supported publication date, including when selected by capture date. Reports, watch selections and counts exclude undated publications. Notification, sampling and observation dates retain their own meanings and cannot supply a report publication date. Public handoffs exclude source supplements and collections; private evidence and sealed compatibility readers remain available. Run `pnpm exec playwright test tests/atlas-undated.spec.ts` to check that these sources stay outside the public interface.

### Private One Health preview

One Health uses site contract `1.8.0`, metrics `0.4.0` and Browser transport `0.3.0`, matching the main ATLAS interface. Candidate validation and public publication are separate decisions.

Set `NEXT_PUBLIC_ATLAS_DATA_ORIGIN` to a loopback data service with the candidate release pointer and checksum-matched assets. Keep candidate bundles outside Git. Run `ATLAS_ONE_HEALTH_CANDIDATE=/path/to/candidate pnpm test` to include the actual-data checks; the candidate directory contains `structured/` and `snapshot.json`. Run `tests/atlas-one-health.spec.ts` against that private preview for evidence selection, filters, phone and workspace layouts, accessibility and public-release compatibility.

One Health includes Network, Evidence, Overview, Timeline and Sampling views under the shared reporting filters, with environmental and intervention layers in Timeline. About One Health contains literature references and interpretation limits. The [citation verification record](evidence/one-health-design-citations-2026-09-28.md) documents the papers and their relevance; the [producer boundary](ATLAS_EXPORT_CONTRACT.md#one-health-presentation-and-producer-workflow) identifies features that require a versioned ATLAS export.

### Analysis delivery and local preview

`ATLAS_INTELLIGENCE_PREVIEW=1 pnpm dev --port 3005` enables `/atlas/experimental/` in development. Production builds return a 404 for this route. The main ATLAS page contains Trends, Analysis, One Health, Reports and Journeys. Reports contains the report chronology, with source coverage beside the review dates. Analysis uses the One Health selector style for Signals & forecasts, Risk assessments, Spatial links and Report relationships. The spatial and relationship views contain expandable masonry cards, searchable entry selectors and local type filters with matching counts. Journeys contains Journeys & connections. One Health Timeline includes environment and intervention layers. The main page loads the Intelligence file named by the public release descriptor and verifies its size, SHA-256, schema, experiment identity, source release, bundle checksum and selector checksum. Results with a mismatched identity remain unavailable. The local preview can read a saved producer export for development. Set `ATLAS_INTELLIGENCE_FILE` to the absolute path of the producer’s `intelligence.json` and `ATLAS_INTELLIGENCE_SHA256` to its validated checksum before starting the server. The server verifies the checksum and the 0.2.0 contract before passing results to the interface. Data files stay outside the repository.

ATLAS owns the analysis and its versioned sidecar contract. Results must carry their source export, analysis scope, evidence links and method references. Forecast evaluation must distinguish retrospective observation-order hindcasts from forecasts issued with the information available at the historical origin. Unknown risk dimensions remain explicit; the interface does not convert missing evidence into risk scores.

The consumer schema in `src/lib/atlas-intelligence.ts` follows ATLAS’s `scripts/intelligence/contract.schema.json`. Analysis’s Risk assessments view presents all source assessments as evidence profile cards, with a searchable jump control and evidence details rendered near the viewport. Signals presents two figures together: the model prediction and the count checks. Count checks uses reported points, expected values and investigation thresholds without a connecting line. Both figures share adjacent Observations and Performance panels that stack on narrow screens. Model cards retain target counts, MAE, WIS, relative WIS and all three coverage levels, with hover previews and direct model selection. Labelled model controls form a borderless strip with the shared ATLAS menus. Model previews preserve chart and legend heights. Observations and Performance share a row height. The figures and evidence fit the available workspace; source evidence scrolls inside its pane. Performance hides its scrollbar and shows the shared scroll cue when more models extend below the visible area. Narrow screens retain scrolling through the stacked figures. Reported observation entries keep the same panel layout, with disabled model controls and explicit availability labels. Their source chart, reviewed connections and evidence remain interactive. Every exported count check and model score remains available. Reporting filters select series with supporting records in view; checks and scores retain the fixed study archive. Journeys contains Journeys & connections, with a reference map, linked event timing and an evidence explorer. Reported dates retain their date basis; undated events sit outside the time axis. The supporting reports action opens the distinct documents behind the selected chain. Analysis’s Spatial links and Report relationships use compact figures and counts for supporting reports, source claims and link history or later assessments. Expanded cards retain headings and actions around a scrolling evidence area, with sources and scope alongside it. Risks exposes full supporting statements and uncertainties in the same layout. Back and Escape restore the list and focus. Spatial links and Report relationships hide their scrollbars and use the circular One Health scroll cue; Reports chronology retains its own scrolling. Model evaluation defaults to the producer’s median ensemble of all three component models. ATLAS combines matching predictive quantiles with equal weights and scores the result on the same held-out targets. About Analysis cites Ray et al. (2023), section 2.6, and distinguishes the quantile combination from a fitted mixture of experts. Forecast charts preserve segment breaks, show the selected historical origin and prediction intervals, and retain all exported model comparisons and empirical coverage. Source assessments retain their population, date, authority and evidence quotations. Run `ATLAS_INTELLIGENCE_FILE=/path/to/intelligence.json pnpm test:e2e -- tests/atlas-intelligence.spec.ts` against a data-enabled local preview. The checks cover desktop and phone layouts, navigation between evidence views and accessibility.

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
