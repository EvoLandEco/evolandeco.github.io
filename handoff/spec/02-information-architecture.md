# Routes and content composition

## Route contract

| Route | Main purpose | Required content |
|---|---|---|
| `/` | A concise introduction and entry points | Identity, short biography, Globe card, three selected research/software features, three selected publications, award note and contact link |
| `/research` | Explain the research programme | Three research strands, Animated Beam approach diagram, four research features and four programme entries with exact status |
| `/publications` | Complete scientific record | Eight peer-reviewed articles and two preprints, author markers, year/type filters, DOI links and citation export |
| `/software` | Show software contributions | Read-only Terminal catalogue, named developer projects, separate collaborator packages, toolkit list and Icon Cloud |
| `/about` | Biography, CV and professional context | Experience, education, talk, awards, service, languages, contact and PDF download |
| `/photography` | Sixth primary destination | Dotted Map, verified travel summary, public country list and country album cards |
| `/photography/[country]` | One album per country | Country title, owner text, ordered photographs, captions and viewer links |
| `/photography/[country]/[photo]` | A shareable full photograph | Full-aspect approved image, caption, credit, album link and adjacent-photo links |
| `/research/evolutionary-inference` | EvoNN and EVE | CV-grounded project prose, publication references, software links |
| `/research/netforge` | NetForge | Generator approach, evaluation categories, preprint label, documentation link |
| `/research/herdlink` | HerdLink | Public application, recorded capabilities, source link, authentic screenshot when supplied |
| `/research/one-health` | Programme context | Separate NextdAI, EUPAHW, SSS-mod and IMBIT roles/status; no fabricated results |

These are real URL routes, not tabs that hide all content inside the home page. Direct opening, refresh, browser Back/Forward and copyable links must work. Use one canonical URL per page and explicit 404 handling for unknown research, country and photo slugs. Draft/private albums and unpublished photos are not generated as public routes. Photography remains active in navigation throughout its nested routes.

## Home, in order

**Introduction.** Use the exact name and professional title. Main copy: “I develop machine learning methods, stochastic models and software to understand biological systems.” Follow with the short bio from the data seed. Provide “Explore research” and “Download CV”. The visitor should not wait for an animation to learn who this is.

**Academic-path card.** Use Globe with a brief Netherlands label and a link to the education section. At wider main-column widths, the introduction and Globe can share a 60/40 row. On smaller screens, stack them. Label markers as academic institutions and keep education text authoritative. Do not claim the markers are current collaborations or residence.

**Selected work.** Three balanced cards: EvoNN & EVE, NetForge, HerdLink. Keep the evolutionary work first or equally prominent; do not hide it behind all the newer epidemiology projects. Each card has a plain one-sentence summary, relevant status and a visible project link. Secondary links point to the paper, documentation or application.

**Selected publications.** Display the Systematic Biology article, Journal of Theoretical Biology article and NetForge preprint. A compact list is better than another animated tile grid. Label the third as a preprint. Link to the complete publications page.

**Recognition and contact.** A modest line for the 2025 Denise Kirschner prize, with the supplied source link. Close with a plain contact action. No invented collaboration availability or booking service.

## Research page

Open with three concise strands: **Evolutionary inference**, **Networks & epidemiology**, **Research software**. Explain them through concrete project links rather than a cloud of buzzwords.

The Animated Beam diagram occupies one bounded panel after that introduction. Use labelled observations on one side, models and inference in the middle, and research outputs on the other. A caption says: “A conceptual view of my research approach; the connections do not represent a single operational data pipeline.” This is a meaningful description of the diagram, not a warning banner.

Follow with the four features in the data seed. Programme entries are a calm chronological or grouped list, not fake product status widgets. NextdAI is “In development”; EUPAHW and SSS-mod are “Ongoing”; IMBIT is “Completed · 2025”. A completed programme does not imply that NetForge or HerdLink is unavailable.

## Publications page

Default view shows the full record grouped into “Peer-reviewed articles” and “Preprints”, each in descending year order. Give author names, year, exact title, venue, volume/issue/pages when supplied, status and DOI. Preserve equal-contribution and joint-senior markers with a legend. Do not collapse preprints into the peer-reviewed section to improve the apparent publication count.

Add small text search and year/type filters as conveniences. There are only ten records; do not add a remote search service. Represent the state in query parameters so results are shareable. The unfiltered server HTML contains every record. Define a clear “No matching publications” state and a reset action.

Citation export uses only supplied fields. Generate valid BibTeX at build time, with deliberate handling of name particles and TeX escaping. Do not invent a journal citation for a preprint, months or missing publication metadata. A download of the complete `.bib` file and accessible copy-citation buttons are sufficient. Copy actions report success through a brief status message, not an animated terminal.

## Software page

Use the Terminal as a small read-only index with title `software.index`. The visible transcript draws names and roles from the central data. Keep real project cards or rows immediately available as ordinary links. No visitor should have to type commands to open software.

Separate developer projects from collaborative contributions. The CV describes NetSpectra, EvoLab and miniape collectively; either retain that grouped description or verify their individual READMEs before publishing separate capability claims. The same rule applies to treestats, DDD and DAISIE. Do not infer a software licence, install command or active maintenance status from a GitHub URL alone.

Place the toolkit lower on the page, with a normal grouped skill list and Icon Cloud as a visual companion. This section uses only CV-supported technologies. Do not imply that use of Next.js for this website proves research expertise in Next.js or TypeScript.

## About page

Provide the full professional bio, timeline of research experience, education, oral presentation, awards, seminars/mentoring/reviewing, languages and a contact section. Preserve overlapping doctoral and postdoctoral dates. The PhD is completed at Groningen; the current position in the supplied CV is at WUR.

The PDF link points to `/Tianjian-Qin-CV.pdf`. Keep a readable HTML CV on this page as well; the compiled source PDF is not a substitute for accessible web content. Contact uses `mailto:tianjian.qin@wur.nl` and verified profile URLs. Do not expose device location, a home address, private messages or phone numbers.

## Photography page and country albums

The navigation order is Home, Research, Papers, Software, About, Photography. Photography is a separate personal destination, not another research strand.

At `/photography`, show the Dotted Map and country total from explicit owner-confirmed records, then country album cards. A visited country can count before photographs are published; published album and photograph totals are separate. Multiple trips never create duplicate country albums. Use text country links beside the map so dense markers are not the only navigation. Keep the complete country list independent of album search.

Each album uses the stable country slug, preserves the owner’s photo order, provides normal full-image links and supports an accessible lightbox. Those links work without JavaScript and resolve to real photo pages on direct navigation. Read [10-photography.md](10-photography.md) for the schema, privacy boundary, map integration, image processing and viewer behaviour.

No travel list or photographs have been supplied. Keep `/photography` present with the real unmarked map and “Albums are being curated.” Do not publish sample country cards or display an unverified zero-visit total. The populated experience is tested with isolated fixture data.

## Writing and legacy routes

Keep the template's trusted MDX capability available in source, but do not launch fabricated blog posts, generic tutorial samples or an empty “Insights” section. A writing destination can be exposed when real material is supplied.

`https://qtj.me/NetForge` is an existing project resource named in the CV. The case-sensitive route and its assets must be preserved or redirected to an equivalent real resource with the owner's approval. The new `/research/netforge` page is a research introduction, not an automatic replacement for the project documentation. Inventory the current hosting before deployment; do not turn this preservation requirement into a redirect loop.
