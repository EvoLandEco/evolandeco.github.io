# ATLAS browser transport

## Transport versions

The UI requires browser transport 0.3.0, site contract 1.8.0 and metrics 0.4.0. Its byte-preserved producer runtime, declarations and selector live in `atlas-vendor/browser/0.3`. Core, map core, detail index, detail partitions and producer handoff must agree with this transport version. The handoff envelope is version 0.1.0.

Measurement summaries carry `qualifier`, including strict, inclusive and approximate bounds. Summary figures and detail views use the same value formatter. No executable asset is fetched for execution; the manifest must match the bundled runtime. Other transport versions and releases without browser transport are rejected before dataset downloads.

Consumer compatibility does not authorize publication. Final adoption requires exact scientific source bindings, reconstruction, every-record selection parity, matching analysis assets and publication authorization. The publication target remains pinned independently in `atlas-hosting.json`.

The browser needs a compact selection index and independently loaded evidence details. The scientific export remains the reconstruction authority. This transport preserves its identities, values, review states, source quotations and eligibility rules; it changes storage and retrieval only.

## Source and projection study

The public release pointer inspected on 2 October 2026 identifies export `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`, site contract 1.5.0 and selector `80f15b7fda19c2fd1aed5d92a6317733fe5b69aa66c5fa0e386b403a61b21e0c`. The local source files passed byte count and SHA-256 checks against that pointer.

| Asset | Published bytes | SHA-256 |
| --- | ---: | --- |
| atlas-site.json | 295,294,778 | e38711ca76cd622cad2c669e9f1bb7f2a23c57b9e9725e741eae19745627a91d |
| map.json | 15,521,467 | 2822e2d86308ff6c52d5c78ef4f85ee28e907f0690f344688ddd2519feaa2f6b |

The projection study contains **17,560,654 bytes of selection and display data**, plus **2,479,274 bytes of map metadata, links and assessments**: **20,039,928 bytes in total** before compression. It retains complete One Health items and places, plus reviewed series metadata without the quotation payload. Manifest and detail lookup overhead are outside this total. These are native `JSON.stringify` UTF-8 sizes from the profiling script, not release asset sizes or a memory measurement. The bound producer candidate below has its own exact bytes and validation receipts. The study's table encoding passes a round trip comparison with every projected source row; full selector parity and reconstruction are separate checks.

Run the profile with verified local files:

```sh
node scripts/profile-atlas-dataset.mjs \
  --bundle /tmp/atlas-032-site.json \
  --map /tmp/atlas-profile-map.json \
  --release /tmp/atlas-profile-current.json \
  --out /tmp/atlas-dataset-display-profile.json --display-core
```

The full measured breakdown is in [the display core profile](evidence/dataset-display-profile-2026-10-02.json). A smaller selector projection measures 14,196,458 bytes in [the projection profile](evidence/dataset-profile-2026-10-02.json), but requires separate loading of One Health labels and display fields. The chosen display core avoids that extra boundary.

| Collection | Rows | Compact bytes |
| --- | ---: | ---: |
| Source evidence | 51,775 | 77,980,881 |
| Metric measures | 17,640 | 73,392,399 |
| Assertions | 31,850 | 23,146,770 |
| Unreviewed metric series | 12,472 | 15,918,934 |
| Metric findings | 6,708 | 10,903,108 |
| Metric panels | 5,750 | 3,959,068 |
| Reviewed metric series | 64 | 2,128,051 |

Evidence and metric references contain 84,852 quotation occurrences but 7,846 distinct strings. Their string values occupy 72,911,301 bytes; distinct strings occupy 9,180,958 bytes. Sharing identical text storage can remove 63,730,343 bytes of repeated string payload. Each evidence occurrence must retain its own identity, document, offsets and review links. Equal text does not imply independent evidence or the same assertion.

## Assets and bindings

Use a versioned `browser` descriptor on the release with the SHA-256 and uncompressed byte count of its manifest. The manifest binds the source export ID, site and map file hashes, embedded metric identity, scientific contract version and trusted browser selector hash. Its `source.metrics_sha256` matches `snapshot.metrics_sha256`, which is distinct from the standalone `metrics.json` download hash. It lists every immutable core and detail asset with a hash and byte count. No asset may mix source releases.

