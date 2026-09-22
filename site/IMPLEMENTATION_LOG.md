# Release verification

The website is a static Next.js export for GitHub Pages at https://qtj.me. The deployment artifact is `site/out`; the repository root HTML files and unrelated projects are outside that artifact.

## Release checks

- `pnpm lint`: source lint.
- `pnpm test`: content integrity, citations, photography publishing and globe geometry.
- `pnpm build`: prerendered pages and static assets.
- `pnpm typecheck`: TypeScript validation.
- `pnpm check:export`: local HTML links, resource paths, custom domain and static-hosting files.
- `pnpm test:e2e`: desktop/mobile layouts, themes, navigation, accessibility and interactions against the static preview.

Blog and Footprint navigation entries carry a Migrating label and cannot navigate. Their review routes have noindex metadata and are excluded from the sitemap. Photo examples are separate from personal travel counts.

## Publishing

The Pages workflow validates pull requests and publishes pushes to main. Repository Settings → Pages must use GitHub Actions, with qtj.me retained as the custom domain. Verify `/`, `/research/`, `/publications/`, `/software/`, the CV download and the separate `/NetForge/` documentation after deployment. No local build publishes the website.
