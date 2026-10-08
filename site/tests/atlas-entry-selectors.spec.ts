import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { intelligenceSchema } from '../src/lib/atlas-intelligence';
import { atlasSelect, selectAtlasOption } from './atlas-select-actions';

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.ATLAS_BROWSER_CANDIDATE || !process.env.ATLAS_RELEASE_FILE || !process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the matching browser transport, release and analysis fixtures');
  const receipt = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE!, 'utf8'));
  await page.route('**/current.json', route => route.fulfill({ json: receipt.release ?? receipt }));
  await page.route('**/daily/*/current.json', route => route.fulfill({ status: 404 }));
  await page.route('**/releases/*/browser/*/**', route => {
    const asset = new URL(route.request().url()).pathname.split('/browser/')[1].split('/').slice(1).join('/');
    return route.fulfill({ contentType: 'application/json', body: readFileSync(join(process.env.ATLAS_BROWSER_CANDIDATE!, asset)) });
  });
  await page.route('**/intelligence/*/intelligence.json', route => route.fulfill({ contentType: 'application/json', body: readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!) }));
});

async function summaryStyle(summary: Locator) {
  return summary.evaluate(element => {
    const style = getComputedStyle(element);
    return [style.minHeight, style.borderTopWidth, style.borderRadius, style.padding, style.backgroundColor];
  });
}

async function searchAndSelect(page: Page, menu: Locator, label: string, value: string) {
  const summary = menu.locator(':scope > summary');
  if (!await page.locator('.atlas-page[data-fullscreen]').count()) await summary.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect(menu.getByRole('option')).toHaveCount(0);
  await summary.press('Enter');
  const search = menu.getByRole('searchbox');
  await expect(search).toBeFocused();
  const popup = await menu.locator('.atlas-select-options').boundingBox();
  const viewport = page.viewportSize()!;
  expect(popup!.x).toBeGreaterThanOrEqual(0);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(viewport.width);
  expect(popup!.y).toBeGreaterThanOrEqual(0);
  expect(popup!.y + popup!.height).toBeLessThanOrEqual(viewport.height);
  await search.fill('no matching entry 982731');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(menu.getByRole('status')).toHaveText('No matches');
  await search.fill(label);
  const option = menu.getByRole('option').and(menu.locator(`button[value=${JSON.stringify(value)}]`));
  await expect(option).toBeVisible();
  await search.press('ArrowDown');
  await expect(option).toBeFocused();
  await option.press('Enter');
  await expect(summary).toBeFocused();
  await expect(summary.locator(':scope > span')).toHaveAttribute('title', label);
  await expect(menu.getByRole('option')).toHaveCount(0);
  await summary.press('Enter');
  await expect(search).toHaveValue('');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await search.press('Escape');
  await expect(summary).toBeFocused();
}

for (const width of [390, 1440]) test(`Entry selectors share search, keyboard and menu layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'light' : 'dark' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');

  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const reference = page.locator('summary[aria-label="One Health report"]');
  await expect(reference).toBeVisible();
  const referenceStyle = await summaryStyle(reference);
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  const journeys = atlasSelect(page, 'Reviewed chain');
  expect(await summaryStyle(journeys.locator(':scope > summary'))).toEqual(referenceStyle);
  await journeys.locator(':scope > summary').click();
  const journeyOption = journeys.getByRole('option').nth(1);
  const journey = { label: (await journeyOption.getAttribute('aria-label'))!, value: (await journeyOption.getAttribute('value'))! };
  await expect(journeyOption.locator('.atlas-select-badge[data-kind="kind"]')).toBeVisible();
  await journeys.getByRole('searchbox').press('Escape');
  await searchAndSelect(page, journeys, journey.label, journey.value);
  await expect(page.locator('.atlas-chain-figure')).toHaveAttribute('aria-label', journey.label);

  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  const seriesMenu = atlasSelect(analysis, 'Monitored series');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const series = data.forecast_series[1];
  await analysis.getByRole('button', { name: 'Models', exact: true }).click();
  expect(await summaryStyle(seriesMenu.locator(':scope > summary'))).toEqual(referenceStyle);
  await searchAndSelect(page, seriesMenu, series.label, series.id);
  await expect(analysis.getByRole('region', { name: 'Model prediction', exact: true })).toBeVisible();
  await seriesMenu.locator(':scope > summary').click();
  await expect(seriesMenu.getByRole('option').filter({ hasText: 'Model evaluation' }).first()).toBeVisible();
  const observation = seriesMenu.getByRole('option').and(seriesMenu.locator('button[value^="observations:"]')).first();
  await expect(observation).toContainText('Reported observations');
  const observationId = (await observation.getAttribute('value'))!;
  await observation.click();
  await expect(analysis.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();

  await analysis.getByRole('button', { name: 'Signals', exact: true }).click();
  await analysis.getByRole('combobox', { name: 'Signal type', exact: true }).selectOption('count_exceedance');
  expect(await summaryStyle(seriesMenu.locator(':scope > summary'))).toEqual(referenceStyle);
  await searchAndSelect(page, seriesMenu, series.label, series.id);
  await expect(analysis.getByRole('group', { name: `${series.label}: observed counts, expected counts and investigation thresholds`, exact: true })).toBeVisible();
  await seriesMenu.locator(':scope > summary').click();
  await expect(seriesMenu.getByRole('option')).toHaveCount(data.forecast_series.length);
  await expect(seriesMenu.locator('button[value^="observations:"]')).toHaveCount(0);
  await seriesMenu.getByRole('searchbox').press('Escape');
  await analysis.getByRole('button', { name: 'Models', exact: true }).click();
  await selectAtlasOption(analysis, 'Monitored series', observationId);
  await expect(analysis.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
