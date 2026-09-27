# ATLAS export integration

ATLAS owns source interpretation, evidence relationships and export preparation. The website renders the export, filters reporting windows and provides navigation. It does not infer conflicts, geographic roles, transmission routes or statistical comparability from prose.

## Hosting and publication

The site loads its data from `https://qtj-atlas.evolandeco-github-io.workers.dev`. The private R2 bucket `qtj-atlas` stores gzip-compressed releases. `current.json` identifies one release and its uncompressed file checksums. Immutable release paths contain `atlas-site.json`, `map.json` and `metrics.json`. The browser verifies downloaded bytes before constructing the explorer. Publication changes the small release pointer after all uploads have passed verification.

`src/lib/atlas-vendor/` contains the trusted ATLAS selector, TypeScript declarations and measurement schema. `src/content-data/atlas-hosting.json` pins the supported contract and selector hash. Executable code is never loaded from an exported dataset. Large data and test fixtures live outside Git in R2 and the ignored `.cache/` directory.

The publication target is contract 1.2.0 with reviewed journeys and connections. The UI also reads 1.0.0 and 1.1.0 releases. Each publication must match the target contract and its trusted selector; a different contract requires a compatibility review. Dataset publication and the GitHub Pages website deployment are separate operations.

The structured bundle owns canonical entities, identities and research figures. The byte-preserved map input must match `snapshot.source_snapshot_sha256`. The measurements download contains the bundle's embedded metrics.

From `site/`, run:

```sh
pnpm atlas:sync --project /Users/tianjian/Documents/ChatGPT/EpiWeekly
```

The command chooses the latest Wednesday in Europe/Amsterdam. Use `--cycle YYYY-MM-DD` to retain an intended cycle when a job is delayed. It regenerates ATLAS's handoff, requires completed review, production and inbox receipts for that cycle, and checks the final reviewed export. ATLAS validates receipt dependencies, the ledger, explicit decisions and export integrity. Missing or incomplete receipts leave the public release unchanged. A local writer lock prevents concurrent sync processes.

The sync checks contract versions, selector identity, every manifest checksum, the map binding, record identity, geographic memberships, local logos, measurements, assertions and evidence references. It rechecks the handoff before publishing. A failed check stops publication; scientific fields must be corrected in ATLAS. Unanswered editorial questions remain visible as review states and do not count as failed execution.

`--initial` publishes the validated six-month candidate only when no public release exists. This mode does not count as weekly completion. The initial source is `reports/six-month/compact-figures-v1/structured` and its map input is `.local/six-month/export-inputs/snapshot.json` within the ATLAS checkout.

An explicitly authorized correction uses `--correction /path/to/authorization.json`. The authorization identifies the exact published export to replace, the user's instruction and the inspected export files. ATLAS revalidates those files before and after upload. The website checks the public pointer again before writing it and records the authorization hash in the release. Corrections retain the collection's initial or weekly provenance and carry separate correction metadata; they do not create weekly completion receipts.

## Schedule and credentials

The Codex heartbeat runs every Wednesday at 14:00 Europe/Amsterdam, after ATLAS's three jobs. It invokes the sync command for the intended Wednesday. The local computer must be awake with Codex running. If ATLAS is incomplete, the website keeps its published release; rerun the command after the jobs complete. Publication receipts are saved under `.cache/atlas-sync/`.

Wrangler uses the signed-in account's renewable OAuth credentials from the operating system's Wrangler configuration directory. No API secret belongs in the repository, website or automation prompt. Normal publication uses the CLI without a browser. Revoked credentials require signing in again.

The Worker accepts only GET and HEAD for the release paths. It limits each IP to 60 requests per minute before reading R2, uses browser caching for immutable assets, and streams compressed objects. The bucket has no public R2 endpoint. Rate limiting reduces abuse; it is not an account spending cap. The Workers development domain does not provide Cache API edge caching. Monitor storage and requests in Cloudflare; stored release versions remain available for rollback.

Deploy the data service with `pnpm exec wrangler deploy --config atlas-worker/wrangler.jsonc`. Run `pnpm atlas:worker:check`, `pnpm test`, `pnpm build` and `pnpm exec playwright test tests/atlas.spec.ts` for integration checks. Tests download a pinned, checksum-verified fixture into `.cache/atlas-fixture/`; production builds need no dataset or Cloudflare credentials.

