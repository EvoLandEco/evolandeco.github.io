import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';

test('Reporting windows retain globe route styles for unchanged keyed routes', async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.atlas-globe-pins')).toHaveAttribute('data-route-renderer', 'gpu');
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async () => {
    const structure = (group: Element) => [group.getAttribute('data-kind'), !!group.querySelector('.atlas-travel-beam'),
      !!group.querySelector('.atlas-route-beam'), !!group.querySelector('.atlas-route-count text')].join(':');
    const routes = new Map([...document.querySelectorAll('.atlas-globe-pins .atlas-route')].map(group => [group, structure(group)]));
    const reads = new Map<Element, number>();
    const style = window.getComputedStyle;
    window.getComputedStyle = function (element, pseudo) {
      if (routes.has(element)) reads.set(element, (reads.get(element) ?? 0) + 1);
      return style.call(this, element, pseudo);
    };
    try {
      document.querySelector<HTMLButtonElement>('button[aria-label="3 months"]')!.click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    } finally { window.getComputedStyle = style; }
    const retained = [...routes].filter(([group, before]) => group.isConnected && structure(group) === before);
    return { retained: retained.length, removed: [...routes.keys()].filter(group => !group.isConnected).length,
      styleReads: retained.reduce((count, [group]) => count + (reads.get(group) ?? 0), 0) };
  });
  expect(result.retained).toBeGreaterThan(0);
  expect(result.removed).toBeGreaterThan(0);
  expect(result.styleReads).toBe(0);
  await expect(page.locator('.atlas-globe-pins .atlas-link-target').first()).toHaveAttribute('d', /^M/);
});