The asset groups are:

1. `core`: selection indexes, figure values and the fields below.
2. `map-core`: `tracks`, `map_links`, `relationships`, and map `records` without `claims`.
3. Document detail partitions: complete assertions, complete measures, evidence occurrences and map claims. Ownership follows explicit document references, never a geographic or disease label.
4. Reviewed series detail partitions: complete series metadata and method evidence, addressed by `series_id`.
5. Reconstruction partitions: all source fields outside the browser projections, including metric findings, metric records, series contexts, panel metadata and export metadata. The complete scientific downloads remain available.

Every partition carries its source export ID. The manifest declares collection counts and the partition inventory; the detail index binds each collection's stable IDs and source array ordinals to their partitions. Preserve source array order during reconstruction. A multi-document item has one declared owner and all its original support references; its supporting documents remain discoverable from the index. Do not duplicate a full item in several partitions without a manifest rule that proves their equality.

Checksums apply to exact uncompressed bytes before parsing or rendering. A missing, truncated, corrupt or mismatched partition is a load failure, not an empty observation set. Publication must validate all referenced assets before exposing the manifest through the release pointer. Keep executable selectors pinned in the website.

## Core table representation

Each named table has fixed `columns`, one `encoding` entry per column, and ordered `rows` of tuples. The schema fixes those columns and encodings; the decoder must reject unexpected columns, short rows, invalid references and unknown versions.

- `string`: an integer into the core's exact `strings` array, or null where the field permits null.
- `strings`: an ordered array of string indexes. Preserve order and repeated members.
- `eligibility`: an integer into `eligibility_record_sets`. Each entry is an ordered array of record string indexes. The schema declares the unchanged rule `all_supporting_records_in_window` and partial behavior `hide_relationship_keep_visible_assertions`.
- `json`: the exact scalar, array or structured field. Numbers retain their source precision; null, zero, false, unknown and negative findings remain distinct.

The measured dictionary contains 142,445 strings using 7,285,404 bytes and 2,116 eligibility lists using 14,992 bytes. The transport is a set of named scientific tables, not an encoding for arbitrary JSON. Nested fields without a declared table encoding retain their original JSON values.

Decode each table once into its compact typed summary rows, sharing dictionary string values, then release the encoded tuple arrays. Retaining the tuples directly is also valid when the selector consumes them. Keep one representation; do not reconstruct the full scientific bundle in the browser. Store the current selection separately from detail payloads so cache eviction cannot reset user choices.

## Exact field projections

Fields in each row below retain their source spelling and meaning. Fields absent from these projections remain in complete detail or reconstruction objects. Use distinct core summary types; do not cast them to full `AtlasMeasure`, `AtlasAssertion` or `AtlasSiteBundle` types.

| Table | Core fields |
| --- | --- |
| records | id, document_id, topic_id, channel_id, capture, publication, location_membership_ids |
| topics | id, label, place_ids |
| places | Complete `AtlasPlace` rows |
| location_memberships | id, record_id, area_code, role, eligibility |
| relationships | id, from_place_id, to_place_id, eligibility |
| disease_reviews | record_id, disease_ids, kind, eligibility |
| assertions | id, record_id, measure_id, eligibility |
| comparisons | id, kind, status, participant_ids, lineage, eligibility |
| one_health_reviews | Complete `AtlasOneHealthReview` rows |
| one_health_nodes | Complete `AtlasOneHealthNode` rows |
| one_health_relations | Complete `AtlasOneHealthRelation` rows |
| one_health_timings | Complete `AtlasOneHealthTiming` rows |
| one_health_sampling_assessments | Complete `AtlasOneHealthSamplingAssessment` rows |
| one_health_contexts | Complete `AtlasOneHealthContext` rows |
| metrics.panels | kind, id, measure_ids |
| metrics.series | context_id, measure_ids |
| metrics.reviewed_series | Complete `AtlasReviewedSeries` rows except `evidence`; retain `evidence_ids` |

Retain complete `channels`, `organizations`, `documents`, `areas`, `diseases`, `display_groups` and `source_coverage` as declared tables. Retain `snapshot`, `contract_version`, `reviewed_chains`, `metrics.contract_version` and `metrics.coverage`. The small reviewed chain collection is 54,898 compact bytes.

