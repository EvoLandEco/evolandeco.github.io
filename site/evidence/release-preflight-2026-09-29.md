# ATLAS UI 0.2.0 release checks

The public website serves the partial One Health research dataset and its matching reviewed network analysis. Incomplete annotation coverage is accepted for publication; source support, export integrity and consumer compatibility remain required.

## Validation

- Repository lint passes.
- Unit tests: 59 passed; two tests requiring separate private checkpoints skipped.
- Production build: 445 static pages; TypeScript passes.
- Static export: local HTML links and assets resolve.
- GitHub Pages browser gate: all five cases pass against the production export, covering entry, mobile themes, retry and combined filters.
- The deployed website accepts contract 1.5.0 and the pinned selector. One Health Network, Overview, Timeline, Sampling and Environment render without page errors.
- A direct public browser check, without request interception, verifies the active export, populated sampling and timeline views, and the network review showing 197 → 135 statement units.
- All nine published dataset and network assets pass byte-length and SHA-256 readback checks. The active pointer matches the verified serving descriptor.
- Production JavaScript contains no local dataset origin.
- Worker route checks pass. Compression, conditional reads, CORS, method restrictions and rate limiting pass checks.
- The consumer validates measurements, source references, assertions, comparisons and bundle checksums. Producer checks cover baseline preservation, date selection, exact network dependency reuse and replay across 184 scopes.
- `git diff --check` passes.

## Public data

The active pointer serves contract 1.5.0, export `9d712c4f57ee47774b0dc69931594bf1ef6b5813429211faddf304351824b2af`, on [ATLAS](https://qtj.me/atlas/).

The partial dataset contains 442 One Health observations, 70 relationships, 91 sampling assessments, 343 timing records and 400 context records. It retains research preview status and incomplete review coverage. The sealed checkpoint integrates 122 annotation entries and 2,086 source scope reviews; these counts describe separate review activities. Exported review records number 1,340.

Saved annotations outside this checkpoint remain excluded. An attempted integration failed numeric source validation for a reported farm proportion. That failure does not invalidate the sealed checkpoint or require completion of the remaining scan before publication. Unreviewed entries are not evidence of absence.

Reviewed network analysis `0d462448b48427c08c52d10b4d030f0b3c4962e6d9573e3e0e4a342116c9146b` binds to this exact dataset, map and selector. Exact replay retains 197 inspected statements, 28 repeat-report groups and 135 partially deduplicated statement units. Global adjusted rankings remain unavailable. The published files comprise the base dataset, map, metrics, network transport, analysis, schema, coverage ledger, selector and release descriptor.

## Data service and producer

The read-only Worker version is `08ea0bee-c685-4083-8b13-efbf5936ec1f`. The public pointer is activated only after deployed consumer compatibility and public asset checks pass.

ATLAS source alpha28 is published at [161cd0b](https://github.com/EvoLandEco/ATLAS/commit/161cd0b88caf14feb038b14bddc1381cfb46c5ea), with 266 tests and [GitHub CI](https://github.com/EvoLandEco/ATLAS/actions/runs/36574079077) passing. Candidate preparation and network replay use saved evidence without further model calls. One Health extraction remains paused.

The website and dataset are live. Generated datasets, raw sources, private queues and publication control files stay outside the website source commit.
