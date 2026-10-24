import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { atlasSelect, selectAtlasOption } from './atlas-select-actions';

test.beforeEach(async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
});

for (const [width, theme, fullscreen] of [[1440, 'light', true], [390, 'dark', false]] as const) {
  test.skip(`Unpublished Network analysis preserves evidence counts and readable controls at ${width}px in ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/atlas/');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
    if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    await expect(page.getByRole('radio', { name: 'Network view' }).locator('.lucide-waypoints')).toHaveCount(1);
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await selectAtlasOption(page, 'Analysis view', 'network');
    const panel = page.getByRole('region', { name: 'Network analysis', exact: true });
    await expect(panel).toBeVisible();
    await expect(page.locator('summary[aria-label="Monitored series"]')).toHaveCount(0);
    await expect(panel.getByRole('table', { name: 'Continent connection matrix' })).toBeVisible();
    const enabledCell = panel.locator('table[aria-label="Continent connection matrix"] button:not(:disabled)').first();
    const count = Number((await enabledCell.getAttribute('aria-label'))!.match(/: (\d+) statements/)![1]);
    await enabledCell.click();
    await expect(panel.locator('section[aria-labelledby="atlas-network-evidence"] details')).toHaveCount(count);
    await panel.locator('section[aria-labelledby="atlas-network-evidence"] details > summary').first().click();
    await expect(panel.getByRole('button', { name: 'Source reports & quotations' }).first()).toBeVisible();
    await panel.getByRole('button', { name: 'Source reports & quotations' }).first().click();
    await expect(page.getByRole('tab', { name: /^Reports/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await expect(atlasSelect(page, 'Analysis view').locator('summary')).toContainText('Network');
    await selectAtlasOption(page, 'Network layer', 'shared_event');
    await expect(panel).toContainText('Unordered pairs, shown once.');
    await selectAtlasOption(page, 'Network layer', 'hypothesis');
    await expect(panel).toContainText('Source hypotheses');
    await selectAtlasOption(page, 'Network layer', 'movement_directed');
    const search = panel.getByRole('searchbox', { name: 'Find a network country' });
    await search.fill('zz-no-country');
    await expect(panel).toContainText('No matching countries.');
    await search.fill('');
    await panel.getByRole('button', { name: 'Network methods & references for Reading the reporting network' }).click();
    await expect(page.getByRole('dialog', { name: 'Network methods & references for Reading the reporting network' })).toContainText('Every supporting report entry');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[aria-label="Network analysis"]').analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await panel.screenshot({ path: info.outputPath(`network-${theme}.png`) });
  });
}
