import { test, expect, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { intelligenceSchema } from '../src/lib/atlas-intelligence';
import { atlasSelect, selectAtlasOption } from './atlas-select-actions';

for (const width of [390, 1440]) test(`One Health content keeps its controls aligned across views at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const panel = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const controls = panel.locator('.atlas-oh-tools');
  const geometry = () => controls.evaluate(element => {
    const parent = element.getBoundingClientRect();
    return [...element.querySelectorAll('.atlas-oh-view-select > .atlas-select > summary, .atlas-entry-filters > summary')].map(control => {
      const rect = control.getBoundingClientRect();
      return [rect.x - parent.x, rect.y - parent.y, rect.width, rect.height].map(Math.round);
    });
  });
  const initial = await geometry();
  for (const mode of ['Network', 'Evidence', 'Overview', 'Timeline', 'Sampling']) {
    await panel.locator('summary[aria-label="One Health view"]').click();
    await panel.getByRole('option', { name: mode, exact: true }).click();
    if (mode !== 'Overview') {
      const menu = atlasSelect(panel, 'One Health report');
      await menu.locator(':scope > summary').click();
      await menu.getByRole('option').filter({ has: page.locator(`[data-kind="${mode.toLowerCase()}"]:not([data-empty])`) }).first().click();
      await expect(panel.getByRole('complementary').locator('h3')).toBeVisible();
      await expect(panel.locator('.atlas-oh-detail-top button')).toBeVisible();
    } else {
      await expect(panel.getByRole('table')).toBeVisible();
      await panel.getByRole('button', { name: 'Report entry & review', exact: true }).click();
      await expect(panel.locator('th[aria-sort="ascending"]')).toContainText('Report entry');
    }
    expect(await geometry()).toEqual(initial);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.atlas-one-health').analyze()).violations).toEqual([]);
    await panel.screenshot({ path: testInfo.outputPath(`${mode.toLowerCase()}.png`) });
  }
});

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.ATLAS_BROWSER_CANDIDATE || !process.env.ATLAS_RELEASE_FILE || !process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the matching browser transport, release and analysis fixtures');
  const receipt = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE!, 'utf8'));
  await page.route('**/current.json', route => route.fulfill({ json: receipt.release ?? receipt }));
  await page.route('**/daily/*/current.json', route => route.fulfill({ status: 404 }));
  await page.route('**/releases/*/browser/*/**', route => {
    const asset = new URL(route.request().url()).pathname.split('/browser/')[1].split('/').slice(1).join('/');
    return route.fulfill({ contentType: 'application/json', body: readFileSync(join(process.env.ATLAS_BROWSER_CANDIDATE!, asset)) });
  });
  await page.route('**/intelligence/*/intelligence.json', route => route.fulfill({ contentType: 'application/json', body: readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!) }));
});

for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark'] as const) test(`One Health Evidence animates beneath stable controls at ${width}px in ${colorScheme}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const panel = page.locator('.atlas-one-health');
  await expect(panel.locator('.atlas-oh-network')).toBeVisible();
  await expect.poll(() => page.locator('#atlas-panel').evaluate(node => node.getAnimations().length)).toBe(0);
  for (const mode of ['evidence', 'network', 'evidence']) {
    await panel.locator('summary[aria-label="One Health view"]').click();
    const geometry = await panel.locator('.atlas-oh-tools').boundingBox();
    const transition = await page.evaluate(async mode => {
      (document.querySelector(`[role="option"][value="${mode}"]`) as HTMLElement).click();
      await new Promise(requestAnimationFrame);
      const content = document.querySelector('.atlas-oh-content')!;
      const animation = content.getAnimations().find(animation => animation.id === 'atlas-content-change');
      if (!animation) return null;
      animation.pause();
      animation.currentTime = 80;
      return { opacity: getComputedStyle(content).opacity, frames: (animation.effect as KeyframeEffect).getKeyframes() };
    }, mode);
    expect(transition).not.toBeNull();
    expect(Number(transition!.opacity)).toBeGreaterThan(0);
    expect(Number(transition!.opacity)).toBeLessThan(1);
    expect(transition!.frames.at(-1)!.opacity).toBe('1');
    for (const selector of ['.atlas-one-health', '#atlas-panel', '.atlas-page']) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
      await expect(page.locator(selector)).toHaveCSS('transform', 'none');
    }
    const during = (await panel.locator('.atlas-oh-tools').boundingBox())!;
    expect(during.x).toBeCloseTo(geometry!.x, 0);
    expect(during.y).toBeCloseTo(geometry!.y, 0);
    expect(during.width).toBeCloseTo(geometry!.width, 0);
    await expect(panel.locator('summary[aria-label="One Health view"]')).toBeFocused();
    await expect(panel.locator(`.atlas-oh-layout[data-view="${mode}"]`)).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${mode}-transition.png`), scale: 'css' });
    await panel.locator('.atlas-oh-content').evaluate(async node => {
      const animations = node.getAnimations();
      animations.forEach(animation => animation.play());
      await Promise.all(animations.map(animation => animation.finished));
    });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await selectAtlasOption(page, 'One Health view', 'network');
  await selectAtlasOption(page, 'One Health view', 'evidence');
  expect(await panel.locator('.atlas-oh-content').evaluate(node => node.getAnimations().length)).toBe(0);
  await expect(panel.locator('.atlas-oh-matrix')).toBeVisible();
});

async function summaryStyle(summary: Locator) {
  await summary.page().mouse.move(0, 0);
  return summary.evaluate(element => {
    const style = getComputedStyle(element);
    return [style.minHeight, style.borderTopWidth, style.borderRadius, style.padding, style.backgroundColor];
  });
}

async function searchAndSelect(page: Page, menu: Locator, label: string, value: string) {
  const summary = menu.locator(':scope > summary');
  if (!await page.locator('.atlas-page[data-fullscreen]').count()) await summary.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect(menu.getByRole('option')).toHaveCount(0);
  await summary.press('Enter');
  const search = menu.getByRole('searchbox');
  await expect(search).toBeFocused();
  const popup = await menu.locator('.atlas-select-options').boundingBox();
  const viewport = page.viewportSize()!;
  expect(popup!.x).toBeGreaterThanOrEqual(0);
  expect(popup!.x + popup!.width).toBeLessThanOrEqual(viewport.width);
  expect(popup!.y).toBeGreaterThanOrEqual(0);
  expect(popup!.y + popup!.height).toBeLessThanOrEqual(viewport.height);
  await search.fill('no matching entry 982731');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(menu.getByRole('status')).toHaveText('No matches');
  await search.fill(label);
  const option = menu.getByRole('option').and(menu.locator(`button[value=${JSON.stringify(value)}]`));
  await expect(option).toBeVisible();
  await search.press('ArrowDown');
  await expect(option).toBeFocused();
  await option.press('Enter');
  await expect(summary).toBeFocused();
  await expect(summary.locator(':scope > span')).toHaveAttribute('title', label);
  await expect(menu.getByRole('option')).toHaveCount(0);
  await summary.press('Enter');
  await expect(search).toHaveValue('');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await search.press('Escape');
  await expect(summary).toBeFocused();
}

for (const width of [390, 1440]) test(`Entry selectors share search, keyboard and menu layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'light' : 'dark' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');

  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const reference = page.locator('summary[aria-label="One Health report"]');
  await expect(reference).toBeVisible();
  const referenceStyle = await summaryStyle(reference);
  await page.getByRole('tab', { name: 'Journeys', exact: true }).click();
  const journeys = atlasSelect(page, 'Reviewed chain');
  expect(await summaryStyle(journeys.locator(':scope > summary'))).toEqual(referenceStyle);
  await journeys.locator(':scope > summary').click();
  const journeyOption = journeys.getByRole('option').nth(1);
  const journey = { label: (await journeyOption.getAttribute('aria-label'))!, value: (await journeyOption.getAttribute('value'))! };
  await expect(journeyOption.locator('.atlas-select-badge[data-kind="kind"]')).toBeVisible();
  await journeys.getByRole('searchbox').press('Escape');
  await searchAndSelect(page, journeys, journey.label, journey.value);
  await expect(page.locator('.atlas-chain-figure')).toHaveAttribute('aria-label', journey.label);

  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'signals');
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  const seriesMenu = atlasSelect(analysis, 'Monitored series');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const profiles = atlasSelect(analysis, 'Evidence profile');
  expect(await summaryStyle(profiles.locator(':scope > summary'))).toEqual(referenceStyle);
  await expect(profiles.locator('summary .atlas-select-count')).toHaveText(String(data.risk_profiles.length));
  const profile = data.risk_profiles[1];
  await searchAndSelect(page, profiles, profile.label, profile.id);
  await profiles.locator(':scope > summary').click();
  await expect(profiles.getByRole('option', { name: profile.label, exact: true }).locator('.atlas-select-badge[data-kind="kind"]')).toHaveText(profile.authority);
  await profiles.getByRole('searchbox').press('Escape');
  const series = data.forecast_series[1];
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  expect(await summaryStyle(seriesMenu.locator(':scope > summary'))).toEqual(referenceStyle);
  await searchAndSelect(page, seriesMenu, series.label, series.id);
  await expect(analysis.getByRole('region', { name: 'Count checks', exact: true })).toBeVisible();
  await seriesMenu.locator(':scope > summary').click();
  await expect(seriesMenu.getByRole('option').filter({ hasText: 'Model evaluation' }).first()).toBeVisible();
  await expect(seriesMenu.locator('summary .atlas-select-count')).toHaveText(String(await seriesMenu.getByRole('option').count()));
  const observation = seriesMenu.getByRole('option').and(seriesMenu.locator('button[value^="observations:"]')).first();
  await expect(observation).toContainText('Reported observations');
  const observationId = (await observation.getAttribute('value'))!;
  await observation.click();
  await expect(analysis.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();

  await searchAndSelect(page, seriesMenu, series.label, series.id);
  await expect(analysis.getByRole('region', { name: 'Count checks', exact: true })).toBeVisible();
  await expect(analysis.getByRole('combobox', { name: 'Signal type', exact: true })).toHaveCount(0);
  await seriesMenu.locator(':scope > summary').click();
  expect(await seriesMenu.getByRole('option').count()).toBeGreaterThan(data.forecast_series.length);
  await expect(seriesMenu.locator('button[value^="observations:"]').first()).toBeVisible();
  await seriesMenu.getByRole('searchbox').press('Escape');
  await selectAtlasOption(analysis, 'Monitored series', observationId);
  await expect(analysis.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 1440]) test(`Entry filters narrow lists and keep a fixed trigger at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));

  async function filterMenu(region: Locator, label: string) {
    const filters = region.locator('.atlas-entry-filters');
    const trigger = filters.locator(':scope > summary');
    await expect(trigger).toHaveAttribute('aria-label', label);
    if (width < 1440) await trigger.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().bottom - innerHeight + 80));
    await trigger.press('Enter');
    await expect(filters.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
    if (width < 1440) {
      const popup = (await filters.locator('.atlas-entry-filter-menu').boundingBox())!;
      const button = (await trigger.boundingBox())!;
      expect(popup.y).toBeGreaterThanOrEqual(button.y + button.height);
    }
    expect(await trigger.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))).toEqual({ width: 36, height: 36 });
    return filters;
  }
  async function activeMenu(filters: Locator, count: number) {
    const trigger = filters.locator(':scope > summary');
    await expect(trigger.locator('b')).toHaveText(String(count));
    await expect(filters.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
    expect(await trigger.evaluate(element => element.getBoundingClientRect().width)).toBe(36);
    const popup = await filters.locator('.atlas-entry-filter-menu').boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(0);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(width);
    if (width === 1440) {
      expect(popup!.y).toBeGreaterThanOrEqual(0);
      expect(popup!.y + popup!.height).toBeLessThanOrEqual(900);
    }
    else {
      const button = (await trigger.boundingBox())!;
      expect(popup!.y).toBeGreaterThanOrEqual(button.y + button.height);
    }
    expect((await filters.getByRole('button', { name: 'Clear', exact: true }).boundingBox())!.width).toBeLessThan(popup!.width / 2);
  }

  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'signals');
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  const risks = await filterMenu(analysis, 'Filter risk profiles');
  const authority = data.risk_profiles[0].authority;
  await risks.getByRole('checkbox', { name: authority, exact: true }).check();
  await risks.getByRole('checkbox', { name: 'Source risk rating', exact: true }).check();
  const expected = data.risk_profiles.filter(profile => profile.authority === authority && profile.assessments.length > 0);
  await expect(risks.getByRole('status')).toHaveText(`${expected.length} of ${data.risk_profiles.length} shown`);
  await activeMenu(risks, 2);
  await risks.getByRole('checkbox', { name: 'Source risk rating', exact: true }).press('Escape');
  await expect(risks).not.toHaveAttribute('open', '');
  await expect(risks.locator('summary')).toBeFocused();
  const profiles = atlasSelect(analysis, 'Evidence profile');
  await profiles.locator('summary').click();
  await expect(profiles.getByRole('option')).toHaveCount(expected.length);
  await profiles.getByRole('searchbox').press('Escape');
  expect((await analysis.locator('[data-risk-id]').evaluateAll(cards => cards.map(card => card.getAttribute('data-risk-id')))).every(id => expected.some(profile => profile.id === id))).toBe(true);
  await risks.locator('summary').click();
  await risks.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(risks.getByRole('status')).toHaveText(`${data.risk_profiles.length} of ${data.risk_profiles.length} shown`);

  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const signals = await filterMenu(analysis, 'Filter monitored series');
  await signals.getByRole('checkbox', { name: 'Reported observations', exact: true }).check();
  await activeMenu(signals, 1);
  await signals.getByRole('checkbox', { name: 'Reported observations', exact: true }).press('Escape');
  await expect(analysis.getByRole('region', { name: 'Reported observations', exact: true })).toBeVisible();
  const series = atlasSelect(analysis, 'Monitored series');
  await series.locator('summary').click();
  expect(await series.getByRole('option').count()).toBeGreaterThan(0);
  await expect(series.locator('summary .atlas-select-count')).toHaveText(String(await series.getByRole('option').count()));
  await expect(series.getByRole('option').filter({ hasText: 'Model evaluation' })).toHaveCount(0);
  await series.getByRole('searchbox').press('Escape');
  await signals.locator('summary').click();
  await signals.getByRole('checkbox', { name: 'Model evaluation', exact: true }).check();
  await activeMenu(signals, 2);
  await signals.getByRole('checkbox', { name: 'Reported observations', exact: true }).uncheck();
  await expect(signals.getByRole('status')).toHaveText(new RegExp(`^${data.forecast_series.length} of `));
  await signals.getByRole('button', { name: 'Clear', exact: true }).click();

  await page.getByRole('tab', { name: 'Journeys', exact: true }).click();
  const geography = page.locator('.atlas-chain-section');
  const chains = atlasSelect(geography, 'Reviewed chain');
  await chains.locator('summary').click();
  const total = await chains.getByRole('option').count();
  const journeys = await chains.getByRole('option').filter({ has: page.locator('.atlas-select-badge', { hasText: /^Reported journey$/ }) }).count();
  await chains.getByRole('searchbox').press('Escape');
  const connections = await filterMenu(geography, 'Filter geographic connections');
  await connections.getByRole('checkbox', { name: 'Reported journey', exact: true }).check();
  await expect(connections.getByRole('status')).toHaveText(`${journeys} of ${total} shown`);
  await activeMenu(connections, 1);
  await connections.getByRole('checkbox', { name: 'Reported journey', exact: true }).press('Escape');
  await chains.locator('summary').click();
  await expect(chains.getByRole('option')).toHaveCount(journeys);
  await chains.getByRole('searchbox').press('Escape');
  await connections.locator('summary').click();
  await connections.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(connections.getByRole('status')).toHaveText(`${total} of ${total} shown`);

  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const health = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const entries = await filterMenu(health, 'Filter One Health entries');
  for (const name of ['Sampling', 'Reviewed sample fraction', 'Food & commodities']) await entries.getByRole('checkbox', { name, exact: true }).check();
  await expect(health).toContainText('No entries match these filters.');
  await activeMenu(entries, 3);
  await entries.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(entries.locator('summary b')).toHaveCount(0);
  await expect(entries.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
  await entries.locator('.atlas-entry-filter-groups').evaluate(element => element.scrollTop = 0);
  await entries.getByRole('checkbox', { name: 'Network', exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('entry-filters.png') });
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  await expect(analysis.locator('.atlas-entry-filters summary b')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Analysis controls align between views at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  const geometry = () => analysis.evaluate(element => {
    const header = element.querySelector('header')!;
    return [element, header, header.querySelector(':scope > .atlas-select')!, header.querySelector('.atlas-entry-filters')!, header.nextElementSibling!].map(item => {
      const box = item.getBoundingClientRect();
      return { x: box.x, width: box.width };
    });
  });
  const signals = await geometry();
  for (const view of ['risk', 'spatial', 'relationships']) {
    await selectAtlasOption(analysis, 'Analysis view', view);
    expect(await geometry()).toEqual(signals);
  }
  if (fullscreen) await expect(page.locator('.atlas-workspace-scroll')).toHaveCSS('scrollbar-gutter', 'stable');
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  expect(await geometry()).toEqual(signals);
  if (fullscreen) await expect(page.locator('.atlas-workspace-scroll')).toHaveCSS('scrollbar-gutter', 'stable');
});

for (const width of [390, 1440]) test(`Analysis card selectors search all pages and filter types at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (width === 1440) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  for (const [view, label, type, secondType, kind] of [
    ['spatial', 'Spatial link', 'Source hypothesis', 'Reported travel', 'hypothesis'],
    ['relationships', 'Report relationship', 'Exposure', 'Unresolved', 'exposure'],
  ]) {
    await selectAtlasOption(analysis, 'Analysis view', view);
    const menu = atlasSelect(analysis, label);
    await menu.locator('summary').press('Enter');
    const entries = await menu.getByRole('option').evaluateAll(options => options.map(option => ({
      id: option.getAttribute('value')!, types: [...option.querySelectorAll('[data-kind="kind"]')].map(badge => badge.textContent),
    })));
    const matches = entries.filter(entry => entry.types.includes(type));
    expect(matches.length).toBeGreaterThan(12);
    await menu.getByRole('searchbox').press('Escape');
    await expect(menu.locator('.atlas-select-count')).toHaveText(String(entries.length));
    const filters = analysis.locator('.atlas-entry-filters');
    await filters.locator('summary').press('Enter');
    await filters.getByRole('checkbox', { name: type, exact: true }).check();
    await expect(filters.getByRole('status')).toHaveText(`${matches.length} of ${entries.length} shown`);
    await filters.getByRole('checkbox', { name: secondType, exact: true }).check();
    const union = entries.filter(entry => entry.types.includes(type) || entry.types.includes(secondType));
    await expect(filters.getByRole('status')).toHaveText(`${union.length} of ${entries.length} shown`);
    await filters.getByRole('checkbox', { name: secondType, exact: true }).uncheck();
    await filters.getByRole('checkbox', { name: type, exact: true }).press('Escape');
    await expect(menu.locator('.atlas-select-count')).toHaveText(String(matches.length));
    await expect(analysis.locator('.atlas-connection')).toHaveCount(12);
    for (const card of await analysis.locator('.atlas-connection').all()) await expect(card).toHaveAttribute('data-kind', kind);
    await expect(atlasSelect(page, 'Link type').locator('summary')).toContainText('All link types');
    await menu.locator('summary').press('Enter');
    await expect(menu.getByRole('option')).toHaveCount(matches.length);
    const last = menu.getByRole('option').last();
    const id = (await last.getAttribute('value'))!;
    const title = (await last.getAttribute('aria-label'))!;
    await menu.getByRole('searchbox').fill('no matching entry 982731');
    await expect(menu.getByRole('status')).toHaveText('No matches');
    await menu.getByRole('searchbox').fill(title);
    await menu.getByRole('searchbox').press('ArrowDown');
    await menu.locator(`button[value=${JSON.stringify(id)}]`).press('Enter');
    const card = analysis.locator(`.atlas-connection[data-${view === 'spatial' ? 'link' : 'assessment'}-id=${JSON.stringify(id)}]`);
    await expect(card).toHaveAttribute('data-expanded', 'true');
    await expect(card.locator('.atlas-evidence').first()).toBeVisible();
    const back = card.getByRole('button', { name: /^Back to/ });
    await back.click();
    await selectAtlasOption(analysis, label, id);
    await expect(card).toHaveAttribute('data-expanded', 'true');
    await filters.locator('summary').press('Enter');
    await filters.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(filters.getByRole('status')).toHaveText(`${entries.length} of ${entries.length} shown`);
    await filters.locator('summary').press('Escape');
    await expect(analysis.locator('.atlas-connection[data-expanded]')).toHaveCount(0);
    await expect(menu.locator('.atlas-select-count')).toHaveText(String(entries.length));
    expect((await new AxeBuilder({ page }).include('.atlas-analysis').analyze()).violations).toEqual([]);
    await analysis.screenshot({ path: testInfo.outputPath(`${view}-controls.png`) });
  }
  await selectAtlasOption(analysis, 'Analysis view', 'spatial');
  const filters = analysis.locator('.atlas-entry-filters');
  await filters.locator('summary').press('Enter');
  await filters.getByRole('checkbox', { name: 'Source hypothesis', exact: true }).check();
  await filters.locator('summary').press('Escape');
  await selectAtlasOption(analysis, 'Analysis view', 'relationships');
  await expect(analysis.locator('.atlas-entry-filters summary b')).toHaveCount(0);
  await selectAtlasOption(analysis, 'Analysis view', 'spatial');
  await expect(analysis.locator('.atlas-entry-filters summary b')).toHaveText('1');
  const globalType = atlasSelect(page, 'Link type');
  await globalType.locator('summary').click();
  await globalType.getByRole('checkbox', { name: 'Reported travel', exact: true }).check();
  await globalType.getByRole('checkbox', { name: 'Reported travel', exact: true }).press('Escape');
  await expect(analysis).toContainText('No spatial links match these types.');
  await expect(atlasSelect(analysis, 'Spatial link').locator('summary')).toHaveAttribute('aria-disabled', 'true');
  await filters.locator('summary').press('Enter');
  await filters.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(atlasSelect(analysis, 'Spatial link').locator('summary')).not.toHaveAttribute('aria-disabled');
  await expect(globalType.locator('summary')).toContainText('Reported travel');
  expect(errors).toEqual([]);
});

