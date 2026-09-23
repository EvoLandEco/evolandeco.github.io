# Verification scope

The local handoff check covers the structured CV transcription, publication and project relations, documented component count, six-destination navigation, photography seed/fixture isolation, supplied asset paths, internal document links, JSON parsing, source-CV SHA-256 and package file hashes. The report is `handoff-check.json`.

The three-page CV PDF was compiled from the supplied TeX without changing the source. All three pages were rendered and visually inspected for clipping, overlap and glyph problems. No such issues were observed in that inspection. The source PDF is not a tagged accessibility document; the website's HTML CV remains the primary accessible presentation.

The citation file contains eight article records and two preprint records generated from the CV data. A BibTeX parser check is recorded separately. The palette report contains 14 calculated flat-colour contrast pairs. It is not a test of the eventual website or all possible component states.

No Next.js application was built during preparation of this handoff. The browser test file is an implementation contract and has not been run against a website. Performance, renderer lifecycle, responsive visuals, keyboard behaviour, automated accessibility results and deployment checks remain implementation tasks.

The photography model has a strict TypeScript compile and 42 executed reference checks in `photography-model-check.json`. These cover the actual empty production seed, synthetic fixture isolation, country counts, publication/privacy selectors, route construction and invalid record rejection. They do not run Next.js, inspect image metadata or exercise a browser.

The browser acceptance files have a local syntax check recorded in `reference-test-syntax.json`; their Playwright assertions are implementation requirements, not executed browser results. The CV, bibliography and palette records describe their supplied assets; photography integration does not alter those assets.

The file manifest excludes itself and the generated handoff-check result to avoid a circular hash dependency. Internal source notes and handoff verification files are not website assets.
