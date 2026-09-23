# Photography, country albums and travel map

## Product contract

Photography is the sixth main destination, after About. It is a personal photographic archive within the same restrained Magic UI portfolio, not a separate travel blog or commercial gallery. Keep the identity rail, neutral surfaces, blue accent, rounded corners and natural page scrolling.

Ship `/photography`, country albums at `/photography/[country]`, full-photo pages at `/photography/[country]/[photo]`, a Dotted Map, truthful travel totals and an accessible viewer. Keep the Home Globe in its academic role. Do not use either map as a live location display.

No photographs or confirmed country inventory are included. The application must support the entire experience and test it with isolated synthetic records while the production page displays its actual empty state. Missing owner media is a content input, not a reason to omit routes, map integration, image processing or tests.

## Index layout

Use the heading **Photography** and the line **Photographs, collected by country.** The order is a travel-summary card, the country list, then country albums. The content column remains within the same shell; photographs provide colour without changing the interface palette.

The summary card contains a static Dotted Map and a compact text summary. Use a 2:1 map aspect ratio and the full world extent. Do not crop the world into a decorative banner. Base dots are quiet neutral marks; selected country points use the existing blue accent. No glowing borders, aircraft paths, looping pulses, flags fetched from a third party or animated counters are needed.

Country cards use a 3:2 cover, country name and published photo count. Use three columns only when the content column can support readable cards, two at medium widths and one below 480 px. Cards have a clear album link that is available on touch and keyboard; do not place essential information only on hover. Use restrained border or shadow feedback, not a colour filter over the photographs.

Sort albums by country name using a fixed English collation. A small search input can filter cards by country name, with a clear reset and no-results message. Store this filter in the URL only if the implementation also handles direct loading and Back/Forward. Search does not change the travel total or the complete country list.

A visited country without a published album remains in the country list as plain text with **Album not published**. It is not a clickable empty card. A published album has a real cover and at least one approved photograph.

## Six-destination navigation

Keep the order Home, Research, Papers, Software, About, Photography. Use the Camera icon for Photography. All country and photo routes activate the Photography item.

Desktop uses the labelled Dock. Below 640 px, the phone navigation has three columns and two rows, with permanent full labels and at least 44 px hit areas. At 640–767 px use one row. The content bottom padding includes the rendered bar height and safe area. The phone bar has no pointer magnification. Test at 360 px and 200% zoom; do not hide overflow or shrink labels to force a single row.

## Travel data and counting

Use `data/photography.json`, separate from the professional manifest and academic Globe. The reference types and selectors are in [photography-model.ts](../reference/photography-model.ts). They describe content; the application supplies the UI, file checks and media pipeline.

A country record has a stable uppercase two-letter code, a display name, a unique lowercase route slug, `visitConfirmed`, `visibility`, and a reviewed representative `mapMarker` or null. Codes are identifiers, not a political classification engine. Validate actual country identifiers against a pinned source during content entry; keep naming and counting scope under the owner's control rather than inferring it from map geometry. Do not display a percentage or denominator for “all countries”.

Use one record per country and at most one album per country. Additional trips add photographs to the same album, not another countable country. The manifest does not need a trip table to support this behaviour.

The public confirmed-country set is:

```text
countries where visibility == public and visitConfirmed == true
```

Its size is the country total. A country with no marker coordinates still contributes. A country with an unpublished album still contributes. Private or unconfirmed countries do not contribute to a public total or map. Published album and photo totals have their own selectors; neither is a substitute for the country count.

`travelLogStatus` has three states:

| State | Public wording |
|---|---|
| `unconfirmed` | No numeric travel claim. This is the supplied seed. |
| `partial` | **N countries documented**. The public inventory is incomplete. |
| `complete` | **N countries visited**. The owner has confirmed this is a complete public inventory. |

Do not mark the list complete from the CV, affiliations, languages, conferences or conversation context. A complete list must not contain confirmed private records; use partial when public totals intentionally omit private visits. Zero is a valid confirmed total, but an empty unconfirmed seed is not evidence of zero travel.

An album has its own ID, `countryCode`, title, description, publication status, cover-photo ID and an explicit ordered list of photo IDs. A photo has its own ID, album ID, publication status, source path, publication approval, creator permission, alt text, nullable caption/date/location label and a public derivative descriptor. A published record must pass every publication requirement.

The production manifest has `fixtureOnly: false`. Test data has `fixtureOnly: true` and must be rejected by the production validator. Structural and relational errors fail validation with a path-specific message. Do not silently deduplicate country records, drop broken images or choose an arbitrary cover to make invalid data render.

## Dotted Map integration

Install the free component through the existing registry configuration:

