# ATLAS UI 0.4.2 release checks

Release date: 2 October 2026. Status: Experimental.

## Scope

The browser loads compact report and map data, then requests evidence partitions as panels need them. Shared requests, cancellation and bounded caching control resource use. GPU markers and route rendering preserve globe interactions, report selection and source data. Fullscreen dragging rotates both globe axes. A Reset tilt button restores the standard viewing latitude while preserving horizontal rotation and report filters. A centered text hint appears at entry, ends after two pulses and dismisses when dragging starts.

The UI supports scientific export contracts 1.0.0 through 1.5.0, Browser transport 0.1.0 and Intelligence 0.2.0. UI metadata is independent of the website package and dataset versions.

## Public dataset

The public service was checked on 2 October 2026:

- Export: `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`, contract 1.5.0.
- Browser manifest: `b660d7a7445f697f2fc2c8737b37e531d695ab9deff87f44d50779b337a2c057`, 870,451 decoded bytes, served with gzip.
- Intelligence asset: `4c1216f715040f7d466123aa04b5ceb55bad6500e5a3f7c388bf0cc4b69b2d51`, schema 0.2.0.

The manifest matches the public release's source identities. The three bundled browser runtime files match the published hashes and consumer pins; the two producer declaration files also match. Publication is recorded in [the browser release receipt](browser-publication-2026-10-02.json). No dataset upload is required for this website release.

## Validation

- ESLint, TypeScript, production build and static links and assets pass.
- The base unit suite has 76 passing tests and five dataset-dependent skips. A separate run with the published browser and Intelligence fixtures passes all seven selected tests, covering three of those skips. The historical One Health and WHO checkpoint cases were not run.
- All seven browser cases selected by the GitHub Pages workflow pass in Chromium and in a separate WebKit run.
- Ten focused cases pass in each engine: five globe rotation, tilt reset and drag-hint cases, and five compact transport and evidence-hydration cases. The transport cases use the checksum-verified published candidate; none are skipped.
- Worker checks pass for public paths, gzip, CORS, conditional reads, HTTP methods and separate request limits.
- Staged source review found no blocking globe lifecycle or interaction defect. Generated exports, caches, traces and screenshots are excluded from Git. Public evidence receipts use portable file names instead of local home-directory paths.

## Performance evidence

Three fresh Chromium contexts per transport, with 4× CPU throttling and local compressed assets, gave median readiness of 2.56 seconds for compact data and 11.83 seconds for archive data. Median startup JavaScript heap was 70.4 MB and 159.9 MB respectively. These measurements exclude internet latency and total process or GPU memory; see [the load comparison](atlas-load-comparison-2026-10-02.json).

[Route rendering measurements](atlas-route-performance-2026-10-02.json) and [browser interaction checks](atlas-route-validation-2026-10-02.json) cover desktop Chromium and WebKit. Final physical iPhone validation of the GPU route renderer remains outstanding. Desktop WebKit does not establish device-specific memory or rendering limits.

## Manual push

The prepared changes are staged on `main`. Remote `main` matched local HEAD `de31a898cd471d631283ce2b50139287fc2c603e` during the preflight. Review the staged changes, then run:

```sh
git commit -m "Release ATLAS UI 0.4.2"
git push origin main
```

The push triggers the GitHub Pages validation and deployment workflow. After deployment, confirm UI 0.4.2 in About ATLAS and check dataset loading, globe dragging and tilt reset. The local preview is at <http://127.0.0.1:3006/atlas/>.
