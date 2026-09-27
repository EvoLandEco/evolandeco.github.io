# Release audit · 27 September 2026

The ATLAS website passes the checks below. Release approval still needs the dataset and device decisions listed under Release checks. Nothing was published or pushed during this audit.

## Findings and repairs

- **Dark theme hydration:** globe beam SVG attributes depended on the client theme before hydration. Theme colours use CSS variables so server and browser markup agree. Home and ATLAS have console regression checks.
- **Full-screen hint:** the globe could alternate between two hover scales as nodes moved under the pointer, and leaving the canvas for the hint could hide its button. The globe uses a single hover scale, with pointer handoff to the hint. Mouse entry, keyboard entry, exit, dragging, theme reveal, and reduced motion pass.
- **Repeated formatting:** date and metric labels share their locale formatters. In five local runs of 2,000 date labels, median time was 61.72 ms with per-call formatters and 0.92 ms with a shared formatter. This measures formatting only.
- **Repeated DOM writes:** globe animation writes node visibility and occlusion attributes only when they change. React owns the accessible labels.
- **Regression coverage:** assertions follow the Rules menu, visible observation entries, grouped routes, compact mobile navigation, and globe filtering. Map resize checks wait for the animated view box to settle. Crowded nodes are also checked through keyboard activation.
- **Deployment gate:** the Pages workflow includes Chromium checks for ATLAS entry, accessible layouts, download recovery, and multi-selection filters. Playwright starts and owns the static server in CI.

## Verification

| Check | Result |
| --- | --- |
| Unit tests | 44 passed |
| Production Chromium scenarios | 71 passed across the full run and targeted reruns |
| Candidate 1.2 Chromium scenarios | 17 passed |
| Firefox scenarios | 6 passed |
| WebKit scenarios | 6 passed |
| ESLint and TypeScript | Passed |
| Production webpack build | Passed with release origin and indexing enabled |
| Export links and assets | All local references resolve |
| R2 worker checks | Paths, compression, CORS, conditional reads, methods and rate limiting passed |
| Production dependency audit | No reported vulnerabilities across 505 dependencies |
| Git whitespace check | Passed |

The final broad Chromium run passed 67 cases. Three assertions needed alignment with the current globe interaction and display, and one run lost its trace files because two runners shared an output directory. All four passed in targeted reruns, with separate output directories for the final rerun. No functional test failure remains from this audit.

Coverage includes both themes, narrow and wide viewports, accessible names and contrast checks, filters, date ranges, pagination, evidence jumps, conflicts, source coverage, galleries, document links, theme persistence, no-JavaScript core content, motion preferences, offscreen rendering, full-screen layout, overlays, and journeys.

## Performance

The [measurement record](release-audit-2026-09-27.json) contains raw samples and the published release manifest. The globe profiler accepts `ATLAS_PROFILE_BASE_URL`, has bounded waits, and closes its browser on failure.

At 1280 × 1000 in local headless Chromium, the animated ATLAS globe consumed 3,280 ms of renderer task time per four-second sample; JavaScript accounted for 376 ms. Offscreen, task time fell to 121 ms and JavaScript to 0.26 ms. Home measured 797 ms visible and 12 ms offscreen. These are local renderer measurements, not user-device frame rates or Core Web Vitals.

The globe remains the main rendering cost. The baseline and final visible results do not establish a rendering speedup. A controlled test without the extra travel glow filter showed too little improvement to justify changing the visual. The beam and event effects are retained.

Cloudflare serves the 24.14 MB source bundle as 2.73 MB gzip with immutable caching. The map adds 3.90 MB before compression. Release assets stay external to the site export and are verified by checksum before use.

## Release checks

1. **Choose the data release.** Cloudflare publishes contract 1.1.0, export `46fe3069739fdeb868f06272247c6f2263986984c8b9a0360c4d682938b56048`, dated 27 September 2026. The localhost preview uses the validated 1.2 journeys candidate. Both paths were exercised; the candidate needs publication if journeys are part of the formal launch.
2. **Check representative phones.** Mobile layouts and WebKit interactions pass in desktop browser automation. Rendering, thermal load, and cold loading on physical phones and slow networks remain unmeasured.
3. **Run the GitHub workflow.** Local build, export, unit, and browser checks pass. The amended hosted workflow has not been dispatched. The local production build used webpack; the workflow's default Next.js build remains a separate hosted check.
4. **Deploy and verify the public site.** Public deployment and a post-deployment smoke check were outside this audit. The existing localhost preview remains open.

## Reproduce

From `site/`, run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm atlas:worker:check`, and `pnpm audit --prod`. Build with the release origin and `SITE_INDEXABLE=true`, then run `pnpm check:export`. Serve `out/` on port 3000 before `pnpm exec playwright test atlas.spec.ts site.spec.ts`.

The candidate checks require `ATLAS_CHAINS_CANDIDATE` to point to the validated 1.2 export and a preview using that dataset. They cover `atlas-chains.spec.ts`, `atlas-controls.spec.ts`, `atlas-fullscreen.spec.ts`, `atlas-theme.spec.ts`, and `atlas-travel-beam.spec.ts`.
