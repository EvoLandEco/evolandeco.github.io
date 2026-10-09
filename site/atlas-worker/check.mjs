import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "./index.mjs";

let reads = 0, heads = 0;
const keys = [], limits = [];
const env = {
  READ_LIMIT: { limit: async ({ key }) => { limits.push({ bucket: 'general', key }); return { success: true }; } },
  BROWSER_READ_LIMIT: { limit: async ({ key }) => { limits.push({ bucket: 'browser', key }); return { success: true }; } },
  ATLAS: {
    get: async (key, options) => {
      reads++; keys.push(key);
      return { size: 4, httpEtag: '"release"', ...(options.onlyIf.get("If-None-Match") ? {} : { body: new Blob(["data"]).stream() }) };
    },
    head: async () => { heads++; return { size: 4, httpEtag: '"release"' }; },
  },
};
const origin = "https://atlas.example";
const path = `/releases/${"a".repeat(64)}/map.json`;
const request = (path, init = {}) => new Request(origin + path, { ...init, headers: { "CF-Connecting-IP": "192.0.2.1", ...init.headers } });
for (const [path, method, status] of [["/private.json", "GET", 404], ["/current.json", "POST", 405], ["/releases/invalid/map.json", "GET", 404]]) {
  assert.equal((await worker.fetch(request(path, { method }), env)).status, status);
}
assert.equal(reads, 0);
assert.equal(limits.length, 0);
for (const name of ['atlas-site.json', 'map.json', 'metrics.json', 'network-transport.json', 'release.json', 'view.mjs']) {
  const path = `/releases/${'a'.repeat(64)}/${name}`;
  const response = await worker.fetch(request(path), env);
  assert.equal(response.status, 200);
  assert.deepEqual(limits.at(-1), { bucket: 'general', key: '192.0.2.1' });
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
  assert.match(response.headers.get('Content-Type'), name.endsWith('.mjs') ? /javascript/ : /json/);
}
for (const name of ['source-supplement.json', 'source-supplement.schema.json']) {
  const path = `/releases/${'a'.repeat(64)}/supplements/${'b'.repeat(64)}/${name}`;
  assert.equal((await worker.fetch(request(path), env)).status, 200);
  assert.equal(limits.at(-1).bucket, 'general');
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
}
for (const name of ['private.json', 'source-supplement.js']) assert.equal((await worker.fetch(request(`/releases/${'a'.repeat(64)}/supplements/${'b'.repeat(64)}/${name}`), env)).status, 404);
const collectionRoot = `/releases/${'a'.repeat(64)}/supplement-collections/${'b'.repeat(64)}`;
for (const name of ['source-supplement-collection.json', 'source-supplement-collection.schema.json', 'source-supplement-catalogue.json', 'source-supplement-catalogue.schema.json']) {
  const path = `${collectionRoot}/${name}`;
  const response = await worker.fetch(request(path), env);
  assert.equal(response.status, 200);
  assert.equal(limits.at(-1).bucket, 'general');
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
  assert.equal(response.headers.get('Content-Encoding'), 'gzip');
  assert.match(response.headers.get('Cache-Control'), /immutable/);
  assert.match(response.headers.get('Content-Type'), /json/);
  assert.equal((await worker.fetch(request(path, { method: 'HEAD' }), env)).body, null);
  assert.equal((await worker.fetch(request(path, { headers: { 'If-None-Match': '"release"' } }), env)).status, 304);
}
const beforeInvalidCollectionPaths = limits.length;
for (const name of ['private.json', 'source-supplement.json', 'source-supplement-collection.js', 'source-supplement-catalogue.json/extra', '%2e%2e/private.json'])
  assert.equal((await worker.fetch(request(`${collectionRoot}/${name}`), env)).status, 404);
assert.equal((await worker.fetch(request(collectionRoot.replace('supplement-collections/', 'supplement-collections/invalid/') + '/source-supplement-collection.json'), env)).status, 404);
assert.equal(limits.length, beforeInvalidCollectionPaths);
for (const name of ['network-analysis.json', 'network-analysis.schema.json', 'coverage-ledger.json']) {
  const path = `/network-analysis/${'b'.repeat(64)}/${name}`;
  assert.equal((await worker.fetch(request(path), env)).status, 200);
  assert.equal(limits.at(-1).bucket, 'general');
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
}
for (const path of [`/network-analysis/${'b'.repeat(64)}/private.json`, '/network-analysis/invalid/network-analysis.json', `/releases/${'a'.repeat(64)}/private.mjs`])
  assert.equal((await worker.fetch(request(path), env)).status, 404);
for (const name of ['intelligence.json', 'contract.schema.json']) {
  const path = `/intelligence/${'c'.repeat(64)}/${name}`;
  assert.equal((await worker.fetch(request(path), env)).status, 200);
  assert.equal(limits.at(-1).bucket, 'general');
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
}
for (const path of [`/intelligence/${'c'.repeat(64)}/private.json`, '/intelligence/invalid/intelligence.json'])
  assert.equal((await worker.fetch(request(path), env)).status, 404);
