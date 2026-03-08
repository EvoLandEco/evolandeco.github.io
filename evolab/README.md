# EvoLab

**A standalone diversification simulator for lineage history, coarse-grained taxa, and trait-based tree reconstruction.**  
One static HTML app for exploring budding lineages, species-level coarsening, extinction, and how trait summaries can disagree with event history.

[![Version](https://img.shields.io/badge/version-v0.1--alpha-3b82f6)](#)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## What is EvoLab?

EvoLab is an interactive teaching and exploration tool built around a continuous-time budding diversification process.

- Each extant lineage can produce a clonal daughter, produce a mutating daughter, or go extinct.
- The simulator tracks the full lineage record through time rather than jumping straight to a final tree.
- A coarsening rule turns lineage-level events into observed "species" by requiring a chosen number of mutational steps before naming a new taxon.
- The same run is then shown through linked views: full history, coarsened chronogram, history tree, trait tree, lineages through time, and trait space.

For the full discussion and interpretation, see **[the blog post](https://qtj.me/blog-Subspecies-Level-Diversification.html)**.

---

## What's included

- `evolab.html`: the whole simulator in one file
- Seeded preset scenarios for balanced exploration, high turnover, rapid radiation, and OU-like trait constraint
- JSON export for complete run history
- Newick export for the history tree and the trait tree
- Light and dark display support

---

## Quickstart

### 1. Clone
```bash
git clone https://github.com/EvoLandEco/EvoLab.git
cd EvoLab
```

### 2. Serve the repository root
Browsers handle clipboard features more reliably over `http://` than `file://`, so run a tiny local server from the repo root:

```bash
python -m http.server 8000
```

### 3. Open in a browser
```text
http://localhost:8000/evolab.html
```

The page loads D3, numeric.js, Bootstrap, and Font Awesome from public CDNs, so the browser session needs internet access unless you vendor those files locally.

---

## How the simulator works

Each run starts with one lineage. Event times are sampled in continuous time with a Gillespie-style stochastic simulation algorithm. At each event, one extant lineage is chosen and one of three outcomes happens:

- **Clonal birth**: a daughter lineage inherits the parent's trait vector
- **Mutating birth**: a daughter lineage receives a trait step and may contribute toward a new observed taxon
- **Death**: the lineage is marked extinct and stops participating in later events

Observed taxa are built from the lineage record by a coarsening rule:

- At **coarsen level 0**, every new lineage can become a named taxon right away
- At higher coarsen levels, mutational steps must accumulate before a new taxon is recorded

The simulator then derives:

- A **full lineage chronogram**
- A **coarsened species chronogram**
- A **history tree** from the coarsened event table
- A **trait tree** built from observed trait distances with UPGMA
- A **lineages-through-time** summary
- A **trait-space** view using the first two trait axes or PCA when needed

---

## How to use

1. Pick a preset or enter your own rates.
2. Set the step limit and coarsen level.
3. Choose a trait model:
   - **Brownian steps** for unconstrained wandering
   - **OU-like pull** for movement toward an optimum
4. Press **Grow** to animate the run, or **Step** to inspect the process one event at a time.
5. Use **Export JSON**, **Copy history Newick**, and **Copy trait Newick** when you want to reuse a run elsewhere.

---

## Acknowledgements

EvoLab uses:

- **D3.js** for the interactive graphics
- **numeric.js** for the PCA fallback
- **Bootstrap** for interface primitives
- **Font Awesome** for UI icons

---

## License

MIT License.