test('Report evidence can open a relationship excluded by its local type filter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'relationships');
  const menu = atlasSelect(analysis, 'Report relationship');
  await menu.locator('summary').click();
  const identity = menu.getByRole('option').filter({ has: page.locator('[data-kind="kind"]', { hasText: /^Identity$/ }) }).first();
  const id = (await identity.getAttribute('value'))!;
  await identity.click();
  const card = analysis.locator(`.atlas-connection[data-assessment-id=${JSON.stringify(id)}]`);
  await card.locator('.atlas-card-footer').getByRole('button', { name: 'View reports', exact: true }).click();
  const report = page.locator('.atlas-report[data-evidence="true"]').first();
  await report.locator(':scope > summary').click();
  const reportId = await report.getAttribute('id');
  const jump = page.locator(`[id=${JSON.stringify(reportId)}] .atlas-report-assessment-links button[data-assessment-id=${JSON.stringify(id)}]`);
  await report.locator('.atlas-report-assessment-links details').filter({ has: page.locator(`button[data-assessment-id=${JSON.stringify(id)}]`) }).locator('summary').click();
  await expect(jump).toBeVisible();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const filters = analysis.locator('.atlas-entry-filters');
  await filters.locator('summary').click();
  await filters.getByRole('checkbox', { name: 'Exposure', exact: true }).check();
  await filters.locator('summary').press('Escape');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.locator(`[id=${JSON.stringify(reportId)}] .atlas-report-assessment-links details`).filter({ has: page.locator(`button[data-assessment-id=${JSON.stringify(id)}]`) }).locator('summary').click();
  await jump.click();
  await expect(card).toHaveAttribute('data-expanded', 'true');
  await expect(card).toHaveAttribute('data-kind', 'identity');
  await expect(card.locator('header')).toBeFocused();
  await expect(filters.locator('summary b')).toHaveCount(0);
});

