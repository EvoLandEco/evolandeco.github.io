# Idle rendering audit

Production exports, headless Chromium, 1440 × 1000, device scale factor 2, dark theme. Each result is the median of three 3-second samples with the same local dataset. Measurements describe browser main thread work, not whole-process CPU or GPU utilization. Frame timing and machine load affect short samples.

| ATLAS state | Baseline work (ms) | Optimized work (ms) |
| --- | ---: | ---: |
| Rotating globe | 2740.93 | 2702.55 |
| Full-screen workspace | 1102.87 | 886.51 |
| Globe and heading offscreen | 39.23 | 26.09 |
| Reduced motion | 0.39 | 0.62 |

Workspace work falls 19.6%. Its layout work falls from 97.46 to 19.60 ms, and style recalculation from 277.56 to 183.61 ms. Offscreen work falls 33.5%. Rotation remains the dominant cost while the globe is visible; these samples do not establish a material improvement to rotation. Home rotation measurements are similar (462.37 and 490.00 ms). Reduced motion is nearly idle in both builds.

The moving travel legend uses an HTML compositor layer over a static SVG line. Its five-second cycle, travel distance, opacity, glow and responsive dimensions are preserved. Decorative network backgrounds use the shared visibility and motion policy, including a pause when the ATLAS workspace covers them.

The globe renderer, map sampling, resolution, route geometry and animation cadence are unchanged. Rotating samples draw about 90 WebGL frames per three seconds. Workspace, reduced-motion and offscreen samples draw none. Animated route paths continue while the workspace is visible; this accounts for substantial remaining work. No repeated dataset processing appeared in the idle scripting profile.

Validation:

- Production build: 445 static pages; TypeScript passes.
- Lint passes for the changed components, profiling script and tests.
- Browser checks cover marker inspection, travel beams, hidden documents, offscreen backgrounds, reduced motion, workspace drag and exit.
- Eight settled legend captures are pixel-identical across light and dark themes: 1440 × 1000 page and workspace, 1280 × 720 workspace, and 390 × 844 page. These layouts have no horizontal overflow and emit no page errors.
- Profiling browsers exit without leaving running test browser processes.

Run `scripts/profile-globe.mjs` from `site/` with `ATLAS_PROFILE_BASE_URL` pointing to a production export. `ATLAS_PROFILE_DATA_ORIGIN` selects a data service reachable by native browser fetch, with CORS permission for the preview origin. The script accepts an output JSON path. Raw measurements are in [idle-performance-2026-09-29.json](idle-performance-2026-09-29.json).
