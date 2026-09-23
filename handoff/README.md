# Tianjian Qin · Magic UI portfolio handoff

**Build a restrained, vCard-inspired research portfolio from Magic UI's free Portfolio Template.** Keep the rounded surfaces and compact personal identity of a vCard, the typography of the Magic UI starter, and five purposeful visual components: Globe, Icon Cloud, Terminal, Animated Beam and Dotted Map.

This package is a specification, content seed and implementation contract for Codex. It is not an implemented website. The CV PDF has been compiled and visually checked; the data and handoff files have local integrity checks. Browser tests, application builds and deployment checks belong to the implementation.

## Start here

Place this folder in the target workspace as `handoff/`. Give Codex the text in [CODEX_START.md](CODEX_START.md). For a fresh application, have Codex place the actual website in a sibling `site/` directory. For an existing application, Codex must inspect the repository before making changes and preserve unrelated work.

Do not paste the entire suite into one prompt. The kickoff directs Codex through the required reading and staged work. The supplied [AGENTS.md](AGENTS.md) is a template for the target application's agent instructions; putting it only inside `handoff/` does not make it automatically govern a sibling application. Codex must merge the relevant rules into the actual application root without deleting existing project instructions.

## Files by purpose

| Need | Read |
|---|---|
| One prompt to start implementation | [CODEX_START.md](CODEX_START.md) |
| Repository rules and reading order | [AGENTS.md](AGENTS.md) |
| Visual target, dimensions and composition | [01-product-design.md](spec/01-product-design.md) |
| Routes, homepage order and navigation | [02-information-architecture.md](spec/02-information-architecture.md) |
| All 77 documented free components and free building blocks | [03-component-audit.md](spec/03-component-audit.md) |
| Exact APIs and engineering contracts for the five signature components | [04-signature-components.md](spec/04-signature-components.md) |
| Biography, project voice, publication and contribution rules | [05-content-editorial.md](spec/05-content-editorial.md) |
| Stack, installation, data boundaries and deployment | [06-architecture.md](spec/06-architecture.md) |
| Build stages and completion gates | [07-implementation-plan.md](spec/07-implementation-plan.md) |
| Functional, content, visual and accessibility tests | [08-acceptance-tests.md](spec/08-acceptance-tests.md) |
| Source ledger, snapshot limits and decisions | [09-sources-decisions.md](spec/09-sources-decisions.md) |
| Country albums, travel counts, Dotted Map, media and viewer | [10-photography.md](spec/10-photography.md) |
| Owner workflow for adding countries and photographs | [PHOTOGRAPHY_CONTENT_GUIDE.md](PHOTOGRAPHY_CONTENT_GUIDE.md) |

[data/portfolio.json](data/portfolio.json) contains the professional content seed: 10 publications, four research features, four programmes, 10 software entries, experience, education, skills, awards, service and contact links. [data/magicui-catalog.json](data/magicui-catalog.json) contains the full component inventory. [data/assets.json](data/assets.json) records asset requirements. The four files under `content/research/` provide CV-grounded project prose.

[reference/design-tokens.css](reference/design-tokens.css) supplies the palette and layout tokens. [reference/portfolio.acceptance.spec.ts](reference/portfolio.acceptance.spec.ts) is a test contract to integrate with the application, not evidence of a website test run. [reference/data-contract.md](reference/data-contract.md) specifies validation and publication rendering.

## The product decision

The site has six destinations, in this order: **Home, Research, Papers, Software, About, Photography**. It uses a narrow identity rail, a quiet content surface and natural page scrolling. The Globe appears on Home; Animated Beam appears on Research; Terminal and Icon Cloud occupy separate sections of Software. Dotted Map belongs on Photography, above country album cards. All five are part of the first complete build.

The research story gives comparable visibility to evolutionary inference, temporal networks and epidemiology, and research software. It does not turn a computational biologist into a generic frontend developer or reduce the career to livestock modelling alone.

## Inputs already supplied

The source CV is preserved byte for byte in [sources/Tianjian_Qin_CV.tex](sources/Tianjian_Qin_CV.tex). A three-page [downloadable CV](public/Tianjian-Qin-CV.pdf) is ready for the website. Bibliographic titles and author annotations are preserved, including wording inside published titles that differs from the editorial style rules.

The application can be built without a portrait, external CMS, paid assets or paid Magic UI components. Photography is a complete section with one album per country, a full-image viewer and a country map. No actual photographs or confirmed travel list are supplied: the production content seed is empty, the visit total is unconfirmed, and test data must never become personal content. Use the specified TQ monogram as the identity design until a portrait is supplied. Authentic application screenshots, final hosting configuration and ownership of the existing `/NetForge` route require verification before they are used or changed. They do not block local implementation.

## Integrity check

```bash
python3 handoff/scripts/validate_handoff.py
```

Run from the parent workspace, or use an absolute path. The validator resolves the package root from its own file. It checks structured content, references, catalogue size, source-CV identity, internal document links and file hashes. It does not test external URL availability or the eventual website.

The machine-readable result of the local handoff check is in [verification/handoff-check.json](verification/handoff-check.json). See [verification/README.md](verification/README.md) for the exact scope.

## Photography inputs and reference logic

[data/photography.json](data/photography.json) is the owner content seed. [reference/photography-model.ts](reference/photography-model.ts) provides strict validation, publication selectors, route construction and separate visit/album/photo totals. The model is framework-independent; it does not implement the UI or image pipeline.

Run its executable reference checks with:

```bash
python3 handoff/scripts/check_photography_reference.py
```

[reference/fixtures/photography.test.json](reference/fixtures/photography.test.json) contains synthetic test records, not Tianjian's travel history. Fixture builds must be isolated from production. The ordinary `/photography` page renders its real empty state until approved albums exist; it must not display a false “0 countries visited” claim.
