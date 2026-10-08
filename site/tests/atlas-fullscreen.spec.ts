import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bundle } from './atlas-fixture';

async function openView(page: Page, name: string) {
  const reportView = ['Reports', 'Assessments', 'Source coverage'].includes(name);
  await page.getByRole('tab', { name: reportView ? 'Reports' : name, exact: true }).click();
  if (reportView) await page.getByRole('group', { name: 'Report content' }).getByRole('button', { name, exact: true }).click();
}

async function selectCaseObservations(page: Page) {
  await page.getByRole('combobox', { name: 'Monitored series', exact: true }).selectOption('observations:ncdc-lassa-2026-cumulative-1');
  await expect(page.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();
}

test('ATLAS full-screen workspace preserves interactions and restores the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  const atlas = page.locator('.atlas-page[data-ready="true"]');
  await expect(atlas).toBeVisible();
  const frame = page.getByTestId('atlas-globe');
  const canvas = frame.locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const surface = async () => canvas.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const dx of [0, -.15, .15, -.25, .25]) for (const dy of [0, .15, -.15]) {
      const x = b.left + b.width * (.5 + dx), y = b.top + b.height * (.5 + dy);
      if (document.elementFromPoint(x, y) === el) return { x, y };
    }
    throw new Error('No exposed globe surface');
  });
  let point = await surface();
  await page.mouse.move(point.x, point.y);
  const entrance = page.getByRole('button', { name: 'Click to enter full screen' });
  await expect(entrance).toHaveAttribute('data-visible', 'true');
  await page.mouse.down(); await page.mouse.move(point.x + 60, point.y); await page.mouse.up();
  await expect(atlas).not.toHaveAttribute('data-fullscreen');
  const pin = frame.locator('.atlas-globe-pin[data-occluded="false"]').first();
  await pin.focus();
  await expect(entrance).not.toHaveAttribute('data-visible');
  await pin.press('Enter');
  await expect(atlas).not.toHaveAttribute('data-fullscreen');
  await page.getByRole('button', { name: 'Clear globe selection' }).click();
  point = await surface(); await page.mouse.move(point.x, point.y);
  await expect(entrance).toHaveAttribute('data-visible', 'true');
  const canvasHandle = await canvas.elementHandle();
  await page.mouse.click(point.x, point.y);
  await expect(atlas).toHaveAttribute('data-fullscreen', 'true');
  await expect(page.getByRole('dialog', { name: 'ATLAS full screen' })).toBeVisible();
  const exit = page.getByRole('button', { name: 'Exit full screen' });
  await expect(exit).toBeFocused();
  expect(await canvasHandle!.evaluate(el => el.isConnected)).toBe(true);
  const left = await page.locator('.atlas-overview-column').boundingBox(), right = await page.locator('.atlas-detail-column').boundingBox();
  expect(left!.x + left!.width).toBeLessThan(right!.x);
  await expect(page.getByRole('list', { name: 'Link types' }).getByText('Reported travel', { exact: true })).toBeVisible();
  await expect(page.locator('.atlas-link-legend small')).toHaveCount(0);
  expect(await page.locator('nav[aria-label="Primary"]').evaluate(el => Boolean(el.closest('[inert]')))).toBe(true);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-report').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.screenshot({ path: '/tmp/atlas-fullscreen-light.png' });
  const scroller = page.locator('.atlas-workspace-scroll');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  const tabsTop = (await tabs.boundingBox())!.y;
  await scroller.evaluate(el => { el.scrollTop = 450; });
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
  expect(await scroller.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await tabs.boundingBox())!.y).toBe(tabsTop);
  expect(await page.locator('.atlas-detail-column').evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
  await page.locator('.atlas-report > summary').first().click();
  await scroller.evaluate(el => { el.scrollTop = 250; });
  expect((await tabs.boundingBox())!.y).toBe(tabsTop);
  expect((await page.locator('.atlas-report[open] > summary').first().boundingBox())!.y).toBeGreaterThanOrEqual((await scroller.boundingBox())!.y - 1);
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  for (const name of ['Reports', 'Geographic links', 'Assessments', 'Source coverage']) {
    await openView(page, name);
    if (name === 'Geographic links' || name === 'Source coverage') {
      const first = page.locator(name === 'Geographic links' ? '.atlas-geographic-journeys' : '.atlas-coverage-filters');
      const gap = (await first.boundingBox())!.y - (await scroller.boundingBox())!.y;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(20);
      await page.screenshot({ path: `/tmp/atlas-top-spacing-${name.replaceAll(' ', '-')}.png` });
    }
    const pager = page.locator('.atlas-pagination');
    await expect(pager).toHaveCount(1);
    const position = (await pager.boundingBox())!.y;
    await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await pager.boundingBox())!.y).toBe(position);
    const label = await pager.locator('summary').innerText();
    await pager.getByRole('button', { name: /^Next/ }).click();
    await expect(pager.locator('summary')).not.toHaveText(label!);
    await pager.locator('summary').click();
    const options = await pager.locator('.atlas-select-options').boundingBox();
    expect(options!.y).toBeGreaterThanOrEqual((await page.locator('.atlas-workspace').boundingBox())!.y);
    expect(options!.y + options!.height).toBeLessThan((await pager.locator('summary').boundingBox())!.y);
    await pager.getByRole('option').first().click();
    await expect(pager.locator('summary')).toHaveText(label!);
  }
  await page.mouse.move(0, 0);
  await scroller.evaluate(el => { el.scrollTop = 0; });
  await page.locator('.atlas-coverage-edge').first().focus();
  await expect(page.locator('.atlas-coverage-edge:focus')).toHaveCount(1);
  await expect(page.locator('.atlas-coverage-beam, .atlas-network-caption')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/atlas-source-coverage-pagination.png' });
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const footer = page.locator('.atlas-workspace-footer');
  const footerPosition = (await footer.boundingBox())!.y;
  for (const name of ['Trends', 'Reports', 'Geographic links', 'Assessments', 'Source coverage']) {
    await openView(page, name);
    await expect(footer.getByRole('button', { name: 'About ATLAS' })).toBeVisible();
    await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await footer.boundingBox())!.y).toBe(footerPosition);
  }
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.screenshot({ path: '/tmp/atlas-workspace-fixed-pagination.png' });
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(page.locator('.atlas-pagination')).toHaveCount(0);
  await page.setViewportSize({ width: 1920, height: 1000 });
  for (const [tab, visual, details] of [["Geographic links", ".atlas-chain-map", ".atlas-chain-details"], ["Analysis", ".atlas-observation-visual", ".atlas-observation-details"]]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === 'Analysis') {
      await page.getByRole('button', { name: 'Models', exact: true }).click();
      await selectCaseObservations(page);
    } else {
      await page.locator('.atlas-chain-entry > summary').last().click();
      const evidence = page.getByRole('region', { name: 'Selected chain evidence' });
      await evidence.getByText('Source evidence', { exact: true }).click();
      await expect(evidence.locator('blockquote').first()).toBeVisible();
    }
    const a = await page.locator(visual).boundingBox(), b = await page.locator(details).boundingBox();
    expect(a!.x + a!.width).toBeLessThan(b!.x);
    await page.locator(details).evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect(await page.locator(details).evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(0);
  }
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  await page.locator('.atlas-chain-map .atlas-chain-pin').first().locator('circle').last().click();
  const chainDetails = page.locator('.atlas-chain-details');
  const selectedChain = page.getByRole('region', { name: 'Selected chain evidence' });
  expect((await selectedChain.boundingBox())!.y).toBeGreaterThanOrEqual((await chainDetails.boundingBox())!.y);
  expect((await selectedChain.boundingBox())!.y).toBeLessThan((await chainDetails.boundingBox())!.y + 150);
  await expect(page.locator('.atlas-chain-entry[open] > summary')).toBeVisible();
  await selectedChain.getByText('Source evidence', { exact: true }).click();
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Models', exact: true }).click();
  await selectCaseObservations(page);
  await page.locator('.atlas-observation-connection').first().press('Enter');
  await expect.poll(() => page.locator('.atlas-observation-details').evaluate(el => el.scrollTop)).toBe(0);
  const datasetButton = page.getByRole('button', { name: 'About ATLAS', exact: true });
  await datasetButton.click();
  const datasetDialog = page.getByRole('dialog', { name: 'About ATLAS', exact: true });
  await expect(datasetDialog).toBeVisible();
  await expect(datasetDialog.getByRole('link', { name: 'EvoLandEco/ATLAS on GitHub' })).toHaveAttribute('href', 'https://github.com/EvoLandEco/ATLAS');
  await expect(datasetDialog.locator('.atlas-about-credits')).toContainText('GPT-6 Astra');
  await expect(datasetDialog.locator('.atlas-about-credits')).toContainText('MagicUI');
  await expect(datasetDialog.locator('.atlas-about-credits')).toContainText('Cloudflare R2');
  await expect(datasetDialog.getByRole('link', { name: 'Download dataset', exact: true })).toHaveAttribute('href', /atlas-site\.json$/);
  expect(await scroller.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-dataset-dialog.png' });
  await page.keyboard.press('Escape');
  await expect(datasetDialog).not.toBeVisible();
  await expect(datasetButton).toBeFocused();
  await expect(atlas).toHaveAttribute('data-fullscreen', 'true');
  await page.screenshot({ path: '/tmp/atlas-workspace-compact-wide.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await new AxeBuilder({ page }).analyze()).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(atlas).not.toHaveAttribute('data-fullscreen');
  await expect(entrance).toBeFocused();
  await entrance.press('Enter');
  await expect(atlas).toHaveAttribute('data-fullscreen', 'true');
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(atlas).not.toHaveAttribute('data-fullscreen');
  await expect(entrance).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.setViewportSize({ width: 390, height: 844 });
  await datasetButton.click();
  await expect(datasetDialog).toBeVisible();
  const mobileDialog = await datasetDialog.boundingBox();
  expect(mobileDialog!.width).toBeLessThan(390);
  await expect(datasetDialog.locator('.atlas-about-credits')).toBeVisible();
  expect(await datasetDialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-about-mobile.png' });
  await datasetDialog.getByRole('button', { name: 'Close About ATLAS' }).click();
  await expect(datasetButton).toBeFocused();
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await datasetButton.click();
  await expect(datasetDialog).toBeVisible();
  await page.screenshot({ path: '/tmp/atlas-about-mobile-dark.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations.map(v => v.id)).toEqual([]);
  await datasetDialog.getByRole('button', { name: 'Close About ATLAS' }).click();
  await page.goto('/');
  await expect(page.locator('.atlas-fullscreen-entrance')).toHaveCount(0);
  await expect(page.locator('.appearance-widget')).toBeVisible();
});

test('ATLAS workspace animates at the wide breakpoint and exits with its button', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.goto('/atlas/');
  const entrance = page.getByRole('button', { name: 'Click to enter full screen' });
  await entrance.focus();
  await entrance.press('Enter');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  const globeCanvas = page.getByTestId('atlas-globe').locator('canvas').first();
  for (const node of await page.locator('.network-node').all()) await expect(node).toHaveCSS('animation-play-state', 'paused');
  const stillAngle = await globeCanvas.getAttribute('data-angle');
  await page.waitForTimeout(250);
  await expect(globeCanvas).toHaveAttribute('data-angle', stillAngle!);
  const surface = await globeCanvas.evaluate(el => {
    const b = el.getBoundingClientRect();
    for (const dx of [0, -.15, .15, -.25, .25]) for (const dy of [0, .15, -.15]) {
      const x = b.left + b.width * (.5 + dx), y = b.top + b.height * (.5 + dy);
      if (document.elementFromPoint(x, y) === el) return { x, y };
    }
    throw new Error('No exposed globe surface');
  });
  await page.mouse.move(surface.x, surface.y);
  await page.mouse.down();
  await page.mouse.move(surface.x + 50, surface.y);
  await page.mouse.up();
  await expect(globeCanvas).not.toHaveAttribute('data-angle', stillAngle!);
  await page.mouse.move(0, 0);
  const draggedAngle = await globeCanvas.getAttribute('data-angle');
  await page.waitForTimeout(250);
  await expect(globeCanvas).toHaveAttribute('data-angle', draggedAngle!);
  expect(await page.locator('.atlas-detail-column').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.locator('.atlas-overview-column').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-fullscreen-dark.png' });
  await page.setViewportSize({ width: 1180, height: 720 });
  const trendsBody = page.locator('.atlas-workspace-scroll');
  await expect(page.getByRole('heading', { name: 'Outbreak watch', exact: true })).toBeVisible();
  expect(await trendsBody.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  const globeBox = await page.getByTestId('atlas-globe').boundingBox();
  const statsBox = await page.locator('.atlas-network-overview').boundingBox();
  const legendBox = await page.getByRole('list', { name: 'Link types' }).boundingBox();
  expect(statsBox!.y).toBeGreaterThanOrEqual(globeBox!.y + globeBox!.height);
  expect(legendBox!.y).toBeGreaterThanOrEqual(statsBox!.y + statsBox!.height);
  expect(legendBox!.height).toBeLessThan(24);
  expect(await page.locator('.atlas-tabs button').evaluateAll(elements => new Set(elements.map(el => el.getBoundingClientRect().top)).size)).toBe(1);
  await expect(page.locator('.atlas-heading .atlas-eyebrow')).toBeHidden();
  await expect(page.locator('.atlas-heading > p')).toBeHidden();
  expect(globeBox!.width).toBeGreaterThan(250);
  await page.screenshot({ path: '/tmp/atlas-workspace-short.png' });
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Models', exact: true }).click();
  await selectCaseObservations(page);
  await expect(page.locator('.atlas-chain-section')).toBeHidden();
  await expect(page.locator('.atlas-trend-observations')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Models', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.atlas-observation-connection').first().press('Enter');
  await expect(page.getByLabel('Selected observation evidence')).toBeVisible();
  expect(await trendsBody.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  const chartBox = await page.locator('.atlas-observation-chart').boundingBox();
  const axes = await page.locator('.atlas-observation-axis').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
  expect(Math.max(...axes) - Math.min(...axes)).toBeGreaterThan(chartBox!.height * .65);
  await page.screenshot({ path: '/tmp/atlas-workspace-short-observations.png' });
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await expect(page.getByLabel('Selected observation evidence')).toBeVisible();
  await page.setViewportSize({ width: 1180, height: 900 });
  await expect(page.locator('.atlas-chain-section')).toHaveCount(0);
  await expect(page.locator('.atlas-trend-observations')).toBeVisible();
  await page.setViewportSize({ width: 1180, height: 720 });
  await page.getByRole('button', { name: '3 months', exact: true }).click();
  const overview = page.locator('.atlas-overview-column');
  for (const label of ['Reporting place', 'Reporting disease', 'Reporting source', 'Link type']) {
    const menu = overview.locator('.atlas-select').filter({ has: page.locator(`summary[aria-label="${label}"]`) });
    await menu.locator('summary').click();
    const popup = await menu.locator('.atlas-select-options').boundingBox();
    const trigger = await menu.locator('summary').boundingBox();
    expect(popup!.y).toBeGreaterThanOrEqual(0);
    expect(popup!.y + popup!.height).toBeLessThan(trigger!.y);
    await menu.getByRole('checkbox').nth(1).check();
    await menu.getByRole('checkbox').nth(1).press('Escape');
    await expect.poll(() => overview.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    const controls = await overview.locator('.atlas-controls').boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(720);
    const stats = await overview.locator('.atlas-network-overview').boundingBox();
    const legend = await overview.locator('.atlas-link-legend').boundingBox();
    const heading = await overview.locator('.atlas-heading').boundingBox();
    expect(stats!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
    expect(legend!.y + legend!.height).toBeLessThanOrEqual(controls!.y);
  }
  await overview.locator('summary[aria-label="Reporting source"]').click();
  await page.screenshot({ path: '/tmp/atlas-workspace-upward-filters.png' });
  await overview.getByRole('searchbox').press('Escape');
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.locator('.atlas-page')).not.toHaveAttribute('data-fullscreen');
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await expect(entrance).toBeFocused();
});


for (const theme of ['light', 'dark'] as const) test(`Workspace scope overlays preserve details and focus in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  await page.goto('/atlas/');
  const entrance = page.getByRole('button', { name: 'Click to enter full screen' });
  await entrance.focus(); await entrance.press('Enter');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const sourceDocument = bundle.documents.find(doc => doc.title === 'Ebola disease caused by Bundibugyo virus - Democratic Republic of the Congo' && doc.publication.startsWith('2026-09-25'))!;
  const report = page.locator(`#atlas-report-${sourceDocument.id}`);
  while (!await report.count()) {
    const pager = page.locator('.atlas-pagination');
    const label = await pager.locator('summary').innerText();
    await expect(pager.getByRole('button', { name: /^Next/ })).toBeEnabled();
    await pager.getByRole('button', { name: /^Next/ }).click();
    await expect(pager.locator('summary')).not.toHaveText(label);
  }
  await report.locator(':scope > summary').click();
  const trigger = page.locator('.atlas-report[open] .atlas-scope-trigger').first();
  await expect(page.locator('.atlas-report-summary .atlas-location-badge')).toHaveCount(0);
  await expect(page.locator('.atlas-report[open] .atlas-claim > p .atlas-country-inline img').first()).toBeAttached();
  await expect(page.locator('.atlas-report[open] .atlas-country-inline').first()).toHaveCSS('border-width', '0px');
  const firstClaim = page.locator('.atlas-report[open] .atlas-claim > p').first();
  await expect(firstClaim.locator('.atlas-report-inline-date')).toHaveText('23 September 2026');
  await expect(firstClaim.locator('.atlas-report-inline-number')).toHaveText(['7890', '3799', '48.1%']);
  await expect(firstClaim).toContainText('7890 confirmed Bundibugyo virus disease cases');

  await expect(trigger).toHaveText('?');
  const helpStyle = (button: typeof trigger) => button.evaluate(el => {
    const style = getComputedStyle(el);
    return ['width', 'height', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'border', 'borderRadius'].map(property => style.getPropertyValue(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)));
  });
  const sharedHelpStyle = await helpStyle(trigger);
  await expect(trigger).toHaveCSS('width', '28px');
  await expect(trigger).toHaveCSS('height', '28px');
  const tiles = page.locator('.atlas-report[open] .atlas-metrics').first();
  await tiles.scrollIntoViewIfNeeded();
  await expect(trigger).toHaveCSS('position', 'absolute');
  for (const tile of await tiles.locator('.atlas-measure').all()) {
    const box = (await tile.boundingBox())!, help = (await tile.locator('.atlas-scope-trigger').boundingBox())!;
    expect(help.y - box.y).toBeCloseTo(10, 0);
    expect(box.x + box.width - help.x - help.width).toBeCloseTo(10, 0);
    const value = (await tile.locator(':scope > strong').boundingBox())!;
    expect(value.y).toBeGreaterThanOrEqual(box.y);
  }
  await tiles.screenshot({ path: `/tmp/atlas-metric-corners-${theme}.png` });
  await page.screenshot({ path: `/tmp/atlas-metric-tiles-${theme}.png` });
  await page.locator('.atlas-report[open] .atlas-claim').first().screenshot({ path: `/tmp/atlas-report-emphasis-${theme}.png` });

  await expect(page.locator('.atlas-report[open] summary').filter({ hasText: /^Scope & source$/ })).toHaveCount(0);
  await trigger.click();
  const overlay = page.locator('dialog[open].atlas-scope-dialog');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('heading')).toHaveText('Confirmed cases');
  await expect(overlay.locator('.atlas-scope-value strong')).toHaveText('7,890');
  await expect(overlay.getByRole('button', { name: 'Close scope and source' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await overlay.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: `/tmp/atlas-scope-overlay-${theme}.png` });
  expect((await new AxeBuilder({ page }).analyze()).violations.map(v => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  await expect(trigger).toBeFocused();
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  await page.mouse.move(0, 0);
  const journeyHelp = page.getByRole('button', { name: 'Scope & review', exact: true });
  expect(await helpStyle(journeyHelp)).toEqual(sharedHelpStyle);
  await journeyHelp.focus();
  await journeyHelp.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(journeyHelp).toBeFocused();
  await expect(journeyHelp).toHaveCSS('outline-offset', '-2px');
  await journeyHelp.press('Enter');
  await expect(overlay).toContainText('Scope & review');
  await page.keyboard.press('Escape');
  await expect(journeyHelp).toBeFocused();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Models', exact: true }).click();
  await selectCaseObservations(page);
  await expect(page.getByRole('button', { name: 'Series scope', exact: true })).toHaveCount(0);
  await expect(page.locator('.atlas-observation-details > .atlas-chart-note')).toHaveCount(0);
  const values = page.getByRole('group', { name: 'Values & sources', exact: true });
  await expect(values).toBeVisible();
  const columns = await values.locator('.atlas-observation-row').evaluateAll(rows => rows.map(row => ['time', 'strong', '.atlas-observation-authority'].map(selector => row.querySelector(selector)!.getBoundingClientRect().right)));
  for (const row of columns.slice(1)) row.forEach((right, index) => expect(Math.abs(right - columns[0][index])).toBeLessThan(1));
  await page.locator('.atlas-trend-observations').screenshot({ path: `/tmp/atlas-observation-list-${theme}.png` });

  const observationHelp = page.locator('.atlas-observation-item').filter({ hasText: '14 Jun 2026' }).locator('.atlas-scope-trigger');
  await observationHelp.scrollIntoViewIfNeeded();
  expect(await helpStyle(observationHelp)).toEqual(sharedHelpStyle);
  await page.locator('.atlas-analysis-observations').screenshot({ path: `/tmp/atlas-help-buttons-${theme}.png` });
  await observationHelp.click();
  await expect(overlay).toContainText('Source date mismatch');
  await expect(overlay.locator('.atlas-status svg')).toHaveCSS('width', '13px');
  await overlay.getByRole('button', { name: 'Close scope and source' }).click();
  await page.locator('.atlas-observation-values .atlas-scope-trigger').first().click();
  await expect(overlay.locator('blockquote').first()).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(overlay).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.locator('.atlas-observation-item .atlas-scope-trigger').first()).toBeVisible();
  await expect(page.locator('.atlas-measure-details > summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Scope & source for/ }).first()).toHaveText('?');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(report).toHaveAttribute('open', '');
  const phoneClaim = page.locator('.atlas-report[open] .atlas-claim > p').first();
  await expect(phoneClaim.locator('.atlas-report-inline-date')).toBeVisible();
  expect(await phoneClaim.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await phoneClaim.screenshot({ path: `/tmp/atlas-report-emphasis-phone-${theme}.png` });

});

test('Source coverage has compact fixed rows during hover and focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  const entrance = page.getByRole('button', { name: 'Click to enter full screen' });
  await entrance.focus(); await entrance.press('Enter');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('group', { name: 'Report content' }).getByRole('button', { name: 'Source coverage', exact: true }).click();
  const graph = page.locator('.atlas-source-network');
  const positions = () => graph.locator('.atlas-coverage-node').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  const original = await positions();
  for (const target of [graph.locator('.atlas-coverage-source').first(), graph.locator('.atlas-coverage-topic').first(), graph.locator('.atlas-coverage-edge').first()]) {
    await target.hover();
    expect(await positions()).toEqual(original);
    await target.focus();
    expect(await positions()).toEqual(original);
  }
  await expect(graph.locator('[data-active]')).toHaveCount(0);
  const rows = await graph.locator('.atlas-coverage-source').evaluateAll(nodes => nodes.map(node => (node as SVGGElement).transform.baseVal.consolidate()!.matrix.f));
  expect(rows.slice(1).every((y, i) => y - rows[i] === 46)).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-coverage-static.png' });
});
