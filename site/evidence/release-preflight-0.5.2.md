# ATLAS UI 0.5.2 release checks

Release date: 8 October 2026. Status: Experimental.

## Scope

Latest reports includes the documents featured in Outbreak watch. Reports combines weekly and daily publications in timestamp order, preserves evidence navigation across pages, and displays the latest capture date beside the planned weekly review. Daily dates follow Europe/Amsterdam; weekly dates retain UTC. Fullscreen source choices stay within the viewport.

Daily publication verifies the matching browser core, weekly document and source references, and timestamp order. Scientific staging permits attachment preparation; activation requires the complete release. The README and contract documentation describe these workflows and the supported contracts: site `1.8.0`, metrics `0.4.0`, Browser transport `0.3.0`, daily `0.2.1` and watch method `daily-watch-1.0.2`.

## Validation

- All 102 unit tests pass with the matching Browser and Intelligence fixtures.
- ESLint, TypeScript, production build, static export links and assets, and Worker checks pass.
- The Chromium UI audit covers reporting controls, chronology, evidence navigation, briefing layout, globe interactions, One Health, source coverage, themes and accessibility. All failing cases pass after the product fixes and test corrections.
- Daily reports, report navigation, briefing and controls pass in Firefox and WebKit. All 12 reporting control cases pass across Chromium, Firefox and WebKit.
- The current sealed daily and presentation candidates pass four Chromium cases at phone and desktop widths. Other candidate-specific suites without their required inputs are skipped.
- Read-only preparation of daily bundle `3171a303cc7ce5fda7134e2adca4f221dffa49aacea9c6f2fce6bd5692b4ac2e` passes the strengthened publisher checks for 38 reports, 217 findings and six watch cards.
- The browser preview displays the 8 October report first and opens its matching Reports entry.

Local check output is retained in `.cache/atlas-report-dates-review/`. Browser viewport checks do not replace physical phone testing.

## Deployment

The UI release publishes through the GitHub Pages workflow on `main`. Scientific and daily datasets retain their independent serving pointers. Deployment verification checks the public UI version, newest report navigation and the `/NetForge/` route.
