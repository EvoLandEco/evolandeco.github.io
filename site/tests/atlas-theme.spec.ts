import { test, expect } from '@playwright/test';

test('Workspace theme transition keeps the viewport covered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  const canvas = page.getByTestId('atlas-globe').locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const point = await canvas.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const dx of [0, -.15, .15, -.25, .25]) for (const dy of [0, .15, -.15]) {
      const x = b.left + b.width * (.5 + dx), y = b.top + b.height * (.5 + dy);
      if (document.elementFromPoint(x, y) === el) return { x, y };
    }
    throw new Error('No exposed globe surface');
  });
  await page.mouse.move(point.x, point.y);
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (typeof options === 'object' && options.pseudoElement === '::view-transition-new(root)') animation.pause();
      return animation;
    };
  });
  const workspace = page.locator('.atlas-page[data-fullscreen]');
  const theme = page.getByRole('switch', { name: 'Dark mode' });
  const angle = await canvas.getAttribute('data-angle');
  for (const mode of ['dark', 'light']) {
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-magicui-theme-vt', 'active');
    await expect.poll(() => page.evaluate(() => document.getAnimations().some(a => (a.effect as KeyframeEffect)?.pseudoElement === '::view-transition-new(root)' && a.playState === 'paused'))).toBe(true);
    await expect(page.locator('html')).toHaveCSS('view-transition-name', 'none');
    await expect(workspace).toHaveCSS('view-transition-name', 'root');
    const viewport = await page.evaluate(() => ({ x: 0, y: 0, width: document.documentElement.getBoundingClientRect().width, height: window.innerHeight }));
    expect(await workspace.boundingBox()).toMatchObject(viewport);
    await expect(page.getByTestId('primary-navigation')).toHaveAttribute('inert', '');
    await page.screenshot({ path: `/tmp/atlas-theme-${mode}-start.png` });
    await page.evaluate(() => { for (const a of document.getAnimations()) if ((a.effect as KeyframeEffect)?.pseudoElement === '::view-transition-new(root)') a.currentTime = 200; });
    await page.screenshot({ path: `/tmp/atlas-theme-${mode}-middle.png` });
    await page.evaluate(() => { for (const a of document.getAnimations()) if ((a.effect as KeyframeEffect)?.pseudoElement === '::view-transition-new(root)') a.finish(); });
    await expect(page.locator('html')).not.toHaveAttribute('data-magicui-theme-vt');
    await expect(theme).toHaveAttribute('aria-checked', String(mode === 'dark'));
    await expect(workspace).toHaveCSS('view-transition-name', 'none');
    await expect(theme).toBeFocused();
    await expect(canvas).toHaveAttribute('data-angle', angle!);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await theme.click();
  await expect(theme).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-magicui-theme-vt');
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.locator('html')).toHaveCSS('view-transition-name', 'root');
  await expect(page.getByTestId('primary-navigation')).not.toHaveAttribute('inert');
});

for (const route of ['/', '/atlas/']) test(`Dark theme hydrates without rendering mismatches on ${route}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto(route);
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('canvas[data-angle]').first()).toBeVisible();
  expect(errors.filter(message => /hydrat|React error|server rendered/i.test(message))).toEqual([]);
});
