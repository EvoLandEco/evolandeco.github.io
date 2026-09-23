# Signature component contracts

## Evidence and integration boundary

These notes are based on source inspection at Magic UI revision `d7207e5692d14c00dceafa8488d6d01f197fa0e4`. Read the actual installed files before implementation. The public registry may serve a different revision by the time the site is built. Record its hash and adjust the integration to the inspected API rather than forcing an obsolete interface.

A **site adapter** below means a controlled interface to implement in local source, not an existing Magic UI prop. Upstream components are the starting point. Do not replace them with unrelated libraries merely to avoid integration work.

Sources: [Globe](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/globe.tsx), [Icon Cloud](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/icon-cloud.tsx), [Terminal](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/terminal.tsx), [Animated Beam](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/animated-beam.tsx).

## Shared presentation and lifecycle

Each visual has a normal semantic content model and a decorative or illustrative renderer. The words and links are not reconstructed from canvas pixels. Give every panel a real heading. Make the diagram or canvas nonessential to accessing the content, and provide a short meaningful description rather than announcing every animated element.

Implement one motion preference model shared by the site. The state has a user preference (`system` or `paused`) and the operating system's reduced-motion preference. A panel also knows whether it is visible and whether its page is active. Continuous decorative motion is allowed only when the user has not paused it, reduced motion is not requested, the document is visible and the panel intersects the viewport. An explicit per-panel pause also stops that panel. Resuming a panel must not override a global pause or system preference.

Provide a clearly labelled global motion control in site settings and a nearby pause/play control for continuously moving visual panels. Store a user's explicit preference locally. The server renders a stable static presentation; hydration can enable motion after the preference is known. This is deliberate motion design, not a catch-all error handler.

Do not use a CSS `animation: none` rule as the only pause mechanism for JavaScript or WebGL animation. Cancel component-owned timers and frame callbacks on unmount; disconnect observers and release resources. Stop work when panels are offscreen. For a library-owned render loop, inspect its actual lifecycle API and record what stopping means. “Rotation stopped” and “GPU renderer destroyed” are different assertions.

Use frame-time based angular motion rather than a fixed angle increment on every frame. Keep timestamps local to active intervals so resume does not accumulate time spent paused. Do not invent performance tiers from user-agent strings or silently replace the visual with fake content.

## 1. Globe → Academic path

### Content and design

Place one Globe card on Home, with an explicit sized relative container. Target roughly 280–340 px of visible globe diameter on desktop and a size derived from the available inner card width on mobile. Do not let an absolutely positioned canvas expand the page or cover nearby text. Use the shared blue accent, a neutral globe surface and a small plain caption.

The content is the academic path represented by the institutions in the CV: Nanjing Normal University, Beijing Forestry University, University of Groningen and Wageningen University & Research. Use city-level schematic markers only after verifying city-centre coordinates. The handoff deliberately leaves the coordinates null. A neutral marker-free globe can be the finished design until those reference coordinates are supplied. It is not a reason to substitute arbitrary demo cities.

Keep “Based in the Netherlands” as text drawn from the CV. Do not infer home address, nationality, live location, collaborations, travel or international impact. Marker size is a visual constant, not a metric. The full institution list is ordinary text on About.

### Actual upstream interface

`Globe` accepts `className` and `config`, where `config` is a complete `COBEOptions` object. The inspected registry uses `cobe@^0.6.4` and `motion`. There is no upstream `paused`, `markers` or `onMarkerClick` prop on this component.

The default configuration contains arbitrary world-city markers. A supplied configuration replaces that default rather than receiving a safe partial merge. Build a complete, stable configuration with the actual installed COBE type. Do not create a new object every render and thereby recreate the globe continually.

The component supplies its own `onRender` after spreading the configuration. Passing a custom `config.onRender` therefore does not control rotation in the inspected implementation. A controlled pause must be implemented in the local component, not asserted by passing an ignored callback.

### Source work required

Introduce explicit local control of autorotation. Keep the renderer's orientation in refs and let the global/per-panel policy control the angle advance. Choose a slow angular rate, approximately 0.08 radians per second, and verify it visually. When paused, the orientation does not move. If the COBE version still renders a stationary frame internally, document that distinction; destroy the renderer when offscreen or unmounted to release its resources.

Use a ResizeObserver on the card or canvas container. The upstream implementation listens only to window resize and assumes a fixed pixel ratio. Measure logical CSS dimensions, then set backing-store dimensions consistently with the actual renderer's device-pixel-ratio contract. Do not multiply by DPR twice. Test browser zoom and container changes as well as window resizing.

The inspected pointer implementation accumulates displacement from the initial pointer position into the angle on every event. Correct the drag model to `dragStartAngle + (currentX - dragStartX) / sensitivity`, or use incremental displacement with an explicitly maintained previous coordinate. A pointer at x = 0 is still an active pointer; test against null rather than truthiness. Use Pointer Events, capture/release and cancellation handling. Preserve vertical page scrolling on touch and do not start an unwanted inertial spin under reduced motion.

