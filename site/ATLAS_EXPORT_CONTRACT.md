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

## Private One Health compatibility

The UI accepts site contracts 1.3.0, 1.4.0 and 1.5.0 through their matching trusted selectors. The publication configuration pins 1.5.0. Immutable asset staging leaves the live pointer unchanged. Activation requires both a content-bound publication authorization and a deployed website that accepts the candidate contract.

Contract 1.3 supplies a partition of reporting attention by disease subject. The ring counts report entries, includes unclassified entries and links its categories to their reports. These counts do not measure disease incidence.

Contract 1.4 supplies the One Health evidence tab. Reporting filters select eligible source records before the authoritative selector applies domain and observation-date filters. A report view retains observations from its explicit connected evidence, including disconnected observations from that report. Excluded endpoints remove their relationships. Undated observations occupy a separate table when an observation window is active; background observations stay outside the relationship diagram.

People, animals, the environment and food occupy separate labelled lanes. Source hypotheses use dashed links, genomic associations use undirected dotted links, and exposure links use solid lines. Direction comes only from the export. Details preserve negative findings, uncertainty, sampling scope, units, denominators, source dates, exact quotations and proposition conflicts. Reviewed reference locations appear without inferred geographic arcs. Surveillance population panels retain separate values and units; One Health membership grants no longitudinal comparison permission.

The One Health review counts distinguish complete scoped reviews, partial and unresolved reviews, entries with no relevant observation, unreviewed entries and support outside selection. Domain coverage bars count unique entries and can overlap. A selected example is not comprehensive spillover surveillance.

## One Health presentation and producer workflow

Network, Evidence and Overview consume the same eligible One Health selection. The overview counts report entries and does not merge entries into epidemiological episodes. Source-specific node IDs are content-derived; a label edit can change the ID. They are not persistent entity identities.

The relationship matrix reads `evidence_types` and opens that relationship’s full `evidence_ids`. Contract 1.4 does not bind each evidence type to individual quotations. A marked cell means a type is cited for the relationship, not that the website independently verified it. An empty cell means the type is not recorded; it is not a negative result, contradiction or statement that no investigation occurred. Source hypotheses, source certainty and curator review state remain separate.

ATLAS maintains the producer specification in `docs/ONE_HEALTH.md`, with workflow and export integration in `docs/WORKFLOW.md` and `docs/SITE_EXPORT.md` in the ATLAS repository. Source review may use existing notes and private review artifacts for richer details, but the UI must not read undeclared fields or parse those notes into scientific relationships.

The following require a versioned producer contract before corresponding UI figures:

- Entity and episode identities with explicit continuity decisions for cross-report episode views.
- Linked numerator and denominator measurements, sample units and pooled, clustered or repeated sampling structure for positivity and comparable population plots.
- Date precision, bounds, kinds and field-specific evidence for observation timelines and lead-time analyses.
- Evidence-type quotation bindings and support, contradiction or unresolved status for evidence-level matrices.
- Isolate identities, methods, genetic distances, thresholds and tree provenance for genomic views.
- Observation-specific place roles and typed environmental covariate or intervention links for driver panels.

Acceptance requires schema and selector versions, source-bound fixtures, eligibility checks under partial selections, unknown and negative-result distinctions, replay or integrity checks, and UI compatibility tests. A scientific source correction belongs in ATLAS. UI layout changes and methods citations require no dataset mutation. Candidate adoption and public publication are separate decisions; compatibility alone does not authorize a public release.

## One Health analytical panels

Contract 1.5.0 provides typed timings, sampling assessments and environmental or intervention contexts. Its pinned selector owns source selection, correction lineage, contradictions and proportion eligibility. Timeline, Sampling and Environment consume those selections without parsing narrative notes or recomputing sample fractions. These views mount only for contract 1.5.0.

Timeline separates observation statements, reporting cutoffs and incomplete dates. Calendar ranges for month or year precision describe possible placement, not event duration. Publication and capture dates remain source metadata. Sampling retains counts, units, frame, methods, pooling, clustering and repeated sampling; a reviewed zero fraction remains visible. Environment distinguishes measured variables, attributed conditions, hypotheses, reported interventions and evaluated effects. Independent context records can be inspected without an observation link. Alignment does not establish transmission or intervention effects.

The schema and selector handoff supports consumer testing with synthetic fixtures. Local adoption requires the sealed candidate, hashes, source review coverage and source-bound validation. Public publication requires its own authorization.

Source time carries an explicit point, closed interval, open interval or unknown extent. Open intervals retain their known boundary in the incomplete-date list and never acquire an endpoint from the reporting window. Detection dates remain distinct from collection and test-result dates. Sampling inclusion periods belong to the sampling frame unless the source also establishes an observed event.

## Country network analysis

[Network analysis and UI acceptance](ATLAS_NETWORK_ANALYSIS.md) defines the producer analysis, evidence requirements and display rules for country statistics. Analytical exports require a separate versioned contract bound to the source release and supported filter scopes. Raw reporting counts, reviewed episode counts, collection adjustments and surveillance adjustments are distinct quantities. A valid export may mark an estimate unavailable with its data requirements; the UI must preserve that distinction from zero.
