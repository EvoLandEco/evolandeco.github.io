# ATLAS export integration

ATLAS owns source interpretation, evidence relationships and export preparation. The website renders the export, filters reporting windows and provides navigation. It does not infer conflicts, geographic roles, transmission routes or statistical comparability from prose.

## Hosting and publication

The site loads its data from `https://qtj-atlas.evolandeco-github-io.workers.dev`. The private R2 bucket `qtj-atlas` stores gzip-compressed releases. `current.json` identifies one release and its uncompressed file checksums. Immutable release paths contain `atlas-site.json`, `map.json` and `metrics.json`. The browser verifies downloaded bytes before constructing the explorer. Publication changes the small release pointer after all uploads have passed verification.

`src/lib/atlas-vendor/` contains the trusted ATLAS selector, TypeScript declarations and measurement schema. `src/content-data/atlas-hosting.json` pins the supported contract and selector hash. Executable code is never loaded from an exported dataset. Large data and test fixtures live outside Git in R2 and the ignored `.cache/` directory.

The publication target and UI require site contract 1.8.0, metrics 0.4.0 and browser transport 0.3.0. Website deployment requires coordinated activation of a matching dataset. Each publication must match the target contract and its trusted selector; a different contract requires a compatibility review. Dataset publication and the GitHub Pages website deployment are separate operations.

## UI contract

Site 1.8.0 adds source-bound report assessments. Browser transport 0.3.0 carries those rows and uses its own pinned decoder, tables and selector. The UI separates publisher authentication, reported diagnosis, authority responses and attributed expert appraisal. Labels, scope, authority, evidence and supersession come from ATLAS. An authenticated publisher does not establish a diagnosis. Dated unresolved reports remain in the chronology; source identity uses exported channel names and a neutral publisher icon when there is no registered logo asset.

The consumer rejects any other site or browser transport version before downloading dataset assets. Browser transport is required; the UI does not download the complete scientific bundle for rendering. Publication remains gated on the configured target, a reviewed export and an exact transport handoff proving reconstruction and every-record selection parity. Assessment eligibility requires complete supporting records, both date bounds and the review knowledge cutoff. No clinical status is inferred by the website.

Publication tools can inspect archived release descriptors to verify replacement targets. Archived selectors support export validation and are excluded from the UI runtime. These readers do not grant UI compatibility or publication authority.

## Measurements and transport

Percentage change and percentage of target retain their distinct units in figures. Report bodies expose every selected measure and source claim; the four-value cap applies only to globe summaries. Timeline, sampling and environmental views retain their exported eligibility and undated entries. Intelligence and network analysis require assets bound to the exact scientific release; an asset bound to another export cannot supply its analysis panels.

Activation requires the final reviewed site, map, metrics and manifest; exact selector and schema identities; a browser transport handoff proving reconstruction and every-record selection parity; and matching analysis descriptors. Run consumer checks against those exact assets, deploy the compatible website, then amend the publication target and activate under the writer lock. A complete review receipt and publication authorization are separate requirements from schema validity.

Strict quantities use `more_than` (`>`) and `less_than` (`<`), distinct from `at_least` (`≥`) and `at_most` (`≤`). Browser transport includes each measure's qualifier so summaries, comparisons and complete details agree.

An interval with `precision: mixed` retains each endpoint's ISO year, month or day encoding. Labels preserve those source precisions. Calendar bounds position the interval on an axis; they are not asserted observation dates. Date eligibility remains the trusted selector's responsibility.

The structured bundle owns canonical entities, identities and research figures. The byte-preserved map input must match `snapshot.source_snapshot_sha256`. The measurements download contains the bundle's embedded metrics.

The release's `browser` descriptor binds a compact display and selection core plus independently fetched evidence details. The complete scientific downloads retain their identities and checksums. [Browser transport](ATLAS_BROWSER_TRANSPORT.md) specifies the projection, reconstruction, integrity checks and consumer cache. Browser assets use immutable paths beneath `releases/<export_id>/browser/<manifest_sha256>/`.

From `site/`, run:

