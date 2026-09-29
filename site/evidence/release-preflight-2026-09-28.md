# ATLAS UI 0.2.0 release preflight

ATLAS UI 0.2.0 is experimental and accepts export contracts 1.0.0 through 1.5.0. One Health timeline, sampling and environmental panels require 1.5.0. Dataset review remains partial; inspected entries and panel evidence are not a claim of complete coverage.

## Dataset and producer

ATLAS source commit: [2fa39f0](https://github.com/EvoLandEco/ATLAS/commit/2fa39f0b31119e4764ed2d196fdd3d8b3efed2df). [CI](https://github.com/EvoLandEco/ATLAS/actions/runs/36465258945) passed on Python 3.11 and 3.13. Producer checks include 259 Python tests, 259 installed package tests, JavaScript, TypeScript, schema equality and replay. Extraction and review remain paused.

The staged export is `84af1f2142e037519b457c5e192d3cd2c06275b79922420cebf01288c7696b3f`, contract 1.5.0. It contains 332 documents, 2,098 report entries, 361 One Health observations, 64 relationships, 164 timing statements, 44 sampling statements and 223 context statements. The exported review view has 1,105 inspected entries and 993 unreviewed entries. Dated and undated statements remain distinct.

The immutable assets are available under [the release path](https://qtj-atlas.evolandeco-github-io.workers.dev/releases/84af1f2142e037519b457c5e192d3cd2c06275b79922420cebf01288c7696b3f/atlas-site.json). All three decompressed public readbacks passed length and SHA-256 verification.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| atlas-site.json | 181119902 | `1bcf70c76b4fa646eb9257bd12d182a8541fce85cb6a519cfdac9ca8b1b69684` |
| map.json | 10433460 | `029cf733fc0410bc470eea90ff0bafff98426c74d3c53e203f6a962cf36e882f` |
| metrics.json | 71919514 | `9d6717eda17521accaaff1b85f4c6a4f9983c9de69e0768b6c50ffccf9a0c2aa` |

## Deployment order

The deployed website's `3oox4hdfe71cg.js` chunk accepts only contracts 1.0.0, 1.1.0 and 1.2.0. The public pointer therefore stays on `0684e4d4a7d0d3fab5fcb5912a0f9dcea1eae59e101f95da74d70f1477380c92` until a compatible website is deployed.

1. Manually commit and push the website source, including the vendored selectors and feature files. Do not include private exports or `.cache` receipts.
2. Wait for GitHub Pages deployment and verify the deployed browser code accepts contract 1.5.0 and its pinned selector.
3. From `site/`, activate the exact authorized export:

```sh
pnpm atlas:sync --project /path/to/EpiWeekly \
  --correction /path/to/EpiWeekly/.local/release-check-20260928/correction-authorization.json
```

The command checks the authorization, source bytes, producer integrity and live predecessor before writing `current.json`. Adding `--stage-only` performs immutable uploads and readback checks without activating the release. The local staged receipt is `.cache/atlas-sync/staged-84af1f2142e037519b457c5e192d3cd2c06275b79922420cebf01288c7696b3f.json`.

4. Verify the public pointer, open One Health on the deployed website, and exercise its Network, Timeline, Sampling and Environment views. Keep the partial review state visible. Publication does not resume extraction or source review.

## Performance scope

The initial browser transfer consists of `atlas-site.json` and `map.json`: about 14.9 MB compressed, or 191.6 MB decoded. `metrics.json` is a separate download asset and is not fetched during page entry. Downloads remain checksum verified and immutable release responses permit browser caching.

The UI reuses selector output for equal report sets, including One Health's default view. Decoding, parsing and index construction run in separate tasks with cancellation checks between them. This follows [Chrome's guidance on splitting long tasks](https://web.dev/articles/optimize-long-tasks). A worker parsing experiment increased cold load time because its result had to be copied into the UI; it is not part of this release. Native `Response.json()` parsing also cost more time on this dataset.

The largest remaining loading constraint is the monolithic export. A future producer contract could separate small navigation and eligibility indexes from source quotations and measurement detail, with checksummed chunks fetched when a panel or report opens. That requires coordinated selector and export changes; the consumer must not omit evidence or infer eligibility from incomplete data.

Run `ATLAS_PROFILE_BASE_URL=http://localhost:3006 node scripts/profile-atlas-load.mjs /tmp/atlas-load.json` against a production preview to record three cold page loads, long tasks and tab switches. These are local lab measurements, not public-network Core Web Vitals or field INP.

### Matched local benchmark

Chromium, 1440 × 1000, reduced motion, three fresh pages per build. Both builds used the same 1.5.0 dataset and the same static asset routing. The baseline uses the identity-keyed selector cache and synchronous decode/parse sequence. The comparison preserves the same UI, evidence and visual content. [Raw measurements](loading-performance-2026-09-28.json) include each run and browser errors.

| Median | Baseline | Release candidate |
| --- | ---: | ---: |
| Data ready | 1488 ms | 1288 ms |
| Longest main-thread task | 537 ms | 325 ms |
| Sum of long-task time beyond 50 ms during the scripted run | 1195 ms | 821 ms |
| Open One Health | 209 ms | 129 ms |
| Return to Trends | 200 ms | 116 ms |
| Open Reports | 65 ms | 67 ms |
| Open Source coverage | 84 ms | 84 ms |

Tab timings include Playwright interaction and two animation frames. They are a lab comparison, not field INP. The longest task remains above 50 ms; the monolithic dataset still requires substantial parsing and indexing. Local transfer timings do not estimate mobile network loading.

## Validation

- 55 unit checks passed; two checks requiring a separate private checkpoint were skipped.
- 75 browser cases passed across the full run and focused corrections; six cases tied to a separate private 1.4 checkpoint were skipped. Tests cover mobile and workspace layouts, keyboard access, overlays, filtering, report navigation, older contracts, One Health analytical panels and reporting attention. Accessibility scans are included in the relevant browser cases.
- Regression selectors distinguish chart SVGs from heading icons and open report disclosures before querying lazy contents. Globe restoration records the orientation at selection time and inspects a visible globe, respecting off-screen animation suspension.
- Type checking, ESLint and static link/asset checks passed. The production preview omits analytics; automatic approval review declined the token-bearing build because its exposure had not been verified.
- Production smoke checks passed against the live 1.2 pointer and against the staged 1.5 manifest with public R2 assets. Both show UI version 0.2.0; One Health appears for 1.5. No browser errors were recorded. No local data origin is embedded in the production JavaScript.