Clear any pending opacity timers and remove listeners during cleanup. Verify theme changes and navigation do not leave multiple canvases or WebGL contexts alive. No random geographic information enters the configuration.

### Completion tests

The globe is visible at 360 px viewport width with no clipping of controls. Pause stops orientation changes; resume does not jump. The local renderer count returns to its baseline after repeated route visits. The same academic-path text is available with JavaScript disabled and in reduced motion. No arbitrary demo markers survive.

## 2. Icon Cloud → Research toolkit

### Content and design

Use the 15 CV-supported items in `data/portfolio.json`: Python, R, C++, JavaScript, PyTorch, React, D3.js, Docker, Git, Linux, SQL, Three.js, Vite, Bash and LaTeX. SQL may use a neutral database symbol with a text label, since it is not a single vendor product. Do not invent a brand or a proficiency number.

Place the cloud beside or above an ordinary grouped toolkit list on Software. The semantic list is the content; the cloud is a compact visual companion. Avoid a rainbow of logos dominating the page. Use permitted monochrome brand variants or simple neutral symbols, with clear labels in the list. Do not stretch logos or ignore their usage terms.

### Actual upstream interface

The inspected implementation is a Canvas2D renderer with spherical icon positions. Its interface is `icons`, `images` and `showControl` (default true). It is not the older implementation using `iconSlugs` and a different tag-cloud package. Do not add `react-icon-cloud` based on an old tutorial.

The component includes a pause control and a reduced-motion listener. Its pause state is internal. A parent-controlled site policy therefore needs an explicit local interface, such as a controlled `playing` value plus a callback. That interface must be documented as local.

Prefer stable `images` paths to locally stored SVG files. The `icons` branch renders React elements into SVG strings; do not import server-rendering machinery into the client bundle unnecessarily. Do not fetch logos from a CDN on every visit.

### Source work required

The inspected canvas is 400 × 400 with mouse-based handlers. Implement responsive logical dimensions and consistent pointer coordinates rather than shrinking the canvas with CSS alone. The transform used for hit testing must be identical to the transform used for drawing. Apply rotation matrices consistently and use the transformed depth for projection and ordering. Test scaling and high-DPR displays.

Use a stable item list and locally validated assets so ordinary parent renders do not rebuild all icon canvases or reset the sphere. Keep animation values in refs where possible rather than scheduling React state changes on every frame.

Asset loading must reach a terminal state on both success and error. The source continues requesting animation frames while assets are pending; a broken image must not produce a permanent pending loop. The build validates every local asset. A failed asset is a recorded failure to repair, not permission to silently substitute a misleading logo.

For reduced motion, render a stationary arrangement. Dragging or pointer proximity must not restart continuous decorative motion against the site preference. Keep controls outside the decorative canvas's accessibility-hidden region. Do not make canvas hotspots the sole links to software or qualifications.

### Completion tests

All 15 labels exist in the semantic list and all referenced assets resolve. Pointer hit testing remains aligned at 360, 768 and 1440 px viewports and device scale factors 1 and 2. Pausing stops positional changes. A deliberately broken test asset produces a clear failure and no perpetual asset-wait render loop. Offscreen/unmounted instances release their listeners and frame callbacks.

## 3. Terminal → Software index

### Content and design

Use one modest terminal-like card on Software, titled `software.index`. It presents actual software names and contribution roles from the central content data. It is a read-only personal catalogue, not a claim that a command has executed.

A suitable transcript is a short structured list: EvoNN — Developer; evesim — Developer; NetForge — Developer; HerdLink — Developer. A second clearly labelled group can list collaborative packages. Use plain links outside the animated transcript for immediate access to every project.

Do not invent shell commands, installation instructions, validation logs, simulation outcomes, accuracy values or green “all tests passed” output. A code-looking panel must not manufacture technical evidence.

### Actual upstream interface

`Terminal` has `children`, `className`, `sequence` (default true) and `startOnView` (default true). The same module exports `AnimatedSpan` and `TypingAnimation`. This last export is distinct from the standalone component with the same name. Use an import alias such as `TerminalTypingAnimation` to keep the distinction clear.

The inspected typing component requires a string child. Its `duration` is milliseconds per character and its `delay` is milliseconds. These units differ from Motion's normal seconds. Inside the Terminal sequence, item order controls timing; the per-item animation delay is not the sequence scheduler.

### Source work required

Terminal sequencing assigns an index to each direct child. Only sequence-aware children signal completion. An ordinary element or a fragment grouping multiple items can stall or misorder the sequence. Use direct sequence-aware children for the animated transcript, or disable sequencing for a static content presentation. Do not patch a stalled sequence with arbitrary timeouts.

Use a brief one-shot animation, not a perpetual replay. A “Show full output” control immediately reveals the whole transcript. Under reduced motion or global pause, show the complete content without character-by-character animation. Keep a complete semantic transcript available from the start and avoid duplicate screen-reader announcements. Do not use an assertive live region for each character.

