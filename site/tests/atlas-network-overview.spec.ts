import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';

for (const [width, height, workspace] of [[390, 844, false], [768, 900, false], [1280, 720, true], [1440, 1000, true]] as const) {
  test(`Country network overview at ${width}×${height}`, async ({ page }, testInfo) => {
    await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
    await page.goto('/atlas/');
    await page.locator('.atlas-page[data-ready="true"]').waitFor();
    if (workspace) {
      await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
      await page.keyboard.press('Enter');
    }
    const overview = page.getByRole('region', { name: 'Country network overview', exact: true });
    await expect(page.getByRole('group', { name: 'Trends overview' })).toHaveCount(0);
    await expect(page.locator('.atlas-stats')).toHaveCount(0);
    await expect(overview).toBeVisible();
    await expect(overview.getByRole('heading', { name: 'Country links', exact: true })).toBeVisible();
    await expect(overview).toHaveCSS('border-left-width', '0px');
    await expect(overview.getByRole('button', { name: /^Most linked country:/ })).toBeEnabled();
    await expect(overview.getByRole('button', { name: /^Top movement destination:/ })).toBeEnabled();
    await page.locator('.atlas-trend-overview').screenshot({ path: `/tmp/atlas-network-overview-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const networkBox = (await overview.boundingBox())!;
    const trendsBox = (await page.locator('.atlas-trend-overview').boundingBox())!;
    const coverageBox = (await page.locator('.atlas-trend-coverage').boundingBox())!;
    const activityBox = (await page.locator('.atlas-trend-activity').boundingBox())!;
    const figureBottoms = await page.locator('.atlas-trend-overview').evaluate(element => {
      const bottom = (selector: string) => element.querySelector(selector)!.getBoundingClientRect().bottom;
      return { year: bottom('.atlas-activity-bars small'), ring: bottom('.atlas-disease-ring > svg'), country: bottom('.atlas-network-stats') };
    });
    expect(figureBottoms.country).toBeCloseTo(figureBottoms.ring, 0);
    if (width !== 390) expect(figureBottoms.year).toBeCloseTo(figureBottoms.ring, 0);
    if (workspace) {
      await expect(page.locator('.atlas-disease-ring > svg')).toHaveCSS('width', '128px');
      const tallestBar = await page.locator('.atlas-activity-track > span').evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().height)));
      expect(tallestBar).toBeGreaterThanOrEqual(50);
    }
    expect(await page.locator('.atlas-trend-overview > section').evaluateAll(elements => elements.map(element => element.className))).toEqual(['atlas-trend-activity', 'atlas-network-overview', 'atlas-trend-coverage']);
    expect(activityBox.x).toBeCloseTo(trendsBox.x, 0);
    expect(coverageBox.x + coverageBox.width).toBeLessThanOrEqual(trendsBox.x + trendsBox.width + 1);
    if (width === 390) {
      expect(activityBox.y).toBeCloseTo(trendsBox.y, 0);
      expect(activityBox.width).toBeCloseTo(trendsBox.width, 0);
      expect(activityBox.y + activityBox.height).toBeLessThan(networkBox.y);
      expect(networkBox.y).toBeCloseTo(coverageBox.y, 0);
      expect(networkBox.x).toBeCloseTo(trendsBox.x, 0);
      expect(networkBox.x + networkBox.width).toBeLessThan(coverageBox.x);
    } else {
      expect(activityBox.y).toBeCloseTo(trendsBox.y, 0);
      expect(networkBox.y).toBeCloseTo(activityBox.y, 0);
      expect(networkBox.y).toBeCloseTo(coverageBox.y, 0);
      expect(activityBox.x + activityBox.width).toBeLessThan(networkBox.x);
      expect(networkBox.x + networkBox.width).toBeLessThan(coverageBox.x);
      if (workspace) expect(networkBox.height).toBeLessThanOrEqual(180);
      else expect(networkBox.height).toBeCloseTo(activityBox.height, 0);
    }
    if (!workspace) expect(networkBox.height).toBeCloseTo(coverageBox.height, 0);
    const period = page.getByRole('group', { name: 'Reporting attention period' }).getByRole('button');
    for (const label of ['Weekly', 'Monthly']) {
      await expect(period).toHaveText(label);
      const heading = await page.locator('.atlas-trend-coverage > header').evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: element.clientWidth, contentWidth: element.scrollWidth,
          children: [...element.children].map(child => { const box = child.getBoundingClientRect(); return { text: child.textContent, left: box.left, right: box.right }; }) };
      });
      expect(heading.contentWidth, JSON.stringify(heading)).toBeLessThanOrEqual(heading.width);
      for (const child of heading.children) {
        expect(child.left, JSON.stringify(heading)).toBeGreaterThanOrEqual(heading.left);
        expect(child.right, JSON.stringify(heading)).toBeLessThanOrEqual(heading.right);
      }
      if (label === 'Monthly') await page.locator('.atlas-trend-overview').screenshot({ path: `/tmp/atlas-network-overview-${width}-monthly-${testInfo.project.name}.png` });
      await period.click();
    }
    await expect(period).toHaveText('Weekly');
    await expect(page.locator('.atlas-observatory .atlas-network-overview')).toHaveCount(0);
    await expect(overview.locator('.atlas-network-stats > button')).toHaveCount(3);
    const statCells = await overview.locator('.atlas-network-stats > button').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      const label = element.querySelector('.atlas-network-stat-label')!.getBoundingClientRect();
      const value = element.querySelector('strong')!.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, labelRight: label.right, valueLeft: value.left, labelCenter: label.top + label.height / 2, valueCenter: value.top + value.height / 2 };
    }));
    for (const cell of statCells) {
      expect(cell.labelRight).toBeLessThanOrEqual(cell.valueLeft);
      expect(cell.labelCenter).toBeCloseTo(cell.valueCenter, 0);
    }
    for (let index = 1; index < statCells.length; index++) {
      expect(statCells[index].left).toBeCloseTo(statCells[0].left, 0);
      expect(statCells[index].right).toBeCloseTo(statCells[0].right, 0);
      expect(statCells[index].top).toBeGreaterThanOrEqual(statCells[index - 1].bottom);
    }
    expect(statCells[2].labelCenter - statCells[1].labelCenter).toBeCloseTo(statCells[1].labelCenter - statCells[0].labelCenter, 0);
    for (const stat of (await overview.locator('.atlas-network-stats > button').all()).slice(0, 2)) {
      await expect(stat.locator(':scope > span:not(.atlas-network-stat-label)')).toHaveCount(0);
    }
    for (const tile of await overview.locator('.atlas-network-stats > button').all()) {
      expect(await tile.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(tile).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(tile).toHaveCSS('border-width', '0px');
    }
    if (workspace) expect(await page.locator('.atlas-workspace-scroll').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await expect(overview.locator('.atlas-network-summary')).toHaveCount(0);
    const methods = page.getByRole('button', { name: 'Network methods & references for Country network statistics' });
    const helpBox = (await methods.boundingBox())!;
    expect(helpBox.width).toBe(22);
    expect(helpBox.height).toBe(22);
    await expect(methods).toHaveCSS('border-radius', '50%');
    await methods.click();
    const dialog = page.getByRole('dialog', { name: 'Network methods & references for Country network statistics' });
    await expect(dialog.getByRole('heading', { name: 'Reporting counts · Unadjusted' })).toBeVisible();
    await expect(dialog.locator('.atlas-references').getByRole('link')).toHaveCount(3);
    await expect(dialog.getByText(/not adjusted for surveillance/)).toBeVisible();
    await dialog.screenshot({ path: `/tmp/atlas-network-methods-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(methods).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Outbreak watch' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest reports' })).toBeVisible();
    if (workspace) expect(await page.locator('.atlas-workspace-scroll').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await expect(overview).toBeVisible();
    await page.locator('summary[aria-label="Link type"]').click();
    const types = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Link type"]') });
    await types.getByRole('checkbox', { name: 'Source hypothesis', exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(overview.getByRole('button', { name: /^Most linked country:/ })).toBeDisabled();
    await expect(overview.locator('.atlas-network-stats button:disabled')).toHaveCount(3);
    await page.locator('summary[aria-label="Link type"]').click();
    await types.getByRole('checkbox', { name: 'All link types', exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(overview.getByRole('button', { name: /^Most linked country:/ })).toBeEnabled();
    const violations = (await new AxeBuilder({ page }).include('.atlas-network-overview').analyze()).violations;
    expect(violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    await overview.getByRole('button', { name: /^Top movement destination:/ }).click();
    await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toBeVisible();
    await expect(overview).toHaveCount(0);
    await page.getByRole('tab', { name: 'Trends', exact: true }).click();
    await expect(overview).toBeVisible();
    expect(errors).toEqual([]);
  });
}
