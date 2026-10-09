import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import hosting from '../src/content-data/atlas-hosting.json';

const configuration = JSON.parse(readFileSync(new URL('../atlas-worker/wrangler.jsonc', import.meta.url), 'utf8')) as {
  ratelimits: { name: string; simple: { limit: number; period: number } }[];
};
const intervals = new Map(configuration.ratelimits.map(({ name, simple }) => {
  assert(Number.isSafeInteger(simple.limit) && simple.limit > 0 && Number.isSafeInteger(simple.period) && simple.period > 0, 'Invalid Worker read limit');
  return [name, Math.ceil(simple.period * 1000 / simple.limit)];
}));
assert(intervals.has('READ_LIMIT') && intervals.has('BROWSER_READ_LIMIT'), 'Worker read limits are required');

export function createAtlasPublicReader(intervalMs = 0, read = (key: string) => fetch(`${hosting.origin}/${key}`, { cache: 'no-cache' })) {
  assert(Number.isSafeInteger(intervalMs) && intervalMs >= 0 && intervalMs <= 60_000, 'Invalid public read interval');
  let lastRead = -Infinity;
  let queue = Promise.resolve();
  return (key: string): Promise<Response> => {
    const request = queue.then(async () => {
      const bucket = /^releases\/[a-f0-9]{64}\/browser\/[a-f0-9]{64}\//.test(key) ? 'BROWSER_READ_LIMIT' : 'READ_LIMIT';
      const wait = Math.max(intervalMs, intervals.get(bucket)!) - (Date.now() - lastRead);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastRead = Date.now();
      return read(key);
    });
    queue = request.then(() => undefined, () => undefined);
    return request;
  };
}
