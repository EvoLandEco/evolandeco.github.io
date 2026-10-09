import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import hosting from '../src/content-data/atlas-hosting.json';
import { browserSelectorHashes, releaseSchema, verifiedBytes, type AtlasRelease } from '../src/lib/atlas-release';
import { decodeBrowserCore, validateBrowserManifest } from '../src/lib/atlas-browser';
import { dailyPins, dailyPointerSchema, validateDaily, validateDailyReferences, type DailyPointer } from '../src/lib/atlas-daily';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.strictObject({ sha256: digest, bytes: z.number().int().positive() });
const manifestSchema = z.strictObject({ daily_version: z.enum(['0.2.1', '0.2.2']), daily_id: digest, base_source_export_id: digest,
  files: z.strictObject({ 'daily.json': asset, 'daily.schema.json': asset, 'daily-view.mjs': asset, 'validation.json': asset }) });
export async function prepareDailyRelease(directory: string, release: AtlasRelease, browserManifestPath: string) {
  assert(release.browser, 'Weekly browser transport is required');
  const browserManifestBytes = await readFile(browserManifestPath);
  assert.equal(hash(browserManifestBytes), release.browser.manifest.sha256, 'Weekly browser manifest hash');
  assert.equal(browserManifestBytes.length, release.browser.manifest.bytes, 'Weekly browser manifest size');
  const browser = validateBrowserManifest(JSON.parse(browserManifestBytes.toString()), release, browserSelectorHashes['0.3.0']);
  const coreBytes = await readFile(resolve(dirname(browserManifestPath), browser.core));
  assert.equal(hash(coreBytes), browser.assets[browser.core].sha256, 'Weekly browser core hash');
  assert.equal(coreBytes.length, browser.assets[browser.core].bytes, 'Weekly browser core size');
  const weekly = decodeBrowserCore(JSON.parse(coreBytes.toString()), release.export_id);
  const manifestBytes = await readFile(resolve(directory, 'manifest.json'));
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString()));
  const files = new Map<string, Buffer>();
  for (const [name, expected] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(directory, name));
    assert.equal(bytes.length, expected.bytes, name); assert.equal(hash(bytes), expected.sha256, name);
    files.set(name, bytes);
  }
  const pins = dailyPins[manifest.daily_version];
  assert.equal(manifest.files['daily.schema.json'].sha256, pins.schema, 'Daily schema pin');
  assert.equal(manifest.files['daily-view.mjs'].sha256, pins.selector, 'Daily selector pin');
  const data = await validateDaily(JSON.parse(files.get('daily.json')!.toString()), release, browser.source.manifest.sha256);
  validateDailyReferences(data, weekly);
  assert.equal(manifest.daily_version, data.daily_version); assert.equal(manifest.daily_id, data.daily_id); assert.equal(manifest.base_source_export_id, release.export_id);
  const receipt = JSON.parse(files.get('validation.json')!.toString());
  assert.deepEqual(receipt, { status: 'valid', daily_id: data.daily_id, base_source_export_id: release.export_id, documents: data.documents.length, findings: data.findings.length, watch_items: data.watch_items.length, weekly_review_pending: data.documents.filter(d => d.processing_status === 'weekly_review_pending').length }, 'Producer validation receipt');
  const pointer = dailyPointerSchema.parse({ version: 1, daily_version: data.daily_version, daily_id: data.daily_id, base_source_export_id: release.export_id, base_manifest_sha256: data.base_manifest_sha256, published_at: data.generated_at, asset: manifest.files['daily.json'], schema_sha256: pins.schema, selector_sha256: pins.selector });
  files.set('manifest.json', manifestBytes);
  return { data, pointer, files, prefix: `daily/${release.export_id}/${data.daily_id}` };
}
export function checkDailyPublicationOrder(current: DailyPointer | null, candidate: DailyPointer) {
  if (current) assert(Date.parse(current.published_at) <= Date.parse(candidate.published_at), 'Daily publication must not move backwards');
}
async function main() {
  const { values } = parseArgs({ options: { directory: { type: 'string' }, release: { type: 'string' }, 'browser-manifest': { type: 'string' }, authorization: { type: 'string' }, upload: { type: 'boolean', default: false }, activate: { type: 'boolean', default: false } } });
  assert(values.directory && values.release && values['browser-manifest'], 'Supply --directory, --release and --browser-manifest');
  assert(!values.activate || values.upload, 'Activation requires --upload');
  const cache = resolve(site, '.cache/atlas-sync'); await mkdir(cache, { recursive: true });
  const lock = resolve(cache, 'lock'); await mkdir(lock);
  try {
    const releaseBytes = await readFile(values.release);
    const input = JSON.parse(releaseBytes.toString());
    const release = releaseSchema.parse(input.release ?? input);
    const prepared = await prepareDailyRelease(values.directory, release, values['browser-manifest']);
    const out = resolve(site, '.cache/atlas-daily', prepared.data.daily_id); await mkdir(out, { recursive: true });
    for (const [name, bytes] of prepared.files) await writeFile(resolve(out, name), bytes);
    await writeFile(resolve(out, 'current.json'), JSON.stringify(prepared.pointer));
    if (!values.upload) { console.log(JSON.stringify({ status: 'validated', daily_id: prepared.data.daily_id, capture: prepared.data.knowledge_cutoff, directory: out })); return; }
    assert(values.authorization, 'Content-bound publication authorization is required');
    const authorizationBytes = await readFile(values.authorization);
    const authorization = z.strictObject({ destination: z.literal(hosting.origin), bucket: z.literal(hosting.bucket), weekly_release_sha256: digest, daily_pointer: dailyPointerSchema,
      authorization: z.strictObject({ thread_id: z.string().min(1), instruction: z.string().min(1), confirmation: z.string().min(1) }) }).parse(JSON.parse(authorizationBytes.toString()));
    assert.equal(authorization.weekly_release_sha256, hash(releaseBytes)); assert.deepEqual(authorization.daily_pointer, prepared.pointer);
    const current = async () => {
      const response = await fetch(`${hosting.origin}/current.json`, { cache: 'no-cache' });
      assert(response.ok, `Weekly pointer unavailable: ${response.status}`); return releaseSchema.parse(await response.json());
    };
    const before = await current(); assert.deepEqual(before, release, 'Public weekly release must match the daily base');
    const dailyUrl = `${hosting.origin}/daily/${release.export_id}/current.json`;
    const readDaily = async () => {
      const response = await fetch(dailyUrl, { cache: 'no-cache' });
      if (response.status === 404) return null;
      assert(response.ok, `Daily pointer unavailable: ${response.status}`); return dailyPointerSchema.parse(await response.json());
    };
    const beforeDaily = await readDaily();
    checkDailyPublicationOrder(beforeDaily, prepared.pointer);
    const put = (key: string, path: string, compressed: boolean) => execFileSync(process.execPath, [resolve(site, 'node_modules/wrangler/bin/wrangler.js'), 'r2', 'object', 'put', `${hosting.bucket}/${key}`, '--file', path, '--remote', '--content-type', key.endsWith('.mjs.gz') ? 'text/javascript' : 'application/json', ...(compressed ? ['--content-encoding', 'gzip'] : [])], { cwd: site, stdio: 'inherit' });
    for (const [name, bytes] of prepared.files) {
      const key = `${prepared.prefix}/${name}`, url = `${hosting.origin}/${key}`, expected = { bytes: bytes.length, sha256: hash(bytes) };
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.status === 404) {
        const path = resolve(out, `${name}.gz`); await writeFile(path, gzipSync(bytes, { level: 9 })); put(`${key}.gz`, path, true);
        await verifiedBytes(await fetch(url, { cache: 'no-cache' }), expected);
      } else await verifiedBytes(response, expected);
    }
    const rechecked = await prepareDailyRelease(values.directory, release, values['browser-manifest']);
    assert.deepEqual(rechecked.pointer, prepared.pointer);
    assert.deepEqual(await readFile(values.authorization), authorizationBytes);
    assert.deepEqual(await current(), before, 'Weekly release changed during upload');
    assert.deepEqual(await readDaily(), beforeDaily, 'Daily release changed during upload');
    if (values.activate) { put(`daily/${release.export_id}/current.json`, resolve(out, 'current.json'), false); assert.deepEqual(await readDaily(), prepared.pointer); }
    console.log(JSON.stringify({ status: values.activate ? 'published' : 'staged', daily_id: prepared.data.daily_id, capture: prepared.data.knowledge_cutoff }));
  } finally { await rm(lock, { recursive: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