```sh
pnpm atlas:sync --project /Users/tianjian/Documents/ChatGPT/EpiWeekly
```

The command chooses the latest Wednesday in Europe/Amsterdam. Use `--cycle YYYY-MM-DD` to retain an intended cycle when a job is delayed. It regenerates ATLAS's handoff, requires completed review, production and inbox receipts for that cycle, and checks the final reviewed export. ATLAS validates receipt dependencies, the ledger, explicit decisions and export integrity. Missing or incomplete receipts leave the public release unchanged. A local writer lock prevents concurrent sync processes.

The sync checks contract versions, selector identity, every manifest checksum, the map binding, record identity, geographic memberships, local logos, measurements, assertions and evidence references. It rechecks the handoff before publishing. A failed check stops publication; scientific fields must be corrected in ATLAS. Unanswered editorial questions remain visible as review states and do not count as failed execution.

For each new export, sync invokes ATLAS's browser transport exporter and verifier against the exact scientific site and map files. The stable handoff must confirm complete reconstruction, every-record selection parity and producer readiness. The website checks its pinned runtime and type files, uploads and verifies the browser assets, and attaches their manifest to the release under the same writer lock. These steps prepare transport and do not run the scientific review jobs. A failed browser check leaves the public pointer intact. Stage receipts include the browser descriptor and handoff reference.

`--initial` publishes the validated six-month candidate only when no public release exists. This mode does not count as weekly completion. The initial source is `reports/six-month/compact-figures-v1/structured` and its map input is `.local/six-month/export-inputs/snapshot.json` within the ATLAS checkout.

An explicitly authorized correction uses `--correction /path/to/authorization.json`. The authorization identifies the exact published export to replace, the user's instruction and the inspected export files. ATLAS revalidates those files before and after upload. The website checks the public pointer again before writing it and records the authorization hash in the release. Corrections retain the collection's initial or weekly provenance and carry separate correction metadata; they do not create weekly completion receipts.

## Schedule and credentials

The Codex heartbeat runs every Wednesday at 14:00 Europe/Amsterdam, after ATLAS's three jobs. It invokes the sync command for the intended Wednesday. The local computer must be awake with Codex running. If ATLAS is incomplete, the website keeps its published release; rerun the command after the jobs complete. Publication receipts are saved under `.cache/atlas-sync/`.

Wrangler uses the signed-in account's renewable OAuth credentials from the operating system's Wrangler configuration directory. No API secret belongs in the repository, website or automation prompt. Normal publication uses the CLI without a browser. Revoked credentials require signing in again.

The Worker accepts only GET and HEAD for the release paths. Each IP has a separate limit of 120 browser transport requests per minute and 60 requests per minute for the current pointer, scientific downloads, network analysis and Intelligence assets. Both limits apply before reading R2. The service uses browser caching for immutable assets and streams compressed objects. The bucket has no public R2 endpoint. Rate limiting reduces abuse; it is not an account spending cap. The Workers development domain does not provide Cache API edge caching. Monitor storage and requests in Cloudflare; stored release versions remain available for rollback.

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

## Reporting filters

Place and Disease filters use `location_memberships`, `areas`, `disease_reviews` and `diseases` in the structured export. A report matches any selected value within a filter and every active filter across Place, Disease, Topic and Source. Memberships and disease reviews require all supporting records in the reporting window. Filtered record IDs pass to the trusted selector; relationships remain visible only with complete supporting evidence.

Disease matching includes every explicit disease assignment in a report covering multiple diseases. Unresolved or unsupported assignments appear under Unclassified disease, while Not disease-specific retains its separate category. Disease names are not inferred from titles or grouped into families by the website.

Place matches occurrence, exposure, travel origin, travel destination and reporting scope. Include background locations adds context memberships. Location unspecified selects entries without an eligible membership among these roles. Place filters select report entries; a matching report can describe several locations. Their connected locations remain available on the globe.

Menu counts describe report entries, not source documents or cases. Each menu applies the reporting window and the other filters while leaving its own choices available. Topic selection and background location inclusion sit under Rules. Link type limits geographic links. Analysis filters select available series and evidence without fitting models again.

