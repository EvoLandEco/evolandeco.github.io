import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import hosting from '../src/content-data/atlas-hosting.json';
import { releaseSchema, verifiedBytes } from '../src/lib/atlas-release';
import { validateNetworkTransport, parseNetworkAnalysis } from '../src/lib/atlas-network-analysis';

async function main() {
  const { values } = parseArgs({ options: { candidate: { type: 'string' }, release: { type: 'string' }, authorization: { type: 'string' }, 'dry-run': { type: 'boolean', default: false } } });
  assert(values.candidate && values.release && values.authorization, 'Supply --candidate, --release and --authorization');
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const receipt = JSON.parse(await readFile(values.release, 'utf8'));
  const release = releaseSchema.parse(receipt.release);
  const authorizationBytes = await readFile(values.authorization);
  const authorization = JSON.parse(authorizationBytes.toString());
  const manifest = JSON.parse(await readFile(resolve(values.candidate, 'manifest.json'), 'utf8'));
  const transportBytes = await readFile(resolve(values.candidate, 'network-transport.json'));
  const transport = validateNetworkTransport(JSON.parse(transportBytes.toString()), release);
  assert.equal(authorization.scope, 'stage_only');
  assert.equal(authorization.analysis_id, transport.analysis_id);
  assert.equal(authorization.site_release_id, release.export_id);
  assert(authorization.thread_id && authorization.instruction);
  assert.equal(hash(transportBytes), manifest.files['network-transport.json']);
  const files = new Map<string, Uint8Array>();
  files.set(`releases/${release.export_id}/network-transport.json`, transportBytes);
  for (const name of ['network-analysis.json', 'network-analysis.schema.json', 'coverage-ledger.json']) {
    const bytes: Buffer = await readFile(resolve(values.candidate, name));
    assert.equal(hash(bytes), manifest.files[name], name);
    files.set(`network-analysis/${transport.analysis_id}/${name}`, bytes);
  }
  for (const asset of [transport.analysis, transport.schema]) {
    const bytes = files.get(asset.relative_path)!;
    assert.equal(bytes.length, asset.bytes);
    assert.equal(hash(bytes), asset.sha256);
  }
  parseNetworkAnalysis(JSON.parse(Buffer.from(files.get(transport.analysis.relative_path)!).toString()), transport);
  const selector = await readFile(receipt.handoff.export.selector.path);
  assert.equal(hash(selector), release.selector_sha256);
  assert.equal(selector.length, transport.selector.bytes);
  files.set(transport.selector.relative_path, selector);
  const attached = releaseSchema.parse({ ...release, assets: { ...release.assets, 'network-transport.json': { bytes: transportBytes.length, sha256: hash(transportBytes) } } });
  files.set(`releases/${release.export_id}/release.json`, Buffer.from(JSON.stringify(attached)));
  if (values['dry-run']) {
    console.log(JSON.stringify({ status: 'validated', analysis_id: transport.analysis_id, paths: [...files.keys()] }));
    return;
  }
  assert.equal(authorization.approval_status, 'approved', 'Public upload requires explicit approval');
  const cache = resolve('.cache/atlas-sync', `network-${transport.analysis_id}`);
  await mkdir(cache, { recursive: true });
  const publicPointer = await (await fetch(`${hosting.origin}/current.json`, { cache: 'no-cache' })).json();
  const uploaded = [];
  for (const [key, bytes] of files) {
    const expected = { bytes: bytes.length, sha256: hash(bytes) };
    const url = `${hosting.origin}/${key}`;
    const existing = await fetch(url, { cache: 'no-cache' });
    if (existing.status === 404) {
      const path = resolve(cache, basename(key) + '.gz');
      await writeFile(path, gzipSync(bytes, { level: 9 }));
      execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'r2', 'object', 'put', `${hosting.bucket}/${key}.gz`, '--file', path, '--remote', '--content-type', key.endsWith('.mjs') ? 'text/javascript' : 'application/json', '--content-encoding', 'gzip'], { stdio: 'inherit' });
      await verifiedBytes(await fetch(url, { cache: 'no-cache' }), expected);
    } else await verifiedBytes(existing, expected);
    uploaded.push({ url, ...expected });
  }
  assert.deepEqual(await (await fetch(`${hosting.origin}/current.json`, { cache: 'no-cache' })).json(), publicPointer, 'Public pointer changed during staging');
  await writeFile(resolve(cache, 'release.json'), JSON.stringify(attached, null, 2));
  await writeFile(resolve(cache, 'receipt.json'), JSON.stringify({ status: 'staged', analysis_id: transport.analysis_id, release: attached, authorization_sha256: hash(authorizationBytes), uploaded, activation_pending: true }, null, 2));
  console.log(JSON.stringify({ status: 'staged', receipt: resolve(cache, 'receipt.json'), activation_pending: true }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
