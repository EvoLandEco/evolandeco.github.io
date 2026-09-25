import assert from "node:assert/strict";
import worker from "./index.mjs";

const saved = new Map();
globalThis.caches = { default: {
  match: async request => saved.get(request.url)?.clone(),
  put: async (request, response) => { saved.set(request.url, response); },
} };
let reads = 0;
const object = () => ({ size: 4, httpEtag: '"photo"', body: new Blob(["webp"]).stream() });
const env = { PHOTO_RATE_LIMIT: { limit: async () => ({ success: true }) }, PHOTOS: {
  get: async () => { reads++; return object(); },
  head: async () => ({ size: 4, httpEtag: '"photo"' }),
} };
const pending = [];
const ctx = { waitUntil: promise => pending.push(promise) };
const url = "https://photos.example/web/photo-0123456789abcdef.webp";
for (const [path, method, status] of [["/private.json", "GET", 404], ["/", "POST", 405]]) {
  assert.equal((await worker.fetch(new Request("https://photos.example" + path, { method }), env, ctx)).status, status);
}
const first = await worker.fetch(new Request(url, { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env, ctx);
assert.equal(await first.text(), "webp");
assert.match(first.headers.get("Cache-Control"), /immutable/);
await Promise.all(pending);
assert.equal((await worker.fetch(new Request(url, { method: "HEAD", headers: { "CF-Connecting-IP": "192.0.2.1" } }), env, ctx)).headers.get("Content-Length"), "4");
assert.equal((await worker.fetch(new Request(url, { headers: { "CF-Connecting-IP": "192.0.2.1", "If-None-Match": '"photo"' } }), env, ctx)).status, 304);
assert.equal(reads, 1);
assert.equal((await worker.fetch(new Request(url.replace("0123456789abcdef", "ffffffffffffffff"), { headers: { "CF-Connecting-IP": "192.0.2.1" } }), { ...env, PHOTOS: { get: async () => null } }, ctx)).status, 404);
assert.equal((await worker.fetch(new Request(url), env, ctx)).status, 403);
let limitedKey;
const limited = await worker.fetch(new Request(url + "?bypass=1", { headers: { "CF-Connecting-IP": "192.0.2.1" } }), {
  ...env, PHOTO_RATE_LIMIT: { limit: async ({ key }) => { limitedKey = key; return { success: false }; } },
}, ctx);
assert.equal(limited.status, 429);
assert.equal(limitedKey, "192.0.2.1");
assert.equal(limited.headers.get("Retry-After"), "60");
assert.equal(limited.headers.get("Cache-Control"), "no-store");
assert.equal(reads, 1);
console.log("Photo Worker: paths, methods, cache, HEAD, ETag, missing images and rate limiting checked");
