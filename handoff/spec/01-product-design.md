# Product and visual design

## Purpose

Present Tianjian Qin as a computational biologist who develops methods, models and software. A visitor should understand the research within a brief scan, reach a paper or project in one or two actions, and find contact details or the CV without exploring an animation.

The audience includes scientific collaborators, researchers using the software, conference contacts and academic selection committees. The site should accommodate all of them without sounding like an application to one particular job.

## Design direction

**A quiet research profile with an interactive toolkit.** Use a vCard-like personal anchor and bounded reading surfaces, not a literal business card that traps all content in a fixed-height window. Adopt the Portfolio Template's concise type and understated UI. The chosen Magic UI effects should make the site distinctive without making every surface move.

The first visual impression is the person's name and work. The second is the quality of the scientific and software projects. Animation is the third layer.

## Desktop composition

At 1,200 CSS pixels and wider, use a centred shell with a maximum width of 1,184 px, 32 px outer padding where space permits, a 232 px identity column and a 24 px gap. The main column consumes the remaining space and must use `min-width: 0`.

The identity column contains the TQ mark or supplied portrait, name, PhD credential, professional title, current role and affiliation, CV link, email and a small group of verified social links. Do not put the complete biography, a skill cloud or a globe in the narrow rail. Keep text readable; wrapping an affiliation is preferable to shrinking it.

On a sufficiently tall desktop viewport, the rail may be sticky 28 px below the viewport top. On short viewports, at high zoom and on smaller screens it is ordinary document content. This is a layout rule based on available space, not a second internal scrollbar.

Place the labelled Dock above the main content on desktop. It has Home, Research, Papers, Software, About and Photography, in that order. It is not a fake application launcher. The rail provides identity and direct actions, while the Dock provides route navigation.

The main column has one clear page title, then distinct sections or cards. Do not wrap every sentence in a separate tile. A research card can contain an illustration, title, description, status and two links, but its text must not become a dense dashboard readout.

## Responsive composition

Below 1,024 px, stack the identity header and main content. Use a compact horizontal identity arrangement when it fits, then a vertical arrangement on narrow phones. At widths below 768 px, the Dock becomes bottom navigation with permanent labels, 44 px or larger hit areas and safe-area padding. At widths below 640 px, place its six destinations in a three-column, two-row grid; at 640–767 px use one row. Keep the full Photography label and at least 12 px label text. Reserve the measured bar height, safe area and an additional 16 px in page-bottom spacing. Do not squeeze six clipped labels into a phone-width row. No pointer magnification is used in the phone navigation.

Use 16 px page gutters on a 360 px phone, 24 px on tablets and 32 px on larger screens. Card padding is 20 px on phones and 24–28 px on desktop. Two-column research cards become one column below 640 px. Do not force a 400 px canvas inside a 328 px card.

Use native document scrolling at all widths. No scroll hijacking, mandatory page-turn transition, draggable window, fixed-height content viewport or horizontal carousel for papers.

## Palette and surfaces

The accent is the restrained blue already present in the supplied CV, not a claim of university branding. Use [the token file](../reference/design-tokens.css) as the starting point.

| Role | Light | Dark |
|---|---|---|
| Page background | `#F5F6F8` | `#10151D` |
| Main surface | `#FFFFFF` | `#171F2B` |
| Secondary surface | `#EEF2F7` | `#202B3A` |
| Primary text | `#182230` | `#E8EDF5` |
| Secondary text | `#566273` | `#B4C0D1` |
| Accent/link | `#315BA6` | `#93B7FF` |
| Hairline border | `#DDE3EA` | `#354255` |

Use 24 px for the outer surface, 18 px for nested project cards and 10–12 px for small controls. Use shadows sparingly: a subtle elevation on the outer frame, little or none inside it. Do not put a shadow, border glow, shimmer and spotlight on the same card.

Do not use the pale hairline border as the sole way to identify an interactive control. Controls need clear text, adequate boundaries and a visible focus ring. Colours in the provided contrast report are token checks, not a claim that every final component meets contrast requirements.

## Typography

Use the starter's sans-serif approach with a locally served, properly licensed family through Next.js font handling. Geist Sans is a suitable choice if available in the selected stack. Use a mono face only in Terminal, small code-like labels and technical metadata. Do not distribute font files from the handoff environment.

Desktop page title: 36–42 px with a short measure. Mobile: 28–32 px. Section titles: 22–26 px. Body: 16 px, line height about 1.6. Metadata: 13–14 px. Avoid essential text below 12 px and avoid all-caps paragraphs. Limit prose measures to roughly 65–75 characters while allowing publication titles to use the available width.

Use “Tianjian Qin” and “Computational Biologist & AI/ML Researcher” as stable identity text. The title does not rotate between professions. No typing animation on the name or required introduction.

## Component choreography

Home contains the Globe and selected project cards. Research contains the Animated Beam diagram. Software contains the Terminal followed by the semantic toolkit and Icon Cloud. Photography contains the Dotted Map above country album cards. These placements provide all five signature components without placing them together in the first viewport. The Home Globe describes academic context; the Photography map describes only owner-confirmed travel.

Magic Card is a restrained pointer effect on selected research cards. Bento Grid provides a regular internal layout rather than an irregular full-page mosaic. Grid Pattern belongs only inside the methods diagram. Scroll Progress belongs only to long project pages. Blur Fade is a finite entrance for decoration, not a gate for reading content.

Continuous motion must have visible controls. Hover effects must also have keyboard and touch equivalents for the actual action. Do not make scientific text glow, move or appear only on hover.

## Imagery

Use authentic screenshots, supplied figures or clearly illustrative diagrams. Initial project art may be small vector compositions: a tree for evolutionary inference, a schematic temporal network for NetForge, and typography or a verified screenshot for HerdLink. These are visual identifiers, not empirical results. Do not display fabricated axes, prevalence curves, accuracy scores, geographic data or simulation output.

The TQ monogram is an intentional identity mark. Do not generate a person and present it as Tianjian. Do not hotlink an unrelated avatar from the starter. The site must still look finished with the monogram and without a hero photo.

## Photography composition

Use the same shell, identity rail, palette and card radii. The page opens with a short heading, a quiet travel-summary card containing Dotted Map, and an orderly grid of country albums. Use a 2:1 map viewport without clipping the world to fill a tall card. The map stays static; small blue markers and a readable count are enough. Photographs keep their original colours, not the interface accent or a global filter. Use 3:2 cover frames for album cards and natural-aspect images within albums. Full images open in a calm, accessible viewer, not a device mockup or a hover lens.

Use a three-column album grid only when the main content width supports it; use two columns on medium widths and one on narrow phones. Do not add the travel map to Home or replace the academic Globe. Details and data rules are in [the photography contract](10-photography.md).

## Visual approval criteria

At desktop size, the profile and current page title form the primary hierarchy. A project should not look like a SaaS pricing card. At phone size, title wrapping, paragraph measures and button spacing remain deliberate. Light and dark modes receive separate visual review rather than relying on blanket colour inversion.

Reject a build when it has more than one dominant accent, oversized marketing headings, multiple competing background effects, clipped card content, tiny text, glowing borders everywhere, unlabeled navigation, or obvious starter placeholder content. The target is an authored personal site, not a catalogue demo.
