# Data and rendering contract

## Ownership of fields

`data/portfolio.json` is the content seed. Copy it into an application-owned content directory, validate it with the application's schema, and create explicit presentation selectors. Do not spread the entire object into a client component or JSON-LD block: internal evidence, editorial notes and unresolved values must stay out of the public render.

Top-level collections are `profile`, `navigation`, `projects`, `programmes`, `software`, `softwareGroups`, `publications`, `experience`, `education`, `skills`, `iconCloudItems`, `talks`, `awards`, `service`, `languages`, `relatedLinks` and `globe`. The source/evidence fields exist for maintenance, not marketing.

Required relation checks: project publication IDs resolve; project software IDs resolve; grouped software points to a real group; project article front matter resolves to a real project; the route slug is unique. Do not derive identity from display titles.

Publication status is `peer-reviewed` or `preprint`. Programme status is `In development`, `Ongoing` or `Completed`. Contribution role is `Developer` or `Collaborator`. Preserve these as separate concepts. A project display status is not a general funding or publication status.

Dates use the precision supplied. Year-only education/experience entries remain year-only. `end: null` in an experience record means present in the supplied CV. It does not instruct the renderer to query live employment status.

## Publication presentation

Render each author in supplied order. Use semantic emphasis for `isOwner`, an asterisk for `equalContribution` and a dagger for `jointSenior`. Explain the markers near the bibliography. Preserve Unicode names. A missing volume, issue or pages field is omitted from the citation rather than replaced with “N/A”.

Use a real DOI anchor. Do not append a guessed PDF URL to a DOI. The supplied citation export is a starting asset generated from the same data; the application must generate or validate its export whenever the source changes.

The `.bib` export uses BibTeX's `family, given` author form with `and` delimiters. Protect exact title capitalisation and escape TeX-sensitive characters. Joint-senior/equal-contribution annotations belong in a note if included, not inside the author name string. The special preprint key uses a non-journal entry type rather than inventing a journal issue.

Do not use string splitting at spaces to discover family names or infer identities. The supplied display names already have comma separation for bibliography use.

## Terminal transcript

Construct the short visual transcript from actual records, for example selected developer names and roles. The transcript is a representation of catalogue data. Its heading is `software.index`; it is not preceded by a fabricated executed shell command.

The unanimated semantic software rows remain visible and linked. Do not derive a command-line interface from a project name or show successful install output without actual documented source evidence.

## Illustrative content

The Globe marker table contains null coordinates intentionally. Do not pass null coordinates to COBE. Validate supplied city references before rendering markers; a marker-free globe is an intentional allowed design. The caption must not imply markers if none are drawn. Switch it to “Research across China and the Netherlands” when appropriate.

The beam graph is a conceptual diagram specified in the design, not a dataset imported from the CV. Its labels and caption communicate that distinction. It does not need scientific parameters, private livestock movements or generated epidemic curves.

## Schema acceptance

Use a strict schema for the content consumed by each page. Validate URL protocols, DOI syntax, unique IDs, relation integrity, status enums and local asset paths. Reject invalid records with actionable build errors. Do not silently drop malformed publications or substitute a template record to keep a build green.

Allow intentionally null fields only where the schema explains them: portrait, unprovided programme URL, absent volume/issue/pages, some grouped software descriptions and unsourced city coordinates. Keep that distinction separate from a broken supplied asset path.

The Python handoff validator checks the supplied seed and file relations. It does not replace the application's build-time validation or the browser test suite.


## Photography data

Photography has a separate manifest, `data/photography.json`. The executable reference contract is [photography-model.ts](photography-model.ts); implementation details are in [10-photography.md](../spec/10-photography.md). Do not merge travel records into academic Globe markers.

The manifest contains country records, at most one album per country and ordered photo records. Validate structure, distinct IDs/codes/slugs, country/album/photo relations, public image approval and cover membership. The production validator rejects `fixtureOnly: true`.

The public projection is an explicit allowlist generated before the application build. Keep its authored manifest outside the deployment input and have app routes import only the generated public manifest, not raw records in a server bundle. It excludes confirmation flags, visibility state, original file paths, unpublished records and private notes. A photo is public only when its country is public and confirmed, its album is published and its own publication/permission checks pass. Hidden assets do not belong in `public/`, even when their links are absent.

Visit count, published album count and published photo count are distinct selectors. A missing map coordinate must not reduce the visit count. A partial travel inventory is labelled “countries documented”; the empty unconfirmed seed has no visit-number claim. Do not hard-code a sample total in JSX, metadata or tests against owner content.
