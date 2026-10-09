# ATLAS UI 0.6.1 release checks

Release date: 9 October 2026. Status: Experimental.

## Scope

Analysis contains signals, spatial links, report relationships and risk assessments. Shared cards retain animated expansion, source evidence and report navigation. Journeys provides event sequences, location references, event timing and evidence digests. One Health includes responsive network routing, readable observation lists and timeline layer switches. Report disclosures use muted, borderless controls. Compact selectors and circular source coverage controls fit narrow screens.

Supported contracts are site 1.8.0, metrics 0.4.0, Browser transport 0.3.0, daily 0.2.1 and 0.2.2, and watch method daily-watch-1.0.2.

## Validation

- All 140 unit tests pass across the default suite and the exact scientific export checks.
- ESLint, TypeScript, production build, static links and assets, and Worker checks pass.
- All seven Pages core browser cases pass. Source coverage meets text contrast requirements. The moving-globe interaction passes an isolated rerun after a concurrent run missed its surface click.
- The Pages report, briefing and card suite passes 21 checks. Two sealed-data cases are covered separately by the exact daily candidate suite.
- The exact daily candidate passes six Chromium and WebKit cases at phone, desktop and fullscreen sizes. Watch facts, source navigation, pagination, evidence highlights and accessibility are checked against its exported values.
- Focused checks cover card expansion and collapse, responsive selectors, source coverage, network routing, list spacing and timeline switches.

Local check output is retained in `.cache/release-0.6.1/`. Browser viewport checks do not replace physical phone testing.

## Dataset and publication order

The scientific base is `2a905e3c3d76885c62976eec23c573d83eccc178d2b47adc4ae47da1016b2426`.

The daily candidate is `a71a1198196fa93169d040f7376e5d0984d8c10fd8a228d46a2de70237da5781`, with a knowledge cutoff of 9 October 2026 at 04:23:16 UTC. It contains 47 dated reports, 297 findings and six watch cards. All 47 reports retain Weekly review pending; seven producer source coverage gaps remain recorded.

Publication requires deployment and verification of the compatible UI before daily activation. The publisher verifies candidate hashes and the exact scientific base, uploads immutable files, reads them back, and changes only the independent daily pointer. Runtime authorization and publication receipts remain outside Git. The Pages deployment must preserve the separate `/NetForge/` project route.
