# Photography content

Personal travel and photographs are separate from the labelled stock samples in `src/content-data/photo-samples.json`. Clear that sample array to remove the preview collections. Sample images are not counted as personal albums or visits and do not receive map markers.

Keep originals, the authored manifest and derivative staging outside `site/`. The manifest schema and a blank seed are in `../handoff/data/photography.json`; the field reference is in `../handoff/PHOTOGRAPHY_CONTENT_GUIDE.md`.

1. Copy the blank seed into a private directory. Add one country record per country, with its two-letter code, stable slug and owner-confirmed public visit status. Use a null marker until its representative coordinates have been reviewed.
2. Add one album for that country. Start with `status: "draft"`, a null cover, and an ordered list of photo IDs. Additional trips use that same album.
3. Add photo records with paths under `media-private/` relative to the private originals directory, descriptive alt text, photographer credit and permission. Set `publishApproved` and `rights.permissionConfirmed` only for images approved for preparation. Keep draft images at `image: null`.
4. Prepare the approved photographs:

```sh
pnpm media prepare /private/archive/manifest.json /private/archive/originals /private/archive/staging
```

Preparation applies orientation, converts to sRGB, creates WebP images with a maximum edge of 2400 pixels without enlargement, and strips embedded metadata. Originals are unchanged. Review the derivatives and `staging/prepared-manifest.json`.

5. In the prepared manifest, set the chosen photos and album to `published` and choose a published `coverPhotoId`. Review captions and date precision. Set the travel log to `partial` or `complete` only after checking the country inventory.
6. Publish the reviewed projection:

```sh
pnpm media publish /private/archive/staging/prepared-manifest.json /private/archive/originals /private/archive/staging
pnpm build
```

Publishing verifies checksums, dimensions and metadata. Only public confirmed countries, published albums and approved photographs enter the public manifest and managed media folder. Source paths and private records stay outside the application. Existing managed media is replaced as one directory; files belonging to hidden albums are removed.

To hide an album, set its status to `draft` and publish again. Its confirmed country can remain in the travel count. To hide the country and its albums, set the country's visibility to `private`. An inventory containing private confirmed visits uses `partial` rather than `complete`.

The gallery uses country and photograph URLs. Ordinary links work without JavaScript. With JavaScript, an album opens photographs in a keyboard-accessible modal: Escape closes, arrows change images, Back closes, and Forward reopens. A direct photograph URL renders a full page.