const browserRoot = `/releases/${'a'.repeat(64)}/browser/${'d'.repeat(64)}`;
for (const name of ['manifest.json', 'release.json', 'core.json', 'map-core.json', 'detail-index.json', 'browser-transport.schema.json', 'browser-manifest.schema.json', 'browser_transport.js', 'browser_tables.js', 'site_view.js', 'browser.d.mts', 'atlas.d.ts', 'details/part-00000.json', 'details/part-00452.json']) {
  const path = `${browserRoot}/${name}`;
  const response = await worker.fetch(request(path), env);
  assert.equal(response.status, 200, name);
  assert.deepEqual(limits.at(-1), { bucket: 'browser', key: '192.0.2.1' });
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
  assert.equal(response.headers.get('Content-Encoding'), 'gzip');
  assert.match(response.headers.get('Cache-Control'), /immutable/);
  assert.match(response.headers.get('Content-Type'), name.endsWith('.js') ? /javascript/ : /\.d\.(mts|ts)$/.test(name) ? /text\/plain/ : /json/);
  assert.equal((await worker.fetch(request(path, { method: 'HEAD' }), env)).body, null);
  assert.equal(limits.at(-1).bucket, 'browser');
  assert.equal((await worker.fetch(request(path, { headers: { 'If-None-Match': '"release"' } }), env)).status, 304);
}
const beforeInvalidBrowserPaths = limits.length;
for (const suffix of ['private.json', 'details/part-1.json', 'details/part-000000.json', 'details/private.json', 'unknown.js', 'secret.txt', 'manifest.json/extra', '%2e%2e/private.json'])
  assert.equal((await worker.fetch(request(`${browserRoot}/${suffix}`), env)).status, 404, suffix);
assert.equal((await worker.fetch(request(browserRoot.replace('browser/', 'browser/invalid/')), env)).status, 404);
assert.equal(limits.length, beforeInvalidBrowserPaths);
const file = await worker.fetch(request(path), env);
assert.equal(await file.text(), "data");
assert.equal(keys.at(-1), path.slice(1) + ".gz");
assert.equal(file.headers.get("Content-Encoding"), "gzip");
assert.match(file.headers.get("Cache-Control"), /immutable/);
assert.equal(file.headers.get("Access-Control-Allow-Origin"), "*");
const current = await worker.fetch(request("/current.json"), env);
assert.equal(limits.at(-1).bucket, 'general');
assert.match(current.headers.get("Cache-Control"), /max-age=60/);
assert.equal(current.headers.get("Content-Encoding"), null);
assert.equal((await worker.fetch(request(path, { headers: { "If-None-Match": '"release"' } }), env)).status, 304);
assert.equal((await worker.fetch(request(path, { headers: { "If-None-Match": 'W/"release"' } }), env)).status, 304);
assert.equal((await worker.fetch(request(path, { method: "HEAD" }), env)).body, null);
const before = reads;
assert.equal((await worker.fetch(request(path), { ...env, READ_LIMIT: { limit: async () => ({ success: false }) } })).status, 429);
assert.equal(reads, before);
for (const method of ['GET', 'HEAD']) {
  const counts = [reads, heads];
  const response = await worker.fetch(request(`${browserRoot}/details/part-00000.json`, { method }), { ...env, BROWSER_READ_LIMIT: { limit: async () => ({ success: false }) } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual([reads, heads], counts);
}
assert.equal((await worker.fetch(request(`${browserRoot}/core.json`), { ...env, READ_LIMIT: { limit: async () => ({ success: false }) } })).status, 200);
assert.equal((await worker.fetch(request(path), { ...env, BROWSER_READ_LIMIT: { limit: async () => ({ success: false }) } })).status, 200);
assert.equal((await worker.fetch(new Request(origin + path), env)).status, 403);
assert.equal((await worker.fetch(request(path), { ...env, ATLAS: { get: async () => null } })).status, 404);
const configuration = JSON.parse(await readFile(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
assert.deepEqual(configuration.ratelimits.map(({ name, simple }) => ({ name, simple })), [
  { name: 'READ_LIMIT', simple: { limit: 60, period: 60 } },
  { name: 'BROWSER_READ_LIMIT', simple: { limit: 120, period: 60 } },
]);
assert.equal(new Set(configuration.ratelimits.map(row => row.namespace_id)).size, configuration.ratelimits.length);
console.log("ATLAS Worker: paths, compression, CORS, conditional reads, methods and separate read limits checked.");

for (const name of ['source-text-display.json', 'source-text-display.schema.json', 'watch.json', 'watch.schema.json']) {
  const path = `/releases/${'a'.repeat(64)}/presentation/${'b'.repeat(64)}/${name}`;
  assert.equal((await worker.fetch(request(path), env)).status, 200);
  assert.equal(keys.at(-1), path.slice(1) + '.gz');
}
assert.equal((await worker.fetch(request(`/releases/${'a'.repeat(64)}/presentation/${'b'.repeat(64)}/private.json`), env)).status, 404);

const dailyRoot = `/daily/${'a'.repeat(64)}`;
const dailyCurrent = await worker.fetch(request(`${dailyRoot}/current.json`), env);
assert.equal(dailyCurrent.status, 200);
assert.equal(keys.at(-1), `${dailyRoot.slice(1)}/current.json`);
assert.equal(dailyCurrent.headers.get('Content-Encoding'), null);
assert.match(dailyCurrent.headers.get('Cache-Control'), /must-revalidate/);
for (const name of ['daily.json', 'daily.schema.json', 'manifest.json', 'validation.json', 'daily-view.mjs']) {
  const dailyPath = `${dailyRoot}/${'b'.repeat(64)}/${name}`;
  const response = await worker.fetch(request(dailyPath), env);
  assert.equal(response.status, 200);
  assert.equal(keys.at(-1), dailyPath.slice(1) + '.gz');
  assert.match(response.headers.get('Cache-Control'), /immutable/);
}
for (const suffix of ['private.json', 'unknown.mjs', 'current.json'])
  assert.equal((await worker.fetch(request(`${dailyRoot}/${'b'.repeat(64)}/${suffix}`), env)).status, 404);
