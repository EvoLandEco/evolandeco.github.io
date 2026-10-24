import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';

for (const mode of ['Map', 'Network']) {
  test(`${mode} preserves stationary geometry through graphics context recovery`, async ({ page }) => {
    await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/atlas/');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    await page.getByRole('radio', { name: `${mode} view`, exact: true }).click();
    const layer = page.locator('.atlas-globe-pins');
    const surface = page.getByTestId('atlas-globe').locator('canvas').first();
    await expect(surface).toHaveAttribute(mode === 'Map' ? 'data-map-mix' : 'data-network-mix', '1.0000');
    await expect(layer).toHaveAttribute('data-renderer', 'gpu');
    await expect(layer).toHaveAttribute('data-route-renderer', 'gpu');
    const geometry = () => layer.evaluate(root => ({
      nodes: [...root.querySelectorAll('.atlas-globe-pin')].map(node => node.getAttribute('transform')),
      routes: [...root.querySelectorAll('.atlas-link-target')].map(route => route.getAttribute('d')),
    }));
    const before = await geometry();
    expect(before.nodes.every(pose => pose?.startsWith('translate('))).toBe(true);
    expect(before.routes.some(path => path?.startsWith('M'))).toBe(true);

    for (const renderer of ['marker', 'route']) {
      const attribute = renderer === 'marker' ? 'data-renderer' : 'data-route-renderer';
      await layer.locator(`.atlas-${renderer}-canvas`).evaluate(element => {
        const extension = (element as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
        Object.assign(window, { stationaryContext: extension });
        extension.loseContext();
      });
      await expect(layer).toHaveAttribute(attribute, 'svg');
      if (renderer === 'marker') {
        await expect(layer.locator('.atlas-event-marker').first()).toHaveCSS('display', 'inline');
        await expect.poll(() => layer.locator('.atlas-event-marker').evaluateAll(markers => markers.every(marker =>
          /^rotate\([^)]*\) scale\([^)]*\)$/.test(marker.getAttribute('transform') ?? '')))).toBe(true);
        await expect(layer.locator('.atlas-rim-arrow').first()).toHaveCSS('display', 'none');
      } else {
        await expect(layer.locator('.atlas-route-line').first()).toBeVisible();
        await expect.poll(() => layer.locator('.atlas-route-line').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(before.routes);
        await expect.poll(() => layer.locator('.atlas-route-count').evaluateAll(badges => badges.every(badge =>
          /^translate\([^)]*\)$/.test(badge.getAttribute('transform') ?? '') && getComputedStyle(badge).visibility === 'visible'))).toBe(true);
      }
      expect(await geometry()).toEqual(before);
      await page.evaluate(() => (window as unknown as { stationaryContext: WEBGL_lose_context }).stationaryContext.restoreContext());
      await expect(layer).toHaveAttribute(attribute, 'gpu');
      expect(await geometry()).toEqual(before);
    }
    await layer.locator('.atlas-link-target').first().focus();
    await expect(page.locator('.atlas-callout-card')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
