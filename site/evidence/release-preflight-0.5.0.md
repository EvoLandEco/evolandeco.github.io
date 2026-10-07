# ATLAS UI 0.5.0 release checks

Release date: 7 October 2026. Status: Experimental.

## Scope

The UI presents daily reports, Outbreak watch, attributed source assessments, paired quotations and translations, and searchable source coverage. The briefing has aligned column fades, a report timeline and three initial watch cards on mobile, with a button to load more. UI metadata is independent of the website package and dataset versions.

The scientific release must use site contract `1.8.0`, metrics `0.4.0` and Browser transport `0.3.0`. The loader checks release identities and asset hashes before displaying data.

## Validation

- ESLint, TypeScript, the production build, static links and assets, and Worker checks pass.
- All 98 unit tests pass with the matching Browser and Intelligence fixtures. Without those fixtures, 95 pass and three are skipped.
- The seven browser cases selected by the GitHub Pages workflow pass in Chromium, Firefox and WebKit. One Firefox case required an isolated rerun after concurrent test runs collided over trace output.
- Thirteen focused Chromium cases pass across briefing navigation, report highlights, mobile loading, source logos, daily evidence, watch selection, undated evidence, network review, attributed assessment quotations and fullscreen layout. These include desktop and phone viewport sizes. Two sealed daily preview cases were skipped because their fixture environment was not configured.
- About ATLAS displays `ATLAS UI v0.5.0` in the local preview. Browser viewport checks do not replace physical phone testing.
- Git whitespace checks pass. Generated exports, local data, browser traces and screenshots are excluded from the commit.

The focused checks use the local contract `1.8.0` candidate and synthetic fixtures. They do not establish compatibility with the public service's active dataset. Local command output is in `.cache/atlas-ui-0.5.0-preflight/`.

## Deployment prerequisite

The public service was checked on 7 October 2026:

- [The active release](https://qtj-atlas.evolandeco-github-io.workers.dev/current.json) points to export `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`, site contract `1.5.0` and Browser transport `0.1.0`.
- The validated local candidate is `2a905e3c3d76885c62976eec23c573d83eccc178d2b47adc4ae47da1016b2426`, site contract `1.8.0` and Browser transport `0.3.0`.
- The candidate's public `releases/<export_id>/release.json` endpoint returns HTTP 404.

**Hold the push until the compatible dataset is published and its activation is coordinated with the UI deployment.** Pushing `main` triggers GitHub Pages deployment. UI 0.5.0 rejects the active `1.5.0` release, so deploying it against that release would prevent data loading. Dataset publication and pointer activation require a separate authorized operation.

## Local preparation

The release is prepared on `main`. Remote `main` matched local base `24029ef381058c9355695068e4472f6ce0a08d5e` during the preflight. The local preview is at <http://127.0.0.1:3008/atlas/>. This preparation does not push, deploy, upload datasets or activate public pointers.

After the dataset prerequisite is satisfied, push the release commit and confirm the UI version, dataset loading, daily reports and evidence navigation on the deployed site.
