import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';

for (const width of [390, 1280]) test(`Briefing lists recent documents without claiming inferred urgency at ${width}px`, async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width, height: 850 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.getByRole('heading', { name: 'Reporting activity', exact: true })).toBeVisible();
  await expect(page.locator('.atlas-trend-coverage > svg, .atlas-disease-ring > svg')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Outbreak watch', exact: true })).toBeVisible();
  await expect(page.locator('.atlas-watch-list')).toContainText('No current watch selections');
  const reports = page.locator('.atlas-latest-list > li:not([inert]) .atlas-latest-entry');
  await expect(reports).toHaveCount(7);
  expect(await reports.first().evaluate(element => element.querySelector('.atlas-latest-date')!.getBoundingClientRect().top - element.getBoundingClientRect().top)).toBeLessThanOrEqual(10);
  await expect(page.locator('.atlas-latest-preview')).toHaveCount(1);
  await expect(page.locator('.atlas-latest-preview')).toHaveAttribute('inert', '');
  await expect(page.locator('.atlas-latest-list')).toHaveCSS('overflow-y', 'clip');
  await expect(page.locator('.atlas-latest-list')).toHaveCSS('padding-right', '0px');
  const footer = page.locator('.atlas-workspace-footer');
  await expect(footer).toHaveCSS('border-top-left-radius', '16px');
  expect(await footer.evaluate(element => element.getBoundingClientRect().top - element.previousElementSibling!.getBoundingClientRect().bottom)).toBeCloseTo(24, 0);
  expect(await page.locator('.atlas-latest-preview').evaluate(el => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom)).toBeCloseTo(0, 0);
  await page.getByRole('button', { name: 'View all reports', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/atlas-briefing-fade-${width}.png` });
  const dates = await reports.locator('time').evaluateAll(elements => elements.map(element => element.getAttribute('datetime')));
  expect(dates).toEqual([...dates].sort().reverse());
  if (width === 1280) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    await expect.poll(() => reports.count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator('.atlas-watch').evaluate(element => Math.abs(element.getBoundingClientRect().height - element.nextElementSibling!.getBoundingClientRect().height) < 1)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).include('.atlas-briefing').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'View all reports', exact: true }).press('Enter');
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('group', { name: 'Report content', exact: true }).getByRole('button', { name: 'Reports', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await reports.first().click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(1);
});
