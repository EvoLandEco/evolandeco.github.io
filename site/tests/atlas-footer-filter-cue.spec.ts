import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { atlasSelect, selectAtlasOption } from './atlas-select-actions';

test.beforeEach(async ({ page }) => {
  await routeBrowserFixture(page, healthPanelsFixture(), JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function openAtlas(page: Page, width: number, theme: 'light' | 'dark', fullscreen = false) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(value => localStorage.setItem('theme', value), theme);
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset all filters and rules', exact: true })).toBeDisabled();
  await expect(page.locator('.atlas-footer-filter-cue')).toHaveCount(0);
  if (fullscreen) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  }
}

async function expectFooterLayout(page: Page) {
  const footer = page.locator('.atlas-workspace-footer');
  const cue = footer.getByRole('button', { name: 'Reset all filters and selections', exact: true });
  await expect(cue).toBeVisible();
  await expect(cue.locator(':scope > span')).toBeVisible();
  await expect(cue.locator('strong > span')).toBeVisible();
  await cue.scrollIntoViewIfNeeded();
  const bounds = (await footer.boundingBox())!;
  const button = (await cue.boundingBox())!;
  const about = (await footer.getByRole('button', { name: 'About ATLAS', exact: true }).boundingBox())!;
  expect(button.y + button.height / 2).toBeCloseTo(about.y + about.height / 2, 0);
  if (bounds.width > 700 || !await page.locator('.atlas-page[data-fullscreen]').count()) expect(button.x + button.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 0);
  expect(button.x).toBeGreaterThanOrEqual(bounds.x);
  expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  for (const center of await footer.locator('button:visible, summary:visible').evaluateAll(controls => controls.map(control => {
    const box = control.getBoundingClientRect();
    return box.top + box.height / 2;
  }))) expect(center).toBeCloseTo(about.y + about.height / 2, 0);
  expect(await cue.evaluate(element => {
    const box = element.getBoundingClientRect();
    return [...element.closest('footer')!.querySelectorAll<HTMLElement>('button, summary')]
      .filter(control => control !== element && control.getClientRects().length > 0)
      .filter(control => {
        const other = control.getBoundingClientRect();
        return box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
      }).map(control => control.getAttribute('aria-label') ?? control.textContent);
  })).toEqual([]);
  expect(await footer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('Footer cue clears the reporting window and source filter by keyboard', async ({ page }) => {
  await openAtlas(page, 390, 'light');
  const controls = page.locator('.atlas-controls');
  const cue = page.getByRole('button', { name: 'Reset all filters and selections', exact: true });
  const rules = controls.locator('.atlas-rules > summary');
  const toolbarReset = page.getByRole('button', { name: 'Reset all filters and rules', exact: true });
  await controls.getByRole('button', { name: '3 months', exact: true }).click();
  await expect(cue).toHaveText('Filtered viewReset');
  await expect(toolbarReset).toBeEnabled();
  await expect(cue).toHaveCSS('animation-name', 'none');
  await expectFooterLayout(page);
  await cue.focus();
  await cue.press('Enter');
  await expect(cue).toHaveCount(0);
  await expect(rules).toHaveAttribute('aria-label', 'Active rules: 0');
  await expect(toolbarReset).toBeDisabled();
  await expect(page.getByRole('button', { name: 'About ATLAS', exact: true })).toBeFocused();
  await expect(controls.getByRole('button', { name: 'All dates', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const source = atlasSelect(controls, 'Reporting source');
  await source.locator(':scope > summary').click();
  await source.getByRole('checkbox').nth(1).check();
  await source.getByRole('checkbox').nth(1).press('Escape');
  await expect(cue).toHaveText('Filtered viewReset');
  await expect(toolbarReset).toBeEnabled();
  await cue.click();
  await expect(cue).toHaveCount(0);
  await expect(rules).toHaveAttribute('aria-label', 'Active rules: 0');
  await expect(source.locator(':scope > summary')).toContainText('All sources');
});

test('Footer cue identifies evidence and route selections without claiming filters', async ({ page }, testInfo) => {
  await openAtlas(page, 1280, 'dark');
  const cue = page.getByRole('button', { name: 'Reset all filters and selections', exact: true });
  await page.locator('.atlas-latest-entry').first().click();
  await expect(cue).toHaveText('Selection activeReset');
  await expect(page.locator('.atlas-active-filters')).toHaveCount(0);
  await expect(page.locator('.atlas-report[data-evidence="true"]')).not.toHaveCount(0);
  await expectFooterLayout(page);
  await page.locator('.atlas-workspace-footer').screenshot({ path: testInfo.outputPath('footer-evidence-selection.png') });
  await cue.focus();
  await cue.press('Enter');
  await expect(cue).toHaveCount(0);
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'About ATLAS', exact: true })).toBeFocused();
  await page.locator('.atlas-link-target').first().press('Enter');
  await expect(cue).toHaveText('Selection activeReset');
  await expect(page.locator('.atlas-active-filters')).toHaveCount(0);
  await cue.click();
  await expect(cue).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset all filters and rules', exact: true })).toBeDisabled();
});

for (const view of [
  { width: 320, theme: 'light' as const, fullscreen: false },
  { width: 390, theme: 'dark' as const, fullscreen: false },
  { width: 450, theme: 'light' as const, fullscreen: false },
  { width: 1280, theme: 'light' as const, fullscreen: true },
]) test(`Footer controls share one row at ${view.width}px fullscreen=${view.fullscreen}`, async ({ page }, testInfo) => {
  await openAtlas(page, view.width, view.theme, view.fullscreen);
  await page.locator('.atlas-latest-entry').first().click();
  await expect(page.locator('.atlas-footer-filter-cue')).toHaveText('Selection activeReset');
  const footer = page.locator('.atlas-workspace-footer');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expectFooterLayout(page);
  if (view.fullscreen) await expect(footer.getByRole('navigation', { name: 'Report pages, bottom', exact: true })).toBeVisible();
  await footer.screenshot({ path: testInfo.outputPath('footer-reports.png') });
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  await selectAtlasOption(page, 'One Health view', { label: 'Overview' });
  await expect(footer.getByRole('button', { name: 'About One Health', exact: true })).toBeVisible();
  await expectFooterLayout(page);
  if (view.fullscreen) {
    const pagination = footer.getByRole('navigation', { name: 'One Health overview pages, bottom', exact: true });
    await expect(pagination).toBeVisible();
    await pagination.getByRole('button', { name: 'Next one health overview page', exact: true }).click();
    await expect(pagination.locator('summary')).toHaveText(/^2 \/ /);
    await expectFooterLayout(page);
  }
  expect((await new AxeBuilder({ page }).include('.atlas-workspace-footer').analyze()).violations).toEqual([]);
  await footer.screenshot({ path: testInfo.outputPath('footer-one-health.png') });
  if (view.fullscreen && testInfo.project.name === 'chromium') await footer.screenshot({ path: '/tmp/atlas-footer-filter-cue.png' });
});
