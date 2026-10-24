import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { atlasSelect } from './atlas-select-actions';

for (const width of [390, 1440]) test(`UI 0.8.0 exposes the published analysis views at ${width}px`, async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await page.getByRole('radio', { name: 'Network view', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Network view', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const selector = atlasSelect(page, 'Analysis view');
  await selector.locator(':scope > summary').click();
  await expect(selector.getByRole('option')).toHaveCount(4);
  await expect(selector.locator('button[value="network"]')).toHaveCount(0);
  for (const value of ['signals', 'spatial', 'relationships', 'risk']) await expect(selector.locator(`button[value="${value}"]`)).toBeVisible();
  await selector.press('Escape');
  await expect(page.getByRole('region', { name: 'Network analysis', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'About ATLAS', exact: true }).click();
  await expect(page.getByLabel('ATLAS UI release')).toContainText('ATLAS UI v0.8.0');
  expect(errors).toEqual([]);
});
