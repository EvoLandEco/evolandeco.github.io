# Implementation plan and completion gates

## Scope

Deliver the six primary routes, four research detail routes, country album and full-photo route families, complete CV-grounded content, all five signature components, the support set, responsive light/dark presentation, accessibility behaviour, metadata and a locally runnable test suite. This is the first-release scope, not a sequence of proposed future enhancements.

Maintain `IMPLEMENTATION_LOG.md` in the application with dates, commands, meaningful decisions and evidence paths. The log is an engineering record, not public portfolio copy. Record failed or unrun checks as such.

## Stage 0 · Workspace and source audit

Inspect the workspace, Git status and current application before changing anything. Preserve user work. Establish the application root and ensure its AGENTS file points to the handoff. Run the handoff validator.

Fetch or inspect the Magic UI Portfolio source at the audited commit. Identify existing configuration, content and media. Record upstream lineage, chosen runtime, package manager and exact dependency versions. Check compatible maintained releases and security advisories before setting the lockfile. Do not use force-install flags to conceal incompatibility.

Inspect the installed source and registry payloads for all selected components. Retain a small source-provenance file containing repository/ref, source path, fetched payload hash, dependency additions and local integration changes. Record differences from the audit's APIs when they exist.

**Gate:** a reproducible local base builds, source lineage is recorded and there is no unexplained second lockfile or second animation runtime. The log names any environment restrictions precisely. Do not claim a successful baseline build without running it.

## Stage 1 · Content and route skeleton

Create the central data validation module from `data/portfolio.json`. Integrate the photography manifest and strict reference model, including separate country/album/photo counts, privacy selectors and isolated fixtures. Add the four project MDX files and their relation to the content seed. Set up all primary routes, research detail routes, country album routes and full-photo routes. Validate the actual empty photography seed and test populated routes with the fixture-only build. Integrate the CV PDF and citation file. Implement not-found handling and stable route links.

Remove the template owner's public content, assets, metadata and demo blog posts. Keep only reusable implementation structures. Keep developer and collaborator software groups distinct. Ensure current affiliation, completed PhD, eight peer-reviewed records, two preprints, four programmes and their statuses render correctly.

**Gate:** every route loads with meaningful content, publications and links are complete, data validation passes, and an HTML-only browser can navigate the essential site. A draft visual style is acceptable at this gate, but fake content is not.

## Stage 2 · Visual foundation

Apply the token system, identity rail, main surfaces, page typography and six-destination labelled Dock. Use the three-column, two-row navigation below 640 px, with measured page-bottom clearance. Build the mobile layout at the same time as desktop. Use the TQ monogram as a designed asset and reserve measured space for the Globe panel.

Refine one research card, one publication record and one timeline entry until typography, spacing, link treatment and status styling are consistent. Then reuse those primitives. Do not create a different visual language for every project.

**Gate:** inspect screenshots at 360 × 800, 390 × 844, 768 × 1024, 1280 × 800 and 1440 × 1000 in light and dark themes. Check long titles, affiliations, author names, portrait-free layout, bottom navigation and focus rings. Fix overflow and hierarchy problems before adding more effects.

## Stage 3 · Five signature components

Implement the controlled Globe on Home and the responsive Animated Beam diagram on Research. Implement the read-only Terminal and the Icon Cloud toolkit in separate sections of Software. Implement the static Dotted Map on Photography from public confirmed-country records, using its own projected marker coordinates and adjacent country links. Follow the source-level contracts rather than old snippets.

Add the shared motion preference and local play/pause controls. Test renderer sizing, frame/timer cleanup, source-specific sequence behaviour, reduced motion, pointer handling and semantic representations. Use stable local assets for the cloud. Do not leave the favourites as future tasks.

**Gate:** all five are rendered and functional. A text placeholder saying “Globe” does not pass. Pausing visibly stops motion, reduced motion is respected, the Terminal has no invented execution results, and the beam is a labelled conceptual diagram. Route navigation does not leak active instances.

## Stage 4 · Supporting interactions and content polish

Add restrained Magic Card treatment to selected work, the internal Bento Grid layout, a static Grid Pattern in the approach panel and Scroll Progress on long detail pages. Keep Blur Fade finite and away from essential content. Add an authentic HerdLink screenshot in a Safari frame only after its provenance is established.

Implement publication search/filter state, citation download and copy controls. Finish About, programme status presentation, award links, project cross-links, PDF access and contact. Build the Photography country cards, ordered photo galleries, full-image pages and accessible lightbox; implement the approved-image derivative pipeline and owner authoring guide. Validate local asset dimensions and metadata. Use one coherent button family.

**Gate:** every interactive element has a purpose and works through keyboard/touch. No hidden-on-hover project action, duplicate animation, broken media, empty card or fictional content remains.

## Stage 5 · Tests, performance and visual review

Integrate the acceptance test contracts and add source-specific unit/component tests. Run photography model tests, then browser tests with isolated populated fixtures and the empty production seed. Verify image metadata removal and absence of private/draft/test files in deployable outputs. Use a production build for end-to-end browser tests. Run lint, TypeScript checks, content validation, automated tests and accessibility checks; inspect screenshots rather than merely collecting them.

Suggested command families, once the corresponding scripts and test dependencies are configured in the app:

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test
pnpm exec playwright test
```

The commands above do not imply that the base already includes a test script or Playwright. Add and document them as part of implementation. Use a generated script for content validation and a production-server configuration for Playwright.

Record bundle/chunk sizes and a reproducible mobile performance measurement. Treat measured outputs as evidence, not template marketing promises. The visual review must include zero-JavaScript and reduced-motion pages, not just the default desktop hero.

**Gate:** required tests pass or a specific blocker is documented with its affected scope. No “all passed” statement is permitted when checks were skipped. High-impact accessibility, route, content or rendering faults must be repaired before describing the site as complete.

## Stage 6 · Delivery and deployment plan

Provide the repository/application path, install/dev/build/start commands, content-editing guide, source provenance, test results and screenshot/contact-sheet paths. Provide the country/album/photo editing instructions and media-import command with a working fixture demonstration; clearly separate missing owner photographs from implemented functionality. List final public routes and explain the use of each signature component. Record any missing authentic media separately from functional completeness.

Document how the existing `/NetForge` project resource will survive deployment. Do not publish, change DNS, overwrite a remote repository or start a paid service without authority. A successful local build is not a completed production deployment.

**Gate:** the owner can run the site, edit content and review it with no hidden dependencies. Deployment-specific decisions are small and explicit, not a vague invitation to finish the application later.

## Work distribution for multiple agents

One agent owns the visual system and final integration. Independent work can cover content validation/publication export, signature component source integration, and tests/accessibility. Agree on data IDs, routes and tokens first. Do not let separate agents invent competing schemas, duplicate providers, unrelated card designs or inconsistent facts. Integrate and test as one product.

## Do not expand the scope into

A live outbreak simulator, authentication, a CMS dashboard, a chatbot, a booking system, a metrics scraper, an operational decision-support service, a replica of HerdLink, or a page filled with all 77 components. Those are separate products, not missing pieces of this portfolio.
