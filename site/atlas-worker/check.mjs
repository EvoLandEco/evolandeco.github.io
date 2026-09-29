import assert from "node:assert/strict";
import worker from "./index.mjs";

let reads = 0;
const keys = [];
const env = {
  READ_LIMIT: { limit: async () => ({ success: true }) },
  ATLAS: {
    get: async (key, options) => {
      reads++; keys.push(key);
      return { size: 4, httpEtag: '"release"', ...(options.onlyIf.get("If-None-Match") ? {} : { body: new Blob(["data"]).stream() }) };
    },
    head: async () => ({ size: 4, httpEtag: '"release"' }),
  },
};
const origin = "https://atlas.example";
const path = `/releases/${"a".repeat(64)}/map.json`;
const request = (path, init = {}) => new Request(origin + path, { ...init, headers: { "CF-Connecting-IP": "192.0.2.1", ...init.headers } });
for (const [path, method, status] of [["/private.json", "GET", 404], ["/current.json", "POST", 405], ["/releases/invalid/map.json", "GET", 404]]) {
  assert.equal((await worker.fetch(request(path, { method }), env)).status, status);
}
assert.equal(reads, 0);
for (const name of ['network-transport.json', 'release.json', 'view.mjs']) {
  const path = `/releases/${'a'.repeat(64)}/${name}`;
  const response = await worker.fetch(request(path), env);
  assert.equal(response.status, 200);
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
  assert.match(response.headers.get('Content-Type'), name.endsWith('.mjs') ? /javascript/ : /json/);
}
for (const name of ['network-analysis.json', 'network-analysis.schema.json', 'coverage-ledger.json']) {
  const path = `/network-analysis/${'b'.repeat(64)}/${name}`;
  assert.equal((await worker.fetch(request(path), env)).status, 200);
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
}
for (const path of [`/network-analysis/${'b'.repeat(64)}/private.json`, '/network-analysis/invalid/network-analysis.json', `/releases/${'a'.repeat(64)}/private.mjs`])
  assert.equal((await worker.fetch(request(path), env)).status, 404);
const file = await worker.fetch(request(path), env);
assert.equal(await file.text(), "data");
assert.equal(keys.at(-1), path.slice(1) + ".gz");
assert.equal(file.headers.get("Content-Encoding"), "gzip");
assert.match(file.headers.get("Cache-Control"), /immutable/);
assert.equal(file.headers.get("Access-Control-Allow-Origin"), "*");
const current = await worker.fetch(request("/current.json"), env);
assert.match(current.headers.get("Cache-Control"), /max-age=60/);
assert.equal(current.headers.get("Content-Encoding"), null);
assert.equal((await worker.fetch(request(path, { headers: { "If-None-Match": '"release"' } }), env)).status, 304);
assert.equal((await worker.fetch(request(path, { headers: { "If-None-Match": 'W/"release"' } }), env)).status, 304);
assert.equal((await worker.fetch(request(path, { method: "HEAD" }), env)).body, null);
const before = reads;
assert.equal((await worker.fetch(request(path), { ...env, READ_LIMIT: { limit: async () => ({ success: false }) } })).status, 429);
assert.equal(reads, before);
assert.equal((await worker.fetch(new Request(origin + path), env)).status, 403);
assert.equal((await worker.fetch(request(path), { ...env, ATLAS: { get: async () => null } })).status, 404);
console.log("ATLAS Worker: paths, compression, CORS, conditional reads, methods and rate limiting checked.");
