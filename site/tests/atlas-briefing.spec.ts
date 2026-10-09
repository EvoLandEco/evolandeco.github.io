import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';

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
  await expect(reports).toHaveCount(width === 390 ? 7 : 9);
  await expect(page.locator('.atlas-latest-body')).toHaveCSS('height', width === 390 ? '672px' : '840px');
  if (width === 1280) await expect(page.locator('.atlas-watch .atlas-briefing-body')).toHaveCSS('height', '840px');
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
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await reports.first().click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(1);
});

test('Fullscreen briefing allocates space and fits complete timeline entries', async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const daily = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  daily.watch_items = Array.from({ length: 6 }, (_, index) => ({ ...daily.watch_items[0], id: `watch_${index}`, key: `event_${index}`, label: `Investigation ${index + 1}` }));
  daily.watch_assessments = structuredClone(daily.watch_items);
  await page.route(/\/daily\//, route => route.fulfill({ json: route.request().url().endsWith('current.json') ? dailyPointer(daily) : daily }));
  await page.setViewportSize({ width: 1466, height: 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(6);
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  const entries = page.locator('.atlas-latest-list > li:not([inert]) .atlas-latest-entry');
  const fit = () => page.locator('.atlas-latest-list').evaluate(element => {
    const rowHeight = parseFloat(getComputedStyle(element).getPropertyValue('--latest-row-height'));
    return Math.max(1, Math.floor((element.clientHeight - rowHeight) / rowHeight));
  });
  for (const height of [1100, 832, 720]) {
    await page.setViewportSize({ width: 1466, height });
    await expect.poll(async () => await entries.count() === await fit()).toBe(true);
    const dimensions = await page.locator('.atlas-briefing-columns').evaluate(element => {
      const watch = element.querySelector('.atlas-watch')!.getBoundingClientRect();
      const latest = element.querySelector('.atlas-latest')!.getBoundingClientRect();
      const list = element.querySelector('.atlas-latest-list')!;
      const watchBody = element.querySelector('.atlas-watch .atlas-briefing-body')!;
      const latestBody = element.querySelector('.atlas-latest-body')!;
      return { watch: watch.height, latest: latest.height, watchRight: watch.right, latestLeft: latest.left, watchTop: watch.top, latestTop: latest.top, overflow: list.scrollHeight - list.clientHeight, watchBottom: watchBody.getBoundingClientRect().bottom, latestBottom: latestBody.getBoundingClientRect().bottom, watchFade: getComputedStyle(watchBody, '::after').height, latestFade: getComputedStyle(latestBody, '::after').height };
    });
    expect(dimensions.latest).toBeCloseTo(dimensions.watch, 0);
    expect(dimensions.watchTop).toBeCloseTo(dimensions.latestTop, 0);
    expect(dimensions.watchRight).toBeLessThan(dimensions.latestLeft);
    expect(dimensions.overflow).toBeLessThanOrEqual(1);
    expect(dimensions.watchBottom).toBeCloseTo(dimensions.latestBottom, 0);
    expect(dimensions.watchFade).toBe(dimensions.latestFade);
    const timeline = await page.locator('.atlas-latest-list').evaluate(element => {
      const rows = [...element.children].map(row => row.getBoundingClientRect());
      const heights = rows.map(row => row.height);
      const nodes = [...element.querySelectorAll('.atlas-source-logo')].map(node => node.getBoundingClientRect().top);
      const gaps = nodes.slice(1).map((top, index) => top - nodes[index]);
      const fade = parseFloat(getComputedStyle(element.closest('.atlas-briefing-columns')!, '::after').height);
      const topGap = element.querySelector('.atlas-latest-date')!.getBoundingClientRect().top - rows[0].top;
      return { spread: Math.max(...heights) - Math.min(...heights), nodeSpread: Math.max(...gaps) - Math.min(...gaps), topGap, previewHeight: heights.at(-1)!, fade };
    });
    expect(timeline.spread).toBeLessThan(1);
    expect(timeline.nodeSpread).toBeLessThan(1);
    expect(timeline.topGap).toBeLessThanOrEqual(10);
    expect(timeline.fade).toBeGreaterThan(timeline.previewHeight);
    expect(timeline.fade).toBeLessThan(2 * timeline.previewHeight);
    await expect(page.locator('.atlas-latest-preview')).toHaveCount(1);
    expect(await page.locator('.atlas-latest-preview').evaluate(el => el.getBoundingClientRect().top - el.previousElementSibling!.getBoundingClientRect().bottom)).toBeCloseTo(0, 0);
    await expect(page.getByRole('button', { name: 'View all reports', exact: true })).toBeVisible();
    if (height === 1100) expect(await entries.count()).toBeGreaterThan(3);
    await expect(entries.first().locator('.atlas-source-logo')).toBeVisible();
  }
  const timelineTop = await page.locator('.atlas-latest-list').evaluate(element => element.scrollTop);
  await expect(page.locator('.atlas-latest-list')).toHaveCSS('overflow-y', 'clip');
  for (const selector of ['.atlas-latest-list', '.atlas-watch-list']) {
    await expect(page.locator(selector)).toHaveCSS('scrollbar-width', 'none');
    await expect(page.locator(selector)).toHaveCSS('scrollbar-gutter', 'auto');
    expect(await page.locator(selector).evaluate(element => element.getBoundingClientRect().width - element.clientWidth)).toBeLessThan(1);
  }
  await expect(page.getByRole('button', { name: 'View all outbreaks', exact: true })).toBeVisible();
  await page.locator('.atlas-watch-reports').last().focus();
  expect(await page.locator('.atlas-watch-list').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.atlas-latest-list').evaluate(element => element.scrollTop)).toBe(timelineTop);
  await page.locator('.atlas-watch-list').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole('button', { name: 'View all outbreaks', exact: true })).toBeVisible();
  expect(await page.locator('.atlas-watch-list').evaluate(element => {
    const fade = parseFloat(getComputedStyle(element).getPropertyValue('--briefing-fade-height'));
    return element.querySelector('.atlas-watch-cards > div:last-child')!.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom - fade;
  })).toBe(true);
  await page.locator('.atlas-watch-list').evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('button', { name: 'View all outbreaks', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1466, height: 1100 });
  await expect.poll(async () => await entries.count()).toBeGreaterThan(3);
  await page.screenshot({ path: '/tmp/atlas-briefing-fit-1100.png' });
  await page.setViewportSize({ width: 1466, height: 832 });
  await expect.poll(async () => await entries.count() === await fit()).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-briefing-fit-832.png' });
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: '/tmp/atlas-briefing-fit-dark.png' });
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(entries).toHaveCount(9);
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await page.locator('.atlas-briefing-columns').screenshot({ path: '/tmp/atlas-briefing-normal.png' });
});