Every One Health date, scope, label, reason, certainty, direction, source wording and sampling field stays in the core. The full source objects support figure, list, table and hover content without additional requests for those fields. Referenced quotations, assertions and full measures use document detail partitions. This preserves open and unknown intervals without inferring a boundary.

Core measures retain:

```text
measure_id context_id label metric value value_status unit observation_date
priority source_id track_id superseded conflict_set geography disease count_kind
period_label source_date_warning publication source_record_id evidence_record_ids
compact_figure_id
```

`geography` and `disease` retain complete status/value objects. `source_record_id` is exactly `source_reference.record_id`. `evidence_record_ids` is the ordered projection of each evidence reference's `record_id`, including duplicates. These lists support the same all-supporting-record eligibility and coverage counts as the complete measure.

### Compact figure identity

`compact_figure_id` is a producer assigned ordinal for exact equality of the pinned selector's ordered `figureFields` values. It is null when the selector's static grouping conditions fail. The prototype has 7,284 distinct identities. The producer must prove that matching identities mean equal canonical field vectors and that equal eligible vectors receive matching identities; do not substitute rounded values, disease labels or epidemiological grouping.

Static eligibility requires reported finite value, a reported non-null observation date, no conflict set and all required fields. **Selection-dependent separation still runs at selection time**: measures participating in an eligible contradiction, different-scope comparison or unresolved association use their individual measure identity even when they share a compact figure identity. Partial selections must retain this behavior. Supersession, latest-date selection, priority sorting and card limits remain unchanged.

The canonical vector is:

```text
label metric value value_status unit count_kind case_class date_basis period_start
period_end case_definition population stratum denominator denominator_status
qualifier origin_authority disease pathogen host geography acquisition
transmission_role as_of period_label denominator_population ratio_basis
cumulative_baseline track_id review_status observation_date
observation_date_status source_date_warning
```

Nested object keys are sorted recursively, arrays retain their order, and scalar values retain their exact meaning. The complete fields remain in each measure's detail object.

## Consumer loading boundaries

| Consumer | Eager data | Detail trigger |
| --- | --- | --- |
| Globe, reporting filters and network statistics | Core identities, geographic memberships, relationship eligibility and map links | Open source or assessment details |
| Reports chronology | Documents, record indexes, comparison category/status and measure summaries | Expand a report; load its complete map claims, measures, assertions and referenced evidence |
| Trends | Measure summaries, series membership, reviewed connections and chain metadata | Select a series or open measure/method details; resolve all displayed evidence before rendering it |
| One Health Overview, selectors and figures | Complete One Health items, places and reviews | Load referenced measures, assertions and evidence for the selected item, including cross-report support |
| Analysis and report risk controls | Complete verified Intelligence export and small source indexes, bound to the same scientific release | Intelligence loads during page startup so report risk controls have matching analysis data; entering Analysis does not initiate its dataset fetch |

`visibleMeasure` and Trends coverage use the core evidence record lists. `MeasureDetails`, report bodies, comparison evidence, chain evidence and One Health detail components require complete objects from the detail store. They must not render absent prose as an empty value. Reports and geographic assessments also read `map.records[].claims`, so map detail loading must cover those readers.

Fetch each immutable partition once per active request, cancel obsolete loads, and bound retained detail bytes. Pin partitions backing visible content and its explicit supporting evidence. Eviction may remove unused decoded details; it must not alter eligibility, selection, counts, pagination or saved interaction state. Browser or HTTP caches can retain compressed immutable responses without keeping every decoded object resident.

## Producer acceptance and adoption

The producer supplies the transport schema, exact types, trusted selector, source-bound manifest, partition inventory, reconstruction validator and compatibility fixtures. Keep the scientific export untouched during transport preparation.

Required checks are:

