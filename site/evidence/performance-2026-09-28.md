# ATLAS rendering performance

Measurements use a production export in headless Chromium at 1440 × 1000, device scale factor 2, dark theme, with export `bae2fe60800e390cf785a3bc916c60a9df1641d5094a5211add45ed9d9427c64`. Each state uses the median of three 3-second samples. Values describe browser main-thread work, not whole-process CPU or GPU utilization.

| ATLAS state | Baseline work (ms) | Optimized work (ms) | Reduction |
| --- | ---: | ---: | ---: |
| Rotating globe | 2798.10 | 2281.59 | 18.5% |
| Workspace with animated routes | 1208.11 | 1077.69 | 10.8% |
| Globe and heading offscreen | 110.04 | 37.61 | 65.8% |
| Reduced motion | 16.72 | 0.43 | 97.4% |

Globe scripting takes 279.67 ms while rotating and 106.71 ms in workspace mode, reductions of 35.6% and 30.2%. Home main-thread work is similar across runs. The rotating globe draws 90 WebGL frames per 3 seconds; workspace, offscreen and reduced-motion samples draw none. Visible workspace beams retain their animation and still incur SVG rendering work. Style recalculation during rotation is higher, while total main-thread work is lower. Frame scheduling and machine load affect these short measurements.

Curves and node coordinates are cached. Camera trigonometry is shared within a frame. SVG paths write geometry directly, and invisible trails skip gradient writes. Title animation follows panel visibility and document visibility. A stationary globe without animated routes does not schedule animation frames. Map sampling, resolution, glow, route geometry and the 30 fps animation cadence are retained.

One Health is a separate module requested on tab selection. Report bodies mount on first expansion, scope contents mount while their dialog is open, and Source coverage reuses report counts, location badges and edges across hover changes.

Validation:

- Production build and static export link checks pass.
- TypeScript, lint for changed performance files, and 11 globe tests pass.
- Browser checks cover report expansion, scope focus and dismissal, hidden-document pausing, beam completion, workspace entry, filters, Source coverage hover, and One Health layouts.
- Light and dark static globe captures are pixel-identical at 680 × 681.
- 1,400 route, camera and progress combinations match the reference geometry exactly, including paths, callout anchors, trails and arrows.
- Production request inspection confirms the One Health module is absent from initial loading and fetched after tab selection.

Run `scripts/profile-globe.mjs` from `site/` with `ATLAS_PROFILE_BASE_URL` pointing to a production preview. `ATLAS_PROFILE_DATA_ORIGIN` can select a local export server. The script accepts an output JSON path. Raw measurements are in `globe-performance-2026-09-28.json`.
