# Free component and building-block audit

Audit date: 21 September 2026. See [upstream pins](../data/upstream-lock.json).

## Scope and method

The catalogue covers all **77 component pages** in the official documentation navigation at the pinned library revision. The inventory was cross-checked against the public registry metadata. The five required signature components, including Dotted Map, received implementation-level source review. Other entries received catalogue and registry review, not a complete browser, accessibility or performance audit. Codex must inspect and test every component actually shipped.

The catalogue is not an instruction to install the whole library. **Core** means required in the first complete implementation. **Supporting** means part of the agreed composition. **Asset-gated** means use when an authentic asset is available. **Reserve** means a possible future content use, not unfinished scope. **Exclude** means a poor fit for this site, not a judgement that the component is defective.

The machine-readable equivalent is [magicui-catalog.json](../data/magicui-catalog.json). Decisions below are design recommendations for this portfolio; APIs and availability are grounded in the official sources.

## Sources

- [Official component navigation](https://magicui.design/docs/templates/portfolio)
- [Pinned documentation navigation](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/config/docs.ts)
- [Pinned application registry](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/registry-ui.ts)
- [Public source licence](https://github.com/magicuidesign/magicui/blob/d7207e5692d14c00dceafa8488d6d01f197fa0e4/LICENSE.md)
- [Installation and namespaced registry use](https://magicui.design/docs/installation)

## Building blocks and free templates

**Portfolio** is the implementation base, not just visual inspiration. Preserve its Next.js application, trusted local MDX infrastructure, theme handling and useful card components. Rework the home composition and content model to match this suite. [Template](https://magicui.design/docs/templates/portfolio) · [Source](https://github.com/magicuidesign/portfolio).

**Blog** and **Changelog** are also listed without Pro flags. They are reference implementations for article/release presentation, not a reason to introduce a second content engine. The existing Portfolio content-collections setup is sufficient. Do not publish template demo posts as Tianjian's writing. [Blog](https://magicui.design/docs/templates/blog) · [Changelog](https://magicui.design/docs/templates/changelog).

**Public composition examples** are the relevant free building blocks: the Bento Grid examples combine smaller components; the Animated Beam examples demonstrate connection arrangements; the Terminal, Dock, Globe and Icon Cloud demos demonstrate their intended composition. These are examples within the free library, not an independently verified catalogue of full free marketing sections. Inspect the corresponding files in [registry/example](https://github.com/magicuidesign/magicui/tree/d7207e5692d14c00dceafa8488d6d01f197fa0e4/apps/www/registry/example).

| Example family | Reuse in this site | Constraint |
|---|---|---|
| Portfolio sections and project cards | Profile, research cards, experience and contact | Retain meaningful source lineage; remove unowned demo content. |
| Bento Grid and vertical Bento examples | Layout composition within the reading surface | No giant dashboard; calls to action remain visible on touch. |
| Animated Beam connection examples | Labelled observations → modelling → outputs diagram | Connections express a broad research approach, not actual data traffic. |
| Globe and Icon Cloud examples | Academic path and research toolkit | Replace arbitrary markers and the demo's technology list. |
| Terminal examples | A short software catalogue presentation | No invented CLI, install instructions or simulation results. |
| Dock examples | Six labelled route links | Full labels with a three-column, two-row layout on narrow phones. |
| Dotted Map examples | Country album index and confirmed travel summary | Use the SVG projection and a separate authoritative travel list; no flags or geographic claims copied from the demo. |

The official **50+ blocks** promotion points to **Magic UI Pro**. Those paid sections and the CodeForge, AI Agent, Dev Tool, Mobile, SaaS and Startup templates are outside this implementation. Public visibility of a paid demo is not permission to copy its source or assets.

[Legacy documentation](https://magicui.design/docs/legacy) identifies a separate Tailwind v3 site. This suite targets the current Tailwind v4 ecosystem. Do not mix its registry CSS and APIs with v3 examples.

## Component decisions

### Components

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Marquee](https://magicui.design/docs/components/marquee) | Reserve | A short logo strip only when there is a real need. Never move publication titles. | Continuous motion; cloned children need accessibility handling. |
| [Terminal](https://magicui.design/docs/components/terminal) | Core | Read-only software catalogue on /software. | Sequence semantics, text availability and timers require source integration. |
| [Hero Video Dialog](https://magicui.design/docs/components/hero-video-dialog) | Reserve | A project recording after an authentic recording is supplied. | Keyboard dialog behaviour, focus return and video loading must be tested. |
| [Bento Grid](https://magicui.design/docs/components/bento-grid) | Supporting | A regular two-column grid for selected research inside the main content panel. | Do not hide links until hover or force equal heights on long prose. |
| [Animated List](https://magicui.design/docs/components/animated-list) | Reserve | A small chronological activity list when dated source material exists. | Avoid simulated notifications, looping updates and fabricated activity. |
| [Dock](https://magicui.design/docs/components/dock) | Supporting | Six labelled destinations with restrained desktop pointer magnification. | Touch targets, keyboard focus, safe-area spacing and route state. |
| [Globe](https://magicui.design/docs/components/globe) | Core | Academic-path card on the overview page. | WebGL lifecycle, full config, deterministic orientation and accessible text. |
| [Tweet Card](https://magicui.design/docs/components/tweet-card) | Exclude | No embedded social stream in the professional site. | Third-party fetching and personal-content provenance add unnecessary work. |
| [Orbiting Circles](https://magicui.design/docs/components/orbiting-circles) | Reserve | A separate methods illustration only if it replaces another animation. | Would duplicate the visual role of Icon Cloud in the initial site. |
| [Avatar Circles](https://magicui.design/docs/components/avatar-circles) | Reserve | Named collaborators only with suitable portraits and permission. | A cluster of faces must not suggest unverified endorsements. |
| [Icon Cloud](https://magicui.design/docs/components/icon-cloud) | Core | A visual companion to the semantic research-toolkit list on /software. | Local image assets, responsive canvas geometry and motion controls. |
| [Lens](https://magicui.design/docs/components/lens) | Reserve | Inspection of a real, high-resolution scientific figure. | Do not use as the photography viewer; retain full-image routes and an accessible lightbox. |
| [Pointer](https://magicui.design/docs/components/pointer) | Exclude | Keep the native pointer. | Custom pointer effects obstruct conventional interaction. |
| [Smooth Cursor](https://magicui.design/docs/components/smooth-cursor) | Exclude | Keep the native pointer. | A second cursor and spring motion add no content value. |
| [Progressive Blur](https://magicui.design/docs/components/progressive-blur) | Exclude | Do not blur the boundaries of readable content. | Can obscure links or text in compact reading panels. |
| [Dotted Map](https://magicui.design/docs/components/dotted-map) | Core | Photography: country album entry points and derived travel summary. | Explicit public confirmed countries; shared projection, static SVG and separate visit/album/photo counts. |

### Special Effects

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Animated Beam](https://magicui.design/docs/components/animated-beam) | Core | A labelled research-approach diagram on /research. | Conceptual links only; geometry, stop state and meaning require tests. |
| [Border Beam](https://magicui.design/docs/components/border-beam) | Reserve | One finite emphasis around a featured software release. | Do not run another continuous effect beside an animated card. |
| [Shine Border](https://magicui.design/docs/components/shine-border) | Exclude | Use a quiet solid border. | Persistent perimeter animation competes with reading. |
| [Magic Card](https://magicui.design/docs/components/magic-card) | Supporting | Subtle pointer-following light on the selected-research cards. | Visible border and focus state must not depend on the effect. |
| [Glare Hover](https://magicui.design/docs/components/glare-hover) | Reserve | A restrained image hover treatment, instead of Magic Card. | Avoid stacking light effects on the same surface. |
| [Meteors](https://magicui.design/docs/components/meteors) | Exclude | No decorative particle shower. | Visual noise conflicts with the contained card design. |
| [Confetti](https://magicui.design/docs/components/confetti) | Exclude | No confetti interaction. | Contacting a scientist is not a celebratory product conversion. |
| [Particles](https://magicui.design/docs/components/particles) | Reserve | A labelled illustration in a dedicated experiment page. | Never imply a measured scientific distribution or simulation result. |
| [Animated Theme Toggler](https://magicui.design/docs/components/animated-theme-toggler) | Reserve | A brief theme transition after integration with the existing theme provider. | Use one theme state; animated overlay and browser support need testing. |

### Animations

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Blur Fade](https://magicui.design/docs/components/blur-fade) | Supporting | A brief entrance for noncritical decorative content, once. | Names, navigation, paper titles and prose must be visible in server HTML. |

### Text Animations

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Text Animate](https://magicui.design/docs/components/text-animate) | Reserve | One short editorial heading with finite motion. | Preserve a complete accessible string and fixed layout dimensions. |
| [Typing Animation](https://magicui.design/docs/components/typing-animation) | Reserve | Standalone demo reference; Terminal uses its own export. | Do not confuse the standalone API with TerminalTypingAnimation. |
| [Line Shadow Text](https://magicui.design/docs/components/line-shadow-text) | Exclude | No moving shadow on headings. | Reduces typographic restraint. |
| [Aurora Text](https://magicui.design/docs/components/aurora-text) | Exclude | No multicolour title treatment. | Conflicts with the single-accent palette. |
| [Video Text](https://magicui.design/docs/components/video-text) | Exclude | Keep video out of text masks. | Large payload with no communication benefit here. |
| [Number Ticker](https://magicui.design/docs/components/number-ticker) | Reserve | A derived, dated total only when a count has a clear purpose. | Never animate invented metrics, citations or proficiency scores. |
| [Animated Shiny Text](https://magicui.design/docs/components/animated-shiny-text) | Exclude | Plain status text. | Repeated shimmer makes ordinary labels look like advertising. |
| [Animated Gradient Text](https://magicui.design/docs/components/animated-gradient-text) | Exclude | Plain accent text. | Competes with the scientific figures and card hierarchy. |
| [Text Reveal](https://magicui.design/docs/components/text-reveal) | Exclude | Keep research prose readable without scrolling choreography. | Scroll-dependent readability is unsuitable for this content. |
| [Dia Text Reveal](https://magicui.design/docs/components/dia-text-reveal) | Reserve | One finite accent on a short nonessential heading. | Test reduced motion and avoid duplicate word animations. |
| [Hyper Text](https://magicui.design/docs/components/hyper-text) | Exclude | Do not scramble the researcher name or terminology. | Temporary illegibility does not suit this site. |
| [Word Rotate](https://magicui.design/docs/components/word-rotate) | Exclude | Use a stable role and research summary. | Changing roles can blur professional positioning. |
| [Scroll Based Velocity](https://magicui.design/docs/components/scroll-based-velocity) | Exclude | No moving type bands. | Strong motion undermines compact reading. |
| [Sparkles Text](https://magicui.design/docs/components/sparkles-text) | Exclude | No sparkling scientific headings. | Decorative tone is a poor fit. |
| [Morphing Text](https://magicui.design/docs/components/morphing-text) | Exclude | Use stable titles. | Word morphing compromises immediate comprehension. |
| [Spinning Text](https://magicui.design/docs/components/spinning-text) | Exclude | No revolving labels. | Adds distraction without information. |
| [Text Highlighter](https://magicui.design/docs/components/highlighter) | Reserve | A single short phrase, never an entire paragraph. | Use restrained colour and a complete static text layer. |
| [Text 3D Flip](https://magicui.design/docs/components/text-3d-flip) | Exclude | No letter-by-letter 3D hover. | Interrupts reading and complicates touch behaviour. |

### Device Mocks

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Safari](https://magicui.design/docs/components/safari) | Asset-gated | Frame a real HerdLink screenshot on its detail page. | Do not fabricate interface screenshots; keep captions outside the frame. |
| [iPhone](https://magicui.design/docs/components/iphone) | Reserve | Only for a real mobile screenshot that helps explain an app. | Avoid a second device mock merely for decoration. |
| [Android](https://magicui.design/docs/components/android) | Reserve | Only for a documented Android experience. | A frame must not imply native application availability. |

### Buttons

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Rainbow Button](https://magicui.design/docs/components/rainbow-button) | Exclude | Use plain, high-contrast action buttons. | Multiple hues conflict with the palette. |
| [Shimmer Button](https://magicui.design/docs/components/shimmer-button) | Reserve | A single modest action treatment after visual review. | No endless attention effect beside reading material. |
| [Ripple Button](https://magicui.design/docs/components/ripple-button) | Reserve | A local tap response on a real action. | Action semantics, focus and hit area remain conventional. |

### Backgrounds

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Flickering Grid](https://magicui.design/docs/components/flickering-grid) | Exclude | Use a static grid. | Flicker competes with content and needs additional motion handling. |
| [Animated Grid Pattern](https://magicui.design/docs/components/animated-grid-pattern) | Reserve | One dedicated concept illustration rather than a page background. | Random animation must not resemble scientific evidence. |
| [Retro Grid](https://magicui.design/docs/components/retro-grid) | Exclude | No perspective retro landscape. | Does not match the restrained vCard direction. |
| [Ripple](https://magicui.design/docs/components/ripple) | Exclude | No perpetual radial background animation. | Duplicates the motion already provided by the signature components. |
| [Dot Pattern](https://magicui.design/docs/components/dot-pattern) | Reserve | A quiet alternative to Grid Pattern; use one of the two. | Keep the pattern out of body text. |
| [Grid Pattern](https://magicui.design/docs/components/grid-pattern) | Supporting | A faint static grid inside the research-approach panel. | Decorative only, low opacity, no effect on content contrast. |
| [Hexagon Pattern](https://magicui.design/docs/components/hexagon-pattern) | Reserve | A local static illustration if the hexagonal structure is meaningful. | Do not use it to imply actual spatial tessellation. |
| [Striped Pattern](https://magicui.design/docs/components/striped-pattern) | Reserve | Small monochrome image framing rather than a whole page texture. | Check for visual interference at small screen sizes. |
| [Interactive Grid Pattern](https://magicui.design/docs/components/interactive-grid-pattern) | Reserve | A contained experiment, not behind the biography. | Pointer interaction must not be the only content access. |
| [Light Rays](https://magicui.design/docs/components/light-rays) | Exclude | No cinematic lighting in the page background. | Wrong visual scale for the chosen layout. |
| [Noise Texture](https://magicui.design/docs/components/noise-texture) | Reserve | Barely visible surface texture only after contrast review. | Do not rasterise a large texture or dirty the reading surface. |
| [Floating 3D Particles](https://magicui.design/docs/components/floating-3d-particles) | Exclude | No additional particle field in the initial site. | Adds another continuous canvas renderer. |

### Community

| Component | Decision | Portfolio use | Engineering concern |
|---|---|---|---|
| [Shiny Button](https://magicui.design/docs/components/shiny-button) | Reserve | An alternative single action treatment, not another button family. | Keep the button system consistent. |
| [File Tree](https://magicui.design/docs/components/file-tree) | Reserve | A verified repository structure in a software article. | Never invent file paths or represent documentation as a file manager. |
| [Code Comparison](https://magicui.design/docs/components/code-comparison) | Reserve | A real, explained code comparison in future notes. | No invented APIs or unsupported benchmark conclusions. |
| [Scroll Progress](https://magicui.design/docs/components/scroll-progress) | Supporting | A thin progress indicator on research detail pages. | Never replace headings, anchor links or native scrolling. |
| [Neon Gradient Card](https://magicui.design/docs/components/neon-gradient-card) | Exclude | Use the shared neutral card surface. | Heavy multicolour glow conflicts with the design. |
| [Comic Text](https://magicui.design/docs/components/comic-text) | Exclude | No comic-book treatment. | Does not fit the professional voice. |
| [Kinetic Text](https://magicui.design/docs/components/kinetic-text) | Reserve | One modest hover experiment on a short nonessential label. | Must remain legible and stable when motion is disabled. |
| [Cool Mode](https://magicui.design/docs/components/cool-mode) | Exclude | No pointer-triggered image bursts. | Adds novelty without useful content. |
| [Pixel Image](https://magicui.design/docs/components/pixel-image) | Reserve | A dedicated personal experiment after a suitable image is supplied. | Do not pixelate the main portrait or scientific figures. |
| [Pulsating Button](https://magicui.design/docs/components/pulsating-button) | Exclude | No persistent pulsing actions. | Creates unnecessary urgency. |
| [Warp Background](https://magicui.design/docs/components/warp-background) | Exclude | Use flat contained surfaces. | The warp effect is too dominant for the reading layout. |
| [Interactive Hover Button](https://magicui.design/docs/components/interactive-hover-button) | Reserve | A compact arrow transition for one consistent action style. | Keep visible text and keyboard behaviour stable. |
| [Animated Circular Progress Bar](https://magicui.design/docs/components/animated-circular-progress-bar) | Exclude | No percentage skill gauges. | The CV supplies skills, not numerical competency measurements. |
| [Backlight](https://magicui.design/docs/components/backlight) | Reserve | A subtle edge around a real application image, instead of other glows. | Avoid stacking glow, glare and Magic Card. |
| [Glyph Matrix](https://magicui.design/docs/components/glyph-matrix) | Reserve | A small visual on a future experiment page. | Changing symbols must not suggest a running scientific analysis. |

## Source entries outside the 77-page count

`client-tweet-card.tsx` is a client variant, not another primary component page. `animated-subscribe-button.tsx` exists in the pinned source directory but was not present in the documentation navigation inspected. Neither belongs in this portfolio. Their presence does not establish an advertised supported API or a suitable installation command.

## Import and dependency discipline

The root repository `registry.json`, the application registry, installed component paths and old tutorials can differ. Treat the pinned `apps/www/registry/registry-ui.ts`, the actual fetched registry payload and the resulting local file as the evidence for the component being installed. Record the payload and its hash in the implementation's provenance log.

Do not bulk-install 77 components. Add the five core components and the support set, inspect the resulting source and styles, and test the composed pages. Source copied through the registry becomes part of the site's maintained code. Preserve licence notices and document any public API added by the site.
