import { preparePresentation, requireCurrentPresentation } from "./publish-atlas-presentation";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import hosting from '../src/content-data/atlas-hosting.json';
import { intelligenceSchema, validateIntelligenceRelease } from '../src/lib/atlas-intelligence';
import { releaseSchema, releaseRoot, verifiedBytes } from '../src/lib/atlas-release';
import { validateNetworkTransport, parseNetworkAnalysis } from '../src/lib/atlas-network-analysis';
import { correctionSchema } from './sync-atlas';
import { requireCurrentBrowserDescriptor } from './publish-atlas-browser';
import { prepareSourceSupplement, requireCurrentSourceSupplement, verifyPublishedSourceSupplement } from './publish-atlas-supplement';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
type FileReference = { path: string; bytes: number; sha256: string };
async function checked(ref: FileReference) {
  const bytes = await readFile(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(hash(bytes), ref.sha256, ref.path);
  return bytes;
}
async function main() {
  const { values } = parseArgs({ options: { authorization: { type: 'string' }, release: { type: 'string' }, 'dry-run': { type: 'boolean', default: false }, activate: { type: 'boolean', default: false } } });
  assert(values.authorization && values.release, 'Supply --authorization and --release');
  assert(!(values['dry-run'] && values.activate), 'Dry runs cannot activate a release');
  const cache = resolve(site, '.cache/atlas-sync');
  await mkdir(cache, { recursive: true });
  const lock = resolve(cache, 'lock');
  await mkdir(lock);
  try {
    const authorizationBytes = await readFile(values.authorization);
    const authorization = JSON.parse(authorizationBytes.toString());
    const correction = correctionSchema.parse(authorization);
    const fileReference = z.object({ path: z.string().min(1), bytes: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
    const source = z.object({ export_id: z.string(), manifest: fileReference, structured_data: fileReference, map_snapshot: fileReference, selector: fileReference }).parse(correction.export);
    assert.equal(authorization.destination, hosting.origin);
    assert(authorization.authorization.thread_id && authorization.authorization.instruction && authorization.authorization.confirmation);
    const receipt = JSON.parse(await readFile(values.release, 'utf8'));
    const base = releaseSchema.parse(receipt.release ?? receipt);
    const presentation = await preparePresentation(authorization.presentation ?? {}, base);
    const release = releaseSchema.parse({ ...base, ...presentation.descriptors, assets: { ...base.assets, 'network-transport.json': authorization.network.pointer_asset }, intelligence: authorization.intelligence.pointer_descriptor });
    assert.equal(release.export_id, source.export_id);
    assert.equal(release.assets['atlas-site.json'].sha256, source.structured_data.sha256);
    assert.equal(release.assets['map.json'].sha256, source.map_snapshot.sha256);
    assert.equal(release.selector_sha256, source.selector.sha256);
    assert.equal(release.correction?.authorization_sha256, hash(authorizationBytes));
    assert.deepEqual(release.source_supplement, correction.source_supplement?.pointer_descriptor, 'Release supplement must match the publication authorization');
    if (correction.source_supplement) await prepareSourceSupplement(correction.source_supplement, release);
    if (correction.browser) assert.deepEqual(release.browser, { transport_version: correction.browser.transport_version,
      manifest: { bytes: correction.browser.manifest.bytes, sha256: correction.browser.manifest.sha256 } }, 'Browser descriptor must match the publication authorization');
    const files = authorization.intelligence.files as Record<string, FileReference>;
    const sources = [source.manifest, source.structured_data, source.map_snapshot, source.selector, authorization.validation] as FileReference[];
    for (const ref of sources) await checked(ref);
    const dataBytes = await checked(files['intelligence.json']);
    const schemaBytes = await checked(files['contract.schema.json']);
    const data = validateIntelligenceRelease(intelligenceSchema.parse(JSON.parse(dataBytes.toString())), release);
    assert.equal(hash(schemaBytes), data.input_identity.schema_sha256);
    assert.deepEqual(release.intelligence!.asset, { bytes: dataBytes.length, sha256: hash(dataBytes) });
    const prefix = `intelligence/${data.experiment_id}/`;
    assert.equal(authorization.intelligence.object_prefix, prefix);
    const assets = new Map<string, Uint8Array>([[prefix + 'intelligence.json', dataBytes], [prefix + 'contract.schema.json', schemaBytes]]);
    const networkFiles = authorization.network.files as Record<string, FileReference>;
    const transportBytes = await checked(networkFiles['network-transport.json']);
    const transport = validateNetworkTransport(JSON.parse(transportBytes.toString()), release);
    assert.equal(transport.analysis_id, authorization.network.analysis_id);
    assert.deepEqual(release.assets['network-transport.json'], { bytes: transportBytes.length, sha256: hash(transportBytes) });
    assets.set(`releases/${release.export_id}/network-transport.json`, transportBytes);
    for (const name of ['network-analysis.json', 'network-analysis.schema.json', 'coverage-ledger.json'])
      assets.set(`network-analysis/${transport.analysis_id}/${name}`, await checked(networkFiles[name]));
    for (const asset of [transport.analysis, transport.schema]) {
      const bytes = assets.get(asset.relative_path)!;
      assert.equal(bytes.length, asset.bytes);
      assert.equal(hash(bytes), asset.sha256);
    }
    parseNetworkAnalysis(JSON.parse(Buffer.from(assets.get(transport.analysis.relative_path)!).toString()), transport);
    const selector = await checked(source.selector);
    assert.equal(selector.length, transport.selector.bytes);
    assets.set(transport.selector.relative_path, selector);
    for (const file of presentation.files) assets.set(file.key, file.content);
    assets.set(`releases/${release.export_id}/release.json`, Buffer.from(JSON.stringify(release)));
    if (values['dry-run']) {
      console.log(JSON.stringify({ status: 'validated', export_id: release.export_id, experiment_id: data.experiment_id }));
      return;
    }
    const current = async () => {
      const response = await fetch(`${hosting.origin}/current.json`, { cache: 'no-cache' });
      assert(response.ok, `Cannot read public release: ${response.status}`);
      return releaseSchema.parse(await response.json());
    };
    const before = await current();
    assert.equal(before.export_id, correction.replaces_export_id, 'Publication target changed');
    assert.equal(release.mode, before.mode);
    assert.equal(release.cycle, before.cycle);
    requireCurrentBrowserDescriptor(before, release);
    requireCurrentSourceSupplement(before, release);
    requireCurrentPresentation(before, release);
    if (before.export_id === release.export_id && before.intelligence) assert.deepEqual(before.intelligence, release.intelligence, 'An intervening Intelligence release requires review');
    const directory = resolve(cache, `intelligence-${data.experiment_id}`);
    await mkdir(directory, { recursive: true });
    const put = (key: string, path: string, compressed: boolean) => execFileSync(process.execPath, [resolve(site, 'node_modules/wrangler/bin/wrangler.js'), 'r2', 'object', 'put', `${hosting.bucket}/${key}`, '--file', path, '--remote', '--content-type', key.endsWith('.mjs.gz') ? 'text/javascript' : 'application/json', ...(compressed ? ['--content-encoding', 'gzip'] : [])], { cwd: site, stdio: 'inherit' });
    for (const [key, bytes] of assets) {
      const url = `${hosting.origin}/${key}`;
      const expected = { bytes: bytes.length, sha256: hash(bytes) };
      const existing = await fetch(url, { cache: 'no-cache' });
      if (existing.status === 404) {
        const path = resolve(directory, key.replaceAll('/', '_') + '.gz');
        await writeFile(path, gzipSync(bytes, { level: 9 }));
        put(key + '.gz', path, true);
        await verifiedBytes(await fetch(url, { cache: 'no-cache' }), expected);
      } else await verifiedBytes(existing, expected);
    }
    for (const [name, expected] of Object.entries(release.assets))
      await verifiedBytes(await fetch(`${releaseRoot(release)}/${name}`, { cache: 'no-cache' }), expected);
    for (const ref of [...sources, ...Object.values(files), ...Object.values(networkFiles)]) await checked(ref);
    await preparePresentation(authorization.presentation ?? {}, release);
    await verifyPublishedSourceSupplement(release);
    if (correction.source_supplement) await prepareSourceSupplement(correction.source_supplement, release);
    assert.deepEqual(await readFile(values.authorization), authorizationBytes, 'Publication authorization changed');
    assert.deepEqual(await current(), before, 'Public release changed during upload');
    const path = resolve(directory, 'current.json');
    await writeFile(path, JSON.stringify(release));
    if (values.activate) {
      put('current.json', path, false);
      assert.deepEqual(await current(), release);
    }
    const result = { status: values.activate ? 'published' : 'staged', release, authorization_sha256: hash(authorizationBytes), activation_pending: !values.activate };
    await writeFile(resolve(directory, 'receipt.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, export_id: release.export_id, experiment_id: data.experiment_id, receipt: resolve(directory, 'receipt.json') }));
  } finally { await rm(lock, { recursive: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
