# One Health design references and verification

28 September 2026. This record covers the references displayed in the One Health Figure methods & references dialog. Bibliographic checks used publisher pages, PubMed and an author repository. The citecheck command was not installed; verification was performed against these primary records. No formal relevance scores were generated.

## Citation checks

| Reference | Verified bibliographic record | Relevance and limits |
| --- | --- | --- |
| Plowright RK et al. (2017), *Nature Reviews Microbiology* 15, 502–510. DOI 10.1038/nrmicro.2017.45 | [Publisher record](https://www.nature.com/articles/nrmicro.2017.45): title, authors, year, volume and pages match. | The spillover barrier framework distinguishes exposure and infection. It supports those semantic distinctions, not a claim that a particular column layout is validated. |
| Caserta LC et al. (2024), *Nature* 634, 669–676. DOI 10.1038/s41586-024-07849-4 | [PubMed record](https://pubmed.ncbi.nlm.nih.gov/39053575/): title, first author, DOI, issue and online publication year match. | The cattle H5N1 investigation combines epidemiological and genomic evidence. It motivates inspecting evidence types; its findings cannot be transferred to ATLAS events without their own evidence. |
| Djordjevic SP et al. (2024), *Nature Reviews Genetics* 25, 142–157. DOI 10.1038/s41576-023-00649-y | [Publisher record](https://www.nature.com/articles/s41576-023-00649-y): bibliographic fields match. Online publication was 25 September 2023; the cited journal issue is February 2024. | The review discusses genomic surveillance technologies and their strengths. The UI retains method and scope, and does not infer transmission direction from an exported genomic association. |
| One Health High-Level Expert Panel (OHHLEP) et al. (2023), *One Health* 17, 100617. DOI 10.1016/j.onehlt.2023.100617 | [PubMed record](https://pubmed.ncbi.nlm.nih.gov/38024258/) and [author repository](https://discovery.ucl.ac.uk/id/eprint/10177468/): title, year, journal, article number and DOI match. PubMed includes the panel as corporate first author; the repository lists Hayman first among individual authors. | Integrated surveillance and upstream drivers motivate exposing coverage and missing information. An entry by domain table describes reviewed reporting, not surveillance sensitivity or completeness. |
| EFSA and ECDC (2025), *EFSA Journal* 23(12), e9759. DOI 10.2903/j.efsa.2025.9759 | [Publisher record](https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2025.9759): title, organizations, year and article number match. The report title contains the 2024 data year; publication is 2025. | The report’s data comparability guidance supports retaining collection method, sample population and denominator. It does not establish comparability among the ATLAS observations. |

| Eby P et al. (2023), *Nature* 613, 340–344. DOI 10.1038/s41586-022-05506-2 | [Publisher record](https://www.nature.com/articles/s41586-022-05506-2): title, authors, journal, volume and pages match. Online publication was 16 November 2022; the journal issue is 12 January 2023. | The study aligns ecological conditions and spillover over time. It motivates retaining environmental context and timing, not attributing an intervention effect from chart alignment. |

The application supplies the full paper titles and DOI links. The methods paragraphs identify which paper informs each design choice. There are no reproduced figures, long quotations, or claims that the papers evaluated ATLAS UI. Event evidence remains in the source details panel and is not replaced by methodological citations.

## Presentation contract

- Network labels retain the exported entity description, finding and scope. Related-node emphasis follows exported edges. Position does not encode time, distance or risk.
- Matrix cells show relationship-level evidence types. Columns cover types cited in the selection. Empty cells mean a type is not recorded. The cell opens the entire relationship evidence, with an explicit note that quotations have no per-type binding.
- Overview rows retain report-entry identities. Complete scoped review, partial, unresolved, no relevant observation, unreviewed and support outside selection are distinct. Negative findings apply to sampled material. Missing domain observations are not negative tests.
- Only the selected view mounts its figure or table. The overview renders 20 entries per page, indexes observations by record and preserves internal scrolling. No idle animation or additional dependency is required.

## Producer ownership

ATLAS documents producer requirements in `docs/ONE_HEALTH.md`, linked from `docs/WORKFLOW.md` and `docs/SITE_EXPORT.md`. The adopted local candidate is `deb479877652f3260444d0a499c17bf4b3ab8cf1950b0bc7e1c0c8e5e46b5409`, contract 1.4.0. Contract 1.5.0 and source enrichment are documented in [the enrichment record](one-health-enrichment-2026-09-28.md); adoption requires the sealed candidate and validation.

Versioned fields are required for entity and episode identity, linked sampling numerators and denominators, richer date precision, evidence-specific quotations and assessment states, genomic provenance, and typed environmental or intervention data. UI code does not parse narrative notes into these structures. Acceptance expectations are recorded in [the integration contract](../ATLAS_EXPORT_CONTRACT.md#one-health-presentation-and-producer-workflow).

## Validation

- TypeScript and focused ESLint checks pass. `git diff --check` passes.
- The unit suite reports 51 passed and two private-data checks skipped without their environment paths. The candidate run includes those checks: six passed across the One Health, layout and WHO fixture tests, with no skips. The WHO fixture retains exact node and relationship totals; the shared One Health test checks eligibility, negative findings, date selection and legacy behavior across candidates.
- Eight production browser checks pass: four network checks across phone, regular page, tall workspace and short workspace layouts; two evidence/overview/methods checks; and two older-contract compatibility checks. Axe reports no violations in the tested One Health views.
- Browser checks cover full tooltip text, keyboard selection, evidence navigation, citation DOI links, pagination, separate partial and unreviewed entries, source hypotheses, negative tests, methods-button placement, cell wrapping and the three-domain network’s horizontal fit.
- The production build runs in an isolated checkout. Static-export validation resolves all local HTML links and assets. Visual inspection covers light and dark themes, bounded source panes, domain columns, the matrix and the overview.
- Visual and accessibility checks identified escaped button positioning, overflowing multi-finding cells, narrow matrix layout, three-domain clipping and selected-cell contrast. The final checks pass with those cases included.

No deployment, data upload, public pointer change or broad producer re-extraction was performed. The local development preview remains available at `http://localhost:3001/atlas/`.