## Research figures and comparisons

Use the supplied `selectView` with the selected record IDs. Its `panels` describe measurements and cards for that selection. The embedded metrics' whole-window card groups must not replace the selector when the reporting window changes.

Compact figures use `selectView(...).panels[].compact_groups` with compact grouping version 1.0.0. Show the first two groups and retain every supplied alternative sharing their context IDs. Render one value per group and the reporting sources from every member measure. ATLAS groups matching recorded scope and value before applying its card limit. These groups describe repeated display content; they do not establish independence or epidemiological comparability. Full report figures and citations retain each measure.

A comparison is visible only when its supporting evidence is in scope. Partial windows retain eligible individual assertions without showing a partially supported relationship. Explicit correction lineage can identify superseded assertions; recency alone cannot. Keep publication, capture and observation dates separate. Observation plots use unconnected points unless ATLAS establishes comparability.

Trends reads `selectView(...).reviewed_series` and draws only the supplied connections between visible member measurements. It never joins across missing members or method evidence. Interval counts and cumulative reporting totals retain their declared operation and scope. Selecting a point or connection reveals its reporting period, publication date, source quotations, review provenance and method evidence. Unreviewed contexts remain separate points, including case fatality percentages. Source-checked drafts retain the research-preview label.

The selector's `numeric_coverage` supplies extraction coverage counts. Records without reviewed measurements have unknown extraction coverage; the interface does not label them as zero or as reports without cases. It does not infer whether extraction is pending or unavailable.

Contradictions use compact, borderless assertion branches. Show source-section labels, values or statements, review status and exact evidence. Scope differences and republication use their own badges. Do not repeat tree measurements among the report's other figures, average disagreements or imply an unresolved branch has merged.

Source-checked research previews retain their review states and coverage limits. Pending candidates, missing measurements and zero values are distinct. A larger extraction archive can be imported only through its declared schema and reviewed memberships; it is not interchangeable with the site bundle.

## Chain maps

The selector supplies `selectView(...).reviewed_chains`. The record selection is shared with the reporting window, topic, source and replay controls. Chain nodes and edges retain their ATLAS identity, kind, direction, review state and evidence. Geographic paths use `drawable_edge_ids`. Unlocated nodes occupy a separate labelled diagram area; their explicit eligible edges connect to that area with dashed lines. The figure does not join excluded nodes or turn travel and contact into transmission. Coincident reference points form a labelled schematic cluster centred on their shared coordinate. Each member retains its own selectable node and exported connections; member offsets describe the cluster layout, not additional geographic precision.

The fitted Mercator extent uses the smallest circular longitude interval, with padding and bounded zoom for reference locations. Dots come from the same land geometry package as the Footprint map. Displayed connections represent exported relationships, not a reconstructed physical route. Source quotations and the View reports action retain report chronology navigation.

`NEXT_PUBLIC_ATLAS_DATA_ORIGIN` selects a data service when building a candidate preview. The service must provide the same release pointer, immutable asset paths and matching checksums as production. Production uses the origin in `atlas-hosting.json`. Browser checks accept the validated bundle path through `ATLAS_CHAINS_CANDIDATE`; datasets remain outside Git.

## Geographic neutrality

Treat places as reporting locations, not assertions of sovereignty. Use neutral place names, preserve attributed source titles and quotations, and keep codes separate from administrative claims. Location badges use flags and geographic codes, with neutral map pins for the disputed regions listed in DESIGN.md. The globe does not draw political boundaries.

## One Health evidence

The export supplies a partition of reporting attention by disease subject. The ring counts report entries, includes unclassified entries and links its categories to their reports. These counts do not measure disease incidence.

The export supplies the One Health evidence tab. Reporting filters select eligible source records before the authoritative selector applies domain and observation-date filters. A report view retains observations from its explicit connected evidence, including disconnected observations from that report. Excluded endpoints remove their relationships. Undated observations occupy a separate table when an observation window is active; background observations stay outside the relationship diagram.

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