References: [Wrangler and R2](https://developers.cloudflare.com/r2/get-started/cli/), [rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [R2 cache behavior](https://developers.cloudflare.com/r2/examples/cache-api/).

## Ownership

| Content | Authoritative fields | Website presentation |
| --- | --- | --- |
| Document title, URL and dates | `documents` | Chronology headings, source links, sorting and pagination |
| Reporting organization | `channels.organization_id`, `organizations` | Logo files, sizing, colour and concise channel labels |
| Report locations | `records.location_membership_ids`, `location_memberships` | Distinct geographic code badges |
| Map location and link endpoint countries | `topics.place_ids`, `places.area_codes`, relationship endpoint IDs | Coordinates, hover cards and neutral location labels |
| Capture and collection schedule | `snapshot` | Date formatting; planned update remains a plan |
| Measurements and comparisons | `metrics`, `assertions`, `comparisons`, `evidence` | Cards, figures, branches and source disclosures |
| Date-dependent evidence eligibility | `view.mjs` | Selection of the reporting window and records |

Globe locations come from `bundle.places` selected by `selectView.place_ids`. The selector owns geographic eligibility through record memberships and relationship evidence. A topic can appear at several locations. Point identities describe geographic positions independently of topic filters, and points at identical coordinates share one display marker. Callout reports use eligible geographic memberships and relationship support. Context-only places appear as endpoints of eligible geographic links. Topics without eligible locations stay in report filters and source coverage. Source coverage shows 24 topics per page, and report chronology shows 12 documents per page.

Empty geographic memberships remain empty. Do not substitute a topic's country list for an unreviewed report location. A publisher is not necessarily the authority quoted in a source. Reporting topics and coincident reference points are not accepted outbreak identities.

The map presentation snapshot supplies topic layout, links, assessment prose and support references. Its exact hash ties those fields to the structured bundle. Globe projection, lane separation, date arithmetic, grouping of coincident markers, search, pagination, focus, themes and motion belong to the website.

## Research figures and comparisons

Use the supplied `selectView` with the selected record IDs. Its `panels` describe measurements and cards for that selection. The embedded metrics' whole-window card groups must not replace the selector when the reporting window changes.

Compact figures use `selectView(...).panels[].compact_groups` with compact grouping version 1.0.0. Show the first two groups and retain every supplied alternative sharing their context IDs. Render one value per group and the reporting sources from every member measure. ATLAS groups matching recorded scope and value before applying its card limit. These groups describe repeated display content; they do not establish independence or epidemiological comparability. Full report figures and citations retain each measure.

A comparison is visible only when its supporting evidence is in scope. Partial windows retain eligible individual assertions without showing a partially supported relationship. Explicit correction lineage can identify superseded assertions; recency alone cannot. Keep publication, capture and observation dates separate. Observation plots use unconnected points unless ATLAS establishes comparability.

The reader supports site contract 1.0.0 with metrics 0.1.0 and site contracts 1.1.0 and 1.2.0 with metrics 0.2.0. Each contract uses its byte-preserved vendored selector; release checks require the matching selector hash. Publication uses the contract pinned in `atlas-hosting.json`.

For 1.1.0 and 1.2.0, Trends reads `selectView(...).reviewed_series` and draws only the supplied connections between visible member measurements. It never joins across missing members or method evidence. Interval counts and cumulative reporting totals retain their declared operation and scope. Selecting a point or connection reveals its reporting period, publication date, source quotations, review provenance and method evidence. Unreviewed contexts remain separate points, including case fatality percentages. Source-checked drafts retain the research-preview label.

The selector's `numeric_coverage` supplies extraction coverage counts. Records without reviewed measurements have unknown extraction coverage; the interface does not label them as zero or as reports without cases. It does not infer whether extraction is pending or unavailable.

Contradictions use compact, borderless assertion branches. Show source-section labels, values or statements, review status and exact evidence. Scope differences and republication use their own badges. Do not repeat tree measurements among the report's other figures, average disagreements or imply an unresolved branch has merged.

Source-checked research previews retain their review states and coverage limits. Pending candidates, missing measurements and zero values are distinct. A larger extraction archive can be imported only through its declared schema and reviewed memberships; it is not interchangeable with the site bundle.

## Chain maps

Contract 1.2.0 supplies `selectView(...).reviewed_chains`. The record selection is shared with the reporting window, topic, source and replay controls. Chain nodes and edges retain their ATLAS identity, kind, direction, review state and evidence. Geographic paths use `drawable_edge_ids`. Unlocated nodes occupy a separate labelled diagram area; their explicit eligible edges connect to that area with dashed lines. The figure does not join excluded nodes or turn travel and contact into transmission. Coincident reference points form a labelled schematic cluster centred on their shared coordinate. Each member retains its own selectable node and exported connections; member offsets describe the cluster layout, not additional geographic precision.

The fitted Mercator extent uses the smallest circular longitude interval, with padding and bounded zoom for reference locations. Dots come from the same land geometry package as the Footprint map. Displayed connections represent exported relationships, not a reconstructed physical route. Source quotations and the View reports action retain report chronology navigation.

`NEXT_PUBLIC_ATLAS_DATA_ORIGIN` selects a data service when building a candidate preview. The service must provide the same release pointer, immutable asset paths and matching checksums as production. Production uses the origin in `atlas-hosting.json`. Browser checks accept the validated bundle path through `ATLAS_CHAINS_CANDIDATE`; datasets remain outside Git.

## Geographic neutrality

Treat places as reporting locations, not assertions of sovereignty. Use neutral place names, preserve attributed source titles and quotations, and keep codes separate from administrative claims. Location badges use flags and geographic codes, with neutral map pins for the disputed regions listed in DESIGN.md. The globe does not draw political boundaries.
