# ATLAS UI 0.3.3 release checks

Release date: 1 October 2026. Status: Experimental.

## Scope

Globe surface clicks enter full screen without relying on hover state. Nodes, links and the globe surface share pointer capture and drag handling. Small pointer movements remain clicks; dragging suppresses selection and full screen entry. A visible Enter full screen button sits between the globe and network statistics on desktop layouts, sharing the Exit full screen button style. Dismissing a globe selection returns keyboard focus to the workspace control so Escape remains usable.

Globe gesture checks run in the GitHub Pages workflow. The UI release does not change dataset contents, scientific calculations, renderer geometry or animation cadence.

## Dataset

The public service serves contract 1.5.0 release `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`. Browser checks use that release, and the Intelligence unit checks use sidecar bytes verified against its published checksum.

## Validation

The UI 0.3.3 production export passes all seven browser cases selected by the GitHub Pages workflow.

- 63 unit tests passed; two historical dataset cases were skipped because their separate One Health and WHO fixtures were not supplied.
- Ten Chromium checks passed against the production export: the five Pages smoke cases, rim marker rotation, hidden document animation suspension, closed selector cleanup, and globe interactions with normal and reduced motion.
- Two WebKit globe interaction cases passed with normal and reduced motion.
- Four Chromium cases passed against the public dataset: desktop and phone reporting filters, and desktop and phone Analysis, One Health and Reports navigation with accessibility checks.
- ESLint, TypeScript, production build and static link and asset checks passed.

WebKit coverage uses a desktop test engine. Physical iPhone Safari and whole process GPU utilization were not measured.

## Performance

Production UI 0.3.1 and 0.3.2 were sampled sequentially in headless Chromium at 1440 × 1000, device scale factor 2, dark theme, using the same public dataset. Each value is the median of three 3-second windows. No browser tests or builds ran during the comparison.

| State | UI 0.3.1 main thread work | UI 0.3.2 main thread work |
| --- | ---: | ---: |
| Rotating globe | 2932.19 ms | 2894.88 ms |
| Full screen with animated routes | 900.13 ms | 917.80 ms |
| Reduced motion | 0.60 ms | 0.49 ms |
| Offscreen | 24.81 ms | 22.74 ms |

This run shows no material regression. Visible animation remains the largest rendering cost. Both versions made zero WebGL draws and SVG attribute writes in reduced motion and offscreen samples. Fullscreen samples made zero WebGL draws; route animation continued through SVG updates. These measurements describe browser main thread activity, not total CPU or GPU utilization, and one comparison does not establish statistical equivalence.

The production export contains 30 JavaScript chunks totalling 1,788,008 bytes, compared with 1,787,740 bytes for UI 0.3.1: an increase of 268 bytes before compression across the whole website.

Raw measurements are in [globe-performance-0.3.2.json](globe-performance-0.3.2.json). The existing `scripts/profile-globe.mjs` script reproduces the sampling procedure with `ATLAS_PROFILE_BASE_URL` set to the production preview origin.

## Manual push

Review and commit these files on main:

- `.github/workflows/pages.yml`
- `site/src/app/atlas/atlas.css`
- `site/src/components/atlas-explorer.tsx`
- `site/src/components/magicui/globe.tsx`
- `site/src/lib/atlas-ui.ts`
- `site/tests/atlas.spec.ts`
- `site/evidence/release-globe-0.3.3.md`
- `site/evidence/globe-performance-0.3.2.json`

Push the reviewed commit to trigger the GitHub Pages build and deployment. Generated output, caches, screenshots and test traces stay outside Git. No dataset upload is required for this UI release.

The production preview is available at http://127.0.0.1:3006/atlas/. After deployment, verify UI 0.3.3 in About ATLAS and test surface clicks, dragging from a node or link, and the Enter full screen button.