Contracts 1.5.0 through 1.7.0 provide typed timings, sampling assessments and environmental or intervention contexts. Their pinned selectors own source selection, correction lineage, contradictions and proportion eligibility. Timeline, Sampling and Environment consume those selections without parsing narrative notes or recomputing sample fractions. These views appear when the selected contract provides the analytical panel collections.

Timeline separates observation statements, reporting cutoffs and incomplete dates. Calendar ranges for month or year precision describe possible placement, not event duration. Publication and capture dates remain source metadata. Sampling retains counts, units, frame, methods, pooling, clustering and repeated sampling; a reviewed zero fraction remains visible. Environment distinguishes measured variables, attributed conditions, hypotheses, reported interventions and evaluated effects. Independent context records can be inspected without an observation link. Alignment does not establish transmission or intervention effects.

The schema and selector handoff supports consumer testing with synthetic fixtures. Local adoption requires the sealed candidate, hashes, source review coverage and source-bound validation. Public publication requires its own authorization.

Source time carries an explicit point, closed interval, open interval or unknown extent. Open intervals retain their known boundary in the incomplete-date list and never acquire an endpoint from the reporting window. Detection dates remain distinct from collection and test-result dates. Sampling inclusion periods belong to the sampling frame unless the source also establishes an observed event.

## Country network analysis

[Network analysis and UI acceptance](ATLAS_NETWORK_ANALYSIS.md) defines the producer analysis, evidence requirements and display rules for country statistics. Analytical exports require a separate versioned contract bound to the source release and supported filter scopes. Raw reporting counts, reviewed episode counts, collection adjustments and surveillance adjustments are distinct quantities. A valid export may mark an estimate unavailable with its data requirements; the UI must preserve that distinction from zero.

## Analysis delivery

The Analysis panel reads Intelligence contract 0.2.0. The release pointer's `intelligence` descriptor identifies the experiment, schema version, uncompressed byte count and SHA-256. The browser verifies the file at `intelligence/<experiment_id>/intelligence.json`, validates its schema, and requires its source export, site checksum and selector checksum to match the loaded release. The adjacent `contract.schema.json` documents the export. A missing or incompatible analysis displays an unavailable state without attributing results to another dataset.

The producer owns signals, source risk statements, model predictions, intervals, scores and method provenance. The website does not fit models or alter their outputs. The default combined prediction is the pointwise median ensemble of the three exported component models. About Analysis retains methods, references, retrospective evaluation limits and provenance.

For an authorized partial release, stage the base through `atlas:sync --correction <authorization> --stage-only`. Then run `node --import tsx scripts/publish-atlas-intelligence.ts --authorization <authorization> --release <staged-receipt> --dry-run`. The same command without `--dry-run` stages the matching network and Intelligence files and a complete immutable release descriptor. Consumer checks can select that staged descriptor through `ATLAS_RELEASE_FILE` in the Analysis browser suite. Add `--activate` only after the checks pass. Activation rechecks source hashes, all public assets and the exact public release being replaced under the shared writer lock. Partial coverage and unresolved reviews remain visible; publication does not create weekly completion or scientific acceptance receipts.

## Undated source supplement

The release descriptor accepts `source_supplement` with the producer descriptor fields: `version`, `source_export_id`, `path`, `sha256`, `bytes`, `schema_path` and `schema_sha256`. Version 0.1.0 uses `source-supplement.json` and `source-supplement.schema.json`. The schema pin is `2314d67db4e9cf1c7c0abab880e5644c21320f2a03fa43bd01a41e6c3015ac01`.

Both assets belong at `releases/<export_id>/supplements/<supplement_sha256>/`. The Worker reads gzip objects, while the descriptor hashes and byte counts describe uncompressed content. The schema is bundled with the consumer; exported code is never executed. Publication must validate and upload both files before attaching the descriptor. The supplement's export binding must match the release, and its inclusion requires content-bound publication authorization.

