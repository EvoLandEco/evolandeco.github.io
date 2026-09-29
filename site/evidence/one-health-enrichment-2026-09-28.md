# One Health enrichment and review scope

28 September 2026. The target collection contains 2,098 report entries. The adopted contract 1.4.0 candidate is `deb479877652f3260444d0a499c17bf4b3ab8cf1950b0bc7e1c0c8e5e46b5409`.

## Source reuse

The candidate has 264 One Health observations and 60 relationships. Forty-nine observations have an explicit date, but reporting cutoffs, notification, onset, collection and results have different meanings. Source-bound notes already preserve several dates for some observations. These notes are material for producer review; the UI does not parse them into events.

There are 162 distinct measurements linked to One Health observations, of which 17 carry numeric denominators. Many describe recovery, exposure, hospitalization or case fatality, not testing. The Sierra Leone ulcer investigation includes 96 positive human lesion samples among 209 tested and zero positive environmental water samples among 11 sampled sources. Sampling method and period still require source review. Negative poultry samples must remain a negative count unless the tested population and positive outcome are explicitly established.

Environmental observations point to captured flooding, complex-emergency, water and sanitation, vaccination and vector-control reports. These can support attributed context and action records after review. They do not establish quantitative environmental driver series or measured intervention effects.

## Producer work

The authorized scope covers the 1,616 unreviewed entries, 54 partial reviews and pending questions uncovered during review. Existing completed and no-relevant-observation reviews require expansion where their stated scope does not address the requested views. Each outcome needs inspected source sections, evidence and provenance. Unavailable material, unresolved interpretation and missing dates or methods remain explicit. A completed review pass is not a claim that every source supplies every field.

ATLAS owns source acquisition, interpretation, annotations, identity decisions, schemas, selectors and export generation. Reuse captured sources and reviewed measurements, review affected dependencies, and produce a separate sealed candidate. Public publication and replacement of the adopted candidate require separate validation and authorization.

## Consumer acceptance

| View | Minimum source contract | Presentation boundary |
| --- | --- | --- |
| Aligned evidence timeline | Typed dates or intervals with precision, uncertainty, source evidence and explicit observation membership; episode continuity only when reviewed | Points for exact dates, spans for intervals, a separate undated area and separate reporting metadata. No implied lead time or connection between unrelated observations. |
| Sampling and positivity | Bound tested and positive measurements with outcome, unit, frame, period, methods and sampling design; eligibility with reasons | Counts remain visible when proportions are ineligible. Pools, people, specimens and herds retain distinct units. No assumed independence, confidence intervals or shared denominator. |
| Environment and interventions | Typed context, measured covariate or action, time and precision, place, source evidence and explicit observation or episode membership | Distinguish attributed context, measured variables, reported actions and evaluated effects. Co-occurrence or chart alignment is not evidence of causation. |

The website requires a versioned schema and selector, declared hashes, source-bound fixtures, partial-window eligibility checks, deterministic export, correction lineage, coverage by view and an exact handoff. Method references remain separate from event evidence. The existing shared reporting controls govern eligibility; there is no second scientific date filter inferred by the UI.

## Producer feasibility decision

ATLAS confirms that no full archive recrawl or digest re-extraction is required. The 1,670 pending entries span 260 documents, with every captured text available. The source worklist contains 6,567,203 characters before grouping and is stored privately at `.local/one-health-panels-20260928/worklist.json` in the ATLAS checkout.

The producer implementation targets site contract 1.5.0 and annotations 1.4.0. Separate timing, sampling-assessment and environmental/intervention-context records reference existing observations, measures and evidence. Report-local observation references support the first views; cross-report episode identities require their own reviewed decisions. The full review pass includes source scope checks and explicit unresolved limitations. Stable schema and selector handoff precedes consumer development; a sealed candidate and validation precede local adoption.

## Consumer schema checks

The 1.5.0 selector is pinned to SHA-256 `80f15b7fda19c2fd1aed5d92a6317733fe5b69aa66c5fa0e386b403a61b21e0c`. Vendored schemas and declarations come from ATLAS. Strict declaration compilation checks the producer's generic panel type separately from the metric panel type.

Synthetic browser fixtures exercise exact, month, year, uncertain and incomplete dates; separate reporting cutoffs; zero positive counts; unresolved sample pairs; and independent context records without observation nodes. Phone and two workspace sizes pass browser and accessibility checks. Synthetic fixtures are test inputs, not scientific data or review outcomes. Source review completion and sealed candidate adoption remain pending.

## Consumer validation

TypeScript, focused ESLint, strict producer declarations and three unit checks pass. The unit checks cover time placement, every pinned selector hash and the adopted private candidate's scientific selection. The isolated production build and static export check pass.

Production browser checks comprise three synthetic analytical-panel checks and eight adopted or legacy dataset checks. They cover phone, regular page, short workspace and tall workspace layouts, light and dark themes, keyboard interaction, accessibility and bounded scrolling. A test fixture must bind each synthetic quantity to an assertion; the selector excludes measurements without eligible assertions. Visual inspection covers date ranges, count tables, independent context and the source panes.

The adopted local dataset remains contract 1.4.0. All three analytical views await the reviewed 1.5.0 export. No deployment, data upload or public pointer change is part of this validation.

Source time carries an explicit point, closed interval, open interval or unknown extent. Open intervals retain their known boundary in the incomplete-date list and never acquire an endpoint from the reporting window. Detection dates remain distinct from collection and test-result dates. Sampling inclusion periods belong to the sampling frame unless the source also establishes an observed event.

A known calendar month or year with an unresolved date kind remains visible in the incomplete-date list. The consumer retains the supplied precision and value without assigning onset, detection, collection or another event meaning. Unit and browser fixtures cover this case for timings and environmental context.
