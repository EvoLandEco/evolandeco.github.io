import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';

test.beforeEach(async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const daily = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  daily.watch_items = Array.from({ length: 12 }, (_, index) => ({ ...daily.watch_items[0], id: `watch_${index}`, key: `event_${index}`, label: `Investigation ${index + 1}` }));
  daily.watch_assessments = structuredClone(daily.watch_items);
  await page.route(/\/daily\//, route => route.fulfill({ json: route.request().url().endsWith('current.json') ? dailyPointer(daily) : daily }));
  await page.setViewportSize({ width: 1466, height: 832 });
});

for (const fullscreen of [false, true]) test(`Outbreak watch expands ${fullscreen ? 'across Trends' : 'across Latest reports'}`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: fullscreen ? 'reduce' : 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(12);
  const date = page.locator('.atlas-daily-watch .atlas-card-date').first();
  await expect(date).toContainText('Report');
  await expect(date.locator('strong')).toHaveCSS('font-weight', '600');
  expect(await date.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}/);
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  const entrance = page.getByRole('button', { name: 'View all outbreaks', exact: true });
  const exit = page.getByRole('button', { name: 'Back to Trends', exact: true });
  const watch = page.locator('.atlas-watch');
  const overview = page.locator('.atlas-trend-overview');
  for (const button of [entrance, page.getByRole('button', { name: 'View all reports', exact: true })]) {
    await expect(button).toHaveCSS('border-top-width', '1px');
    await expect(button).toHaveCSS('border-top-style', 'solid');
  }
  const columns = page.locator('.atlas-briefing-columns');
  expect(await columns.evaluate(element => {
    const fade = getComputedStyle(element, '::after');
    return { content: fade.content, width: Math.round(parseFloat(fade.width)), area: Math.round(element.getBoundingClientRect().width), filter: fade.backdropFilter, pointer: fade.pointerEvents };
  })).toEqual({ content: '\"\"', width: Math.round((await columns.boundingBox())!.width), area: Math.round((await columns.boundingBox())!.width), filter: 'blur(10px)', pointer: 'none' });
  for (const body of await columns.locator('.atlas-briefing-body').all()) {
    expect(await body.evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  }
  await entrance.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('shared-briefing-fade.png') });
  const before = await watch.boundingBox();
  const overviewHeight = (await overview.boundingBox())!.height;
  await entrance.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-watch-transition');
  await expect(exit).toBeFocused();
  await expect(page.locator('.atlas-latest')).toBeHidden();
  expect(await columns.evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  expect((await watch.boundingBox())!.width).toBeGreaterThan(before!.width);
  expect((await watch.boundingBox())!.width).toBeCloseTo((await page.locator('.atlas-trends').boundingBox())!.width, 0);
  if (fullscreen) {
    await expect(overview).toBeHidden();
    expect((await watch.boundingBox())!.height).toBeCloseTo((await page.locator('.atlas-trends').boundingBox())!.height, 0);
    await expect(watch).toHaveCSS('border-top-width', '0px');
    await expect(watch).toHaveCSS('padding-top', '0px');
    const gap = (await watch.locator(':scope > header').boundingBox())!.y - ((await page.locator('.atlas-toolbar').boundingBox())!.y + (await page.locator('.atlas-toolbar').boundingBox())!.height);
    expect(gap).toBeGreaterThanOrEqual(12);
    expect(gap).toBeLessThanOrEqual(20);
  } else {
    await expect(overview).toBeVisible();
    expect((await overview.boundingBox())!.height).toBeCloseTo(overviewHeight, 0);
  }
  const exitBox = (await exit.boundingBox())!;
  expect(exitBox.y).toBeGreaterThanOrEqual(0);
  expect(exitBox.y + exitBox.height).toBeLessThanOrEqual(832);
  await expect(watch.locator('.atlas-briefing-body')).toHaveAttribute('data-fade', 'false');
  expect(await watch.locator('.atlas-briefing-body').evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  const list = page.getByRole('region', { name: 'Outbreak watch cards' });
  await expect(list).toHaveCSS('scrollbar-width', 'none');
  const more = page.getByRole('button', { name: 'More outbreaks below', exact: true });
  await expect(more).toBeVisible();
  await expect(more).toHaveCSS('position', 'absolute');
  await expect(more).toHaveCSS('border-radius', '50%');
  expect((await list.boundingBox())!.height).toBeCloseTo((await watch.locator('.atlas-briefing-body').boundingBox())!.height, 0);
  await more.click();
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(more).toBeHidden();
  expect(await list.evaluate(element => element.querySelector('.atlas-watch-cards > div:last-child')!.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom)).toBe(true);
  await list.evaluate(element => { element.scrollTop = 0; });
  await expect(more).toBeVisible();
  await watch.screenshot({ path: testInfo.outputPath('expanded-watch.png') });
  expect((await new AxeBuilder({ page }).include('.atlas-briefing').analyze()).violations).toEqual([]);
  await list.focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-watch-transition');
  await expect(entrance).toBeFocused();
  await expect(overview).toBeVisible();
  await expect(page.locator('.atlas-latest')).toBeVisible();
  if (fullscreen) await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen');
  await entrance.press('Enter');
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-watch-transition');
  await exit.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-watch-transition');
  await expect(entrance).toBeFocused();
});

