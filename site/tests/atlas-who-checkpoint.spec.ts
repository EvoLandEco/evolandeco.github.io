import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { AtlasMapSnapshot } from '../src/lib/atlas-contract';

for (const [width, height] of [[390, 950], [1280, 950], [1280, 720]]) test(`WHO checkpoint figures and laboratory values at ${width}×${height}`, async ({ page }) => {
  test.skip(!process.env.ATLAS_WHO_CHECKPOINT && !process.env.ATLAS_WHO_FINAL, 'Requires the private WHO checkpoint preview');
  const final = !!process.env.ATLAS_WHO_FINAL;
  const snapshot = JSON.parse(readFileSync((process.env.ATLAS_WHO_FINAL ?? process.env.ATLAS_WHO_CHECKPOINT) + '/snapshot.json', 'utf8')) as AtlasMapSnapshot;
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const started = Date.now();
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  console.log(JSON.stringify({ width, height, localReadyMs: Date.now() - started }));
  if (width === 1280) {
    const entrance = page.getByRole('button', { name: 'Click to enter full screen' });
    await entrance.focus();
    await entrance.press('Enter');
    if (height <= 850) await page.getByRole('button', { name: 'Observations', exact: true }).click();
  }
  const plot = page.locator('.atlas-analysis-observations');
  async function series(kind: string) {
    await plot.locator('summary[aria-label="Observation series"]').click();
    await plot.getByRole('option', { name: `WHO global mpox cumulative ${kind}, January 2025 baseline`, exact: true }).click();
  }
  for (const kind of ['cases', 'deaths']) {
    await series(kind);
    await expect(plot.locator('.atlas-observation-chart circle')).toHaveCount(final ? 8 : 4);
    await expect(plot.locator('.atlas-observation-connection')).toHaveCount(final ? 7 : 3);
    await expect(plot.locator('figcaption')).toContainText('Cumulative');
    await expect(plot.locator('.atlas-observation-row > strong')).toHaveText(kind === 'cases' ? [...(final ? ['52,845', '54,817', '56,356', '58,214'] : []), '59,709', '61,061', '63,692', '65,784'] : [...(final ? ['215', '221', '227', '238'] : []), '241', '244', '256', '264']);
  }
  const menu = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Reporting topic"]') });
  async function topics(ids: string[]) {
    await menu.locator('summary').click();
    await menu.getByRole('checkbox').first().check();
    for (const id of ids) {
      const track = snapshot.records.find(r => r.id === id)!.track;
      await menu.getByRole('checkbox').nth(snapshot.tracks.findIndex(t => t.id === track) + 1).check();
    }
    await page.keyboard.press('Escape');
  }
  await topics(['doc_36d54e30f3343e2afaedde33:0', 'doc_cc016cc283eeee19665d1e18:0', 'doc_b4f15ad87084fa8a5ea3af0b:0']);
  await series('cases');
  await expect(plot.locator('.atlas-observation-chart circle')).toHaveCount(3);
  await expect(plot.locator('.atlas-observation-connection')).toHaveCount(1);
  await expect(plot.locator('.atlas-observation-connection')).toHaveAttribute('aria-label', 'Comparison from 30 Apr 2026 to 31 May 2026');
  await expect(plot.locator('.atlas-observation-row > strong')).toHaveText(['59,709', '61,061', '65,784']);
  await plot.screenshot({ path: `/tmp/atlas-who-mpox-${width}-${height}.png` });
  await topics(['doc_5c699b314c639511d1f3259c:0']);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const report = page.locator('#atlas-report-doc_5c699b314c639511d1f3259c');
  const beforeOpen = Date.now();
  await report.locator(':scope > summary').click();
  await expect(report).toHaveAttribute('open', '');
  const values = report.locator('.atlas-measure > strong');
  expect(await values.allTextContents()).toContain('unknown');
  expect(await values.allTextContents()).toContain('0');
  console.log(JSON.stringify({ width, height, laboratoryOpenMs: Date.now() - beforeOpen, figureTiles: await values.count() }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
