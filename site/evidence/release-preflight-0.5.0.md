# ATLAS UI 0.5.0 release checks

Release date: 7 October 2026. Status: Experimental.

## Scope

The UI presents daily reports, Outbreak watch, attributed source assessments, paired quotations and translations, and searchable source coverage. The briefing has aligned column fades, a report timeline and three initial watch cards on mobile, with a button to load more. UI metadata is independent of the website package and dataset versions.

The scientific release must use site contract `1.8.0`, metrics `0.4.0` and Browser transport `0.3.0`. The loader checks release identities and asset hashes before displaying data.

## Validation

- ESLint, TypeScript, the production build, static links and assets, and Worker checks pass.
- All 98 unit tests pass with the matching Browser and Intelligence fixtures. Without those fixtures, 95 pass and three are skipped.
- The seven browser cases selected by the GitHub Pages workflow pass in Chromium, Firefox and WebKit. One Firefox case required an isolated rerun after concurrent test runs collided over trace output.
- Thirteen focused Chromium cases pass across briefing navigation, report highlights, mobile loading, source logos, daily evidence, watch selection, undated evidence, network review, attributed assessment quotations and fullscreen layout. These include desktop and phone viewport sizes.
- The sealed daily bundle passes six browser cases across Chromium, Firefox and WebKit at phone and desktop widths. Card facts, source links, evidence highlights and reset controls match the supplied data. All six watch cards remain selected in a January 2027 replay.
- The production build renders the matching network review using the uploaded public Browser and network assets.
- About ATLAS displays `ATLAS UI v0.5.0` in the local preview. Browser viewport checks do not replace physical phone testing.
- Git whitespace checks pass. Generated exports, local data, browser traces and screenshots are excluded from the commit.

Local command output is in `.cache/atlas-ui-0.5.0-preflight/`, `.cache/atlas-publish-0.5.0/` and the daily bundle's `.cache/atlas-daily/` directory.

## Release data

The publication targets are:

- Scientific export `2a905e3c3d76885c62976eec23c573d83eccc178d2b47adc4ae47da1016b2426`, with 345 documents and 2,189 records. Its 519 base files and matching network, Intelligence, supplement and presentation attachments pass public hash verification. The [complete release descriptor](https://qtj-atlas.evolandeco-github-io.workers.dev/releases/2a905e3c3d76885c62976eec23c573d83eccc178d2b47adc4ae47da1016b2426/release.json) records their identities.
- Daily bundle `33698e21048ca6508dfe787739d97143e4dfa1fa3bb94c190dfe436679693a36`, bound to that scientific export. It contains 37 documents, 208 findings and six watch cards, using daily contract `0.2.1` and watch method `daily-watch-1.0.2`.

All daily documents retain **Weekly review pending**. WHO editions 597 and 598 have reviewed PDF evidence; other source access gaps remain recorded in the producer's audit. Scientific candidates with different export IDs require their own consumer checks and matching attachments.

## Deployment

The user authorized dataset publication and the UI push on 7 October 2026. The publication run verifies immutable public assets before coordinating the scientific and daily pointers with GitHub Pages deployment. The data Worker supports the daily, supplement and presentation paths and preserves the existing request limits.

Pushing `main` triggers the Pages build, browser checks and deployment. Confirm UI 0.5.0, both dataset identities, the six watch cards and source navigation on the deployed site. Runtime publication and deployment receipts are saved in `.cache/atlas-publish-0.5.0/`.