```bash
pnpm dlx shadcn@latest add @magicui/dotted-map
```

Inspect the installed source and its dependency before use. The pinned source is `apps/www/registry/magicui/dotted-map.tsx` at `d7207e5692d14c00dceafa8488d6d01f197fa0e4`; Git blob `fbb85928fc721dd89230dce4b374ee7aedf9bc85`. The dependency is `svg-dotted-map`.

The component accepts latitude/longitude markers and exposes projected overlay coordinates through `renderMarkerOverlay`. Retain this projection for all overlays. Generic marker metadata may carry country code, label and album URL; do not expect latitude/longitude inside the projected overlay record. Both the global and per-marker pulse controls must be false for this design. [Official documentation](https://magicui.design/docs/components/dotted-map) · [source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/dotted-map.tsx).

Use width 150 and height 75 for the SVG coordinates, a stable sample count and responsive CSS for physical size. Do not make sample count depend on random performance estimates or browser width. Keep SVG generation out of repeated pointer or search updates; a server-rendered static map is appropriate when the installed source supports it. Any local memoization must depend on the actual generation inputs, not hide inconsistent state.

Create one marker for every public confirmed country with reviewed coordinates. Country centres or another reviewed representative point are navigation aids, not where a photograph was taken. Keep geographic points at their actual projected coordinates. Do not jitter markers to make a crowded region look neat.

The required navigation is the visible HTML country list and album cards. Marker overlays may link to published country albums when their hit areas remain distinct and usable; do not require marker clicking to reach an album. Use the same projected coordinates for the visible mark and its overlay. Give an SVG link an accessible name and visible focus style; an SVG `role="img"` wrapper must not hide interactive children from assistive technology. The simplest accessible composition is a labelled, noninteractive map figure paired with the complete country-link list.

If markers crowd together, retain exact locations and the country list rather than layering oversized invisible hit targets. Do not create a separate equirectangular projection or CSS percentage calculation over the SVG. Missing coordinates cause no marker, not a missing country or an invented coordinate.

Use `data-testid="signature-dotted-map"` on the real panel. Its `data-motion-state` is `static`. Test for actual SVG dots and no `<animate>` descendants, not just a label that says the map is static.

## Country albums and image presentation

Each published country has one route with country title, a short owner-written introduction when supplied, published photo count and the ordered gallery. Multiple journeys can be described in that introduction or represented by owner-approved photo dates; they remain one country album.

Use an ordinary CSS grid with natural image aspect ratios and a clear reading order. Keep source, visual and keyboard order aligned. Do not use dense packing or masonry that moves the visual sequence away from the DOM sequence. A regular one- or two-column gallery is a deliberate design choice, not an unfinished masonry layout.

Cover cards can crop within a 3:2 frame. Album images and the full-image viewer show the whole photograph without forced landscape cropping. A portrait, landscape and panorama must each remain legible. Preserve the photographer's colour treatment; the light/dark interface must not invert, desaturate or tint the image.

Each photograph has a normal link to its full-photo route. The route includes a large image, available caption, creator credit, album link and adjacent-photo links. Show `takenOn` and `locationLabel` only when approved. Do not infer precise places from embedded GPS or invent dates from file modification time. Public dates retain the supplied precision: year, month or day.

## Accessible viewer and browser history

Enhance unmodified same-tab photo-link activation with a lightweight lightbox using the existing shadcn/Radix dialog primitives, not Magic UI Lens or Hero Video Dialog. Do not ship a second large gallery framework only to obtain a modal.

Keep the image in a contain-fit viewport with space for caption and controls. Provide labelled Close, Previous photo and Next photo controls with touch-sized targets. Use Escape to close and left/right keys for adjacent images, except while an input or editable element has focus. Do not autoplay. Do not globally disable browser zoom or vertical touch scrolling. A full-photo page remains the large-image access path; custom pinch-zoom physics are outside the first build.

Use a real modal with an accessible name, focus containment, initial focus on a meaningful control and focus restoration to the originating photo link. The background is inert while open. After changing images, announce a short position such as “2 of 12”, not the whole image description repeatedly. On narrow screens the viewer may occupy the full viewport while preserving safe-area clearance. [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Use this history contract: opening from an album adds one photo URL entry; stepping through images replaces that entry; closing returns to the originating album entry and restores focus/scroll. A direct photo URL is a full page with an album link, not a modal that assumes a parent history entry exists. Browser Forward after closing may reopen the viewer from that recorded album state; reloading a photo URL renders the full page. Modified clicks and “open in new tab” retain normal link semantics.

Implement this with a router-aware state model or App Router route interception after checking the chosen version. The behaviour is the contract; do not rely on unconditional `history.back()` when no album-origin state exists. Test Back/Forward, refresh, first/last photo and close after navigating between images.

## Media preparation and privacy boundary

Originals belong in an owner-controlled private input directory, not `public/`, tracked source, browser storage or the handoff. The authored manifest also belongs outside the deployable application tree. Generate a public content manifest with `getPublicPhotography` during content preparation, and let app routes import only that generated allowlist. Do not bundle raw private records on the server and assume that makes the deployment archive private. The manifest's `sourcePath` is internal build input and never part of a client prop. Keep a permission/provenance record for each photograph. Code licences do not grant rights to photographs.

Codex must implement a two-stage local media workflow. **Prepare** accepts explicitly selected photographs with owner approval and creator permission, including records whose status is still draft and whose `image` is null. It writes orientation-correct derivatives and their proposed public paths, dimensions and checksums into private staging, not `public/`. This lets the owner inspect a real image before changing its publication state. **Publish** validates the completed content manifest, selects only the public projection, checks its staged derivatives and produces the managed public image folder. An album can therefore be prepared while it is draft without exposing it.

The draft-compatible prepare validator checks source shape, relations and permission without requiring a public image for draft records. The publication validator requires the full published-image and cover contracts. Both fail on missing sources, unsupported files, unsafe paths, symlink escapes or undecodable media. Never publish all files found in an input or staging directory.

Use a maintained image library such as Sharp. Convert deliberately to a web colour space, apply the source orientation, resize without enlargement and remove embedded metadata. Sharp strips metadata by default unless retention methods are used; do not call its metadata-retention methods for these derivatives. Inspect output metadata in tests rather than assuming a flag guarantees privacy. [Sharp output documentation](https://sharp.pixelplumbing.com/api-output/).

A cleaned display master with a maximum long edge of 2,400 px is a starting target; keep smaller sources at their natural size. Use WebP or another tested web format at a quality setting chosen through actual photo review. Never generate larger source dimensions by upscaling. Preserve the original input unchanged in its private location.

When hosting supports Next.js image optimization, use the cleaned master as the source with intrinsic dimensions and an accurate `sizes` expression for the actual shell and gallery. Lazy-load offscreen images; preload only a measured initial image, not the whole gallery. Next.js uses intrinsic dimensions to reserve layout and `sizes` to select responsive resources. [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image).

For static hosting, generate width variants at build time and serve them through a tested loader or `<picture>`/`srcset` composition. Do not assume the default image optimizer works in a static export. Choose one documented asset strategy for the selected hosting arrangement.

Publish through a fresh staging directory containing only approved derivatives, then replace the managed `public/photography/media/` output after validation succeeds. This prevents files from a hidden album remaining publicly reachable. Test that private/draft image names do not occur in public assets, emitted routes, JSON, client chunks, source maps, metadata or deployment archives. Explicitly test URLs for hidden assets.

Do not offer camera-original downloads in the first build. Do not claim that disabling right-click protects images; every publicly displayed photograph is retrievable. No upload service, authentication, image CMS, cloud account or recurring paid service is required.

## Empty content and fixtures

The supplied `travelLogStatus` is `unconfirmed`; arrays are empty. Render the actual unmarked Dotted Map, the Photography heading and **Albums are being curated.** Omit the visit count and empty album/photo metric tiles. Do not write “0 countries visited”, populate sample travel dates or infer countries from the CV.

The reference fixture contains explicitly synthetic country, album and photo records. A separate test task may create labelled geometric image files solely in its own build output. It must not fetch stock photographs or present its fixture as Tianjian's work. Run tests against the true empty manifest as well as this populated test build.

Acceptance requires a functioning gallery and viewer demonstrated with fixtures, plus an accurate statement that owner travel records and photographs are still needed to populate the live archive. Do not declare an empty page alone to be a tested photographic gallery.

## Delivery evidence

Provide tests for unique country counts, publication selectors, invalid relationships, same-country repeat visits, empty/partial/complete logs, missing coordinates, published covers and fixture rejection. The reference model tests cover the data portion; physical file privacy and the Next.js UI require separate implementation tests.

Record screenshots for the empty index, populated index, one album with mixed aspect ratios, and a full-image viewer at desktop and phone sizes in both themes. Verify ordinary links without JavaScript, modal keyboard behaviour, six-item navigation clearance, image colour/orientation, network loading and file metadata.

Deliver a short owner guide and exact commands for adding a country, adding photographs to an existing album, preparing and reviewing private derivatives, approving a cover, publishing/hiding an album, and running validation. No manual JSX edits should be necessary to add another country album.
