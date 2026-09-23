# Portfolio implementation rules

Build Tianjian Qin's personal research website from `magicuidesign/portfolio`. Use the free Magic UI ecosystem. The source and design authority is the handoff suite, with the supplied CV as the authority for professional facts and owner-approved photography records as the authority for travel and image content.

## Read before coding

Read the handoff README, `spec/01-product-design.md`, `spec/02-information-architecture.md`, `spec/04-signature-components.md`, `spec/05-content-editorial.md`, `spec/06-architecture.md`, `spec/08-acceptance-tests.md` and `spec/10-photography.md`. Inspect `data/portfolio.json`, `data/photography.json`, `reference/photography-model.ts` and `data/upstream-lock.json`. Use `spec/03-component-audit.md` for every component selection.

## Non-negotiable requirements

- Keep a contained, quiet vCard-like composition, rounded cards, a neutral palette and one blue accent. Do not build a component gallery, cinematic landing page or dashboard full of floating widgets.
- Ship Globe, Icon Cloud, Terminal, Animated Beam and Dotted Map. Give each a content purpose; control motion in animated panels and keep the Dotted Map static. A placeholder box with its name does not satisfy the requirement.
- Keep six primary destinations. Photography has one album per country, a Dotted Map, separate derived visit/album/photo counts and accessible full-image navigation. Do not infer travel from the CV or expose draft, private or test media.
- Preserve the research identity: evolutionary inference, networks and epidemiology, and research software. PhD: University of Groningen. Current postdoc in the supplied CV: Wageningen University & Research.
- Keep eight peer-reviewed articles distinct from two preprints. Preserve author order and contribution markers. NextdAI is in development, not an awarded grant. Collaborator roles are not sole authorship.
- Never invent publications, skills, testimonials, usage counts, contacts, scientific outputs or project commands. The Terminal is a read-only catalogue, not a shell.
- Build semantic server-rendered content with small interactive client components. Navigation, biography, titles, project links and publications must not depend on canvas interaction, delayed animation or JavaScript availability.
- Use proper state and lifecycle control for animation. CSS hiding is not cancellation of a JavaScript renderer. Observe geometry, release resources and test responsive pointer coordinates.
- Preserve MIT notices, record upstream source pins and avoid Pro code or unlicensed assets.
- Keep unrelated repository changes. Do not run destructive Git operations or publish/deploy without explicit authority. Do not overwrite the existing `/NetForge` project route.

## Working practice

Use the repository's package manager and a single lockfile. Inspect installed source before relying on an API. Resolve type and build errors at their cause; do not silence them with blanket lint rules, unchecked casts, fake data, random timeouts or `--force` dependency resolution.

Use natural, self-contained comments and documentation. State what the code does, not the history of edits or the conversation that produced it. Keep bibliographic titles exact.

Work through the stages in `spec/07-implementation-plan.md`. After each stage, run the relevant checks and record concrete results. Do not stop after scaffolding or a design plan. The final report must separate passed tests, failures, unrun tests and decisions requiring deployment authority.
