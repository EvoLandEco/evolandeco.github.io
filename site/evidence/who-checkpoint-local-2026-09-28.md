# WHO checkpoint interface review · 28 September 2026

Status: private review of checkpoint `1026`, a partial processing run. Publication is held. No upload, deployment, push or public pointer change was performed.

## Candidate and adoption

- Export: `bae2fe60800e390cf785a3bc916c60a9df1641d5094a5211add45ed9d9427c64`.
- Producer directory: `/Users/tianjian/Documents/ChatGPT/EpiWeekly/reports/who-workflow-2026-09-28/checkpoint-1026`.
- Contracts: site 1.4.0 and metrics 0.2.0.
- Selector SHA-256: `5786eb97ab1eb242ddd805699498ad9d1ff588358274f9601c91ba9af286167b`, matching the trusted consumer copy.
- All five bundle file hashes and the map snapshot hash match `validation.json`; consumer schema, reference and quote validation passed.
- Private preview: `http://localhost:3001/atlas/`, with the candidate served only through loopback port 3004. Public hosting configuration targets contract 1.2.0.
- 1,794 report entries, 3,301 measurements, 101 One Health observations and 16 relationships. The checkpoint contains 170 of the 474 recovered entries awaiting processing.

## Scientific and interaction checks

The meningitis laboratory table retains 255 missing cells as `unknown` and 110 explicit zeros as `0`. Neither missing values nor undated measurements become plotted zero observations. The report retains all 456 laboratory measurements with their evidence.

Both reviewed global mpox series show April–July cumulative totals. Cases are 59,709; 61,061; 63,692; and 65,784. Deaths are 241; 244; 256; and 264. Removing the June report leaves the April–May connection and an isolated July point. No incident differences or replacement connections are calculated. A knowledge cutoff of `2026-09-28T00:00:00Z` excludes all 170 recovered entries and retains 1,624 entries.

Source hypotheses, negative findings, separate undated observations and review coverage remain visible. One Health coverage has 15 complete scoped reviews, 21 partial reviews, 142 reviews with no relevant observation and 1,616 unreviewed entries. It does not represent comprehensive detection.

The observation selector opens upward in the lower row of the two-panel workspace and downward in a single-panel workspace. This prevents the menu from extending behind the toolbar when filtering leaves no journeys, or when the viewport uses the short layout.

## Verification

- 50 unit tests passed, including checkpoint validation, missing-value presentation, cumulative connection eligibility and the historical capture cutoff.
- Seven Chromium scenarios passed: One Health at 390 and 1280 pixels, legacy and public 1.2 compatibility, and WHO figures at 390 × 950, 1280 × 950 and 1280 × 720.
- One Health checks include keyboard use, domain and date filters, source hypotheses, negative findings and axe accessibility checks.
- The three WHO scenarios verify real selector clicks, the isolated July point, cumulative labels and values, lab report expansion and absence of page overflow or JavaScript errors.
- TypeScript, targeted ESLint and `git diff --check` passed.
- Isolated production build and static export link checks passed. The build required execution outside the sandbox; the private preview remained available.

## Performance observations

These measurements come from the local development preview on this Mac, without CPU or network throttling. They are not production or physical phone benchmarks.

| Measurement | Result |
| --- | --- |
| Page navigation to ready | 1.90–2.04 seconds |
| Lab report opening, including browser automation | 520–524 ms |
| Tiles in that report | 466 |
| Structured JSON | 66.45 MB; 7.15 MB gzipped |
| Map JSON | 8.15 MB; 1.19 MB gzipped |
| Node JSON parsing | 129 ms |
| Trusted selector, median of 12 runs | 31.9 ms |
| Trusted selector, maximum of 12 runs | 41.3 ms |

The initial data transfer is about 8.34 MB gzipped. The large laboratory report and growing payload warrant physical phone and slower-network profiling before publication. No data was omitted or combined to reduce those costs. Firefox and WebKit checks for this checkpoint were not run.

Runnable checks use `ATLAS_WHO_CHECKPOINT` pointing to the candidate directory: `node --import tsx --test tests/atlas-who-checkpoint.test.ts` and the private preview Playwright configuration with `tests/atlas-who-checkpoint.spec.ts`.
