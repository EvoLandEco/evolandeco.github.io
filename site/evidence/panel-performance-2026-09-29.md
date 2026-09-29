# Panel interaction audit

Closed selectors and unrelated React renders account for substantial interaction work outside the globe renderer. Inactive tabs unmount; the cost comes from components inside the active view.

`AtlasSelect` mounts its choices while open. Keyboard navigation, search, selection and focus restoration use the same native details control. Trends, One Health, report cards, geographic entries, assessments and source coverage use memoized component boundaries with stable data and callbacks. Filter, selection and context changes still render the affected content.

## Production measurements

Headless Chromium, 1440 × 1000, device scale factor 1, full-screen workspace, local contract 1.5 dataset. Reduced motion stops continuous animation to isolate interaction work. Each build visits the same views and dispatches pointer enter and exit events over the first 15 visible globe markers, waiting two animation frames after each event. One Health also receives six node hover pairs inside its own figure.

| View | DOM elements, baseline / optimized | Hover main thread work, baseline / optimized | Reduction |
| --- | ---: | ---: | ---: |
| Trends | 19,621 / 5,603 | 1,292 / 878 ms | 32% |
| Reports | 10,806 / 4,636 | 1,750 / 793 ms | 55% |
| Assessments | 11,602 / 5,252 | 1,824 / 798 ms | 56% |
| One Health | 18,508 / 4,969 | 1,043 / 842 ms | 19% |
| Geographic links | 11,509 / 5,373 | 1,764 / 831 ms | 53% |
| Source coverage | 11,271 / 4,987 | 1,065 / 851 ms | 20% |

Trends has 14,024 elements inside closed selectors in the baseline and six empty container elements in the optimized build. One Health node hover work measures 113 ms and 66 ms, a 42% reduction. Both builds are nearly idle with motion disabled: less than 2 ms of main thread work per three-second observation. These results identify interaction cost rather than continuous background processing in static panels.

Measurements use one production run per build. Synthetic event timing is not INP, and CDP main thread duration is not whole-process CPU or GPU utilization. The globe geometry, rendering resolution and visual effects are unchanged by these panel changes.

## Validation

- TypeScript and focused lint pass; the production build exports 445 pages.
- Fourteen browser checks pass across selector keyboard handling, filtering, report pagination, lazy report bodies, assessment evidence, source coverage, One Health discovery and network interactions at desktop and mobile sizes.
- Both profiling runs emit no page errors.

Run `scripts/profile-atlas-panels.mjs` from `site/`, with `ATLAS_PROFILE_BASE_URL` set to the production preview origin and `ATLAS_PROFILE_DATA_ORIGIN` set to a data service that permits that origin. Pass the output JSON path as the first argument. Raw measurements are in [panel-performance-2026-09-29.json](panel-performance-2026-09-29.json).