async function cardFooterStyle(card: Locator) {
  return card.evaluate(element => {
    const footer = element.querySelector<HTMLElement>('.atlas-card-footer')!;
    const button = footer.querySelector<HTMLElement>('button[aria-label^="View report"]')!;
    const style = getComputedStyle(footer);
    const action = getComputedStyle(button);
    const box = element.getBoundingClientRect();
    const bounds = footer.getBoundingClientRect();
    return {
      bottomGap: Math.round(box.bottom - bounds.bottom - parseFloat(getComputedStyle(element).borderBottomWidth)),
      leftGap: Math.round(bounds.left - box.left - parseFloat(getComputedStyle(element).borderLeftWidth)),
      padding: style.padding, margin: style.marginTop, gap: style.gap, alignment: style.justifyContent,
      button: [action.padding, action.minHeight, action.borderWidth, action.borderRadius, action.backgroundColor, action.color, action.fontSize],
    };
  });
}

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Connection cards expand with evidence and scroll cues at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await atlasSelect(page, 'Analysis view').locator('summary').click();
  expect(await atlasSelect(page, 'Analysis view').getByRole('option').evaluateAll(options => options.map(option => option.getAttribute('aria-label')))).toEqual(['Signals & forecasts', 'Spatial links', 'Report relationships', 'Risk assessments']);
  await page.keyboard.press('Escape');
  await selectAtlasOption(page, 'Analysis view', 'risk');
  const risk = page.locator('[data-risk-id]').first();
  await expect(risk).toBeVisible();
  const compactFooter = await cardFooterStyle(risk);
  await risk.locator('[data-risk-expand]').click();
  const expandedFooter = await cardFooterStyle(risk);
  await risk.locator('[data-risk-back]').click();
  for (const view of ['Spatial links', 'Report relationships']) {
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await selectAtlasOption(page, 'Analysis view', view === 'Spatial links' ? 'spatial' : 'relationships');
    const collection = page.locator('.atlas-connection-workspace');
    const scroll = collection.locator('.atlas-connection-scroll');
    const cards = collection.locator('.atlas-connection');
    await expect(cards.first()).toBeVisible();
    await expect(scroll).toHaveCSS('scrollbar-width', 'none');
    const count = await cards.count();
    const cue = collection.getByRole('button', { name: `More ${view.toLowerCase()} below`, exact: true });
    await expect(cue).toBeVisible();
    await cue.click();
    await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    for (const timing of await cards.locator('.atlas-card-timing').all()) {
      const endpoints = await timing.locator('.atlas-card-timing-dates time').evaluateAll(elements => elements.map(element => element.getAttribute('datetime')!));
      const dates = await timing.locator('li time').evaluateAll(elements => elements.map(element => element.getAttribute('datetime')!));
      if (dates.length) {
        expect(dates).toEqual([...new Set(dates)].sort());
        expect(endpoints).toEqual([dates[0], dates.at(-1)]);
        const days = (Date.parse(dates.at(-1)!) - Date.parse(dates[0])) / 86400000;
        await expect(timing).toContainText(`${days} ${days === 1 ? 'day' : 'days'} between reports`);
        const positions = await timing.locator('li').evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.getPropertyValue('--date-position'))));
        dates.forEach((date, index) => expect(positions[index]).toBeCloseTo((Date.parse(date) - Date.parse(dates[0])) / 86400000 / days * 100));
      } else {
        expect(endpoints).toHaveLength(1);
        await expect(timing).toHaveAttribute('data-single', 'true');
      }
      expect(endpoints.every(date => Number.isFinite(Date.parse(date)))).toBe(true);
    }
    const card = cards.first();
    await expect(card.locator('.atlas-card-timing')).toHaveCount(1);
    expect(await cardFooterStyle(card)).toEqual(compactFooter);
    await expect(card.locator('.atlas-card-action-label:visible')).toHaveCount(0);
    await card.getByRole('button', { name: 'View details', exact: true }).click();
    await expect(card).toHaveAttribute('data-expanded', 'true');
    expect(await cardFooterStyle(card)).toEqual(expandedFooter);
    await expect(card.locator('.atlas-card-footer button')).toHaveText(['View reports', 'Locate']);
    await expect(collection.locator('.atlas-connection:visible')).toHaveCount(1);
    await expect(collection.locator('.atlas-geographic-journeys')).toHaveCount(0);
    const back = card.getByRole('button', { name: `Back to ${view.toLowerCase()}`, exact: true });
    await expect(back).toBeFocused();
    expect(await back.evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
    expect((await new AxeBuilder({ page }).include('.atlas-connection-workspace').analyze()).violations).toEqual([]);
    await expect(card.locator('.atlas-evidence')).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Supporting reports', exact: true })).toBeVisible();
    const body = card.getByRole('region', { name: 'Connection details', exact: true });
    await expect(body).toHaveCSS('scrollbar-width', 'none');
    const cardBox = (await card.boundingBox())!;
    const collectionBox = (await collection.boundingBox())!;
    expect(cardBox.height).toBeCloseTo(collectionBox.height, 0);
    expect(cardBox.width).toBeCloseTo(collectionBox.width, 0);
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const main = (await card.locator('.atlas-card-main').boundingBox())!;
    const aside = (await card.locator('.atlas-card-aside').boundingBox())!;
    if (width > 600) expect(aside.x).toBeGreaterThan(main.x + main.width);
    else expect(aside.y).toBeGreaterThan(main.y);
    await collection.screenshot({ path: `/tmp/atlas-${view === 'Report relationships' ? 'relationship' : 'geographic'}-expanded-${width}-${fullscreen}.png` });
    const more = collection.getByRole('button', { name: 'More details below', exact: true });
    if (await more.isVisible()) {
      await more.click();
      await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(more).toBeHidden();
    }
    await page.keyboard.press('Escape');
    await expect(collection.locator('.atlas-connection:visible')).toHaveCount(count);
    await expect(card.getByRole('button', { name: 'View details', exact: true })).toBeFocused();
    await expect(card.locator('.atlas-evidence')).toHaveCount(0);
    await scroll.evaluate(element => { element.scrollTop = 0; });
    await collection.screenshot({ path: `/tmp/atlas-${view === 'Report relationships' ? 'relationship' : 'geographic'}-cards-${width}-${fullscreen}.png` });
  }
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-connection-workspace')).toHaveCount(0);
  if (fullscreen) await expect(page.locator('.atlas-workspace-scroll')).toHaveCSS('overflow-y', 'auto');
  expect(errors).toEqual([]);
});

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Connection card transitions retain scroll clipping at ${width}px, fullscreen ${fullscreen}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  for (const view of ['Spatial links', 'Report relationships']) {
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await selectAtlasOption(page, 'Analysis view', view === 'Spatial links' ? 'spatial' : 'relationships');
    const card = page.locator('.atlas-connection').first();
    for (const expanded of [true, false]) {
      const scroller = expanded ? page.locator('.atlas-connection-scroll') : card.locator('.atlas-card-body');
      await scroller.evaluate(element => { element.scrollTop = 120; });
      expect(await scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      const before = (await card.boundingBox())!;
      const pause = await page.addStyleTag({ content: 'html[data-atlas-connection-transition]::view-transition-group(*), html[data-atlas-connection-transition]::view-transition-old(*), html[data-atlas-connection-transition]::view-transition-new(*) { animation-play-state: paused !important; animation-delay: -.15s !important; }' });
      await card.locator(expanded ? '[data-card-expand]' : '[data-card-back]').evaluate((element: HTMLButtonElement) => element.click());
      await expect(page.locator('html')).toHaveAttribute('data-atlas-connection-transition', expanded ? 'expand' : 'collapse');
      await expect(card).toHaveCSS('view-transition-name', 'atlas-connection-card');
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').length)).toBeGreaterThanOrEqual(5);
      expect(await page.evaluate(() => document.getAnimations().some(animation => (animation.effect as KeyframeEffect)?.pseudoElement === '::view-transition-group(root)'))).toBe(false);
      const visibleTop = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement, '::view-transition-group(atlas-connection-card)');
        const inset = Number(style.clipPath.match(/inset\(([-\d.]+)px/)![1]);
        return new DOMMatrix(style.transform).m42 + inset;
      });
      if (expanded) {
        const start = await page.evaluate(() => {
          const animation = document.getAnimations().find(animation => animation.id !== 'atlas-card-clip' && (animation.effect as KeyframeEffect)?.pseudoElement === '::view-transition-group(atlas-connection-card)')!;
          return new DOMMatrix((animation.effect as KeyframeEffect).getKeyframes()[0].transform as string).m42;
        });
        expect(start).toBeGreaterThanOrEqual((await page.locator('.atlas-connection-scroll').boundingBox())!.y - 1);
      }
      const tools = (await page.locator('.atlas-analysis > header').boundingBox())!;
      expect(visibleTop).toBeGreaterThanOrEqual(tools.y + tools.height - 1);
      const after = (await card.boundingBox())!;
      const middle = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement, '::view-transition-group(atlas-connection-card)').width));
      if (before.width !== after.width) {
        expect(middle).toBeGreaterThan(Math.min(before.width, after.width));
        expect(middle).toBeLessThan(Math.max(before.width, after.width));
      }
      const clips = await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').map(animation => (animation.effect as KeyframeEffect).getKeyframes().map(frame => frame.clipPath)));
      expect(await page.evaluate(() => {
        const animations = document.getAnimations();
        return animations.filter(animation => animation.id === 'atlas-card-clip').every(clip => {
          const effect = clip.effect as KeyframeEffect;
          const geometry = animations.find(animation => animation.id !== 'atlas-card-clip' && (animation.effect as KeyframeEffect)?.pseudoElement === effect.pseudoElement)!;
          return effect.getKeyframes()[0].easing === (geometry.effect as KeyframeEffect).getKeyframes()[0].easing;
        });
      })).toBe(true);
      if (!expanded) expect(clips.some(frames => frames.some(frame => frame !== 'inset(0px)'))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${view}-${expanded ? 'expanding' : 'collapsing'}.png`) });
      await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').forEach(animation => animation.finish()));
      await pause.evaluate(element => element.parentNode?.removeChild(element));
      await expect(page.locator('html')).not.toHaveAttribute('data-atlas-connection-transition');
      await expect(card.locator('[style*="view-transition-name"]')).toHaveCount(0);
      await expect(card.getByRole('button', { name: expanded ? `Back to ${view.toLowerCase()}` : 'View details', exact: true })).toBeFocused();
      if (!expanded) expect((await card.boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('.atlas-connection-scroll').boundingBox())!.y - 1);
    }
  }
});

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Journey workspace links geography, event timing and source evidence at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Journeys', exact: true }).click();
  const workspace = page.locator('.atlas-chain-section');
  await expect(workspace.locator('.atlas-chain-figure')).toHaveAttribute('aria-label', 'MV Hondius: selected episode reports');
  const journeyView = workspace.locator('summary[aria-label="Journey view"]');
  await expect(journeyView).toHaveAttribute('aria-disabled', 'true');
  await expect(journeyView).toContainText('Sequences');
  await journeyView.dispatchEvent('click');
  await expect(journeyView.locator('..')).not.toHaveAttribute('open');
  const timing = page.getByRole('region', { name: 'Event timing', exact: true });
  const map = workspace.locator('.atlas-chain-map');
  const details = page.getByRole('region', { name: 'Journey details', exact: true });
  await selectAtlasOption(page, 'Reviewed chain', { label: 'MV Hondius: selected episode reports' });
  for (const label of ['MV Hondius: selected episode reports', 'Kent meningococcal outbreak: March reporting sequence']) {
    await selectAtlasOption(page, 'Reviewed chain', { label });
    const inset = map.locator('.atlas-chain-unlocated-zone rect');
    await expect(inset).toBeVisible();
    const geometry = await map.evaluate(svg => {
      const viewport = svg.getBoundingClientRect();
      const box = svg.querySelector('.atlas-chain-unlocated-zone rect')!.getBoundingClientRect();
      const heading = svg.querySelector('.atlas-chain-unlocated-zone text')!.getBoundingClientRect();
      const connectors = [...svg.querySelectorAll('.atlas-chain-edge[data-schematic] .atlas-chain-edge-line')].map(element => element.getBoundingClientRect());
      const obstacles = [...svg.querySelectorAll('.atlas-chain-pin:not([data-unlocated]) .atlas-chain-pin-halo, .atlas-chain-pin foreignObject, .atlas-chain-edge:not([data-schematic]) .atlas-chain-edge-line')].map(element => element.getBoundingClientRect());
      return { inside: box.left >= viewport.left && box.right <= viewport.right && box.top >= viewport.top && box.bottom <= viewport.bottom,
        overlaps: obstacles.filter(a => a.left < box.right && a.right > box.left && a.top < box.bottom && a.bottom > box.top).length,
        headingOverlaps: connectors.filter(a => a.left < heading.right && a.right > heading.left && a.top < heading.bottom && a.bottom > heading.top).length,
        height: box.height / viewport.height, width: box.width / viewport.width };
    });
    expect(geometry.inside).toBe(true);
    expect(geometry.overlaps, label).toBe(0);
    expect(geometry.headingOverlaps, label).toBe(0);
    expect(geometry.height).toBeLessThan(.5);
    expect(geometry.width).toBeLessThan(.5);
    await workspace.locator('.atlas-chain-map-panel').screenshot({ path: `/tmp/atlas-inset-${label.split(':')[0].replaceAll(' ', '-')}-${width}-${fullscreen}.png` });
  }
  await selectAtlasOption(page, 'Reviewed chain', { label: 'MV Hondius: selected episode reports' });
  const title = (await workspace.locator('.atlas-chain-heading').boundingBox())!;
  const controls = (await workspace.locator('.atlas-chain-tools').boundingBox())!;
  expect(title.y + title.height / 2).toBeCloseTo(controls.y + controls.height / 2, 0);
  expect(title.x + title.width).toBeLessThan(controls.x);
  await expect(workspace.locator('.atlas-chain-context')).toHaveCount(0);
  await expect(details.getByRole('heading', { name: 'Evidence explorer', exact: true })).toHaveCount(0);
  await expect(details.getByRole('button', { name: 'View all supporting reports' })).toHaveCount(0);
  const outline = details.getByRole('region', { name: 'Journey events and connections' });
  await expect(outline.getByRole('heading', { name: 'Journey outline', exact: true })).toBeVisible();
  await expect(outline.locator(':scope > header > span')).toHaveText('5 entries');
  const digests = details.getByRole('region', { name: 'Journey evidence digests' });
  const cards = digests.locator('.atlas-evidence-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.first().locator('.atlas-card-action-label')).toBeHidden();
  expect(await cardFooterStyle(cards.first())).toMatchObject({ bottomGap: 10, leftGap: 14, padding: '0px', margin: '8px', alignment: 'flex-start' });
  await expect(cards.first().locator('.atlas-card-summary')).toContainText('two sick passengers');
  const top = (await outline.boundingBox())!, bottom = (await digests.boundingBox())!;
  expect(bottom.y).toBeGreaterThan(top.y + top.height);
  expect(bottom.x + bottom.width).toBeCloseTo(top.x + top.width, 0);
  await cards.first().getByRole('button', { name: 'View details', exact: true }).click();
  await expect(outline).toBeHidden();
  const expandedCard = digests.locator('.atlas-evidence-card[data-expanded]');
  await expect(expandedCard.locator('.atlas-card-footer button')).toHaveText('View report');
  expect(await cardFooterStyle(expandedCard)).toMatchObject({ bottomGap: width > 600 ? 14 : 10, leftGap: width > 600 ? 14 : 10, margin: '8px', alignment: 'flex-start' });
  await expect(expandedCard.getByRole('region', { name: 'Evidence details' })).toBeVisible();
  const backControl = (await expandedCard.getByRole('button', { name: 'Back to evidence digests', exact: true }).boundingBox())!;
  const journeyToolbar = (await workspace.locator('.atlas-chain-toolbar').boundingBox())!;
  expect(backControl.y).toBeGreaterThanOrEqual(journeyToolbar.y + journeyToolbar.height);
  await expect(expandedCard.locator('blockquote').first()).toBeVisible();
  await expect(expandedCard).toContainText('Journey support');
  expect((await new AxeBuilder({ page }).include('.atlas-chain-section').analyze()).violations).toEqual([]);
  expect((await expandedCard.boundingBox())!.height).toBeGreaterThan((await details.boundingBox())!.height * .9);
  await details.screenshot({ path: `/tmp/atlas-journey-digest-expanded-${width}-${fullscreen}.png` });
  await page.keyboard.press('Escape');
  await expect(outline).toBeVisible();
  await expect(cards.first().getByRole('button', { name: 'View details', exact: true })).toBeFocused();
  await expect(cards.first()).toBeInViewport({ ratio: .25 });
  await details.screenshot({ path: `/tmp/atlas-journey-digests-${width}-${fullscreen}.png` });
  await cards.first().getByRole('button', { name: 'View details', exact: true }).click();
  await map.locator('.atlas-chain-pin').first().press('Enter');
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('region', { name: 'Selected chain evidence' })).toBeVisible();
  await map.locator('.atlas-chain-pin').first().press('Enter');
  await workspace.locator('summary[aria-label="Reviewed chain"]').focus();
  if (fullscreen) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await cards.first().getByRole('button', { name: 'View details', exact: true }).click();
    await expect(expandedCard).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-connection-transition');
    await expandedCard.getByRole('button', { name: 'Back to evidence digests', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-connection-transition');
    await expect(cards.first()).toBeInViewport({ ratio: .25 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await workspace.screenshot({ path: `/tmp/atlas-journey-toolbar-${width}-${fullscreen}.png` });
  await expect(details.locator('summary[aria-label="Journey evidence"]')).toHaveCount(0);
  await expect(timing.locator('.atlas-chain-time-event')).toHaveCount(3);
  await expect(timing.locator('.atlas-chain-time-event time')).toHaveText(['6 May', '18 May', '2 Jul']);
  await expect(timing.locator('.atlas-chain-time-plot')).toHaveCount(1);
  await expect(timing.locator('.atlas-chain-time-link[marker-end]')).toHaveCount(2);
  await page.mouse.move(0, 0);
  for (const row of await timing.locator('.atlas-chain-time-event').all()) {
    await expect(row).toHaveCSS('border-top-width', '0px');
    await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  const connectors = await timing.evaluate(element => {
    const markers = [...element.querySelectorAll('.atlas-chain-time-track > span')].map(node => node.getBoundingClientRect());
    return [...element.querySelectorAll<SVGPathElement>('.atlas-chain-time-link')].map((path, index) => {
      const matrix = path.getScreenCTM()!;
      const first = path.getPointAtLength(0).matrixTransform(matrix), last = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
      const a = markers[index], b = markers[index + 1];
      return { startX: first.x - a.x - a.width / 2, startY: first.y - a.y - a.height / 2,
        endX: last.x - b.x - b.width / 2, endY: last.y - b.y - b.height / 2 };
    });
  });
  for (const connector of connectors) {
    expect(Math.abs(connector.startX)).toBeLessThan(1);
    expect(connector.startY).toBeCloseTo(14, 0);
    expect(connector.endX).toBeCloseTo(-16, 0);
    expect(Math.abs(connector.endY)).toBeLessThan(1);
  }
  await timing.screenshot({ path: `/tmp/atlas-unified-timing-${width}-${fullscreen}.png` });
  await expect(timing.locator('.atlas-chain-undated')).toHaveCount(0);
  const fractions = await timing.locator('.atlas-chain-time-event').evaluateAll(elements => elements.map(element => parseFloat((element as HTMLElement).style.getPropertyValue('--event-time'))));
  expect(fractions[0]).toBe(0); expect(fractions[2]).toBe(100);
  expect(fractions[1]).toBeCloseTo(12 / 57 * 100, 5);
  const last = timing.locator('.atlas-chain-time-event').last();
  await last.hover();
  await expect(map.locator('.atlas-chain-pin[data-highlighted]')).toHaveCount(1);
  await expect(details.locator('.atlas-chain-entry[data-highlighted]')).toHaveCount(1);
  await last.press('Enter');
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  const evidence = page.getByRole('region', { name: 'Selected chain evidence', exact: true });
  await expect(evidence).toBeVisible();
  await expect(map.locator('.atlas-chain-pin[data-unlocated]')).toHaveAttribute('aria-pressed', 'true');
  await evidence.getByText('Source evidence', { exact: true }).click();
  await expect(evidence.locator('blockquote').first()).toBeVisible();
  await page.mouse.move(0, 0);
  await workspace.evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await workspace.screenshot({ path: `/tmp/atlas-journey-workspace-${width}-${fullscreen}.png` });
  const mapBox = (await workspace.locator('.atlas-chain-map-panel').boundingBox())!;
  const detailBox = (await details.boundingBox())!;
  if (width > 600) {
    expect(detailBox.x).toBeGreaterThan(mapBox.x + mapBox.width);
    const timingBox = (await timing.boundingBox())!;
    expect(detailBox.y + detailBox.height).toBeCloseTo(timingBox.y + timingBox.height, 0);
    expect((await workspace.boundingBox())!.height).toBeGreaterThan(550);
  } else expect(detailBox.y).toBeGreaterThan((await timing.boundingBox())!.y);
  if (fullscreen) {
    expect(await page.locator('.atlas-workspace-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 650 });
    expect(await page.locator('.atlas-workspace').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width, height: 900 });
  }
  await selectAtlasOption(page, 'Reviewed chain', { label: 'Latvia measles: reported journey' });
  await expect(timing.locator('.atlas-chain-time-event')).toHaveCount(1);
  await expect(timing.locator('.atlas-chain-time-event')).toHaveCSS('--event-time', '50%');
  await expect(timing.locator('.atlas-chain-time-link')).toHaveCount(0);
  await expect(timing.locator('.atlas-chain-undated button')).toHaveCount(2);
  await timing.locator('.atlas-chain-undated button').first().press('Enter');
  await expect(evidence).toBeVisible();
  await expect(map.locator('.atlas-chain-pin[aria-pressed="true"]')).toHaveAttribute('aria-label', 'Istanbul transit');
  await selectAtlasOption(page, 'Reviewed chain', { label: 'A(H9N2): Senegal to Italy' });
  await expect(timing.locator('.atlas-chain-time-event, .atlas-chain-time-axis')).toHaveCount(0);
  await expect(timing.locator('.atlas-chain-undated button')).toHaveCount(2);
  await expect(workspace.locator('.atlas-chain-edge:not([data-schematic])')).toHaveCount(1);
  expect((await new AxeBuilder({ page }).include('.atlas-chain-section').analyze()).violations).toEqual([]);
  await selectAtlasOption(page, 'Reviewed chain', { label: 'MV Hondius: selected episode reports' });
  await page.getByRole('slider', { name: 'Window start', exact: true }).evaluate(input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(Date.parse('2026-06-01T00:00:00Z') / 86400000));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(details.locator('.atlas-status')).toHaveText('Partial selection');
  await expect(timing.locator('.atlas-chain-time-event')).toHaveCount(1);
  await expect(timing.locator('.atlas-chain-time-event time')).toHaveAttribute('datetime', '2026-07-02');
  await expect(map.locator('.atlas-chain-edge')).toHaveCount(0);
  await expect(cards).toHaveCount(1);
  await cards.first().getByRole('button', { name: /^View report:/ }).click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [width, fullscreen, reduced] of [[390, false, true], [1440, false, false], [1440, true, false]] as const) test(`Relationship Locate highlights globe locations at ${width}px, fullscreen ${fullscreen}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference', colorScheme: reduced ? 'dark' : 'light' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(page, 'Analysis view', 'relationships');
  const id = await page.locator('[data-assessment-id]').first().getAttribute('data-assessment-id');
  const card = page.locator(`[data-assessment-id="${id}"]`);
  const globe = page.getByTestId('atlas-globe');
  for (let attempt = 0; attempt < 2; attempt++) {
    await card.getByRole('button', { name: 'Locate relationship', exact: true }).click();
    await expect(globe.locator('.globe-drag-hint')).toHaveCount(0);
    const beacons = globe.locator('.atlas-locate-beacon');
    await expect.poll(() => beacons.count()).toBeGreaterThan(0);
    await expect(globe).toBeInViewport();
    await expect.poll(() => beacons.evaluateAll(elements => {
      const positions = elements.map(element => element.closest<SVGGElement>('.atlas-globe-pin')!.transform.baseVal.consolidate()!.matrix);
      return Math.hypot(positions.reduce((sum, position) => sum + position.e - 500, 0), positions.reduce((sum, position) => sum + position.f - 500, 0)) / positions.length;
    })).toBeLessThan(1);
    await expect.poll(() => beacons.first().evaluate(element => element.getAnimations().filter(animation => animation.id === 'atlas-locate-pulse').length)).toBe(1);
    const animations = await beacons.evaluateAll(elements => elements.map(element => {
      const animation = element.getAnimations().find(item => item.id === 'atlas-locate-pulse')!;
      const effect = animation.effect as KeyframeEffect;
      const timing = effect.getTiming();
      return { duration: timing.duration, iterations: timing.iterations, opacities: effect.getKeyframes().map(frame => frame.opacity), pointer: getComputedStyle(element).pointerEvents };
    }));
    for (const animation of animations) {
      expect(animation.duration).toBe(1200);
      expect(animation.iterations).toBe(5);
      expect(animation.pointer).toBe('none');
      expect(new Set(animation.opacities).size).toBe(reduced ? 1 : 2);
    }
    await beacons.evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 480; })));
    await globe.screenshot({ path: info.outputPath(`located-${attempt}.png`) });
    await beacons.evaluateAll(elements => elements.forEach(element => element.getAnimations().forEach(animation => animation.finish())));
    for (const beacon of await beacons.all()) await expect(beacon).toHaveCSS('opacity', '0');
    if (!attempt) {
      await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
      await selectAtlasOption(page, 'Analysis view', 'relationships');
    }
  }
});

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Card animations release pointer interaction at ${width}px, fullscreen ${fullscreen}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  for (const view of ['risk', 'spatial', 'relationships']) {
    await selectAtlasOption(page, 'Analysis view', view);
    const card = page.locator(view === 'risk' ? '[data-risk-id]' : '.atlas-connection').first();
    for (let cycle = 0; cycle < 2; cycle++) {
      await card.getByRole('button', { name: /View details/ }).click();
      await expect(card).toHaveAttribute('data-expanded', 'true');
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').map(animation => ({ state: animation.playState, start: animation.startTime, time: animation.currentTime, pending: animation.pending }))), { timeout: 3000 }).toEqual([]);
      await expect(page.locator('html')).not.toHaveAttribute(view === 'risk' ? 'data-atlas-risk-transition' : 'data-atlas-connection-transition');
      await card.getByRole('button', { name: /^Back to/ }).click();
      await expect(card).not.toHaveAttribute('data-expanded');
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').length), { timeout: 3000 }).toBe(0);
    }
  }
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('Full screen card layers stay in their viewport on every rendered frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  for (const view of ['spatial', 'relationships', 'risk']) {
    await selectAtlasOption(page, 'Analysis view', view);
    const card = page.locator(view === 'risk' ? '[data-risk-id]' : '.atlas-connection').first();
    for (const expanded of [true, false]) {
      const result = await card.evaluate(async (element, expanded) => {
        if (expanded) {
          let scroller = element.parentElement!;
          while (scroller.parentElement && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
          scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + 120;
          const cardBounds = element.getBoundingClientRect(), viewportTop = scroller.getBoundingClientRect().top;
          if (cardBounds.top >= viewportTop || cardBounds.bottom <= viewportTop) throw new Error('The card must cross the viewport top before expansion');
        }
        const failures: unknown[] = [];
        let frames = 0;
        const html = document.documentElement;
        element.querySelector<HTMLButtonElement>(expanded ? '[data-card-expand], [data-risk-expand]' : '[data-card-back], [data-risk-back]')!.click();
        while (html.hasAttribute('data-atlas-connection-transition') || html.hasAttribute('data-atlas-risk-transition')) {
          await new Promise(requestAnimationFrame);
          const boundary = document.querySelector('.atlas-connection-scroll')?.getBoundingClientRect().top ?? document.querySelector('.atlas-analysis > header')!.getBoundingClientRect().bottom;
          const animations = document.getAnimations();
          for (const animation of animations.filter(a => a.id !== 'atlas-card-clip')) {
            const pseudo = (animation.effect as KeyframeEffect)?.pseudoElement;
            if (!pseudo?.match(/^::view-transition-group\(atlas-(connection|risk)-/)) continue;
            frames++;
            const style = getComputedStyle(html, pseudo);
            const values = style.clipPath === 'none' ? [0] : style.clipPath.slice(6, -1).split(' ').map(parseFloat);
            const top = values[0], bottom = values[2] ?? top;
            const y = new DOMMatrix(style.transform).m42;
            if (top + bottom < parseFloat(style.height) && y + top < boundary - 1) failures.push({ pseudo, y, clip: style.clipPath, boundary, time: animation.currentTime });
          }
        }
        return { frames, failures };
      }, expanded);
      expect(result.frames).toBeGreaterThan(0);
      expect(result.failures, `${view} ${expanded ? 'expanding' : 'collapsing'}`).toEqual([]);
    }
  }
});