Reports exposes an Undated sources disclosure. Opening it verifies and loads the separate supplement without adding records to the scientific data store. Capture remains capture; publication remains null. Supplement content does not enter reporting filters, dated counts, geographic views, charts or model inputs. Complete quotations, measurement scope, source identities and review disclosures remain accessible. The reader checks document, record, claim and measurement references, quotation hashes and code-point lengths, source text hash bindings and revision cycles. Exact comparison with captured source text and scientific interpretation belong to producer validation.

For a reviewed correction, the content-bound authorization includes `source_supplement.pointer_descriptor` with those seven descriptor fields and `source_supplement.files` with entries for `source-supplement.json` and `source-supplement.schema.json`. Each file entry has an absolute `path`, uncompressed `bytes` and `sha256`. These fields are covered by the correction authorization checksum. `atlas:sync --correction <authorization> --stage-only` validates both local files, stages them through the shared immutable gzip writer, verifies their public bytes and includes the descriptor in its staged release receipt. Local files and authorization are checked again before the receipt is sealed. Existing immutable objects must match; they are never replaced.

The sync cache keeps `supplement-delivery-<sha256>.json` for local validation and `supplement-staged-<sha256>.json` for public verification. Neither receipt establishes consumer adoption or activation. Consumer checks use the complete staged release through `ATLAS_RELEASE_FILE` and keep their own receipt. A release that includes network or Intelligence assets must use the staged base and the complete descriptor activation command. That command requires the authorized supplement descriptor to match, verifies its local and public files, and rechecks the public release being replaced under the shared writer lock. Its publication receipt records activation after pointer readback. A publication cannot silently discard an attached supplement or change it under the same export identity.

The Worker supplement routes and the consumer schema pin must be deployed before activation. Final release testing requires the exact source export, matching browser transport, network analysis, Intelligence assets and supplement; a compatibility fixture is not an activation target.

A correction can supply `browser_validation` as a checked file reference and `browser` as the producer browser descriptor. Sync verifies this exact handoff, all assets, bundled runtime identities and source bindings. Its browser manifest must match the authorization. Weekly exports without a supplied handoff use the producer exporter and every-record verifier. Public verification reads are spaced by `--read-interval-ms` (600 ms by default) to respect the browser asset service's request limit.

## Source text and watch presentation

The `source_text` and `watch` release descriptors bind presentation JSON to the scientific export. Assets use `releases/<export_id>/presentation/<payload_sha256>/`. Schema hashes are pinned in the website; downloaded JavaScript is never executed. The watch selector is vendored from ATLAS with its checksum recorded in the release handoff.

Source text display 0.1.0 retains reviewed language assignments, English translations and explicit record/claim/quotation bindings. The descriptor also binds the complete audit catalogue. The UI attaches translations by target identity or exact claim coordinates, preserves original quotations, and labels ATLAS generated drafts. Unlisted text has an unreviewed language assignment. Embedded series method evidence and the undated supplement have no translation bindings. Language badges identify the language without inferring a country.

Watch 0.1.0 retains source checked selections in the scientific presentation attachment. The live Events to watch board uses the daily contract exclusively. Latest reports orders dated documents by publication date, capture date and document identity, excluding documents featured in the displayed daily watch list.

`publish-atlas-intelligence.ts` accepts the content bound `presentation` object alongside the scientific, network, Intelligence and supplement handoff. Each entry contains `pointer_descriptor`, `data` and `schema` file references. Files are checked before upload and before activation. Publication preserves attached presentation descriptors for the same scientific export. A release for a different export needs matching presentation attachments; a weekly publisher must not drop them silently.

## Daily source reports

Daily contract 0.2.1 contains source documents, reviewed findings, paired quotations, watch selections, acquisition coverage and exact weekly reconciliations. Its scientific export ID, site hash, map hash and scientific manifest hash must match the loaded weekly release. The browser transport manifest supplies the scientific manifest hash. The consumer bundles the daily schema and selector under `atlas-vendor/daily/0.2.1`; `dailyPins` records their exact hashes. Downloaded code is never executed.

