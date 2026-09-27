import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const colorScheme of ['light', 'dark'] as const) test(`Cursor set preserves interaction states in ${colorScheme}`, async ({ page }) => {
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('cursor', /data:image\/svg\+xml.*6 4, default/);
  await expect(page.getByRole('tab', { name: 'Trends', exact: true })).toHaveCSS('cursor', /16 16, pointer/);
  await expect(page.getByRole('button', { name: 'Reset all filters and rules' })).toHaveCSS('cursor', /16 16, not-allowed/);
  await expect(page.locator('.atlas-observation-chart').first()).toHaveCSS('cursor', /16 16, crosshair/);
  const thumb = await page.getByRole('slider', { name: 'Window start', exact: true }).evaluate(el => getComputedStyle(el, '::-webkit-slider-thumb').cursor);
  expect(thumb).toContain('16 16, ew-resize');
  await page.getByRole('button', { name: 'Click to enter full screen', exact: true }).press('Enter');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  const canvas = page.getByTestId('atlas-globe').locator('canvas').first();
  await expect(canvas).toHaveCSS('cursor', /16 16, grab/);
  await canvas.scrollIntoViewIfNeeded();
  const point = await canvas.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const x of [.5, .35, .65]) for (const y of [.5, .35, .65]) {
      const point = { x: b.x + b.width * x, y: b.y + b.height * y };
      if (document.elementFromPoint(point.x, point.y) === el) return point;
    }
    throw new Error('No exposed globe surface');
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(canvas).toHaveCSS('cursor', /16 16, grabbing/);
  await page.mouse.move(point.x + 12, point.y);
  await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('data-dragging');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(page.locator('html')).toHaveCSS('cursor', 'auto');
  await expect(page.getByRole('tab', { name: 'Trends', exact: true })).toHaveCSS('cursor', 'pointer');
  await page.emulateMedia({ forcedColors: 'none' });
  await page.goto('/reading/protocol-transforming-phylogeny-to-gcn.html');
  await expect(page.locator('html')).toHaveCSS('cursor', /data:image\/svg\+xml/);
  await expect(page.locator('input[type="number"]').first()).toHaveCSS('cursor', /16 16, text/);

  const css = readFileSync('public/cursors.css', 'utf8');
  const states = [...css.matchAll(/--cursor-([a-z-]+): url\("([^"]+)"\) (\d+) (\d+), ([a-z-]+);/g)];
  expect(states).toHaveLength(34);
  await page.setContent(`<style>${css}</style><main>${states.map(([, name, url]) => `<button data-cursor="${name}">${name}<img src="${url}" alt="${name}"></button>`).join('')}</main>`);
  for (const [, name, , x, y] of states) {
    const sample = page.locator(`[data-cursor="${name}"]`);
    await expect(sample).toHaveCSS('cursor', new RegExp(`${x} ${y}, ${name}$`));
    expect(await sample.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(32);
    expect(Number(x)).toBeLessThan(32); expect(Number(y)).toBeLessThan(32);
  }
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.setContent(readFileSync('evidence/cursors.html', 'utf8'));
  await page.screenshot({ path: '/tmp/atlas-cursor-set.png', fullPage: true });
});

test('Touch devices retain native cursor behavior', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('cursor', 'auto');
  await expect(page.locator('a[href="/atlas/"]').first()).toHaveCSS('cursor', 'pointer');
  await context.close();
});
