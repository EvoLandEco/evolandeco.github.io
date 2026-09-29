# ATLAS UI 0.2.0 push checks

The website passes its production checks. Dataset activation follows website deployment so the public page can read contract 1.5.0. The approved network analysis is publicly staged and verified.

## Validation

- Repository lint passes.
- Unit tests: 59 passed; two tests requiring separate private checkpoints skipped.
- Production build: 445 static pages; TypeScript passes.
- Static export: local HTML links and assets resolve.
- GitHub Pages browser gate: all five cases pass against the production export, covering entry, mobile themes, retry and combined filters.
- Native public downloads pass with both the live 1.2 release and the staged 1.5 release. The 1.5 smoke check covers One Health Network, Overview, Timeline, Sampling and Environment. Neither run emits page errors.
- The production export loads the public network transport and analysis with HTTP 200. The review shows 197 → 135 statement units and 197 of 197 inspected statements, with no page errors. Only the release pointer is substituted for this browser check; asset downloads use the public service.
- Production JavaScript contains no local dataset origin.
- Worker route checks and deployment dry run pass. The network uploader passes local byte, schema and release-binding checks in dry-run mode.
- `git diff --check` passes.

## Public data

The active pointer is contract 1.2.0, export `0684e4d4a7d0d3fab5fcb5912a0f9dcea1eae59e101f95da74d70f1477380c92`.

The release-ready partial 1.5.0 dataset is staged as `84af1f2142e037519b457c5e192d3cd2c06275b79922420cebf01288c7696b3f`. Independent public downloads of `atlas-site.json`, `map.json` and `metrics.json` match all byte lengths and SHA-256 values in its sealed receipt. Its publication remains a research preview with incomplete One Health review coverage.

The inspection checkpoint `9d712c4f57ee47774b0dc69931594bf1ef6b5813429211faddf304351824b2af` is local. It contains 122 integrated annotation entries and 2,086 integrated scope reviews. Remaining annotation integration and release audits are unfinished. It is not the activation candidate.

Reviewed network analysis `e3f9e9eebc37fb083be669beef930968527ca12a8d6cbe0dcf9796906832d888` binds to release `84af1f…`. Its six public assets comprise the transport descriptor, analysis, analysis schema, coverage ledger, pinned selector and attached release descriptor. Every public download matches its expected byte length and SHA-256 value. The user explicitly authorized these public files; dataset activation is separate.

## Data service and producer

The read-only Worker version is `08ea0bee-c685-4083-8b13-efbf5936ec1f`. Its allowlist covers published datasets, selectors, release descriptors and network-analysis assets. Compression, conditional reads, CORS, method restrictions and rate limiting pass checks. Public `current.json` is unchanged after deployment.

ATLAS reports a clean producer checkout at [161cd0b](https://github.com/EvoLandEco/ATLAS/commit/161cd0b88caf14feb038b14bddc1381cfb46c5ea), alpha28, with 266 tests and exact network replay passing. [GitHub CI](https://github.com/EvoLandEco/ATLAS/actions/runs/36574079077) passes. One Health extraction remains paused.

## Publication order

1. Keep the inspection checkpoint local until its release audits pass.
2. Manually commit and push the website, including the Worker route checks and uploader source. Private exports and upload receipts stay outside the commit.
3. Wait for GitHub Pages, then verify the deployed page accepts contract 1.5.0 and its pinned selector.
4. Activate the exact approved dataset descriptor and verify One Health and network review through the public page.

A website push does not change the dataset pointer. The website has not been pushed by these checks.
