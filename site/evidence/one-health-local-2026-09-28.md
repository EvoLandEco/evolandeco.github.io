# One Health local compatibility · 28 September 2026

Status: private implementation for review. No upload, public pointer change, website deployment or Git push is authorized or performed. The publication target remains site contract 1.2.0.

## Candidate

- Export: `2e68a96c245a98103d86008756bf85bc4cd92a201103fe5478fa82eae3c24e21`.
- Site contract: 1.4.0; metrics: 0.2.0.
- Source: `reports/one-health-2026-09-28/structured` and its matching `snapshot.json` in the ATLAS checkout.
- Evidence: 44 observations and six explicit relationships; no accepted cross-species transmission edges.
- Coverage: eight inspected report entries, comprising one complete scoped review and seven partial reviews; 1,616 entries unreviewed.

## Interface

The One Health tab pairs labelled People, Animals, Environment and Food and commodities lanes with an accessible observation table and a bounded source panel. Marker shapes distinguish domains. Connections use clear routing corridors, genomic associations are undirected and dotted, exposure links are solid, and source hypotheses have a dashed style and separate toggle. Direction is drawn only when exported.

Reporting filters select source records; domain and observation-date filters pass through ATLAS's trusted selector. Undated findings have a separate table when observation dates are filtered. Excluding an endpoint removes its incident relationships. Background observations stay in the evidence table. Report views include only their observations and explicitly connected evidence.

Details retain negative findings, uncertain results, source assessment, sampling methods, dates and their basis, units, denominators, quotes, source links and proposition comparisons. Population panels show independent source measurements. Animal values have no invented longitudinal connections. Reference maps draw reviewed places without inferred arcs. The existing Trends view retains reviewed human series and reviewed journeys.

The reporting-attention ring uses the 1.3/1.4 subject partition, including unclassified entries. It counts report entries, not incidence. One Health domain coverage uses overlapping bars rather than a partitioning pie.

## Checks

- 49 unit tests passed, including the actual 1.4 candidate, sealed 1.3 compatibility, negative findings, endpoint eligibility, undated selection and trusted selector hashes.
- Four Chromium browser scenarios passed: narrow dark layout, wide light workspace, legacy dataset and the live public 1.2 journeys. Candidate checks include keyboard selection, hypotheses, observation filters and axe accessibility checks.
- Lint and TypeScript passed.
- Isolated default Turbopack production build passed; all local export links and assets resolve.
- Visual inspection confirmed all four lanes fit the desktop workspace and relationship lines avoid unrelated markers.
- Private data service: loopback port 3004. Interface preview: `http://localhost:3001/atlas/` with `NEXT_PUBLIC_ATLAS_DATA_ORIGIN=http://localhost:3004`.

The public data origin and publication settings are unchanged. Production builds without the preview environment variable use the public data service. Physical-device performance and Firefox/WebKit checks for this new view were not run. The candidate's collection and review gaps remain unresolved; this interface does not establish comprehensive spillover detection or publication approval.
