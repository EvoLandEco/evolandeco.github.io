# Browser test integration

Install and configure Playwright in the target app, use its production build/server and copy `portfolio.acceptance.spec.ts` and `photography.acceptance.spec.ts` into the test directory. Set `baseURL` to that server. Use browser projects with representative desktop/mobile viewports; the full matrix is in the acceptance specification. This handoff does not contain a built application or executed Playwright results.

Use the following stable hooks on the actual rendered elements: `profile-name`, `toolkit-list`, `signature-globe`, `signature-beam`, `signature-terminal`, `signature-icon-cloud`, `signature-dotted-map`; item attributes `data-publication-id`, `data-publication-status`, `data-programme-id`, `data-software-id`, and `data-equal-contribution`. A signature panel's `data-motion-state` is `running`, `paused` or `static` and must reflect its real controller. Never create invisible test-only markup to satisfy an assertion.

The reference test file covers route visibility, selected content constraints, component existence, reduced-motion state, PDF format and some zero-JavaScript behaviour. Add the filter-state, clipboard, semantic detail, real paused-frame, geometry, resource-cleanup, keyboard, automated accessibility and screenshot tests described in the specification. Existence of a canvas is not evidence that it rendered correctly.

Run tests without automatic retries while diagnosing failures. Fix unstable conditions through correct lifecycle state and readiness signals rather than longer sleeps. Review the visual outputs and actual interaction traces. A green assertion on a data attribute is not a substitute for source-level and visual checks.

Official setup reference: https://playwright.dev/docs/test-configuration


## Photography test contexts

Run a normal production-content build against the supplied empty manifest and a separate fixture build using `fixtures/photography.test.json`. Set `PHOTOGRAPHY_E2E_DATA=empty` or `fixture` on the Playwright test process to select assertions. The app must not choose production content from a public query string or a client environment variable. An explicit test build task selects the fixture in a separate build output and cannot publish it.

Additional hooks: `primary-navigation` on the single visible primary nav, `photography-empty`, `travel-count`, `travel-count-label`, `album-count`, `photo-count`, `country-list`, `photo-viewer`; item attributes `data-country-code`, `data-album-id`, `data-photo-id` and `data-photo-link`. Each hook belongs on the real visible UI. The counts have an integer-only `data-count` attribute and a human-readable label nearby. A confirmed country with no album appears in the country list but has no photo-album link.

The fixture has public confirmed NL/JP/FR, private BE and unconfirmed DE. It yields three documented countries, two published albums and three public photographs. These are fabricated test cases, not personal facts. The test build prepares visibly labelled geometric image fixtures in its own output folder; it must not download stock photographs or add fixture files to production assets.
