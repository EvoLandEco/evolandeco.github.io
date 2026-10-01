# ATLAS UI 0.3.0 release checks

ATLAS UI 0.3.0 is experimental. The main `/atlas/` page includes Trends, Analysis, One Health, Reports and Geographic links. Reports contains chronology, assessments and source coverage. Analysis defaults to the producer's median ensemble. Tab choices persist within the explorer, and About dialogs share one presentation.

## Published dataset

The public release is `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`, captured on 28 September 2026. Its [immutable descriptor](https://qtj-atlas.evolandeco-github-io.workers.dev/releases/e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48/release.json) includes both matching analyses:

- Network: `a124d9cfe7b37ca200bb0c3287057dadd72f254ce42923c2ff62fc18c264571a`.
- Intelligence: `565479b0942b0cf58b61b0ef31888a518174421174f172bfeec31fa49cdcd29b`.

The dataset contains 332 documents, 2,098 report entries, 1,278 One Health observations, 131 relationships, 1,944 timing annotations, 559 sampling assessments and 2,291 context annotations. The enrichment checkpoint includes 704 of its 1,088 scoped entries. Partial and unresolved review states remain explicit. This publication does not certify complete surveillance coverage or resume the producer's paused jobs.

ATLAS verified source integrity and exact analysis replay. The five forecast series, 259 ensemble backtests, ten ensemble last-origin predictions and 184 network scopes retain their supplied results. Predictions remain retrospective demonstrations; network statistics do not establish population vulnerability or unbiased incidence.

Publication used the content-bound authorization with SHA-256 `29e41cfdfef7d48b7ee5250ed7aa4d7d7047f797098e300d08d4dcbde134d07c`. The publisher staged the base and both analyses, verified public bytes, checked the predecessor and activated the complete descriptor under the writer lock. The replaced release remains available. The data Worker accepts only the declared immutable JSON and selector paths; the browser executes its vendored selector.

## Validation

- 62 unit tests passed. Two tests for separate historical 1.4 checkpoints were skipped; the 1.5 release passed producer validation and direct consumer checks.
- 15 Analysis and One Health browser cases passed against the built `/atlas/` page and the exact staged public assets. Coverage includes desktop and phone layouts, tab memory, every ensemble series and horizon, empty selections, keyboard access, sticky controls, About dialogs and accessibility scans.
- Five GitHub Pages browser smoke cases passed against the compatibility fixture.
- Four WebKit cases passed: phone layout, source flag placement in both themes, and the full phone Analysis integration against the release candidate. These tests do not replace a physical iPhone Safari check.
- Five globe checks passed across Chromium and WebKit, covering travel arrival, hover, reduced motion and hidden-document suspension. The promoted main page also passed a complete navigation check against the activated public pointer. The release run contains 30 passed browser checks in total.
- ESLint, TypeScript, production build, static links, asset paths, Worker checks and Wrangler dry run passed.
- The public activation readback matches the staged descriptor. Every uploaded asset passed byte-length and SHA-256 checks.

The publication path binds Analysis to its base export, site checksum and selector checksum. Invalid or absent Analysis files have an explicit unavailable state. Base evidence remains accessible. Production `/atlas/experimental/` returns a 404; `/atlas/` serves the promoted interface.

## Loading scope

The source bundle is 295.3 MB decoded, with a 15.5 MB map and a 2.4 MB Intelligence export. Gzip reduces transfer size, but parsing and indexing still require substantial memory. The release checks cover the full candidate on desktop Chromium and phone-width WebKit without simulated bandwidth or CPU restrictions. Physical-device loading time and low-memory behavior remain unmeasured.

The [rendering measurements](release-performance-2026-10-01.json) record three 3-second samples per state. Median main-thread task time was 2,881 ms during ATLAS rotation, 876 ms with the stationary workspace globe, 1.6 ms with reduced motion and 15.3 ms offscreen. Reduced-motion and offscreen samples had zero globe draws and zero SVG attribute writes. The visible globe's 105 moving travel beams remain a substantial rendering cost. These instrumented local measurements are not total CPU or GPU utilization, and the release does not claim to resolve that cost.

## Manual website push

The dataset and data Worker are published. Website source is uncommitted and unpushed. The UI version is independent of the website package version and dataset contract.

Review `git diff` and `git status --short`, include the ATLAS source, tests, publication script and release notes under `site/`, then commit and push `main`. The GitHub Pages workflow validates and builds the website. Private exports, `.cache`, generated output and browser screenshots stay outside Git.

After Pages deployment, open `/atlas/`, verify UI 0.3.0 in About ATLAS, and check Analysis model selection plus One Health navigation. No additional dataset upload is required for this release.
