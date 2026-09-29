import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [width, height, workspace] of [[390, 844, false], [1280, 720, true], [1440, 1000, true]] as const) {
  test(`Country network overview at ${width}×${height}`, async ({ page }) => {
    test.skip(!process.env.ATLAS_HEALTH_PARTIAL, 'Requires the partial dataset');
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
    await expect(overview.getByRole('button', { name: /^Most linked country:/ })).toBeEnabled();
    await expect(overview.getByRole('button', { name: /^Top movement destination:/ })).toBeEnabled();
    await page.locator('.atlas-observatory').screenshot({ path: `/tmp/atlas-network-overview-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const networkBox = (await overview.boundingBox())!;
    const globeBox = (await page.locator('.atlas-globe-frame').boundingBox())!;
    expect(Math.abs(networkBox.x + networkBox.width / 2 - globeBox.x - globeBox.width / 2)).toBeLessThan(1);
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
    await expect(page.getByRole('heading', { name: 'Reporting activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reporting attention' })).toBeVisible();
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
    expect((await overview.boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('.atlas-globe-frame').boundingBox())!.y + (await page.locator('.atlas-globe-frame').boundingBox())!.height);
    const violations = (await new AxeBuilder({ page }).include('.atlas-network-overview').analyze()).violations;
    expect(violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    await overview.getByRole('button', { name: /^Top movement destination:/ }).click();
    await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
