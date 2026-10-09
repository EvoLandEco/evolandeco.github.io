import { selectAtlasOption } from './atlas-select-actions';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Evidence cards preserve source details and navigation at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Journeys', exact: true }).click();
  await expect(page.locator('.atlas-connection-workspace')).toHaveCount(0);
  for (const view of ['Spatial links', 'Report relationships']) {
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await selectAtlasOption(page, 'Analysis view', view === 'Spatial links' ? 'spatial' : 'relationships');
    const collection = page.locator('.atlas-connection-workspace');
    const card = collection.locator('.atlas-connection').first();
    await expect(card).toBeVisible();
    const masonry = async () => {
      await expect(card).toHaveCSS('position', 'absolute');
      await expect.poll(() => collection.locator('.atlas-connection-cards').evaluate(element => {
        const columns = new Map<number, DOMRect[]>();
        for (const card of element.querySelectorAll(':scope > article')) {
          const box = card.getBoundingClientRect(), x = Math.round(box.x);
          columns.set(x, [...(columns.get(x) ?? []), box]);
        }
        return [...columns.values()].flatMap(boxes => boxes.slice(1).map((box, index) => box.top - boxes[index].bottom).filter(gap => Math.abs(gap - 12) >= 1));
      })).toEqual([]);
    };
    await masonry();
    const columns = await collection.locator('.atlas-connection').evaluateAll(cards => new Set(cards.map(card => Math.round(card.getBoundingClientRect().x))).size);
    if (width === 390) expect(columns).toBe(1);
    else expect(columns).toBeGreaterThan(1);
    if (view === 'Report relationships') {
      if (!fullscreen) await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await expect.poll(async () => {
        const header = (await page.locator('.atlas-analysis > header').boundingBox())!;
        return (await card.boundingBox())!.y - header.y - header.height;
      }).toBeGreaterThanOrEqual(15);
    }
    const title = await card.locator('h3').textContent();
    const counts = await card.locator('.atlas-card-counts dd').allTextContents();
    expect(counts).toHaveLength(3);
    expect(Number(counts[0])).toBeGreaterThan(0);
    expect(Number(counts[1])).toBeGreaterThan(0);
    await card.getByRole('button', { name: 'View details', exact: true }).click();
    await expect(card).toHaveAttribute('data-expanded', 'true');
    await expect(card.locator('h3')).toHaveText(title!);
    await expect(card.locator('.atlas-card-counts dd')).toHaveText(counts);
    await expect(collection.locator('.atlas-connection:visible')).toHaveCount(1);
    await expect(card.locator('.atlas-evidence blockquote').first()).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Supporting reports' })).toBeVisible();
    await expect(card.getByRole('region', { name: 'Connection details' })).toHaveCSS('scrollbar-width', 'none');
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(card.getByRole('button', { name: 'View details', exact: true })).toBeFocused();
    await expect(card.locator('.atlas-evidence')).toHaveCount(0);
    await masonry();
    await collection.locator('.atlas-connection-scroll').evaluate(element => { element.scrollTop = 0; });
    await collection.screenshot({ path: `/tmp/atlas-masonry-${view.replaceAll(' ', '-')}-${width}-${fullscreen}.png` });
    if (fullscreen) {
      if (view === 'Report relationships') await page.locator('.atlas-workspace').screenshot({ path: '/tmp/atlas-masonry-relationships-controls.png' });
      await page.setViewportSize({ width: 1100, height: 900 });
      await masonry();
      await page.setViewportSize({ width, height: 900 });
      await masonry();
    }
  }
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-connection-workspace')).toHaveCount(0);
  await expect(page.locator('.atlas-report-list > .atlas-report').first()).toBeVisible();
});
