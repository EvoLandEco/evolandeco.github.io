import { openAtlasView } from './atlas-select-actions';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';

test('filtered bubbles stay bounded and expanded vectors stay centred at native resolution', async ({ page, browserName }, testInfo) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: browserName === 'webkit' ? 390 : 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (browserName === 'chromium') await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await openAtlasView(page, 'relationships');
  const graph = page.getByRole('img', { name: 'Relationship evidence network' });
  const groups = graph.getByRole('button', { name: /^Explore evidence group/ });
  const largest = () => groups.evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().width)));
  const cap = await largest();
  await page.getByRole('group', { name: 'Filter groups by reporting source' }).getByRole('button').last().click();
  expect(await largest()).toBeLessThanOrEqual(cap + 1);
  await page.getByRole('button', { name: 'Clear group filters' }).click();
  for (const index of [0, (await groups.count()) - 1]) {
    await groups.nth(index).press('Enter');
    const camera = graph.locator('[data-settled]');
    const expanded = graph.locator('[data-expanded-group]');
    const area = (await graph.boundingBox())!;
    for (const fraction of [.25, .7, .4]) {
      await page.mouse.move(area.x + area.width * fraction, area.y + area.height / 2);
      const moving = await graph.evaluate(element => element.getAttribute('data-transitioning') === 'true'
        ? { pointer: getComputedStyle(element.querySelector('[data-expanded-group]')!).pointerEvents,
          active: element.querySelectorAll('[data-active="true"]').length } : null);
      if (moving) expect(moving).toEqual({ pointer: 'none', active: 0 });
    }
    await expect(camera).toHaveAttribute('data-settled', 'true');
    await expect(graph).toHaveAttribute('data-transitioning', 'false');
    await expect(async () => {
      const measured = await graph.evaluate(element => {
        const stage = element.getBoundingClientRect();
        const detailElement = element.querySelector<SVGGraphicsElement>('[data-network-detail]')!;
        const detail = detailElement.getBBox(), screen = detailElement.getScreenCTM()!;
        const center = new DOMPoint(detail.x + detail.width / 2, detail.y + detail.height / 2).matrixTransform(screen);
        const painted = detailElement.getBoundingClientRect();
        const camera = element.querySelector('[data-settled]')!;
        const matrix = new DOMMatrix(getComputedStyle(camera).transform);
        return { dx: Math.abs(center.x - stage.x - stage.width / 2),
          dy: Math.abs(center.y - stage.y - stage.height / 2),
          fits: painted.width < stage.width && painted.height < stage.height, scale: matrix.a,
          willChange: getComputedStyle(camera).willChange };
      });
      expect(measured.dx).toBeLessThan(.5);
      expect(measured.dy).toBeLessThan(.5);
      expect(measured.fits).toBe(true);
      expect(measured.scale).toBeLessThanOrEqual(1);
      expect(measured.willChange).toBe('auto');
    }).toPass({ timeout: 5000 });
    if (browserName === 'webkit') await graph.screenshot({ path: testInfo.outputPath(`network-${index}.png`) });
    await page.getByRole('button', { name: 'All groups', exact: true }).click();
    const box = (await graph.boundingBox())!;
    for (const fraction of [.3, .6, .4, .7]) {
      await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
      if (await graph.getAttribute('data-transitioning') === 'true') {
        await expect(graph.locator('[inert]')).toHaveCount(1);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
      }
    }
    await expect(expanded).toHaveCount(0);
    await expect(graph).toHaveAttribute('data-transitioning', 'false');
    await expect(groups.nth(index)).toBeVisible();
  }
});