for (const direction of ['expand', 'collapse']) test(`The sticky menu stays above the ${direction} animation`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  const entrance = page.getByRole('button', { name: 'View all outbreaks', exact: true });
  await expect(entrance).toBeVisible();
  if (direction === 'collapse') {
    await entrance.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-watch-transition');
  }
  await page.locator('.atlas-trend-overview').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.addStyleTag({ content: `
    html[data-atlas-watch-transition]::view-transition-group(*),
    html[data-atlas-watch-transition]::view-transition-old(*),
    html[data-atlas-watch-transition]::view-transition-new(*) {
      animation-play-state: paused !important;
      animation-delay: -275ms !important;
    }
  ` });
  const trigger = direction === 'expand' ? entrance : page.getByRole('button', { name: 'Back to Trends', exact: true });
  await trigger.evaluate(element => { if (element instanceof HTMLButtonElement) element.click(); });
  await expect(page.locator('.atlas-trends')).toHaveAttribute('data-watch-expanded', String(direction === 'expand'));
  await expect(page.locator('html')).toHaveAttribute('data-atlas-watch-transition', direction);
  const layers = await page.locator('.atlas-toolbar').evaluate(element => {
    const root = document.documentElement;
    const style = getComputedStyle(element);
    return {
      name: style.viewTransitionName,
      fill: style.backgroundColor,
      menu: getComputedStyle(root, '::view-transition-group(atlas-watch-toolbar)').zIndex,
      charts: getComputedStyle(root, '::view-transition-group(atlas-watch-overview)').zIndex,
      animation: getComputedStyle(root, '::view-transition-new(atlas-watch-toolbar)').animationName,
    };
  });
  expect(layers.name).toBe('atlas-watch-toolbar');
  expect(layers.fill).toBe('rgb(255, 255, 255)');
  expect(Number(layers.menu)).toBeGreaterThan(Number(layers.charts) || 0);
  expect(layers.animation).toBe('none');
  await page.screenshot({ path: testInfo.outputPath(`menu-during-${direction}.png`) });
});

test('Narrow layouts keep page scrolling and three-card loading after a resize', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.getByRole('button', { name: 'View all outbreaks', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 832 });
  await expect(page.locator('.atlas-trends')).toHaveAttribute('data-watch-expanded', 'false');
  await expect(page.getByRole('button', { name: 'View all outbreaks', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back to Trends', exact: true })).toHaveCount(0);
  await expect(page.locator('.atlas-latest')).toBeVisible();
  expect(await page.locator('.atlas-briefing-columns').evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  expect(await page.locator('.atlas-latest-body').evaluate(element => getComputedStyle(element, '::after').content)).toBe('""');
  await expect(page.locator('.atlas-daily-watch:visible')).toHaveCount(3);
  await expect(page.locator('.atlas-latest-list > li:not([inert]) .atlas-latest-entry')).toHaveCount(7);
  await expect(page.locator('.atlas-watch-list')).toHaveCSS('overflow-y', 'visible');
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.locator('.atlas-daily-watch:visible')).toHaveCount(6);
  await page.setViewportSize({ width: 1466, height: 832 });
  await expect(page.getByRole('button', { name: 'Back to Trends', exact: true })).toBeVisible();
  await page.locator('.atlas-watch-reports').first().click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View all outbreaks', exact: true })).toBeVisible();
  await expect(page.locator('.atlas-latest')).toBeVisible();
  await expect(page.locator('.atlas-latest-list > li:not([inert]) .atlas-latest-entry')).toHaveCount(9);
});
