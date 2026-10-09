import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { supplementSchemaHash } from '../src/lib/atlas-supplement';
import { supplementCollectionSchemaHash } from '../src/lib/atlas-supplement-collection';

for (const width of [390, 1280]) for (const collection of [false, true]) test(`Undated sources stay outside Reports at ${width}px, collection ${collection}`, async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const daily = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  daily.documents[0].publication = null;
  daily.documents[0].publication_precision = 'unknown';
  const descriptor = { version: '0.1.0', source_export_id: fixture.release.export_id,
    path: collection ? 'source-supplement-collection.json' : 'source-supplement.json',
    schema_path: collection ? 'source-supplement-collection.schema.json' : 'source-supplement.schema.json',
    schema_sha256: collection ? supplementCollectionSchemaHash : supplementSchemaHash, sha256: 'a'.repeat(64), bytes: 1 };
  fixture.bodies['/current.json'] = Buffer.from(JSON.stringify({ ...fixture.release, source_supplement: descriptor }));
  await page.route(/\/daily\//, route => route.fulfill({ json: route.request().url().endsWith('current.json') ? dailyPointer(daily) : daily }));
  const supplements: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/\/(supplements|supplement-collections)\//.test(request.url())) supplements.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-latest-list')).toContainText('Latest daily report');
  const count = new Set(bundle.records.map(record => record.document_id)).size + 1;
  await expect(page.locator('.atlas-trend-activity header strong')).toHaveText(`${count} reports`);
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(0);
  await expect(page.locator('.atlas-latest-list')).not.toContainText('Investigation in France');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-daily-report')).toHaveCount(1);
  await expect(page.locator('.atlas-daily-report')).toContainText('Latest daily report');
  await expect(page.getByRole('button', { name: 'Undated sources', exact: true })).toHaveCount(0);
  expect(supplements).toEqual([]);
  expect(errors).toEqual([]);
});
