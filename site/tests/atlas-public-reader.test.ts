import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasPublicReader } from '../scripts/atlas-public-reader';

const browserKey = `releases/${'a'.repeat(64)}/browser/${'b'.repeat(64)}/core.json`;
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('Public reads respect both Worker limits and a longer requested interval', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const times: number[] = [];
  const read = createAtlasPublicReader(0, async () => { times.push(Date.now()); return new Response('{}'); });
  await read('current.json');
  const browser = read(browserKey);
  await settle();
  t.mock.timers.tick(499);
  await settle();
  assert.deepEqual(times, [0]);
  t.mock.timers.tick(1);
  await browser;
  assert.deepEqual(times, [0, 500]);
  const general = read(`releases/${'a'.repeat(64)}/supplement-collections/${'c'.repeat(64)}/source-supplement-catalogue.json`);
  await settle();
  t.mock.timers.tick(999);
  await settle();
  assert.deepEqual(times, [0, 500]);
  t.mock.timers.tick(1);
  await general;
  assert.deepEqual(times, [0, 500, 1500]);
  const slower = createAtlasPublicReader(2000, async () => { times.push(Date.now()); return new Response('{}'); });
  await slower('current.json');
  const next = slower(browserKey);
  await settle();
  t.mock.timers.tick(1999);
  await settle();
  assert.equal(times.at(-1), 1500);
  t.mock.timers.tick(1);
  await next;
  assert.equal(times.at(-1), 3500);
  for (const interval of [-1, 1.5, Infinity, 60_001]) assert.throws(() => createAtlasPublicReader(interval), /Invalid/);
});

test('Concurrent verification requests share one paced queue', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const times: number[] = [];
  const read = createAtlasPublicReader(0, async () => { times.push(Date.now()); return new Response('{}'); });
  const requests = [read('current.json'), read('releases/map.json'), read('releases/metrics.json')];
  await requests[0];
  await settle();
  assert.deepEqual(times, [0]);
  t.mock.timers.tick(1000);
  await requests[1];
  await settle();
  assert.deepEqual(times, [0, 1000]);
  t.mock.timers.tick(1000);
  await Promise.all(requests);
  assert.deepEqual(times, [0, 1000, 2000]);
});

test('Public readers return rate-limit failures without retries', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  let reads = 0;
  const read = createAtlasPublicReader(0, async () => { reads++; return new Response(null, { status: 429, headers: { 'Retry-After': '60' } }); });
  const response = await read('current.json');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  t.mock.timers.tick(120_000);
  await settle();
  assert.equal(reads, 1);
});