`daily/<base_export_id>/current.json` is an independent descriptor containing `version: 1`, `daily_version`, `daily_id`, `base_source_export_id`, `base_manifest_sha256`, `published_at`, `asset: {sha256, bytes}`, `schema_sha256` and `selector_sha256`. The data, schema, selector, producer manifest and validation receipt are immutable gzip objects at `daily/<base_export_id>/<daily_id>/`. The daily descriptor is uncompressed with a short cache lifetime. The weekly `current.json` is not a daily publication target.

The daily request starts after the weekly store is ready. A missing daily descriptor means no daily release is published for that weekly base. Other request or validation failures display a daily availability message while retaining the reviewed workspace. The consumer validates identities, source bindings, quotation hashes, offsets and evidence references before display.

`selectDaily` controls publication dates, source IDs, country codes, the knowledge cutoff and the assessment time (`asOf`). Selections remain visible after their reassessment due time. A reviewed daily release replaces or retires them; review deadlines describe reassessment needs and do not hide cards. Assessment time prevents a selection from appearing before its review. An empty daily selection stays empty; the scientific watch attachment does not supply replacement cards. Findings and watch selections retain all required supporting documents. Daily entries are excluded under disease, topic, relationship or scientific evidence focus because the daily contract does not contain those reviewed classifications. Source and place controls include daily source IDs and reviewed country codes. The producer supplies `channel_id` from the scientific channel acquisition mapping; source selection accepts either explicit identifier. Daily dates extend the reporting window without adding records to scientific calculations.

Reporting activity counts the union of selected weekly and daily publisher reports. Exact document IDs and producer `base_document_ids` bind publication versions into one display entry; they do not merge events or clear review status. Each version keeps its own evidence and capture date. Reporting attention remains scoped to weekly reviewed records. Events to watch includes producer selected daily briefs with attributed facts and a View reports action. Latest reports and Reports include daily source documents in publication chronology. The processing badge “Weekly review pending” is separate from diagnostic certainty. An exact review reconciliation for the loaded weekly export clears the pending state. An integrated daily version is omitted only when every referenced canonical record exists in that weekly store; titles and URLs do not establish reconciliation. The consumer never derives publication bindings from text or URLs. Reviewed versions not exported remain accessible with their processing outcome.

Latest reports excludes publications supporting the selected watch cards. Standalone daily publications enter the same date order as weekly publications. The full Reports chronology includes both featured and unfeatured publications. Cards render the producer label, location, diagnostic label, key facts and reason directly, retaining their attribution and qualifiers. View reports uses the shared chronology navigation and evidence highlights, matching exact document IDs and explicit publication version bindings. Document selection does not change the reporting window or scientific panels. Source quotations remain in the report entries. Watch assessments and source coverage are separate collections; monitoring a source does not select its reports for attention. The consumer verifies each card and fact against its assessment and supporting findings.

`pnpm atlas:daily --directory <sealed_daily_directory> --release <weekly_release> --browser-manifest <browser_manifest>` checks the handoff and writes a local candidate under `.cache/atlas-daily/<daily_id>`. It requires the producer manifest, schema, selector and validation receipt. `--upload` requires a content-bound authorization file with `destination`, `bucket`, `weekly_release_sha256`, the exact `daily_pointer`, and `authorization` containing `thread_id`, `instruction` and `confirmation`. Upload preserves existing immutable assets and verifies their public bytes. `--activate` additionally writes only the daily pointer. Publication holds the shared ATLAS writer lock, requires the exact public weekly base, and rechecks files and both pointers before activation. Deploy the daily Worker routes before uploading.

A daily publication schedule requires explicit standing authorization naming the public service, bucket and scope of future daily payloads. Source collection authority alone does not grant public upload authority. After that authorization and the initial website, Worker and scientific release rollout are verified, each run saves `.cache/atlas-daily/<daily_id>/publication-authorization.json` with the exact public weekly descriptor hash and validated daily pointer. Its authorization records the originating human instruction, thread and daily schedule identity, plus the matching consumer validation receipt. This is a per-release record of standing authorization, not a request for approval each morning. A local preview descriptor cannot bind a public publication. Daily runs cannot deploy the website or Worker, change the scientific pointer, expand source scope, or commit or push repositories. Incompatible contracts, changed scientific bindings and failed checks preserve the serving release.
