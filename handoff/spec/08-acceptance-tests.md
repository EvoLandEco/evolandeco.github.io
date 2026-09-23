# Acceptance tests and evidence

## Evidence rules

These are requirements for the implemented site. The handoff's local integrity check is a different test and does not establish that the site builds, runs or meets accessibility targets. The implementation report must give each test an outcome: passed, failed or not run, with its command and evidence path.

Use deterministic data and stable screenshot conditions. Do not conceal a render defect with repeated retries, broad screenshot tolerances or arbitrary sleeps. Wait on actual readiness conditions such as local asset loading, rendered nodes or completed transitions.

## Content and provenance

| ID | Test | Pass condition |
|---|---|---|
| C01 | Identity | Tianjian Qin, PhD; exact professional title; WUR postdoc and Groningen doctorate are distinct. |
| C02 | Publications | Eight peer-reviewed articles and two preprints; no duplicates or missing CV records. |
| C03 | Bibliography | Exact titles, DOI strings, author order, equal-contribution and joint-senior annotations. |
| C04 | Programmes | NextdAI in development; EUPAHW and SSS-mod ongoing; IMBIT completed in 2025. No fabricated funding award. |
| C05 | Contributions | Collaborator roles for treestats, DDD and DAISIE remain visible. |
| C06 | Software truth | No invented API, commands, releases, user counts, testimonials or successful execution output. |
| C07 | Dates | Overlapping doctoral/postdoctoral dates are preserved. No guessed month/day for year-only entries. |
| C08 | Assets | Every public image/icon/PDF has a local provenance record and resolves; no sample-person avatar. |
| C09 | Seed isolation | Internal evidence, handoff docs and unresolved asset notes are not exposed as public page content. |
| C10 | Research balance | EvoNN/EVE, NetForge and HerdLink are all visible from Home; evolutionary work is not relegated to an archive. |

## Routing and functionality

Direct-open and refresh every specified route. Test browser Back/Forward and deep links to sections. An unknown project slug returns the correct 404. The Dock identifies the active route and remains usable at each breakpoint. It has exactly six destinations in the specified order, including Photography. Nested country/photo routes keep Photography active. At narrow phone widths all six labels fit the three-column, two-row layout with unobscured content beneath it.

On Publications, test combined year/type/text filters, URL query state, reset and the no-results state. A direct visit to a filter URL gives the intended results. Every DOI anchor matches the data. Citation copy/download handles accents, name particles and annotations without malformed BibTeX. Copy controls show their actual outcome rather than assuming permission to access the clipboard.

The PDF link returns a PDF, not a 404 HTML page. Verify the three-page file title and visible contents. About provides a readable HTML CV independently of the PDF. Every outbound project and profile link uses the supplied destination; report an inaccessible external source instead of silently redirecting to an unrelated site.

Test the existing `/NetForge` resource in the intended production routing configuration before deployment. The personal project introduction at `/research/netforge` does not count as preserving the documentation.

## Signature components

| ID | Test | Pass condition |
|---|---|---|
| V01 | Globe sizing | Visible at 360 px width; no overlap, cropped controls or oversized backing canvas. |
| V02 | Globe pause | Orientation stays fixed after pause; resuming does not jump by elapsed hidden time. |
| V03 | Globe source controls | Pausing uses actual source control, not an ignored `config.onRender`. |
| V04 | Icon Cloud assets | All 15 CV-backed labels and local images are accounted for; image failure cannot leave a permanent pending loop. |
| V05 | Icon Cloud interaction | Pointer coordinates and rendered positions agree after CSS sizing, zoom and DPR changes. |
| V06 | Terminal sequence | Direct sequence items complete in order; “Show full output” works at each stage; no leftover interval on unmount. |
| V07 | Terminal truth | Transcript is a data-driven catalogue, not simulated command execution. |
| V08 | Beam geometry | Endpoints meet intended nodes after resize, font load and mobile orientation change. |
| V09 | Beam pause | Static connectors remain readable; `repeat=0` is not misrepresented as a stationary state. |
| V10 | Lifecycle | Repeated route visits do not accumulate observers, listeners, timers or renderer instances. |
| V11 | Meaning | The globe shows academic context and the beam conceptual relationships, not invented empirical data. |
| V12 | Dotted Map | Real SVG dots, correct public-country markers, neutral/blue theme and no SVG pulse elements. |
| V13 | Travel counts | Unique public confirmed countries only; independent of album filters, photo volume, repeated trips and missing marker coordinates. |
| V14 | Geographic links | Projected marker positions and labelled country links agree; no private/unconfirmed markers or dead album targets. |

A `data-motion-state` attribute is useful for diagnostics but is not proof of a stopped animation. Compare frames/orientation and inspect the actual animation controller. For COBE, distinguish a stationary camera from a destroyed renderer; do not fail a visible paused globe merely because its library still redraws the same frame. Offscreen/unmounted renderers must release their resources as specified.

## Accessibility

Aim for WCAG 2.2 AA. Automated checks are only part of the evidence. Use semantic landmarks, a skip link, one primary heading per route, logical heading order, meaningful link text and visible keyboard focus. Every action must work without a hover event. Test focus visibility around sticky navigation and at 200% zoom.

Use body-text contrast of at least 4.5:1 and suitable contrast for controls and focus indicators. Do not count a pale decorative border as an adequate control boundary. Hit areas should be at least 44 px where the design specifies them; do not confuse that design target with a claim about the exact minimum size of every WCAG criterion.

Test all routes in light and dark modes with keyboard navigation and an automated accessibility scanner. Manually check names, reading order, the Dock, publication controls, theme and motion controls, and any dialog. Focus must return to its trigger after a dialog closes. No dialog or mobile menu may trap the user after closing.

