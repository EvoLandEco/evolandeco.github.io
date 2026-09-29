# One Health visualization research

28 September 2026. Targeted literature and data review for ATLAS UI. The recommendations are design proposals, not findings established by the cited papers. The literature selection emphasizes major research journals, the Lancet Commission and operational surveillance guidance; it is not a citation ranking or systematic review.

## Purpose

The tab should help an investigator answer four questions: what was observed in each domain, what connects those observations, what evidence supports each connection, and what remains unknown. Surveillance users also need to see which populations and materials were examined, with what methods and denominators. A report-based evidence browser can serve these questions without claiming to be a comprehensive One Health surveillance system.

## Literature that informs the design

| Source | Relevant contribution | Design implication |
| --- | --- | --- |
| [Plowright et al., Pathways to zoonotic spillover, Nature Reviews Microbiology, 2017](https://doi.org/10.1038/nrmicro.2017.45) | Distinguishes the successive processes that permit exposure and infection across a species barrier. | Keep exposure, agent detection, infection and transmission separate. A connection should state which process its evidence addresses. |
| [Eby et al., Pathogen spillover driven by rapid changes in bat ecology, Nature, 2023](https://doi.org/10.1038/s41586-022-05506-2) | Combines 25 years of ecological, behavioural and spillover observations; Figure 2 aligns climate, food shortage and spillover timing. | Use aligned temporal panels when comparable observations and dates exist. Environmental context needs its own measured variables and temporal scope. |
| [Spillover of highly pathogenic avian influenza H5N1 virus to dairy cattle, Nature, 2024](https://doi.org/10.1038/s41586-024-07849-4) | Integrates epidemiology, geography, sample testing and genomic analysis across species and farms. The proposed pathways have differing support. | Make sampling material and host identity visible. Allow users to inspect the evidence behind a route, rather than interpreting a line as sufficient proof. |
| [Djordjevic et al., Genomic surveillance for antimicrobial resistance—a One Health perspective, Nature Reviews Genetics, 2024](https://doi.org/10.1038/s41576-023-00649-y) | Explains the roles of genomic technologies across microbial populations and ecological sources. | A genomic relationship needs its method, resolution and scope. Do not manufacture a phylogeny or transmission direction from a textual statement of similarity. |
| [The Lancet One Health Commission, 2025](https://doi.org/10.1016/S0140-6736(25)00627-0) and its [official programme](https://lancetonehealth.org/) | Frames One Health through human, animal and environmental interdependence, cooperation and equity, extending beyond infectious disease alone. | Present ATLAS's infectious-disease scope clearly. Environmental and animal observations deserve substantive representation rather than decorative columns. |
| [OHHLEP, Developing One Health surveillance systems, One Health, 2023](https://doi.org/10.1016/j.onehlt.2023.100617) | Sets out integrated surveillance and attention to upstream drivers, data requirements and coordination. | Surface review and sampling gaps, and preserve the sources needed for joint interpretation. |
| [EFSA and ECDC, The European Union One Health 2024 Zoonoses Report, 2025](https://doi.org/10.2903/j.efsa.2025.9759) | Categorizes surveillance data by harmonization and comparability; not every collection supports spatial or temporal trend analysis. | Counts, positivity and trends must retain their sampling frame, population and denominator. Separate incomparable sources. |
| [Sikkema and Koopmans, Viral emergence and pandemic preparedness in a One Health framework, Nature Reviews Microbiology, 2026](https://doi.org/10.1038/s41579-025-01243-1) | Reviews drivers of emergence and the integration of surveillance and intervention approaches. | Treat a driver panel as an analytical addition that requires contextual data, not as an inference from report frequency. |

## What the local export supports

Inspected export: `deb479877652f3260444d0a499c17bf4b3ab8cf1950b0bc7e1c0c8e5e46b5409`, site contract 1.4.0.

- 264 observations: 120 animal, 76 human, 61 environmental and 7 food.
- Observation scope: 155 episode, 89 surveillance and 20 background.
- 60 relationships: 24 exposure, 29 environmental association, 5 genomic association and 2 vector involvement. None has the reviewed cross-species transmission kind.
- 47 relationships are source reported and 13 are source hypotheses. Only one has an exported direction.
- 175 observations have an unknown date basis; 69 use a reporting cutoff. The remaining 20 use collection, diagnosis, notification, onset or test-result dates. A date basis does not itself guarantee a complete exact date.
- 49 observations have an explicit observation date; 7 have a period start and 40 a period end. These fields overlap and must not be summed as distinct observations.
- 176 observations reference places. Geographic precision must be read from the places; a country reference is not a sampled site.
- 80 observations reference quantitative measures. There are 162 distinct linked measurements, only 17 with a numeric denominator. A denominator alone does not establish a valid positivity calculation.
- Sampling metadata is sparse: sample unit on 24 observations, sampling frame on 51, collection method on 5 and test method on 11.
- Eleven observations record an agent not detected. These are bounded negative findings, not proof that a population or region is free of infection.

These counts describe exported evidence, not incidence, prevalence, species richness or surveillance sensitivity.

## Priority 1: improve the evidence network

Retain the domain columns and the compact figure/details layout. The primary change is semantic clarity.

1. Put an entity name beside every node: host, population, specimen or material. Keep numbers as reference markers. Generic labels such as “Detected” do not identify what a node represents; essential identity must remain visible without hover. Use source wording or a reviewed short label.
2. Show finding as a separate small marker or label: infection reported, agent detected, exposure reported, not detected, context or unresolved. Keep domain shape and colour consistent; do not turn the entire negative node into a danger signal.
3. Give edges short relationship labels, such as “reported consumption”, “genomic association” or “environmental association”. Preserve direction only where exported. Keep relationship kind distinct from whether it is source reported or a hypothesis.
4. On node hover or focus, emphasize its neighbours and show the concise infocard. On edge hover or focus, identify both endpoints, the relation, evidence types and the main uncertainty. Clicking pins the complete source details. Keyboard focus and touch selection provide access to the same information.
5. Use deterministic column routing with separate connected groups and sufficient spacing for labels. Shared location, pathogen name or report membership must not create edges. Avoid force-layout animation, moving beams and line width that suggests an unmeasured flow.
6. Separate episode evidence, surveillance summaries and background context visibly. Background material can sit in a context disclosure rather than becoming a peer in an apparent event chain. Preserve every observation in the accessible list.

For the sprout investigation, the diagram should let a reader identify interviewed people, seed or sprout material, irrigation water, process-water isolates and human isolates directly. The five main evidence questions differ: reported consumption, contamination detection, genomic relatedness, source hypothesis and missing lot or timing information. A uniform chain of numbered “Detected” nodes obscures those distinctions.

## Priority 2: relationship evidence matrix

Rows represent the selected report's exported relationships. Columns represent exported evidence types, such as epidemiological investigation, genomic analysis, environmental testing, human testing and source assessment. Cells indicate that evidence is cited, not that it independently proves the relationship. Clicking a cell opens the exact source passages. A small adjacent label identifies source hypothesis or source reported, direction and stated uncertainty.

This is useful to investigators deciding what supports a proposed connection and what investigation is still needed. It is feasible with current `evidence_types`, `evidence_ids`, `basis`, `direction_basis`, `source_certainty` and `uncertainty` fields. An empty cell means no evidence of that type is recorded for this relationship. It must not mean that the evidence contradicts the claim or that testing was negative. Contradiction and explicit non-investigation need separate exported states.

Offer Network and Evidence as two views of the same selected report. Both share selection and the source panel, so the compact layout does not become a wall of charts.

## Priority 3: report and domain overview

Use a small matrix whose rows are report entries and columns are People, Animals, Environment and Food. Each cell can show the recorded finding types, with a distinct review-state indication. It answers which entries combine domains and where the exported review is partial or absent. Selecting a row opens that entry's network and evidence.

The grouping unit must stay explicit. Counts of observations from repeated reports are not counts of independent events. Across-report episode grouping requires a reviewed episode identifier and continuity decisions. A Venn diagram conceals these differences; an evidence matrix handles absent, unreviewed, negative and mixed findings more clearly.

## Priority 4: dated evidence view

An aligned timeline can place one lane per domain, with points for exact dates, spans for reported intervals and a separate undated area. Reporting cutoffs and publication dates need distinct symbols or a separate strip. They must not stand in for exposure, collection or onset dates. Existing relationships can appear on selection without introducing temporal connections.

This is feasible for the dated subset, but the current missingness makes it unsuitable as the universal default. Do not calculate a detection lead time between domains without comparable collection or onset definitions, evidence of the same episode and an appropriate ascertainment context. The Hendra study demonstrates the value of aligned observations, not permission to infer drivers from sparse bulletin dates.

## Later: sampling and geographic views

A sampling table or small set of plots could show tested and positive units by host and material, with method, location and period. Show numerator and denominator together. Keep people, animals, herds, specimens, pools and food batches separate. Plot a proportion only when the numerator and denominator refer to the same defined frame, period, unit and outcome. Confidence intervals additionally require a defensible sampling model; do not add binomial intervals to clustered or pooled data by default.

A synchronized map can help when an investigation has meaningful geographic variation. Distinguish sample sites from country reference locations, retain unlocated observations and link to evidence. Avoid heat maps of “risk” based on report counts. Maps should support the network or timeline, not displace an informative relationship with a country centroid.

Environmental drivers and intervention timelines are valuable research directions. They need explicit measured variables, location and temporal linkage, exposure definitions, intervention dates and provenance. Land use, animal density, precipitation, temperature, vector abundance and occupational exposure cannot be recovered simply by relabelling existing context nodes.

## Export priorities

1. Reviewed short labels, stable entity identifiers, and reviewed episode membership across reports; keep duplicate reports and distinct observations identifiable.
2. Sampling unit, tested and positive counts, denominator population, sampling frame, method, pool or herd structure, and collection period. Preserve missingness reasons.
3. Date kind, precision, interval bounds and source evidence for each date. Keep observation, reporting cutoff, publication and capture dates separate.
4. Relationship evidence with explicit support, contradiction and unresolved status, including the scope of each statement. Keep source confidence separate from curator review status.
5. Genomic method and comparison metadata: isolate identifiers, typing scheme, thresholds, distances, analysis provenance and any reviewed tree. Similarity alone supplies neither transmission direction nor a missing intermediary.
6. Place precision and role, such as sampled site, exposure location, residence or reporting jurisdiction. Add measured environmental covariates and interventions only with explicit evidence and linkage.

The first implementation should improve the network and add the relationship evidence matrix. Follow with a report/domain overview. Introduce timelines and sampling plots where the data passes those views' eligibility rules. Render only the active view, cache layout and indexing by selection, and use interaction-driven highlighting rather than continuous animation.
