# ATLAS UI preflight · 27 September 2026

ATLAS UI 0.1.0 is experimental. The local release checks pass. Cloudflare serves contract 1.1.0; the journeys preview uses a separate contract 1.2 candidate. Publishing the UI does not publish that candidate.

## Verification

| Check | Result |
| --- | --- |
| Unit tests | 47 passed |
| Production Chromium suite | 75 passed |
| Candidate Chromium suite | 20 passed |
| Figure interaction regressions | 2 passed in each of Chromium, Firefox and WebKit |
| Focus and overlay checks | 4 passed in Chromium |
| Candidate production smoke checks | 2 passed, at 390 and 1280 px |
| Mobile loading and retry regression | Passed against the production export |
| ESLint and TypeScript | Passed |
| Default Next.js Turbopack production build | Passed |
| Static export | 445 pages; all local HTML links and assets resolve |
| Cloudflare worker checks | Passed |
| Production dependency audit | Zero reported vulnerabilities across 505 dependencies |
| Git whitespace check | Passed |

Focused runs overlap with the broad suites; these counts are not a total of distinct scenarios. The build used the release origin and indexing configuration in a separate directory. The live preview remains open.

## Repairs

- Figure highlights track pointer hover and keyboard focus independently. Scrolling the entries under a stationary pointer cannot erase a focused node or connection.
- Scope and About dialog launchers receive focus before opening. Closing a dialog returns focus to its button in WebKit as well as Chromium and Firefox.
- The loading view reserves viewport space. The site contact footer stays below the viewport while the dataset loads. Six production load samples recorded zero layout shift; the initial mobile measurement was 0.244.

## Release checks

- Include the untracked ATLAS components, routes, assets, scripts and tests in the manual commit. They are part of the build.
- Cloudflare publishes export `46fe3069739fdeb868f06272247c6f2263986984c8b9a0360c4d682938b56048`, contract 1.1.0, dated 27 September 2026. Journeys require a separate validated 1.2 dataset publication. Both data paths pass browser checks.
- Physical phone rendering, thermal load and slow network behavior remain unmeasured. The animated globe is the main rendering cost.
- The hosted GitHub workflow and a public post-deployment smoke test remain to be run. No commit, push, data publication or deployment was performed.

## Performance

Measurements use a local production static server and the published Cloudflare dataset in unthrottled headless Chromium. They describe this workstation, not field Core Web Vitals, a Lighthouse score or physical phone frame rates. The raw results and release manifest are in [the measurement record](preflight-2026-09-27.json).

| Viewport | Median ATLAS ready | Layout shift | Median longest task |
| --- | --- | --- | --- |
| 390 × 1000 | 1075 ms | 0.000 | 113 ms |
| 1280 × 1000 | 989 ms | 0.000 | 123 ms |

| Renderer, four-second samples | Median task time | Median JavaScript time |
| --- | --- | --- |
| Home visible | 673 ms | 84.83 ms |
| Home offscreen | 21 ms | 0.45 ms |
| ATLAS visible | 2974 ms | 382.90 ms |
| ATLAS offscreen | 298 ms | 0.75 ms |

The renderer numbers include browser rendering work as well as JavaScript. Offscreen JavaScript is close to idle. Visible ATLAS rendering still merits a check on representative phones; these measurements do not establish a frame-rate guarantee.
