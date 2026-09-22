# Sources and licences

## Application

The base is [Magic UI Portfolio](https://github.com/magicuidesign/portfolio) at `5ef12e4c8bd0de3e22e89c2181ee77a35925ec8b`. Its MIT licence is retained in `LICENSE`. The application retains the Next.js App Router scaffold, theme provider, trusted content-collections MDX pipeline, utilities, UI primitives and Dock. The research composition and content belong to this site.

Globe, Icon Cloud, Terminal, Animated Beam, Dotted Map, Bento Grid, Magic Card, Grid Pattern and Scroll Progress originate in [Magic UI](https://github.com/magicuidesign/magicui) at `d7207e5692d14c00dceafa8488d6d01f197fa0e4`. Its MIT notice is retained in `LICENSE-MAGICUI.md`. Blur Fade and Dock come from the portfolio base.

Local component integrations add controlled motion, responsive rendering, resource cleanup, full HTML content and the site palette. Globe uses COBE 2.0.1 with its native markers and arcs. Nine decorative points and connections suggest a global research network without claiming travel or specific collaborations. Leaving the viewport destroys the renderer. Icon Cloud retains the upstream Fibonacci sphere construction with responsive projection and depth sorting, renders local Font Awesome icons, and cancels its frame callback when stopped. It has no canvas-only links. Beam paths retain their static geometry when moving gradients unmount. Terminal uses direct sequence children and offers complete output immediately.

Dotted Map uses `svg-dotted-map` 2.1.0. The dependency has been renamed upstream, but this pinned API is the one used by the supplied component. It renders static SVG with pulse disabled. No Pro templates or paid components are included.

Geist is served locally through the `geist` package. Its SIL Open Font License is included in the package. The portrait is supplied by the site owner.

## Content and assets

Professional content derives from the supplied September 2026 CV and structured handoff. The downloadable PDF is a byte-for-byte copy of `CV_Data_Scientist_New.pdf`. Paper titles, author order, contribution markers and programme status follow those sources. The personal photograph seed contains no confirmed travel records.

The six technical notes were extracted from tracked HTML articles in the repository. Article and simulation dependencies are contained in `public/notebook-assets`. Technical notes use an isolated reading document to retain their mathematical typesetting and interactive examples within the site shell. The reading view has matching typography, surfaces and project art; the complete text is also server-rendered. Untracked draft articles and unrelated working files are outside that migration.

Stock photography comes from [Lorem Picsum](https://picsum.photos), with original photographer credits from its image information endpoints. Per-image sources, credits and file checksums are recorded in `evidence/asset-provenance.json`. The UI explicitly labels these as sample images.

The four project illustrations were generated with the built-in image generation tool and saved under `public/art/`. They are abstract visual identifiers. The prompt set is below.

## Image prompts

The project thumbnails in `public/art/*-refined.webp` use blue and sage sculptural scientific forms on pale backgrounds. The full prompt set is in [PROMPTS.md](public/art/PROMPTS.md). All were produced with the built-in image generation tool and encoded as WebP. The four additional tool illustrations and their prompts are documented in [SOFTWARE-PROMPTS.md](public/art/SOFTWARE-PROMPTS.md).

## Font Awesome and template details

Toolkit icons use Font Awesome Free 6.4.2 SVGs from the repository's `assets/fontawesome/svgs/`. Their CC BY 4.0 notice is preserved in each SVG and `public/icons/toolkit/LICENSE.txt`. Python, R, JavaScript, React, Docker, Git and Linux use brand marks. Code, fire, chart, database, cubes, bolt, terminal and square-root symbols represent the other toolkit categories. Their SVG viewports are square, with no tile background.

Project cards follow the pinned portfolio's `project-card.tsx` composition. Timelines use its `timeline.tsx` and the layout of `section/hackathons-section.tsx`: circular icons, a connecting rule, dates above titles, compact links and a 40-pixel content gap. Institution emblems identify education and research appointments.

The toolkit animates for 4.5 seconds on entering view, then settles. The research diagram animates while visible. Reduced-motion preferences and document visibility remain respected. Appearance is the only display setting.

The globe uses the shared Magic UI Animated Beam component with projected spherical paths. Deep red pulses have two translucent glow layers and no persistent connecting line. Ten fixed routes use raised quadratic arcs and staggered 2.5-second animation cycles. Blue nodes combine bright cores, breathing halos, expanding pulses and rotating segmented rings. Each ring follows the globe surface and foreshortens with its orientation. Animation runs while visible, stops for reduced motion and hidden documents, and releases both renderers on unmount.

The globe also provides a dashed link style: eucalyptus green SVG strokes in light mode and sage green in dark mode, with a soft glow and a 1.5-second dash drift. The default style uses solid green routes with glowing Magic UI beams on five-second cycles. Dashed and red pulse styles remain available through the Globe component’s linkStyle prop. Both styles share the same projected routes and motion policy.

## Institutional identity and portfolio layout

Section rules, centered project headings, open page sections and the contact composition follow the pinned Magic UI portfolio template. The background uses a sparse graph over a dot field, with slow node pulses that respect reduced motion. The globe and blue-green research palette connect the visual identity to network and complex systems research.

Institution logos are local copies of official assets, shown with their original colors and proportions. Symbol variants isolate the shield or emblem; the Beijing Forestry badge viewport excludes the source image’s transparent right margin:

- Wageningen University & Research: inline SVG from https://www.wur.nl/en
- University of Groningen: https://www.rug.nl/_definition/shared/images/logo--en.svg
- Beijing Forestry University: https://www.bjfu.edu.cn/images/2024-12/bc603a59730e40f8b674028594c3ca12.png
- Nanjing Normal University colored seal: https://cdn.urongda.com/images/normal/medium/nanjing-normal-university-logo-1024px.png (archive page: https://www.urongda.com/logos/4132010319)

The logos identify education and employment entries. They remain the property of their institutions; they are not covered by the site's code licence.

The portrait preview uses Magic UI Magic Card for its pointer-following gradient, with a native HTML popover for click, tap, Escape and outside-click dismissal. Its research identity and current role come from the portfolio profile data.

The navigation follows the portfolio Dock composition: a translucent rounded container, bordered icon buttons, spring magnification and labelled tooltips. Magnification applies to the bottom dock; top navigation uses fixed icon sizes and simple color states. Reduced motion disables magnification.

## Thesis cover

`public/art/thesis-cover.webp` is a web rendering of the user-supplied `Front Cover.pdf`, the approved doctoral thesis cover. The full thesis link comes from the CV education record.

Publication identity assets and bibliographic verification are documented in [the citation audit](evidence/citation-audit/REPORT.md).
