# Managing country albums

The authoring workflow starts from an owner-controlled copy of `data/photography.json` outside the deployable application folder. The content command generates a public manifest for the website to read; the raw manifest is not imported into app routes or server bundles. Each country has one album; photographs from later visits are added to that album. The country total and published album total are deliberately different.

## Add a country

Create one country record with a stable two-letter code, display name, route slug, `visitConfirmed`, `visibility`, and a reviewed representative map point or null. The slug becomes `/photography/<slug>` when the album is published. Use a country-level point rather than a home address or photo GPS.

Set `visitConfirmed: true` only after confirming the visit. Choose `visibility: "public"` to include that country in the map/list and the public count. Keep records private when they should not be disclosed. Never add a second country record for a second journey.

The public count uses each public confirmed country once, even when its album is not published. Private records are not included. The map can omit a country with no reviewed coordinate without changing its count or list entry.

Use `travelLogStatus: "partial"` while the public inventory is incomplete. The page says “N countries documented”. Use `complete` only after reviewing the whole public list and any private omissions; the label becomes “N countries visited”. `unconfirmed` hides the numeric travel claim.

## Add an album and photographs

Create an album with a unique ID, the country code, title, description, `status: "draft"`, a null cover until selected, and `photoOrder: []`. Only one album may use a country code.

Store camera originals in the private input location configured by the application. Do not put them in `public/` or commit them to the site repository. The application’s prepare command creates approved web copies in private staging and reports their proposed public paths and dimensions. Preparation does not publish an image.

For each photograph, create its stable ID, album ID, source path, creator/permission record, alt text, caption and date/location fields as available. Start with `status: "draft"`, `publishApproved: false` and `image: null`. Add the ID once to that album’s `photoOrder`. Do not use raw GPS, inferred dates or camera serials as public fields.

After selecting a photograph for public display, confirm its publication permission, set `publishApproved: true`, run the prepare command while its status is still draft, inspect the privately staged image and assign the returned `image` descriptor. Set its status to `published` only when the descriptor, alt text and permission are complete. Set the album’s cover to one of its published photo IDs.

Set the album status to `published` after at least one photo and its cover are ready. Run the publish command to validate the completed manifest and copy only publicly selected derivatives from private staging into the managed public media directory. Run content and media validation before building. The country card links to the album and its photo total is derived automatically.

## Edit an existing album

Reorder `photoOrder` to set the visible gallery sequence. Add photos from another visit to the same country album. Choose another published image as cover by its ID. Use a short introduction or owner-approved dates to explain several visits rather than creating duplicate country albums.

A cover card is cropped into a consistent 3:2 frame, while album and full-photo views preserve the complete photograph. Check portrait and panorama images in both places before publishing.

## Hide an album or photo

Set a photo to `draft` to remove it from public output. Replace the cover first if that photograph is the current published cover. Set an album to `draft` to remove its public route, card and image assets. Its country may still count as visited. Set the country visibility to `private` to remove it and its album from the public count, map, pages and assets.

Run the media-publish task and build again; changing a link alone does not remove a publicly hosted file. The command must regenerate the managed public image folder from the approved manifest and report the resulting file list.

## Commands supplied by the implementation

Codex must include working application scripts for content validation, private media preparation, approved media publication, production build, data tests and photography browser tests, and record the exact commands in the application README. This handoff does not assume those scripts already exist.

The handoff’s reference data checks can be run before application implementation:

```bash
python3 handoff/scripts/validate_handoff.py
python3 handoff/scripts/check_photography_reference.py
```

The fixture under `reference/fixtures/` is synthetic test data. It is not a template to publish as a personal travel log. The production seed intentionally contains no countries or photographs.
