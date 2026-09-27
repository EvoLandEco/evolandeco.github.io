import { test, expect } from '@playwright/test';

for (const view of [
  { width: 390, height: 844, theme: 'light', workspace: false },
  { width: 390, height: 844, theme: 'dark', workspace: false },
  { width: 1280, height: 900, theme: 'light', workspace: false },
  { width: 1180, height: 720, theme: 'dark', workspace: true },
]) test(`Reporting controls retain their size at ${view.width} ${view.theme}`, async ({ page }) => {
  await page.setViewportSize(view);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => localStorage.setItem('theme', theme), view.theme);
  await page.goto('/atlas/');
  const atlas = page.locator('.atlas-page[data-ready="true"]');
  await expect(atlas).toBeVisible();
  if (view.workspace) {
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
    await expect(atlas).toHaveAttribute('data-fullscreen', 'true');
  }
  const controls = page.locator('.atlas-controls');
  await controls.getByRole('button', { name: 'All dates', exact: true }).click();
  const toolbar = page.locator('.atlas-toolbar');
  const toolbarReset = toolbar.getByRole('button', { name: 'Reset all filters and rules' });
  const theme = page.getByRole('switch', { name: 'Dark mode' });
  await expect(theme).toHaveCount(1);
  await expect(theme).toHaveCSS('border-radius', '50%');
  await expect(toolbarReset).toHaveCSS('border-radius', '50%');
  await expect(page.locator('.appearance-widget')).toHaveCount(0);
  await expect(toolbarReset).toBeDisabled();
  const tabsBox = await toolbar.getByRole('tablist').boundingBox();
  const resetBox = await toolbarReset.boundingBox();
  const themeBox = await theme.boundingBox();
  expect(resetBox!.x + resetBox!.width).toBeLessThan(tabsBox!.x);
  expect(themeBox!.x).toBeGreaterThan(tabsBox!.x + tabsBox!.width);
  expect(await toolbar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const size = await controls.boundingBox();
  const stable = async () => {
    const box = await controls.boundingBox();
    expect(box!.height).toBeCloseTo(size!.height, 1);
    expect(box!.width).toBeCloseTo(size!.width, 1);
    expect(await controls.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    if (view.workspace) expect(await page.locator('.atlas-overview-column').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  };
  await controls.getByRole('button', { name: '3 months', exact: true }).click();
  await stable();
  for (const label of ['Reporting topic', 'Reporting source', 'Link type']) {
    const menu = controls.locator('.atlas-select').filter({ has: page.locator(`summary[aria-label="${label}"]`) });
    await menu.locator('summary').click();
    const count = Math.min(15, (await menu.getByRole('checkbox').count()) - 1);
    for (let i = 1; i <= count; i++) await menu.getByRole('checkbox').nth(i).check();
    await menu.getByRole('checkbox').nth(1).press('Escape');
    await stable();
  }
  const rules = controls.locator('.atlas-rules');
  await expect(rules.locator('summary')).toHaveAttribute('aria-label', 'Active rules: 4');
  await rules.locator('summary').click();
  await expect(rules.getByRole('button', { name: 'Remove topic filter' })).toBeVisible();
  await stable();
  const popup = await rules.locator('.atlas-rules-options').boundingBox();
  expect(popup!.x).toBeGreaterThanOrEqual(0);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(view.width);
  if (view.workspace) expect(popup!.y + popup!.height).toBeLessThan((await rules.boundingBox())!.y);
  await page.screenshot({ path: `/tmp/atlas-stable-rules-${view.width}-${view.theme}.png` });
  await rules.getByRole('button', { name: 'Remove topic filter' }).click();
  await stable();
  await page.keyboard.press('Escape');
  await expect(rules.locator('summary')).toBeFocused();
  if (view.workspace) await expect(atlas).toHaveAttribute('data-fullscreen', 'true');
  await expect(toolbarReset).toBeEnabled();
  await toolbar.screenshot({ path: `/tmp/atlas-toolbar-${view.width}-${view.theme}.png` });
  const wasDark = await theme.getAttribute('aria-checked');
  await theme.click();
  await expect(theme).toHaveAttribute('aria-checked', wasDark === 'true' ? 'false' : 'true');
  await theme.click();
  await toolbarReset.click();
  await expect(rules.locator('summary')).toHaveAttribute('aria-label', 'Active rules: 0');
  await stable();
  await page.locator('.atlas-link-target').first().press('Enter');
  await rules.locator('summary').click();
  await expect(rules.getByRole('button', { name: 'Clear selected route' })).toBeVisible();
  await stable();
  await rules.getByRole('button', { name: 'Clear selected route' }).click();
  await expect(rules.locator('summary')).toHaveAttribute('aria-label', 'Active rules: 0');
  await stable();
});
