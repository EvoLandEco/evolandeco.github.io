# Source ledger, decisions and audit limits

Audit date: **21 September 2026**. Source pins appear in `data/upstream-lock.json`.

## Primary sources

| ID | Source | Used for |
|---|---|---|
| CV01 | `sources/Tianjian_Qin_CV.tex` | Personal identity, employment, education, publication record, software, programme status, skills and links |
| MU01 | [Portfolio Template](https://magicui.design/docs/templates/portfolio) | Official free portfolio base and documented catalogue |
| MU02 | [Pinned Portfolio manifest](https://github.com/magicuidesign/portfolio/blob/5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b/package.json) | Actual stack and scripts |
| MU03 | [Pinned Portfolio page](https://github.com/magicuidesign/portfolio/blob/5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b/src/app/page.tsx) | Existing section composition and source paths |
| MU04 | [Pinned documentation navigation](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/config/docs.ts) | 77 documented component entries and free/Pro template distinction |
| MU05 | [Pinned application registry](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/registry-ui.ts) | Registry metadata, dependencies and source locations |
| MU06 | [Globe source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/globe.tsx) | Config and renderer/pointer lifecycle |
| MU07 | [Icon Cloud source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/icon-cloud.tsx) | Canvas API, controls, image loading and geometry |
| MU08 | [Terminal source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/terminal.tsx) | Sequencing, timing units and exported components |
| MU09 | [Animated Beam source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/animated-beam.tsx) | Ref geometry, repeat behaviour and gradient animation |
| MU10 | [Installation](https://magicui.design/docs/installation) | Namespaced shadcn installation |
| MU11 | [Bento Grid](https://magicui.design/docs/components/bento-grid) | Free component composition examples |
| MU12 | [Blog](https://magicui.design/docs/templates/blog) and [Changelog](https://magicui.design/docs/templates/changelog) | Additional free template references |
| MU13 | [Legacy](https://magicui.design/docs/legacy) | Separate Tailwind v3 ecosystem |
| MU14 | [Magic UI licence](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/LICENSE.md) | MIT terms for library source |
| PH01 | [Dotted Map documentation](https://magicui.design/docs/components/dotted-map) and [pinned source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/dotted-map.tsx) | SVG renderer, marker overlays, projected coordinates and pulse controls |
| PH02 | [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image) | Responsive image sizing and intrinsic dimensions |
| PH03 | [Sharp output](https://sharp.pixelplumbing.com/api-output/) | Image derivative metadata handling |
| PH04 | [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Viewer focus, keyboard operation and close behaviour |
| MU15 | [Portfolio licence](https://github.com/magicuidesign/portfolio/blob/5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b/LICENSE) | MIT terms for starter source |
| FW01 | [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) | Runtime and framework requirements |
| FW02 | [Next.js static export](https://nextjs.org/docs/app/guides/static-exports) | Hosting constraints |
| FW03 | [shadcn registry namespace](https://ui.shadcn.com/docs/registry/namespace) | Registry configuration |
| AC01 | [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) | Control of nonessential continuous motion |
| PF01 | [Core Web Vitals](https://web.dev/articles/vitals) | Performance targets and measurement vocabulary |
| AG01 | [Codex AGENTS guide](https://developers.openai.com/codex/guides/agents-md) | Agent reading instructions and root scope |
| AG02 | [Magic UI MCP](https://magicui.design/docs/mcp) and [shadcn MCP](https://ui.shadcn.com/docs/mcp) | Available discovery approaches for a configured coding environment |

The publication and project URLs in the data seed are supplied by the CV. Their presence is not a claim that every remote endpoint was live-tested or that all bibliographic facts were independently re-audited against publishers during this website task.

## Audit scope

The investigation covers all component entries in the public documentation navigation at the stated revision, registry metadata, the free template families and relevant public composition examples. Five components received detailed source inspection: Globe, Icon Cloud, Terminal, Animated Beam and Dotted Map. This does not claim a complete browser test of every free example file, every release branch or an undisclosed block library. The two extra source entries are recorded separately from the 77-page count.

The advertised collection of 50+ blocks is Pro. No Pro source, template or paid asset is required. No assumption is made that an arbitrary online clone carries the original author's licence.

## Decisions

| Decision | Reason |
|---|---|
| Keep Magic UI Portfolio as the base | The owner explicitly chose that ecosystem and starter. |
| Use a vCard-like shell, not a fixed-height card | Preserves personal focus while accommodating real research content and mobile reading. |
| Separate the signature components across routes | All five can be enjoyed without an overloaded first viewport. |
| Use CV blue plus neutral surfaces | Coherent personal identity without institutional imitation or neon theming. |
| Put evolutionary research beside epidemiology | Accurately reflects the breadth and strongest published evidence. |
| Keep HTML content independent of the visual renderers | Readability, navigation, discoverability and motion preferences are part of the design. |
| Prefer local content and assets | The portfolio does not need backend accounts or runtime data scraping. |
| Keep unknowns explicit internally | Prevents plausible but false personal or scientific claims. |
| Keep Photography as the sixth destination | The owner requested country albums and a travel map, separate from the research portfolio. |
| Derive travel totals from explicit country records | Photo counts, academic affiliations and map points cannot establish the travel history. |
| Publish approved derivatives only | Photography originals and hidden media must stay outside publicly served assets. |
| Protect `/NetForge` | The supplied CV names an existing resource on the intended domain. |

## Missing inputs and how work proceeds

A portrait has not been supplied: implement the designed TQ monogram. Authentic project screenshots have not been supplied: implement the typography and schematic project identifiers, and add a screenshot only after provenance is established. There is no verified Google Scholar URL: do not display it. Globe marker coordinates have not been sourced: use no arbitrary markers and verify city-level coordinates before adding them.

No photographs or owner-confirmed travel list are supplied. `data/photography.json` is intentionally empty and unconfirmed. Implement the real Photography page and validate populated behaviour using the isolated synthetic fixture; do not copy those countries into the production manifest. The owner guide explains how to populate it.

Final hosting configuration and `/NetForge` ownership/routing are unresolved. Finish the local application and deployment plan, but do not deploy over an existing resource. These unknowns do not justify stopping content, layout, component integration or tests.

## Licensing and release notes

Retain the Portfolio and Magic UI MIT notices in the resulting source distribution. Do not apply an MIT licence to the supplied CV, the owner's portrait and photographs, institutional trademarks or third-party screenshot assets merely because the code uses MIT components. Keep an asset attribution ledger. The handoff does not distribute font binaries or third-party component source snapshots.

The upstream commits support reproducibility. They do not freeze dependency maintenance or certify a safe production environment. The final application must record its own tested runtime, dependency lock and security review results.
