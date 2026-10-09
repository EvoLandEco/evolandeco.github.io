import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';
import presentation from './atlas-presentation-fixture.json';

test('Independent release attachments load together and preserve verification failures', async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const watch = Buffer.from(JSON.stringify({ ...presentation.watch, source_export_id: fixture.release.export_id,
    source_site_sha256: fixture.release.assets['atlas-site.json'].sha256, map_snapshot_sha256: fixture.release.assets['map.json'].sha256, items: [] }));
  const release = { ...fixture.release,
    watch: { ...presentation.release.watch, source_export_id: fixture.release.export_id,
      sha256: createHash('sha256').update(watch).digest('hex'), bytes: watch.length },
    intelligence: { experiment_id: 'a'.repeat(64), schema_version: '0.2.0', asset: { sha256: 'b'.repeat(64), bytes: 1 } },
  };
  fixture.bodies['/current.json'] = Buffer.from(JSON.stringify(release));
  let unblock!: () => void;
  const gate = new Promise<void>(resolve => { unblock = resolve; });
  const requested = new Set<string>();
  await page.route('**/watch.json', async route => { requested.add('watch'); await gate; await route.fulfill({ contentType: 'application/json', body: watch }); });
  await page.route('**/intelligence/*/intelligence.json', async route => { requested.add('intelligence'); await gate; await route.fulfill({ status: 503, body: 'Unavailable' }); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await page.goto('/atlas/');
    await expect.poll(() => [...requested].sort()).toEqual(['intelligence', 'watch']);
    await expect(page.getByRole('heading', { name: 'Reporting activity', exact: true })).toHaveCount(0);
  } finally { unblock(); }
  await expect(page.getByRole('heading', { name: 'Reporting activity', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Source risk assessments', exact: true })).toContainText('Analysis could not be verified. Reload to try again.');
});