for (const width of [320, 390, 450]) test(`Compact panel controls stay on one row at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const aligned = async (selector: string) => {
    const boxes = await page.locator(selector).evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    }));
    expect(boxes).toHaveLength(3);
    expect(Math.max(...boxes.map(box => box.top))).toBeLessThan(Math.min(...boxes.map(box => box.bottom)));
    for (let index = 1; index < boxes.length; index++) expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index - 1].right);
  };
  for (const [view, label] of [['signals', 'Signals'], ['spatial', 'Spatial'], ['relationships', 'Relationships'], ['risk', 'Risks']]) {
    await selectAtlasOption(page, 'Analysis view', view);
    await expect(atlasSelect(page, 'Analysis view').locator(':scope > summary')).toContainText(label);
    await aligned('.atlas-analysis > header summary');
    expect(await page.locator('.atlas-analysis .atlas-oh-mode-label > span').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  const controlSize = (label: string) => page.locator(`summary[aria-label="${label}"]`).evaluate(element => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, padding: style.padding, fontSize: style.fontSize, borderRadius: style.borderRadius };
  });
  const analysisSize = await controlSize('Analysis view');
  await page.locator('.atlas-analysis > header').screenshot({ path: testInfo.outputPath('analysis-controls.png') });
  await page.getByRole('tab', { name: 'Journeys', exact: true }).click();
  await expect(page.locator('summary[aria-label="Journey view"]')).toContainText('Sequences');
  await aligned('.atlas-chain-toolbar summary');
  expect(await controlSize('Journey view')).toEqual(analysisSize);
  await expect(page.locator('summary[aria-label="Journey view"]')).toHaveAttribute('aria-disabled', 'true');
  expect(await page.locator('.atlas-chain-heading .atlas-oh-mode-label > span').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.locator('.atlas-chain-toolbar').screenshot({ path: testInfo.outputPath('journey-controls.png') });
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  expect(await controlSize('One Health view')).toEqual(analysisSize);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const coverage = page.getByRole('button', { name: 'Source coverage', exact: true });
  const box = (await coverage.boundingBox())!;
  expect(box.width).toBe(36); expect(box.height).toBe(36);
  await expect(coverage).toHaveCSS('border-radius', '50%');
  await expect(coverage).toHaveCSS('font-size', '0px');
  await coverage.click();
  await expect(page.getByRole('dialog', { name: 'Source coverage', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