Keep card height stable during the short reveal while allowing text wrapping at narrow widths. Do not apply a fixed height that clips the final content. Render code-like text with valid HTML semantics; the source's `pre`/`code` wrapper may need a local structural adjustment when integrating block children. Keep the source's decorative window dots neutral or low emphasis, rather than introducing a competing colour scheme.

### Completion tests

Every catalogue fact is traceable to the seed. “Show full output” works at any sequence position. A refresh or route change leaves no typing intervals. The static representation is readable without JavaScript. The test suite exercises multiple direct sequence children and confirms that all complete in order; it does not rely on guessed total delays.

## 4. Animated Beam → Research approach

### Content and design

The diagram has three observation nodes: **Phylogenies**, **Temporal networks**, **Spatial observations**. These connect to **Models & inference**, which connects to **Scientific insight** and **Research software**. This is a broad representation of related work, not a production architecture claiming that every dataset enters one shared system.

Use real text labels and a caption. Place nodes on a predictable CSS grid with enough space for line routing. Use one blue hue for the moving highlight, subdued grey static paths and restrained line widths. Default orange-to-purple beams from the demo do not match the site palette.

On desktop use a left-to-right arrangement. On mobile use a vertical arrangement designed for the available width; do not merely shrink the desktop diagram. Keep the labelled nodes navigable and readable even when the SVG layer is absent. The SVG can be decorative when the adjacent text explains the relationships.

### Actual upstream interface

Required refs are `containerRef`, `fromRef` and `toRef`, each referring to an HTML element. Other inspected props include `curvature`, `reverse`, `pathColor`, `pathWidth`, `pathOpacity`, `gradientStartColor`, `gradientStopColor`, `delay`, `duration`, `repeat`, `repeatDelay` and four endpoint offsets.

The timing props are in seconds. `repeat` defaults to infinity. Setting `repeat={0}` gives a single animation, not a stationary path. There is no upstream pause or reduced-motion prop on the inspected component.

### Source work required

Make the container positioned, keep nodes above the SVG paths and use pointer-events none on the decorative layer. All connection coordinates are measured relative to the same container. Do not pass a different ancestor ref or apply a transform to one coordinate system without accounting for it.

The component observes the container size; it does not comprehensively observe every node or position change. Measure when node size, diagram orientation, font metrics or relevant layout state changes. Observe node sizes and use layout-aware effects for the chosen grid. Do not repair line alignment through a collection of unexplained pixel offsets or delayed timers.

Implement an explicit local animation-control path. A stationary state shows the same neutral connections with no moving gradient. A pause stops the animation rather than hiding a still-running layer. Keep unique IDs per beam and verify hydration does not duplicate gradient IDs.

The diagram's links are ordinary HTML anchors on labelled nodes or in its caption. The moving highlight is not an interactive target. Reverse animation changes presentation, not the scientific meaning of an edge.

### Completion tests

At mobile, tablet and desktop widths, beam endpoints meet the intended nodes after fonts load and after resizing. Labels do not intersect paths so heavily that reading becomes difficult. Reduced motion shows complete static relationships. Keyboard navigation reaches all real links. Screen readers receive a clear description of the approach without a list of meaningless SVG fragments.


## Dotted Map · Photography

**Required on `/photography`.** Use the free Magic UI component, not an image that imitates it. The full data, viewer and media contract is in [10-photography.md](10-photography.md).

The inspected source renders SVG through `svg-dotted-map`, accepts generic marker metadata and supplies projected coordinates to `renderMarkerOverlay`. Its marker input uses `lat` and `lng`; overlay marker objects carry `x` and `y` instead. Both global and per-marker flags can enable its built-in SVG pulse. [Pinned source](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/magicui/dotted-map.tsx).

Implement a site-owned `PhotographyMap` with a stable 150 × 75 viewBox and 2:1 container, neutral dots and the shared blue accent. Build markers from the public confirmed-country selector. Use an album URL only when that country has a published album. Supply `pulse={false}` and `pulse: false` for every marker; no automatic animation is required. The public country list and verified total remain normal HTML.

Use the provided `x`, `y` and `r` for any marker overlay, rather than a second lat/lng projection or guessed pixel offset. Country markers are representative locations, not camera GPS or a travel itinerary. Render missing-coordinate countries in the list and count without making up marker positions. The total comes from unique public confirmed country records, never the number of rendered markers, photographs or visits.

A public country with no published album is labelled “Album not published” in the country list and has no dead album link. The implementation must not scrape flags, infer border shapes, fabricate a travel log, add a percentage of the world visited, or reuse academic Globe markers as travel evidence.

With no supplied travel records, render the real unmarked map and the specified empty state, with no numeric visit claim. Test populated cases using the synthetic fixture outside the production build. Set `data-testid="signature-dotted-map"` on the real panel and `data-motion-state="static"`; assert actual SVG dots and absence of `<animate>` elements as well as the attribute.
