# WHO final candidate interface review · 28 September 2026

Status: adopted for local compatibility and presentation review. Publication is held. This is an ad hoc research candidate, not weekly completion. No deployment, upload, push or public release pointer change is authorized.

## Candidate

- Export: `deb479877652f3260444d0a499c17bf4b3ab8cf1950b0bc7e1c0c8e5e46b5409`.
- Producer directory: `/Users/tianjian/Documents/ChatGPT/EpiWeekly/reports/who-workflow-2026-09-28/final`.
- Site contract 1.4.0; metrics 0.2.0; producer software 0.1.0a25.
- Manifest SHA-256: `46c66fd41bb58d4926b6af45f7e02e4be324cb686c451cf52f5120ccf3f8ac83`.
- Selector SHA-256: `5786eb97ab1eb242ddd805699498ad9d1ff588358274f9601c91ba9af286167b`, matching the trusted consumer copy.
- 332 documents, 2,098 entries, 13,083 measurements, 62 reviewed series, 567 series connections and 11 reviewed chains.
- 264 One Health observations and 60 relationships in total. Review coverage contains 61 complete scoped reviews, 54 partial reviews, 367 reviews without relevant observations and 1,616 unreviewed entries.
- Publication extent: 27 December 2025–25 September 2026. Capture cutoff: `2026-09-28T07:26:31.596353Z`.
- Preview: `http://localhost:3001/atlas/`, using a loopback data server on port 3004. Public hosting configuration remains separate.

The adoption receipt is `who-final-adoption-2026-09-28.json`. It records consumer adoption separately from the producer's delivery receipt. Private source bundles remain outside the website repository.

## Scientific and interface checks

Bundle files, manifest, selector and map hashes match the handoff. Consumer schemas, record references and source quotations validate. The historical capture cutoff excludes all 474 recovered entries and retains the 1,624 baseline entries.

Both global mpox series preserve eight cumulative reporting snapshots from December 2025 through July 2026. They are labelled cumulative. Removing the June report removes both adjacent connections and leaves July isolated. No incident differences or replacement connections are calculated. The 36 meningitis country series retain exactly 162 reviewed consecutive-week connections; every connected pair is seven days apart.

Laboratory measurements preserve 2,771 missing values and 998 explicit zeros. Negative One Health findings, source hypotheses, unknown observation dates and partial review coverage remain visible. Recent-travel destinations do not acquire inferred arrows: geographic figures use exported direction flags. The 731 source questions remain with the producer; this review accepts no outbreak merge or transmission decision.

Seven Chromium scenarios pass at 390 × 950, 1280 × 950 and 1280 × 720, covering both workspace and page layouts. Checks include eight-point cumulative plots, filtered connection gaps, laboratory report expansion, One Health keyboard interactions, infocards, source details, accessibility and horizontal overflow. Screenshots were inspected for the observation figure and compact One Health workspace. Production checks also cover globe node selection, geographic links, Source coverage navigation and the largest report's 813 measurement tiles.

## Loading and selector cost

Measurements use this Mac without CPU or network throttling. They are not physical phone or slow-network benchmarks.

| Measurement | Result |
| --- | --- |
| Structured JSON | 169.07 MB; 12.57 MB gzipped |
| Map JSON | 10.24 MB; 1.42 MB gzipped |
| Production navigation to ready, three fresh contexts | 1.12–1.31 seconds |
| JavaScript heap after ready | 204.1–204.5 MB |
| Longest initial main-thread task | 382–387 ms |
| Largest report opening, including automation | 157 ms for 813 tiles |
| Node JSON parsing | 319 ms |
| Trusted selector, median of 12 runs | 86.8 ms |
| Trusted selector, maximum of 12 runs | 108.8 ms |

Production loading uses direct loopback gzip responses. A profiling run with intercepted responses closed its browser before ATLAS became ready; that run is excluded. Browser interception materializes extra payload copies and is not used for these loading measurements.

The roughly 14 MB compressed transfer, 204 MB JavaScript heap and initial parsing pause warrant slower-device checks before release. No measurements or scientific detail were removed to reduce payload size. Firefox, WebKit, physical phones and throttled-network scenarios were not tested here.

TypeScript, targeted lint, consumer tests, production build, static export link checks and `git diff --check` pass. Run the candidate unit and browser checks with `ATLAS_WHO_FINAL` pointing to the candidate directory. One Health browser checks use `ATLAS_ONE_HEALTH_CANDIDATE` and the local preview.

## Rendering cost

Production Chromium at 1440 × 1000, device scale factor 2, dark theme: median browser main-thread time over three 3-second samples is 2,859.75 ms while rotating, 1,277.94 ms in workspace mode, 14.29 ms offscreen and 0.24 ms with reduced motion. These values are not total CPU or GPU utilization. The larger route set increases visible animation cost compared with the partial candidate. Offscreen views produce no WebGL draws or SVG attribute writes; workspace mode produces no globe WebGL draws while its SVG beams remain animated. The rotating sample retains about 30 fps. This check validates idle suspension, but does not establish a low-cost visible scene on slower hardware.