For continuous nonessential motion, provide a pause mechanism and respect reduced motion. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html). Do not rely on hover pause alone. Animated text must not produce character-by-character screen-reader announcements.

Disable JavaScript in a browser context and test Home, Research, Publications, Software, About and Photography. Names, biography, headings, research summaries, publication records, software links, contact and CV links must be visible, not merely present in transparent markup. Canvas visuals are not required in this state; their semantic content is. On Photography, verify the country list, travel summary, album cards and full-photo links. Country albums and full-photo pages must be usable without the lightbox or JavaScript.

## Visual regression matrix

Capture the Home, Research, Publications, Software, About and Photography pages in these representative configurations:

| Viewport | Theme | Motion | Purpose |
|---|---|---|---|
| 360 × 800 | Light and dark | Reduced | Narrow layout and readable long content |
| 390 × 844 | Light | Normal | Touch navigation and signature component interaction |
| 768 × 1024 | Light and dark | Reduced | Stacked/tablet composition |
| 1280 × 800 | Light | Normal | Desktop rail, Dock, animated composition |
| 1440 × 1000 | Light and dark | Reduced | Full visual hierarchy and stable snapshots |

Include at least one desktop and one narrow screenshot for every project detail page, a populated country album and the photo viewer. Test both the true empty photography seed and fixture content containing portrait/landscape/panorama images, a visited country without an album and many nearby markers. Inspect actual screenshots for overflow, card radii, inconsistent gaps, poor contrast, tiny metadata, awkward title wrapping, misplaced beam endpoints, empty renderer areas, oversized glyphs and Dock occlusion.

Tests should inspect `scrollWidth <= clientWidth` for the page at every viewport. Do not “fix” an overflowing component by hiding page overflow and clipping the content.

## Performance and resources

Record a production build's route bundles and lazy-loaded visual chunks. Confirm that offscreen Icon Cloud and Globe are not both eagerly executed on every route. Avoid duplicate animation packages, large server-rendering code in the browser for logo conversion, and unbounded high-DPR canvas allocations.

Record a reproducible lab test: production server, browser/version, machine or throttling profile, viewport, cache state and multiple runs. Treat Core Web Vitals thresholds as targets, not measured field results: LCP at most 2.5 seconds, CLS at most 0.1, and INP at most 200 ms when real interaction data are available. Assess field thresholds at the 75th percentile, separately for mobile and desktop. Lighthouse's score alone is not an INP field measurement. [Core Web Vitals reference](https://web.dev/articles/vitals).

The first meaningful view must not wait for WebGL, remote image CDNs, a typing sequence or a social API. Reserve visual dimensions to avoid layout shift. At most two continuously moving decorative panels should share a normal viewport; the chosen route placement should usually keep this lower without runtime performance guessing.

## Build and release

The configured lint, typecheck, production build, unit/component tests and browser tests must pass. Review the dependency/security report for the actual lockfile. Keep licences and attribution records. No secret or private data may be bundled into client assets.

Do not claim a production deployment from a local build result. Deliver a separate deployment checklist covering domain configuration, HTTPS, canonical URLs, `/NetForge` preservation, PDF download, image paths, redirects, 404s and rollback using the actual hosting setup.

## Reference browser test file

`reference/portfolio.acceptance.spec.ts` and `reference/photography.acceptance.spec.ts` supply starting assertions and test hooks. `reference/photography-model.test.mjs` supplies executable data-model tests. Integrate it after creating a Playwright setup and make the tests observe real UI state. Add the geometry, lifecycle, clipboard and screenshot checks described here; the reference file is not the entire acceptance suite.


## Photography acceptance matrix

| ID | Test | Pass condition |
|---|---|---|
| P01 | Truthful empty seed | Photography route and real map render; no claimed zero-country total or synthetic album cards. |
| P02 | Country identity | Duplicate codes/slugs and multiple albums for one country fail validation; repeated trips remain within one album. |
| P03 | Count semantics | Complete list uses “countries visited”; partial uses “countries documented”; unconfirmed has no numeric visit claim. Album and photo totals count only public approved content. |
| P04 | Publication boundary | Private/unconfirmed countries, draft albums and draft/unapproved photos are absent from HTML, JSON, routes, media, sitemap and bundles. |
| P05 | Album completeness | Published album has a valid published cover and at least one approved photograph; every photo belongs to exactly one country album. |
| P06 | Navigation | Country and photo URLs refresh directly; unknown/hidden slugs return 404; nested routes keep Photography selected. |
| P07 | Viewer | Keyboard open, Escape close, focus containment/return, adjacent controls and natural-aspect images; no autoplay or hover-only controls. |
| P08 | History | Opening, changing and closing the viewer preserve sensible browser history. Direct photo visits have a full page; modifier clicks keep normal link semantics. |
| P09 | Media pipeline | Orientation and colour are preserved in approved derivatives; GPS, camera serials, hidden metadata and originals are not published. Inspect resulting files rather than a configuration flag. |
| P10 | Responsive images | Intrinsic dimensions and sizes prevent shift; thumbnails do not download every full-size image; lazy loading respects natural reading order. |
| P11 | Map geometry | One marker per public confirmed country with reviewed coordinates; overlay coordinates are upstream-projected; no jitter or false location offsets. Missing coordinates do not reduce the country total. |
| P12 | Fixture isolation | Fixture records are marked synthetic, run only in a separate test build and are refused by the production-content validator. |
| P13 | Owner workflow | A documented local command ingests approved media, validates the manifest and generates public routes/assets reproducibly. |
| P14 | Six-link navigation | Full labels at 360 px and 200% zoom; controls are not overlapped by the two-row bar or browser safe area. |
