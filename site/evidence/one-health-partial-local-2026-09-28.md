# Partial One Health local UI candidate

The local preview at http://localhost:3001/atlas/ uses export `84af1f2142e037519b457c5e192d3cd2c06275b79922420cebf01288c7696b3f`, site contract 1.5.0. It is a partial dataset for interface testing. The public dataset and Cloudflare pointer are unchanged.

## Data and review scope

The immutable candidate is `/Users/tianjian/Documents/ChatGPT/EpiWeekly/reports/one-health-panels-2026-09-28/local-ui-candidate`. Its `handoff.json` supplies hashes, file sizes, counts and review limitations. Every declared file hash and size matches; the selector, schemas and types match the pinned consumer files. Consumer schema, snapshot and source-reference validation passes.

The producer worklist records 1,293 source scope reviews and 805 pending entries. Detailed panel annotation covers 65 entries, with 488 identified entries awaiting annotation. Those workflow counts are distinct from exported One Health review states. The complete reporting selection has 1,105 exported inspected entries and 993 unreviewed entries. Eligible panel statements cover 62 entries after selector eligibility and correction rules; raw annotation completion is not a claim that all statements remain eligible.

The bundle contains 164 timings, 44 sampling assessments and 223 contexts. September has report entries without completed panel annotations. Empty panel statements do not establish absence of events. Dates, unmatched sample pairs, negative findings and source hypotheses retain their exported meanings.

## Local configuration

`NEXT_PUBLIC_ATLAS_DATA_ORIGIN=http://localhost:3004` selects the loopback data service. `/tmp/atlas-one-health-partial-server.py` serves only this candidate, with gzip, exact asset checksums and local preview CORS. The service starts with `python3 /tmp/atlas-one-health-partial-server.py`. The website dev server remains on port 3001. This configuration does not modify `src/content-data/atlas-hosting.json`.

The accepted 1.4 candidate remains available under `/Users/tianjian/Documents/ChatGPT/EpiWeekly/reports/who-workflow-2026-09-28/final`. Public adoption and publication are separate from this local test selection.

ATLAS review workers are paused. Resume requires an explicit user instruction. UI work observes the subscription stop threshold below 66% remaining.

## UI validation

The candidate passes two browser checks at phone and workspace sizes. They exercise populated January timing, sampling and context views, source evidence, keyboard date-window changes, September's empty panel statements, selector-approved annotation coverage, accessibility and bounded scrolling. TypeScript, focused lint, the isolated production build and static-export checks pass. Visual inspection covers the actual candidate; narrow timeline axes use two date labels to avoid overlap. Topic titles distinguish entries from the same bulletin in the report selector.

The latest subscription reading at completion is 75% remaining. The loopback candidate service and local dev preview remain running for UI testing.

## Entry discovery

With the full publication window selected, 43 entry views contain timing statements, 30 contain sampling assessments and 50 contain environmental or intervention context. Counts follow the selected evidence and explicit connected observations. Undated records and reporting cutoffs contribute to Timeline availability, but the dated-evidence filter excludes cutoffs and incomplete dates.

View choices show current-entry content counts and matching-entry totals. Report choices show content badges for each view. Filters cover content availability, observation domains, dated panel evidence, producer-approved sample fractions, negative findings and source hypotheses. Domain filters find entries; they do not remove domains from the figures. Zero counts mean no eligible exported content for that view.

Entry indexing and date unit checks pass. Five browser checks cover menu counts, badges, combined filters, empty-result recovery, keyboard dismissal, phone and workspace layouts, analytical panels and accessibility. The real-candidate panel checks also pass. TypeScript, focused ESLint, production build, static-export validation and whitespace checks pass.

The One Health toolbar contains view and report choices, entry filters and the methods button. Aggregate inspection counters are absent from the panel header. Per-entry source details, review status in Overview and incomplete-data messages retain the context needed to interpret the evidence.