1. Reconstruct every full source collection and metadata field from core/detail/reconstruction assets. Compare exact scalar values, object members, stable IDs and array order with the reviewed source export. Check every declared source byte hash independently.
2. Compare complete hydrated selection results with the pinned selector for the full window, every record alone, representative partial support sets, source/place/disease combinations, empty selection, capture/publication bases and knowledge cutoffs.
3. Check contradictions, corrections, supersession, different-scope and unresolved comparisons under complete and incomplete support; verify compact figure equality and ordering for every resulting panel.
4. Compare One Health node/relationship membership, undated partitions, panel availability, fraction eligibility, review coverage, connected components, Overview evidence ranks and sorting. Include unknown and negative findings and open intervals.
5. Check detail references across documents and series, duplicate IDs, missing references, altered bytes, source mismatch, aborts and cache eviction followed by reload.
6. Measure actual parse time, resident memory, first view, interaction latency and rendering on the connected iPhone and a constrained desktop profile. The measured 20.0 MB prototype is a transport size estimate, not proof of these runtime requirements.

A candidate must pass both producer integrity checks and consumer parity, interaction and memory checks before adoption. The live release stays bound to its matching analysis assets throughout validation.

## Bound producer candidate

Transport 0.1.0 for the measured source export has manifest SHA-256 `b660d7a7445f697f2fc2c8737b37e531d695ab9deff87f44d50779b337a2c057`. The [stable producer handoff](evidence/browser-transport-stable-handoff-2026-10-02.json) records exact reconstruction and 2,220 selection cases, including every report entry. Its public copy has checksum `cda3c1ac0bf45bb6bfa1eeba3dee6687808c4c6afa609cb7099aef4bde1593e2`. The [producer handoff](evidence/browser-transport-handoff-2026-10-02.json), [reconstruction and selection receipt](evidence/browser-transport-validation-2026-10-02.json), [exhaustive selection receipt](evidence/browser-transport-exhaustive-validation-2026-10-02.json) and [size measurements](evidence/browser-transport-measurements-2026-10-02.json) provide supporting validation and measurements. The public handoff copies use portable file names and serve as evidence summaries; publication requires the producer's local receipt.

The exact core and map core total **20,039,058 bytes** before compression. This excludes the manifest, lazy detail index and independently loaded Intelligence asset.

| Asset | Bytes before compression | Loading boundary |
| --- | ---: | --- |
| Manifest | 870,451 | Release load |
| Core | 17,559,669 | Release load |
| Map core | 2,479,389 | Release load |
| Detail index | 7,226,177 | First detail request |
| Detail partitions | At most 2,000,000 each | Requested entities and their supporting evidence |

The release descriptor is `{ "transport_version": "0.1.0", "manifest": { "sha256": "…", "bytes": 870451 } }` under `browser`. Its directory is `releases/<export_id>/browser/<manifest_sha256>/`. The manifest fixes 453 detail partitions and binds their exact bytes. The detail index maps each source collection's ordered `[id, partition_ordinal]` tuples to the partition path array. Tuple position is the source row ordinal; null IDs remain addressable by ordinal. Partition rows carry `collection`, `ordinal`, `id` and the complete source `value`.

The bundled runtime files are byte identical to the producer candidate. Their hashes are pinned by `browserSelectorHashes` in `src/lib/atlas-release.ts`. `browser_transport.d.ts` is a byte identical copy of `browser.d.mts` so TypeScript resolves the runtime's declarations.

`src/lib/atlas-browser.ts` verifies the manifest and assets, then exposes an entity lease interface. `acquire()` accepts typed collection and ID or ordinal references; `get()` returns only entities requested by that lease. Missing entities, corrupted bytes, wrong source identities and unrequested reads throw errors. Concurrent readers share downloads. Cancelling one reader leaves other readers intact; cancelling the last reader aborts its request. Visible leases pin their partitions. Releasing a lease makes its partitions eligible for eviction under the 32 MiB uncompressed retention budget. A set of visible details can exceed that budget until its leases are released. The detail index is retained separately and reported in cache diagnostics.

Focused consumer tests cover these boundaries and exercise verified core decoding, full measure and map claim retrieval, and reviewed series evidence hydration against the producer candidate. Run them with:

```sh
ATLAS_BROWSER_CANDIDATE=/path/to/browser-assets \
ATLAS_RELEASE_FILE=/path/to/current.json \
node --import tsx --test tests/atlas-browser.test.ts
```

The local candidate test requires both paths; synthetic cache and integrity tests run without them. Browser interaction, resident memory and HTTP compression checks remain separate acceptance checks.

