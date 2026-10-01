# ATLAS UI 0.3.1 release checks

Release date: 1 October 2026. Status: Experimental.

The main `/atlas/` page provides searchable Place and Disease filters, multiple selections, report entry counts and compact Rules controls. Disease uses a virus icon. Topic selection and background location inclusion sit under Rules. Choices persist across evidence tabs, and the record selection feeds the globe, Trends, Analysis, One Health, Reports and source coverage.

Supported export contracts are 1.0.0 through 1.5.0. Separate Place and Disease controls require the reviewed disease fields in 1.3.0 or later. Contracts without those fields use the combined topic control. Filter semantics and evidence eligibility are documented in [the export contract](../ATLAS_EXPORT_CONTRACT.md#reporting-filters).

## Dataset

Validation used the published contract 1.5.0 release `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`, captured on 28 September 2026, through the public data service. Nigeria and Lassa fever select 63 report entries across 51 source documents for the full reporting window. Disease matches include explicit assignments in reports covering multiple diseases.

This UI release requires no dataset upload or producer rerun. It does not change scientific data, fit Analysis models or publish a Cloudflare release. Large data bundles and private checkpoints stay outside Git.

## Validation

- 63 unit tests passed. Two tests requiring separate historical 1.4 datasets were skipped.
- Two reporting-filter browser cases passed against the production export at desktop and phone widths. These cover place and disease intersection, source and date changes, entry counts, tab persistence, empty selections, nested keyboard controls, reset, fullscreen menus and the virus icon.
- Two complete Analysis and One Health navigation cases passed against the production export at desktop and phone widths, including their accessibility checks.
- Five GitHub Pages smoke cases passed against the pinned compatibility fixture, including report navigation, mobile themes, download retry and checkbox filtering.
- One phone-width WebKit reporting-filter case passed. This is an engine check, not a physical iPhone test.
- ESLint, TypeScript, production build, static links and asset paths passed. Git whitespace checks passed.

The browser run contains ten passing cases. Two browser cases required reruns because concurrent runners used the same trace directory. Both passed with separate artifact directories. A restricted compiler run stalled; the production build passed with local compiler subprocess permissions.

## Manual push

Review the source, tests and documentation under `site/`, including these untracked files:

- `src/lib/atlas-reporting-filters.ts`
- `tests/atlas-reporting-filters.test.ts`
- `tests/atlas-reporting-filters.spec.ts`
- `evidence/release-filters-0.3.1.md`

Commit the reviewed changes on `main` and push when ready. The GitHub Pages workflow builds and deploys the website. Generated output, test artifacts, screenshots and caches stay outside Git. No commit or push was performed during these release checks.

The local production preview is available at `http://127.0.0.1:3006/atlas/`. After Pages deployment, verify UI 0.3.1 in About ATLAS and test a Place + Disease selection on the public page.
