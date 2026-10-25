import { openAtlasView, selectAtlasOption } from './atlas-select-actions';
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
  for (const view of ['Spatial links']) {
    await openAtlasView(page, view === 'Spatial links' ? 'spatial' : 'relationships');
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

for (const [width, fullscreen, reduced] of [[390, false, true], [1440, false, false], [1440, true, false]] as const) test(`Relationship network expands evidence details and returns at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await openAtlasView(page, 'relationships');
  const network = page.locator('svg[aria-label="Relationship evidence network"]');
  await expect(network).toBeVisible();
  await expect(page.getByRole('group', { name: 'Relationship presentation' })).toHaveCount(0);
  await expect(page.locator('.atlas-connection')).toHaveCount(0);
  await selectAtlasOption(page, 'Report relationship', { index: 0 });
  const summary = page.getByRole('complementary', { name: 'Selected relationship', exact: true });
  const title = await summary.locator('h3').textContent();
  const selected = await network.locator('[data-selected="true"]').getAttribute('aria-label');
  const card = page.locator('.atlas-connection[data-expanded="true"]');
  for (let cycle = 0; cycle < 2; cycle++) {
    await summary.getByRole('button', { name: 'View details', exact: true }).click();
    await expect(card).toBeVisible();
    await expect(card.locator('h3')).toHaveText(title!);
    await expect(network).toBeHidden();
    await expect(card.getByRole('button', { name: 'Back to network', exact: true })).toBeFocused();
    await expect(card.getByRole('heading', { name: 'Source evidence', exact: true })).toBeVisible();
    const bounds = (await card.boundingBox())!;
    const container = (await page.locator('.atlas-connection-workspace').boundingBox())!;
    expect(bounds.width).toBeCloseTo(container.width, 0);
    expect(bounds.height).toBeCloseTo(container.height, 0);
    expect(bounds.y).toBeGreaterThanOrEqual((await page.locator('.atlas-analysis > header').boundingBox())!.y);
    await expect(card.getByRole('region', { name: 'Connection details', exact: true })).toHaveCSS('scrollbar-width', 'none');
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-connection-transition');
    if (cycle === 0) await card.getByRole('button', { name: 'Back to network', exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(card).toHaveCount(0);
    await expect(network).toBeVisible();
    await expect(network.locator('[data-selected="true"]')).toHaveAttribute('aria-label', selected!);
    await expect(summary.getByRole('button', { name: 'View details', exact: true })).toBeFocused();
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-connection-transition');
  }
});

for (const reduced of [false, true]) test(`Relationship groups preserve filters and return through expansion, reduced motion ${reduced}`, async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await openAtlasView(page, 'relationships');
  const graph = page.getByRole('img', { name: 'Relationship evidence network' });
  const publisher = page.getByRole('group', { name: 'Filter groups by reporting source' }).getByRole('button').first();
  await publisher.click();
  await expect(publisher).toHaveAttribute('aria-pressed', 'true');
  const count = await graph.getByRole('button').count();
  const group = graph.getByRole('button').first();
  const name = await group.getAttribute('aria-label');
  await group.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Evidence group overview' })).toBeVisible();
  await expect(graph.locator('[data-expanded-group]')).toHaveCount(1);
  await page.getByRole('button', { name: 'All groups', exact: true }).click();
  await expect(graph.locator('[data-expanded-group]')).toHaveCount(0);
  await expect(graph.getByRole('button', { name: name!, exact: true })).toBeVisible();
  await expect(publisher).toHaveAttribute('aria-pressed', 'true');
  await expect(graph.getByRole('button')).toHaveCount(count);
  const reset = page.getByRole('button', { name: 'Clear group filters' });
  const box = await reset.boundingBox();
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
  await reset.click();
  await expect(reset).toBeDisabled();
  await expect(publisher).toHaveAttribute('aria-pressed', 'false');
});