## Measured desktop loading

The [load comparison](evidence/atlas-load-comparison-2026-10-02.json) uses three fresh Chromium contexts per transport on an Apple M4 Max, with 4× CPU throttling, reduced motion and precompressed assets served over loopback HTTP. Both transports load the same scientific release and matching Intelligence export. Values below are medians; MB uses decimal bytes. The [compact run record](evidence/atlas-load-compact-2026-10-02.json) contains the machine settings and individual samples.

| Metric | Full scientific archives | Compact browser transport |
| --- | ---: | ---: |
| Page ready | 11.830 s | 2.558 s |
| Startup JavaScript heap | 159.9 MB | 70.4 MB |
| Startup CDP backing storage | 343.6 MB | 35.4 MB |

These browser memory categories do not measure total device RAM, process memory or GPU memory. Loopback delivery excludes internet latency, and CPU throttling does not reproduce a physical iPhone. Panel timings include concurrent detail work and are not isolated rendering measurements.

## Additive publication

`scripts/publish-atlas-browser.ts` accepts a content-bound publication plan. Its `atlas-browser-publication/1` schema records the destination and bucket, approval state and instruction, the exact source release, stable producer handoff, the four scientific source files, and the browser manifest. Each file reference contains its local path, byte count and SHA-256. The handoff must declare `producer_ready`, reconstruction, pinned selector parity and every-record validation as true, and `source_files_compared` must contain `site` and `map` in that order. Its browser descriptor binds the directory, manifest and complete source identities. Local bundled runtime and type bytes must match the browser manifest.

Run from `site/`:

```sh
node --import tsx scripts/publish-atlas-browser.ts --authorization /path/to/plan.json
```

The default command validates local files and performs no network requests. `--stage` requires `approval_status: approved`, takes the shared `.cache/atlas-sync/lock`, checks the exact public source pointer, and stages immutable gzip objects with public byte and checksum verification. Its complete release descriptor is stored beside the browser manifest. `--activate` performs those checks and attaches the browser descriptor to `current.json` after a second exact pointer comparison. Every other release field, including analysis descriptors, remains intact. Publication does not rewrite the scientific assets or their immutable release descriptor.

The Worker permits only the declared browser asset names and numbered detail partition paths. Public verification rejects absent, mismatched or uncompressed assets. A 429 response stops the command with the server's retry interval; `--read-interval-ms` can space requests to match the deployed read policy. The command does not change the rate limit. This candidate has 464 browser assets including its manifest. Its document partitions have a median of one, a 95th percentile of two and a maximum of three per document; these counts describe potential requests before cache reuse and cross-document support.

The [navigation request capture](evidence/browser-request-budget-2026-10-02.json) counted 31 ATLAS service requests for a full visit and 24 report openings across two pages: five startup requests, one detail index and 25 distinct detail partitions. Of those, 29 use browser transport paths and two use the current pointer and Intelligence paths. At this request rate, rapid browsing across six report pages can exceed a shared 60-request minute. The Worker assigns validated browser paths a separate `BROWSER_READ_LIMIT` of 120 requests per IP per minute, while the other public paths retain `READ_LIMIT` at 60. This capacity allows several report pages per minute at the observed partition rate. It is a request-budget choice, not a measured gain in loading or rendering speed. Both buckets return 429 before reading R2 when their own budget is exhausted.

## Weekly sync

`atlas:sync` checks the review, production and inbox receipts and validates the canonical scientific export before preparing browser assets. For a new export, it runs the producer's `export_browser_transport.mjs` in a fresh cache directory, followed by `verify_browser_transport.mjs --every-record` against the exact site and map files. It accepts only a ready stable handoff and the pinned browser runtime. These commands prepare and verify transport; they do not run the scientific review jobs or amend evidence.

The sync attaches the verified browser descriptor to the release, uploads the scientific and browser assets, and checks public gzip delivery and checksums. The final handoff, ledger, job receipts and public pointer comparison gate publication. The entire operation uses the sync's single writer lock. `--stage-only` retains the same browser descriptor and handoff reference in its receipt. An unchanged published export exits before transport generation. Failed compatibility, verification, authentication or read-limit checks leave the public pointer intact.
