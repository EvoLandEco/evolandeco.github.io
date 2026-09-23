# Codex kickoff

Paste the following into Codex after placing this package in the workspace as `handoff/`.

---

Build my personal professional portfolio from Magic UI's free Portfolio Template using the attached `handoff/` suite. Deliver a working, polished application, not another proposal.

First inspect the workspace, repository state, existing application and package manager. Read `handoff/README.md` and `handoff/AGENTS.md`, then follow the reading order there. Merge the relevant agent rules into the actual application root without overwriting existing instructions. If this is a fresh workspace, create the application in `site/`; otherwise work within the existing app and preserve unrelated files and changes.

Start from `magicuidesign/portfolio`, with the audited commit in `handoff/data/upstream-lock.json` as the source reference. Inspect compatible maintained dependency versions and security notices before deciding the production lockfile. Use free Magic UI components and standard shadcn primitives only. Do not replace the base with another portfolio starter or a paid template.

The visual target is a premium but restrained vCard-like site: contained width, a compact identity rail, rounded neutral cards, calm typography, one blue accent, and polished interactions. Use the specific route composition and tokens in the handoff. Do not produce an animation showroom.

All five signature components must work in the first complete build: Globe on Home, Animated Beam on Research, Terminal and Icon Cloud in separate sections of Software, and Dotted Map on Photography. Implement the actual upstream components with the site-level controls described in `spec/04-signature-components.md`. Do not substitute static placeholder boxes. Keep their semantic content available to everyone, including users who pause motion or navigate without JavaScript.

The six main destinations are Home, Research, Papers, Software, About and Photography. Implement Photography at `/photography`, with one album per country at `/photography/[country]` and a full-image route at `/photography/[country]/[photo]`. Read `spec/10-photography.md` and `PHOTOGRAPHY_CONTENT_GUIDE.md`. Use `data/photography.json` and the reference model for owner-confirmed countries, separate travel and album counts, publication privacy, and real photographs. Keep the empty production seed truthful. Use the isolated test fixture to exercise populated albums and the viewer without presenting it as my travel history. Generate an allowlisted public manifest before the app build, and keep the authored manifest, originals and hidden photos outside public assets and deployment bundles.

Use `handoff/data/portfolio.json` and the source CV for all professional facts. Preserve publications, preprint labels, contributor roles, programme status and education. Use the supplied project prose without expanding it into unsupported scientific findings. Use the designed TQ monogram until an authentic portrait is supplied. Do not invent a headshot, scholarly links, project APIs, screenshots or real-world metrics.

Implement the complete route set, content model, component integrations, responsive behaviour, metadata, download links and tests. Work through the build stages and acceptance gates. Run the application, inspect desktop and mobile screenshots in light and dark themes, test reduced motion and keyboard navigation, and repair visual or functional faults before delivery. Keep a progress log with commands and results, not speculative success claims.

The existing `https://qtj.me/NetForge` resource must remain reachable. Build and test locally without publishing. Before any production deployment, document the hosting arrangement and preservation plan for that route.

At completion provide: the app path, run commands, implemented routes and components, source provenance, test results, visual evidence, accessibility findings, the photography authoring and media-import workflow, remaining missing assets, and any deployment decision that needs my approval. Continue until the handoff's first-release scope is complete or a concrete external dependency prevents a specific step; finish all independent work rather than stopping the entire build.

---
