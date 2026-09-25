# Footprint photographs

The gallery has one album per country. Its public catalogue is `src/content-data/photography-public.json`. Country coordinates mark representative locations; image files contain no embedded location metadata.

Original HEIC files, capture metadata and the owner manifest belong outside this repository. The local archive is `~/Downloads/Footprint`: `originals/` holds country folders, `web/` holds full images, and `thumbnails/` holds gallery previews. The owner manifest records publication approval, captions, image dimensions and album order.

## Image hosting

Cloudflare R2 bucket `qtj-footprint` stores only the web images, under `web/` and `thumbnails/`. The Worker in `photo-worker/` serves these files through `https://qtj-photos.evolandeco-github-io.workers.dev`. It accepts GET and HEAD requests for content-addressed WebP names and uses browser and edge caching. It exposes no directory listing or upload endpoint.

Full images have a maximum edge of 2400 pixels; thumbnails have a maximum edge of 640 pixels. WebP quality is 82 and 78 respectively. Conversion applies orientation, uses sRGB and removes embedded EXIF, GPS, XMP and IPTC metadata. Keep originals unchanged.

Upload both image sizes to the matching R2 folders. Then validate their public URLs and generate the public catalogue from the private owner manifest:

```sh
node --import tsx scripts/publish-hosted-photography.ts "$HOME/Downloads/Footprint/photography-owner.json"
pnpm build
```

The publisher checks approval and album relationships, verifies every image URL, and writes only public fields. Source paths and precise capture coordinates stay private. Set `travelLogStatus` to `partial` for a photo collection that does not document every trip.

To change the image service:

```sh
node photo-worker/check.mjs
npx wrangler deploy --config photo-worker/wrangler.jsonc
```

## Traffic and cost controls

Keep this account on Workers Free. Cloudflare stops Worker execution after 100,000 requests per day, resetting at midnight UTC. Each photo request makes at most one R2 read, so this service can generate at most about 3.1 million reads in a 31-day month, below R2 Standard’s 10 million free reads. This assumes the bucket stays private and other applications do not consume the shared allowance. R2 has no Internet egress charge. Storage and uploads have separate allowances.

`PHOTO_RATE_LIMIT` allows 240 image requests per minute per client IP, checked before the cache or R2. Excess requests receive HTTP 429 with `Retry-After: 60`; rejected responses are not cached. Shared networks share this allowance. Cloudflare’s counters are approximate and local to each edge location, so this is abuse protection, not a global spending cap. Cached images use a one-year lifetime, and query strings do not create separate cache entries.

Keep the bucket’s public development URL and custom domains disabled. The Worker exposes only GET and HEAD; visitors cannot upload or list objects. A paid Workers plan removes the daily cutoff, so reassess cost controls before upgrading. The account alert “Photo hosting budget” emails Tianjianqin@outlook.com when spending reaches $1. It warns about spending but does not stop it.

See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Navigation

Map pins open country albums. Album links return to the country’s map marker.

Gallery images open in a dialog: arrow keys change photos, Escape closes, Back closes and Forward reopens. Each photograph also has a static URL that works without JavaScript.

To hide a photo or album, set its status to `draft` in the owner manifest and publish again. To remove public access to an image, also delete its R2 objects and purge any cached copies. Removing an album from the site alone does not revoke its image URLs.
