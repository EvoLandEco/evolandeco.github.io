import { test, expect, type Page } from '@playwright/test';
import { openAtlasView, selectAtlasOption } from './atlas-select-actions';

async function expectContentScrollsThrough(page: Page) {
  const blocked = await page.locator('#atlas-panel').evaluate(panel => [...panel.querySelectorAll<HTMLElement>('*')].filter(element => {
    if (!element.checkVisibility() || element.closest('dialog, .atlas-select-options, .atlas-entry-filter-menu, [inert]')) return false;
    const style = getComputedStyle(element);
    return ['auto', 'scroll'].includes(style.overflowY) && style.overscrollBehaviorY !== 'auto';
  }).map(element => element.className));
  expect(blocked).toEqual([]);
}

for (const width of [390, 768]) test(`ATLAS content passes scrolling to the page at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.atlas-watch-list')).toBeVisible();
  await expectContentScrollsThrough(page);

  for (const view of ['signals', 'risk', 'relationships', 'spatial']) {
    await openAtlasView(page, view);
    await expect(page.locator(`.atlas-analysis[data-view="${view}"]`)).toBeVisible();
    await expectContentScrollsThrough(page);
  }
  await selectAtlasOption(page, 'Journey view', 'sequences');
  await expect(page.locator('.atlas-chain-outline')).toBeVisible();
  await expectContentScrollsThrough(page);
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  for (const view of ['network', 'evidence', 'timeline', 'sampling', 'overview']) {
    await selectAtlasOption(page, 'One Health view', view);
    await expect(page.locator('.atlas-one-health')).toBeVisible();
    await expectContentScrollsThrough(page);
  }
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-report-list')).toBeVisible();
  await expectContentScrollsThrough(page);

  await openAtlasView(page, 'relationships');
  const region = page.getByRole('region', { name: 'Network overview content', exact: true });
  await expect(region).toBeVisible();
  const network = page.locator('.atlas-analysis [data-playing]');
  for (const direction of [1, -1]) {
    await network.evaluate((root, direction) => {
      for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        if (['auto', 'scroll'].includes(getComputedStyle(element).overflowY)) element.scrollTop = direction > 0 ? element.scrollHeight : 0;
      }
    }, direction);
    const target = direction > 0 ? region : network;
    await target.scrollIntoViewIfNeeded();
    const bounds = await target.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, Math.min(bounds!.y + bounds!.height / 2, 750));
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, direction * 300);
    await expect.poll(async () => (await page.evaluate(() => scrollY) - before) * direction).toBeGreaterThan(0);
  }
});
