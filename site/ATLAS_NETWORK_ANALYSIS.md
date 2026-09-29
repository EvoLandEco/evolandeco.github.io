# Network analysis and UI acceptance

The country summary describes the selected reporting network. Each distinct map link contributes one unit. Most linked country and Most repeated pair combine reported movement and shared events; Top movement destination counts only incoming directed movement. Movement statements can describe people, products, vessels or other transfers; they do not all represent living travellers. These counts are unadjusted. They do not measure incidence, importation risk or vulnerability.

## Scientific basis

1. Barrat A, Barthélemy M, Pastor-Satorras R, Vespignani A. The architecture of complex weighted networks. *PNAS*. 2004;101:3747–3752. [doi:10.1073/pnas.0400087101](https://doi.org/10.1073/pnas.0400087101). Defines weighted network strength; it does not correct reporting bias.
2. Jones KE et al. Global trends in emerging infectious diseases. *Nature*. 2008;451:990–993. [doi:10.1038/nature06536](https://doi.org/10.1038/nature06536). Studies emergence events with reporting-effort adjustment. Its event definition and observation process differ from ATLAS reporting links.
3. Allen T et al. Global hotspots and correlates of emerging zoonotic diseases. *Nature Communications*. 2017;8:1124. [doi:10.1038/s41467-017-00923-8](https://doi.org/10.1038/s41467-017-00923-8). Constructs a reporting-effort measure and models zoonotic emergence. It supports analysing ascertainment explicitly, not interpreting raw report counts as risk.

These papers motivate the analysis requirements. They do not validate an ATLAS adjustment or country ranking.

## Producer analysis

ATLAS owns evidence extraction, episode identity, coverage measurement, model fitting and validation. The website presents validated exports and their interpretation limits.

- Map supporting records and relationships to reviewed episodes and journeys. Record source lineage, unresolved identity and deduplication decisions. Country pairs and similar dates alone do not establish episode identity.
- Describe the sampling frame and collection pipeline by source, geographic scope, topic and period. Record discovery, retrieval, parsing, extraction and review eligibility and completion, with exclusions, failures and unknowns. A complete local collection does not imply complete surveillance.
- Separate three targets: distinct observed episodes, collection-adjusted reporting connectivity, and disease occurrence. State which target the available evidence identifies. Do not infer missing events from a lack of documents.
- Assess independent effort measures and valid denominators before selecting an adjustment. Dividing by observed country report totals is not, by itself, a bias correction. Report assumptions, sparse support, missingness and dependence between sources.
- Compare raw and episode-based results; test source, time and topic sensitivity. Any fitted adjustment needs validation, uncertainty and ranking stability using units that respect repeated observations of the same episode. Report unavailable estimates with reasons when identification or validation fails.

The recurring workflow must record input hashes, method version, software version, reproducible commands, model settings, seeds where used, tests and validation results. Reuse reviewed evidence and distinguish additional source work from analysis of existing records. Preserve immutable releases and quota limits.

## Export requirements

Agree the versioned schema with the website before implementing its reader. Keep the analytical asset compact and separate from map geometry and report bodies.

The export must identify the data release, analysis method, target quantity, units and adjustment status. Include eligible countries and pairs, raw counts, supported adjusted estimates, uncertainty definition and bounds, review/validation status, coverage, exclusions, missingness, evidence IDs, citations and provenance. Distinguish an unsupported estimate from a measured zero.

Every estimate must declare its supported date, topic, source and relationship-type scope. Arbitrary UI filters cannot reuse a global fitted estimate as though the model were fitted to that subset. Supply supported scope keys or validated rules for selection and aggregation. Uncertainty intervals and nonlinear estimates must not be summed by the UI without a producer-defined method.

## Acceptance

- Schema and release checks pass; evidence references resolve.
- Duplicate reports do not inflate episode counts; distinct reviewed episodes remain distinct.
- Direction, relationship type, geography, ties, unknowns and empty selections have executable checks.
- Adjusted labels match the exact correction performed. Deduplication and collection coverage alone cannot justify a surveillance-adjusted claim.
- Model diagnostics and sensitivity results support the stated interpretation. The display does not force a unique winner where ranking uncertainty is unresolved.
- Filter changes select a matching analysis scope or state that the estimate is unavailable. Raw counts remain explicitly identified.
- The methods dialog exposes definitions, adjustment status, limitations and paper references.

Production activation is separate from local analysis and UI validation.

## Consumer reader

A release can declare `network-transport.json` in its asset manifest with an exact byte length and SHA256. The methods dialog loads this descriptor on opening; releases without it make no analysis request. The descriptor must match the active release, site, map and selector. Analysis paths stay under the trusted dataset origin. The consumer pins the reviewed schema hash, verifies asset bytes and validates the fields used by the display. Complete scientific validation belongs to the producer replay.

Contract 0.2.0, method `reporting-network-3`, describes a research preview. Its review groups display only when every member relationship and all supporting records are eligible under the reporting filters. Partial membership does not trigger a correction. The methods dialog separates source assessment, repeat-report membership and unresolved identity. It shows partial statement counts and source lineage; the country summary retains raw ranks. Movement categories distinguish living travellers, products, human remains, vessel itineraries, shared events and unresolved subjects. These categories do not turn statements about groups of travellers into counts of individuals. Collection and surveillance adjustments and dataset-wide corrected rankings are unavailable in this contract. Unestimated uncertainty is not a zero-width interval.

Local attachment uses a separate serving descriptor and does not alter sealed dataset files. Production attachment requires its own publication decision.

## Staging reviewed files

`scripts/stage-atlas-network.ts` takes `--candidate`, `--release` and `--authorization`. The release argument names the sealed staging receipt. The authorization names the exact analysis and site release IDs, the authorizing thread and instruction, `scope: "stage_only"`, and `approval_status: "approved"`. `--dry-run` validates the local files without uploading them.

The command verifies the reviewed contract, input bindings, selector and file hashes. It uploads absent immutable objects and checks public readbacks; existing objects must match. Its serving descriptor is `releases/<export_id>/release.json`. It never writes `current.json`. Activation requires the compatible website deployment and a separate publication action.
