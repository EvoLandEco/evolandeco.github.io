# Design direction

Read this before refining any part of Tianjian Qin’s website. A request such as “refine the research visualization” means apply this direction to that part, preserve its purpose and content, and check it in the browser. A direct request takes priority over this guide.

## Identity

Tianjian is a computational biologist and AI/ML researcher working with evolution, networks, infectious disease and research software. The central idea is that biological systems are interconnected. The visual language should suggest scientific instruments, connected observations and complex systems: elegant, precise and quietly futuristic.

Use the supplied CV and content files for factual claims. Decorative diagrams are conceptual, not experimental results. Keep the personal voice natural and concise.

## Layout and typography

- Follow the [Magic UI portfolio template](https://magicui.design/docs/templates/portfolio): narrow, centered content, a maximum width of about 768px, generous spacing and open sections.
- Use the shared section heading with a small badge, fading horizontal rules and a clear title. Keep useful text large enough to read; supporting labels generally need 14–16px, not miniature captions.
- Prefer meaningful icons and short labels over paragraphs of interface explanation. Avoid extra notes, disclaimers and decorative copy.
- Keep a bottom contact section. Home combines the biography with the introductory hero, followed by research experience, without a separate About section, teaching or language sections.

## Colour and atmosphere

- Use blue as the primary colour, with sage or eucalyptus green for scientific connections. Light mode uses deeper greens for contrast; dark mode can use pale luminous greens.
- Use thin strokes, soft halos and faint structural lines. Glowing highlights should remain distinct from their base paths. Avoid thick neon bands, rainbow accents and overpowering bloom.
- Background dots should form subtle networks, with a few edges and gently breathing nodes. In dark mode, give dots and edges enough blue contrast to remain clearly visible. Fade them away from text. Use scientific geometry in place of generic visual noise.

## Components and interaction

- Prefer real [Magic UI components](https://magicui.design/docs/components/animated-beam) and the components already installed in this project. Preserve their license notices. Adapt them to the subject rather than adding unrelated effects.
- Make hover feel polished through a small image zoom, lift, soft spotlight or coordinated glow. Do not turn every element into a control. Actual controls need keyboard and touch access, visible focus and useful accessible names.
- Animate slowly and consistently. Connected beams should have thin glowing heads and long tails over very faint solid paths. Keep comparable links at the same duration.
- Respect reduced motion, page visibility and viewport visibility. Static diagrams must still communicate their relationships. Do not add pause buttons or implementation controls.
- The theme switcher is a restrained circular button near the bottom right, above the mobile dock. Use Magic UI Animated Theme Toggler with a circular reveal from the button, theme persistence, reduced-motion support and keyboard access. Visibility is controlled by `NEXT_PUBLIC_SHOW_APPEARANCE`.

## Navigation and portrait

- Use the Dock component with regions: portrait left, navigation centre, CV and contact right. Keep the regions visually independent.
- On wide screens, navigation belongs at the top with quiet hover states. The menu and CV button have pill outlines, and icon controls are circular at every width. On small screens, use the portfolio’s bottom icon dock with spring magnification and tooltips. No text labels in the dock. The space after the portrait holds a rounded page label while the dock is at the bottom: About me, Research, Publications, Software, Blog or Footprint. The top menu and page label align directly after the portrait with a 16px gap. These labels use a pale blue and sage fill, blue text and a fine tinted outline, without a button shadow. Desktop pages have no introductory badges. Below 360px, omit the top page label too.
- Keep the portrait at about 58px. Hover adds a modest zoom and opens the profile card; tapping can pin it. The card contains the current position and professional identity, with a network background and Magic Card spotlight.
- Keep “Download CV” visible with a download icon. CV and contact actions share the menu’s surfaces, borders and hover treatment.

## Content patterns

- Blog sits between Software and Footprint. Follow the [Magic UI blog template](https://magicui.design/docs/templates/blog) with a concise introduction, illustrated exploration cards and compact technical note entries. Use colourful flat illustrations with subtle paper shadows, cobalt, teal, coral and gold on warm ivory. Give each entry a distinct image. Use Magic Card hover treatment and clear category labels. Article pages have generous reading typography, an illustration and Button navigation back to the notebook. Embedded documents use the shared controls.css theme for native simulation controls, inputs, cards and code blocks. Their theme follows the enclosing site. Interactive explorations retain their controls in a dedicated workspace with a full screen link to the migrated simulation. Article links point to the current notebook routes. The notebook owns its documents and assets inside the site directory; builds do not import pages from the repository root.

- The Papers page opens with the doctoral thesis and its supplied cover, followed by “Selected publications”. The thesis uses an open layout with its dimensional cover, without a card frame. Keep the page free of a separate introductory title and subtitle. Show first-author preprints above peer-reviewed papers, using compact, borderless entries with publisher or journal identity marks, venue headers and right-aligned dates. Read and copy actions share the same quiet link style. Keep this short list free of search controls and a bulk citation download button.

- Research opens with the approach diagram and one concise line connecting biology, models and inference, followed by programmes. Footprint includes a short travel line above its map. Software opens with Tech stack: the icon cloud, static orbital rings without beams or icon glow, and skill category titles with icons and a short selection of methods, followed by a colourful terminal index under Open source. The terminal is the software catalogue; do not repeat its projects as thumbnail cards. The terminal groups developed tools and collaborative packages with concise categories, icon-labelled technologies and accessible website/source icon links. Reserve a fixed width for links so technology columns align across rows. The terminal follows the light/dark theme, and technology labels have no background fill. Centre the Tech stack heading above a balanced skill list and icon cloud. Skill rows use circular icon badges and fine separators, with concise supporting text. Stack the cloud above the list on narrow screens. Research, Software and Footprint omit visible page titles and subtitles; their accessible page headings remain available to screen readers. Do not add separate research field cards or a heading above the diagram. Keep the tool catalogue on Software rather than repeating it on Research. Each tool has a distinct illustration in the shared blue and sage sculptural style.

- Project and software cards follow the portfolio template: clean thumbnail, Website and Source buttons on the image, concise description and technology badges. Use minimalist illustrations that match the site, not incompatible legacy thumbnails.
- Timelines use a thin vertical rule, circular institution emblems and clear dates, titles and descriptions. Use real, coloured shields or badges without wordmarks. Centre each emblem in the same circular badge and adjust its visible size, not just its image dimensions. Use white badge surfaces in light mode and dark card surfaces in dark mode, with enough emblem contrast for both.
- The research toolkit uses Font Awesome icons in the icon cloud, without text tiles. Cloud motion runs briefly on entry, then stops; avoid continuous animation and canvas glow filters.
- The Footprint map uses static blue dots on a clear background, without grid lines, a compass or a gallery button. Sample status appears in the collection heading and album cards; confirmed travel records create visit markers, while three labelled sample country markers with circular flags link to the sample albums without contributing to travel counts.
- The travel tab is called Footprint and uses a map pin icon. Its introduction focuses on places visited and moments along the way.
- Album collections use Magic Card, full image covers, readable titles and Magic UI Lens magnification with a fine glass rim. Keep text outside the lens in a theme-aware footer with the country name and a pill-shaped “Let’s go” action. Omit badges over the cover; retain the sample collection heading. Sample photographs remain labelled until personal photographs are supplied. Do not imply they document Tianjian’s travel.

## Globe and research visuals

- Preserve the globe’s dimensionality. Nodes sit on its surface, glow gently and are spread across the world, including Hawaii and New Zealand.
- Globe connections use faint solid curves and slowly travelling Magic UI beams. Place social profile icons below the home introduction, aligned with its text. Hover enlarges the globe as one unit and reveals a vertical callout from its centre to a community Shiny Button above it labelled Open HerdLink. Both the globe and the button open https://herdlink.nl in a new tab. The callout is an overlay and reserves no layout space. Reveal it on keyboard focus and keep it visible on touch screens.
- Use the documented Magic UI Glyph Matrix demo settings behind the research diagram: 14px cells, 4% mutation, 90ms intervals, 0.6 bottom fade and monochrome glyphs that follow the theme. Use the biological and mathematical character set `ATCG01·+λΣ∆`. Keep labels on clear surfaces. Animate while visible and respect reduced motion.
- Research diagrams should communicate an actual conceptual relationship: observations feed models and inference, which lead to insight and software. Use compact observation and outcome ports around a central inference processor. Concentrate the glyph field behind the processor, with clear side regions and measured curved connections to express data becoming understanding.
- Use Magic UI Aurora Text for Models & inference and Line Shadow Text for Observe and Understand. The model label sits over a half-transparent theme background with a soft, blurred fade at its edges. Apply the Rainbow Button gradient along the model tile’s inner border, respecting the panel motion policy.
- Use depth through layered rings, restrained gradients and fine lines. Motion supports the relationships; it must not obscure the labels.

## Completion checks

Check the changed section at phone and desktop sizes, in light and dark themes, with reduced motion. Check hover and keyboard behaviour where relevant, text contrast and horizontal overflow. Reuse the existing lint, build and browser checks. Keep changes scoped to the requested section and shared styles it depends on.
