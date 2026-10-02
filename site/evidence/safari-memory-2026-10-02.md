# ATLAS Safari memory check

Date: 2 October 2026. UI: 0.3.3.

Release: `e5f3f97dffb4be05d02c634d3eaa45a5eb7be26c3e5dbe3e82d1283d1a489e48`.

The published site bundle contains 281.62 MiB of JSON. Decoding the complete bundle and map into strings while retaining their byte buffers and parsed objects creates a large memory peak. Safari Web Inspector reproduced an iPhone page crash with a recorded maximum of 1.55 GB.

The loader verifies asset lengths and SHA-256 checksums, then parses 1 MiB byte views with a 64 KiB string buffer. It yields between chunks and honors cancellation. All exported fields remain present. The complete published bundle matches native `JSON.parse` output field for field.

Validation:

- The connected iPhone completes an initial load and a reload without cache from a local HTTPS production build. One Health, Analysis and Reports render successfully.
- Chromium and WebKit each pass seven ATLAS browser checks. The date assertion accepts both browser spellings of September.
- The unit suite passes 62 checks; two further Intelligence checks pass with the published asset. Two source fixture checks remain skipped.
- Production build, lint and static link checks pass.
- Parser checks cover split Unicode, escaped strings, nested values, malformed input, special object keys and cancellation.

Web Inspector memory samples stop before dataset preparation completes. The partial trace cannot establish the complete load's memory peak or a percentage reduction. Successful phone loads verify this release on the connected device, not every iPhone memory limit.

Website publication requires a manual push. Dataset publication is separate.
