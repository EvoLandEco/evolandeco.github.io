import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { intelligenceSchema } from '../src/lib/atlas-intelligence';
import { atlasSelect, selectAtlasOption, selectedAtlasValue } from './atlas-select-actions';

test.use({ baseURL: process.env.ATLAS_INTELLIGENCE_PREVIEW_URL ?? 'http://127.0.0.1:3005' });

test.beforeEach(async ({ page }) => {
  if (process.env.ATLAS_BROWSER_CANDIDATE) {
    const directory = process.env.ATLAS_BROWSER_CANDIDATE;
    await page.route('**/releases/*/browser/*/**', route => {
      const asset = new URL(route.request().url()).pathname.split('/browser/')[1].split('/').slice(1).join('/');
      return route.fulfill({ contentType: 'application/json', body: readFileSync(join(directory, asset)) });
    });
    if (process.env.ATLAS_INTELLIGENCE_FILE) await page.route('**/intelligence/*/intelligence.json', route => route.fulfill({ contentType: 'application/json', body: readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!) }));
  }
  if (process.env.ATLAS_RELEASE_FILE) {
    const receipt = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE, 'utf8'));
    await page.route('**/current.json', route => route.fulfill({ json: receipt.release ?? receipt }));
  }
});

for (const width of [1440, 390]) test(`Risk profile search and repeated jumps at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 780 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(page, 'Analysis view', 'risk');
  const risk = page.getByRole('region', { name: 'Source risk assessments', exact: true });
  const profileMenu = atlasSelect(page, 'Evidence profile');
  const selector = profileMenu.locator(':scope > summary');
  await expect(selector.locator('.atlas-select-choice-title')).toHaveText('Find an evidence profile');
  await expect(selector.locator('.atlas-select-count')).toHaveText('3');
  await expect(risk.locator('article[data-risk-id]')).toHaveCount(3);
  await selector.click();
  const search = profileMenu.getByRole('searchbox', { name: 'Search evidence profile', exact: true });
  await search.fill('Cereulide');
  await expect(profileMenu.getByRole('option')).toHaveCount(1);
  await search.press('ArrowDown');
  await profileMenu.getByRole('option', { name: 'Cereulide in infant formula', exact: true }).press('Enter');
  const cereulide = risk.getByRole('heading', { name: 'Cereulide in infant formula', exact: true });
  await expect(cereulide).toBeInViewport();
  await expect(risk.locator('article[data-risk-id]')).toHaveCount(3);
  await risk.getByRole('heading', { name: 'Salmonella in sprouted seeds', exact: true }).scrollIntoViewIfNeeded();
  await selectAtlasOption(page, 'Evidence profile', { label: 'Cereulide in infant formula' });
  await expect(cereulide).toBeInViewport();
  await expect(selector).toBeFocused();
  await selector.click();
  await expect(search).toHaveValue('');
  await expect(profileMenu.getByRole('option')).toHaveCount(3);
  expect((await new AxeBuilder({ page }).include('[aria-label="Source risk assessments"]').analyze()).violations).toEqual([]);
  await profileMenu.getByRole('option', { name: 'Salmonella in sprouted seeds', exact: true }).click();
  await risk.getByRole('article', { name: 'Salmonella in sprouted seeds', exact: true }).getByRole('button', { name: 'View report', exact: true }).click();
  await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toHaveAttribute('open', '');
});

for (const [width, fullscreen] of [[1440, true], [1440, false], [390, false]] as const) test(`Compact risk cards expand to the full source profile at ${width}px, full screen ${fullscreen}`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await expect(atlasSelect(analysis, 'Analysis view')).toContainText('Signals');
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  await expect(analysis.getByRole('button', { name: 'Models', exact: true })).toHaveCount(0);
  const profileSelector = atlasSelect(analysis, 'Evidence profile');
  expect(await profileSelector.evaluate(element => element.parentElement?.classList.contains('atlas-panel-tools'))).toBe(true);
  const cards = analysis.locator('article[data-risk-id]');
  await expect(cards).toHaveCount(data.risk_profiles.length);
  await expect(cards.locator('blockquote, details, a')).toHaveCount(0);
  const cardPositions = await cards.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }));
  let stackedCards = 0;
  for (let index = 1; index < cardPositions.length; index++) {
    const card = cardPositions[index];
    const above = cardPositions.slice(0, index).filter(previous => Math.abs(previous.x - card.x) < 1).at(-1);
    if (above) { expect(card.y - above.y - above.height).toBeCloseTo(12, 0); stackedCards++; }
  }
  expect(stackedCards).toBeGreaterThan(0);
  await analysis.screenshot({ path: `/tmp/atlas-risk-compact-${width}-${fullscreen}.png` });

  for (const profile of data.risk_profiles) {
    await selectAtlasOption(analysis, 'Evidence profile', profile.id);
    const hero = analysis.getByRole('article', { name: profile.label, exact: true });
    await expect(cards).toHaveCount(data.risk_profiles.length);
    await expect(hero).toHaveAttribute('data-ready', 'true');
    await expect(hero.getByRole('heading', { name: profile.label, exact: true })).toBeInViewport();
    await expect(hero).toContainText(profile.authority);
    await expect(hero.locator('.atlas-card-date')).toHaveCount(2);
    await expect(hero.locator('.atlas-card-date').filter({ hasText: 'Published' }).locator('time')).toHaveAttribute('datetime', profile.publication);
    if (profile.assessment_date) await expect(hero.locator('.atlas-card-date').filter({ hasText: 'Assessment' }).locator('time')).toHaveAttribute('datetime', profile.assessment_date);
    await expect(hero.getByRole('group', { name: 'Illness probability', exact: true })).toHaveCount(0);
    const finding = hero.getByRole('group', { name: profile.dimensions[0].label, exact: true });
    await expect(finding).toContainText(profile.dimensions[0].summary);
    await expect(hero.getByText(profile.dimensions[0].summary, { exact: true })).toHaveCount(1);
    for (const dimension of profile.dimensions) {
      await expect(hero.getByRole('heading', { name: dimension.label, exact: true })).toBeVisible();
      await expect(hero.getByText(dimension.summary, { exact: true })).toHaveCount(1);
    }
    const sourceBox = (await hero.getByRole('group', { name: 'Source assessment', exact: true }).boundingBox())!;
    const findingBox = (await finding.boundingBox())!;
    expect(findingBox.y).toBeCloseTo(sourceBox.y, 0);
    await hero.getByRole('button', { name: /View details/ }).click();
    await expect(hero).toHaveAttribute('data-expanded', 'true');
    await expect(analysis.locator('article[data-risk-id]:visible')).toHaveCount(1);
    await expect(hero.getByRole('button', { name: 'Back to risks', exact: true })).toBeFocused();
    const body = hero.getByRole('region', { name: 'Risk profile details', exact: true });
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBe(0);
    const bodyBox = (await body.boundingBox())!;
    const panelBox = (await analysis.boundingBox())!;
    expect(bodyBox.width).toBeGreaterThan(panelBox.width * .85);
    expect(bodyBox.height).toBeGreaterThan(200);
    expect(bodyBox.y + bodyBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
    for (const assessment of profile.assessments) {
      await expect(hero.getByText(assessment.rating, { exact: true }).first()).toBeVisible();
      await expect(hero.getByText(assessment.population, { exact: true }).first()).toBeVisible();
    }
    for (const dimension of profile.dimensions) {
      await expect(hero.getByRole('heading', { name: dimension.label, exact: true })).toBeVisible();
      await expect(hero.getByText(dimension.summary, { exact: true })).toBeVisible();
    }
    for (const unknown of profile.unknowns) await expect(hero.getByText(unknown, { exact: true })).toBeVisible();
    for (const source of data.sources.filter(source => profile.source_ids.includes(source.id))) await expect(hero.locator(`a[href=${JSON.stringify(source.url)}]`).first()).toBeVisible();
    const method = data.methods.find(method => method.id === profile.method_id)!;
    await hero.locator('summary').filter({ hasText: method.label }).click();
    await expect(hero.getByText(method.description, { exact: true })).toBeVisible();
    for (const summary of await hero.locator('summary').filter({ hasText: 'Source quotations' }).all()) await summary.click();
    const assertionIds = new Set([...profile.assessments.flatMap(item => item.assertion_ids), ...profile.dimensions.flatMap(item => item.assertion_ids)]);
    for (const evidence of profile.evidence.filter(item => assertionIds.has(item.assertion_id))) await expect(hero.getByText(evidence.text, { exact: true }).first()).toBeVisible();
    expect(await hero.evaluate(element => {
      const box = element.getBoundingClientRect();
      const pane = element.closest('.atlas-workspace-scroll')!.getBoundingClientRect();
      return element.scrollWidth <= element.clientWidth && box.left >= pane.left && box.right <= pane.right && parseFloat(getComputedStyle(element).borderRadius) > 0;
    })).toBe(true);
    await body.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
    const extent = await body.evaluate(element => {
      const box = element.getBoundingClientRect();
      return {
        bottom: box.bottom,
        contentBottom: Math.max(...Array.from(element.children, child => child.getBoundingClientRect().bottom)),
        remaining: element.scrollHeight - element.clientHeight - element.scrollTop,
      };
    });
    expect(Math.abs(extent.remaining)).toBeLessThanOrEqual(1);
    expect(extent.contentBottom).toBeLessThanOrEqual(extent.bottom);
    const footer = (await hero.locator('.atlas-card-footer').boundingBox())!;
    expect(extent.bottom).toBeLessThanOrEqual(footer.y);
    expect((await new AxeBuilder({ page }).include('[aria-label="Source risk assessments"]').analyze()).violations).toEqual([]);
    await hero.getByRole('button', { name: 'Back to risks', exact: true }).click();
    await expect(analysis.locator('article[data-risk-id]:visible')).toHaveCount(data.risk_profiles.length);
    await expect(hero.getByRole('button', { name: /View details/ })).toBeFocused();
    await expect(cards.locator('blockquote, details, a')).toHaveCount(0);
  }
  const first = cards.first();
  await first.getByRole('button', { name: /View details/ }).click();
  await expect.poll(() => first.getByRole('region', { name: 'Risk profile details', exact: true }).evaluate(element => element.scrollTop)).toBe(0);
  await analysis.screenshot({ path: `/tmp/atlas-risk-expanded-${width}-${fullscreen}.png` });
  await page.keyboard.press('Escape');
  await expect(first).not.toHaveAttribute('data-expanded');
  if (fullscreen) await expect(page.getByRole('dialog', { name: 'ATLAS full screen', exact: true })).toBeVisible();
  await first.getByRole('button', { name: /View details/ }).click();
  await selectAtlasOption(analysis, 'Evidence profile', data.risk_profiles.at(-1)!.id);
  await expect(cards.filter({ has: page.getByRole('button', { name: 'Back to risks', exact: true }) })).toHaveCount(0);
  await expect(analysis.getByRole('heading', { name: data.risk_profiles.at(-1)!.label, exact: true })).toBeInViewport();
  if (width === 1440 && !fullscreen) {
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => cards.evaluateAll(elements => new Set(elements.map(element => Math.round(element.getBoundingClientRect().x))).size)).toBe(1);
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => cards.evaluateAll(elements => new Set(elements.map(element => Math.round(element.getBoundingClientRect().x))).size)).toBe(2);
  }
  expect(errors).toEqual([]);
});

for (const [width, fullscreen] of [[390, false], [1440, false], [1440, true]] as const) test(`Risk card transitions retain scroll clipping at ${width}px, full screen ${fullscreen}`, async ({ page }, testInfo) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  const hero = analysis.getByRole('article', { name: 'Salmonella in sprouted seeds', exact: true });
  for (const expanded of [true, false]) {
    if (expanded) await hero.scrollIntoViewIfNeeded();
    else {
      await hero.locator('.atlas-card-body').evaluate(element => { element.scrollTop = 120; });
      expect(await hero.locator('.atlas-card-body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    }
    const before = (await hero.boundingBox())!;
    const pause = await page.addStyleTag({ content: 'html[data-atlas-risk-transition]::view-transition-group(*), html[data-atlas-risk-transition]::view-transition-old(*), html[data-atlas-risk-transition]::view-transition-new(*) { animation-play-state: paused !important; animation-delay: -.15s !important; }' });
    await hero.evaluate((element, expanded) => {
      if (expanded) {
        let viewport = element.parentElement;
        while (viewport && !(viewport.scrollHeight > viewport.clientHeight && /auto|scroll/.test(getComputedStyle(viewport).overflowY))) viewport = viewport.parentElement;
        const scroller = viewport ?? document.scrollingElement!;
        scroller.scrollTop += element.getBoundingClientRect().top - (viewport?.getBoundingClientRect().top ?? 0) + 120;
      }
      element.querySelector<HTMLButtonElement>(expanded ? '[data-risk-expand]' : '[data-risk-back]')!.click();
    }, expanded);
    await expect(page.locator('html')).toHaveAttribute('data-atlas-risk-transition', expanded ? 'expand' : 'collapse');
    await expect(hero).toHaveCSS('view-transition-name', 'atlas-risk-card');
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').length)).toBeGreaterThanOrEqual(5);
    const visibleTop = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement, '::view-transition-group(atlas-risk-card)');
      const inset = Number(style.clipPath.match(/inset\(([-\d.]+)px/)![1]);
      return new DOMMatrix(style.transform).m42 + inset;
    });
    const tools = (await page.locator('.atlas-analysis > header').boundingBox())!;
    expect(visibleTop).toBeGreaterThanOrEqual(tools.y + tools.height - 1);
    const after = (await hero.boundingBox())!;
    const middle = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement, '::view-transition-group(atlas-risk-card)').width));
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
    if (expanded) expect(clips.some(frames => frames.some(frame => frame !== 'inset(0px)'))).toBe(true);
    const body = hero.locator('.atlas-card-body');
    await expect(body.locator('[style*="view-transition-name"]')).toHaveCount(0);
    if (expanded) {
      const height = await body.evaluate(element => element.clientHeight);
      expect(await body.evaluate(element => element.scrollHeight)).toBeGreaterThan(height);
      await expect(body).toHaveCSS('overflow-y', 'auto');
    }
    expect(await analysis.evaluate(element => element.getAnimations().some(animation => animation.id === 'atlas-content-change'))).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`risk-${expanded ? 'expanding' : 'collapsing'}.png`) });
    await page.evaluate(() => document.getAnimations().filter(animation => animation.id === 'atlas-card-clip').forEach(animation => animation.finish()));
    await pause.evaluate(element => element.parentNode?.removeChild(element));
    await expect(page.locator('html')).not.toHaveAttribute('data-atlas-risk-transition');
    await expect(analysis.locator('[style*="view-transition-name"]')).toHaveCount(0);
    await expect(hero.getByRole('button', { name: expanded ? 'Back to risks' : /View details/ })).toBeFocused();
  }
});

for (const width of [1440, 390]) test(`Merged Intelligence navigation and evidence at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 780 });
  await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  expect(await tabs.getByRole('tab').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(['Trends', 'Analysis', 'Journeys', 'One Health', 'Reports']);
  const toolbar = page.locator('.atlas-toolbar');
  await toolbar.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 180));
  await expect.poll(async () => (await toolbar.boundingBox())!.y).toBeCloseTo(0, 0);
  await expect(toolbar).toHaveCSS('border-bottom-width', '1px');
  await page.screenshot({ path: `/tmp/atlas-sticky-menu-${width}.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (width > 1180) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
    await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  }
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await expect(atlasSelect(analysis, 'Analysis view').locator(':scope > summary')).toContainText('Signals');
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'signals');
  const aboutAnalysis = page.locator('.atlas-workspace-footer').getByRole('button', { name: 'About Analysis', exact: true });
  await expect(aboutAnalysis).toBeVisible();
  const footerBounds = (await page.locator('.atlas-workspace-footer').boundingBox())!;
  const aboutBounds = (await aboutAnalysis.boundingBox())!;
  expect(aboutBounds.x + aboutBounds.width).toBeGreaterThan(footerBounds.x + footerBounds.width - 24);
  await aboutAnalysis.click();
  const analysisMethods = page.getByRole('dialog', { name: 'About Analysis', exact: true });
  await expect(analysisMethods).toBeVisible();
  await expect(analysisMethods.locator('.atlas-references > li')).toHaveCount(5);
  await expect(analysisMethods).toContainText('Preprint; not peer reviewed.');
  await expect(analysisMethods).toContainText('does not measure performance with data available in real time');
  await expect(analysisMethods).toContainText('do not correct for underreporting or collection bias');
  await expect(analysisMethods.getByRole('heading', { name: 'Study scope', exact: true })).toBeVisible();
  await expect(analysisMethods.getByRole('heading', { name: 'Combined prediction', exact: true })).toBeVisible();
  await expect(analysisMethods).toContainText('No weights are fitted to held-out outcomes.');
  await expect(analysisMethods.getByRole('link', { name: 'Ray et al. (2023, §2.6)', exact: true })).toHaveAttribute('href', 'https://doi.org/10.1016/j.ijforecast.2022.06.005');
  await expect(analysisMethods).toContainText('Their weighted sum is divided by 3.5.');
  await expect(analysisMethods).toContainText('Testing, ascertainment, reporting completeness and delays have not been quantified.');
  await analysisMethods.screenshot({ path: `/tmp/atlas-about-analysis-${width}.png` });
  await analysisMethods.locator('summary').filter({ hasText: 'Series eligibility' }).click();
  await expect(analysisMethods).toContainText('Cumulative totals cannot supply weekly incident counts.');
  await analysisMethods.locator('summary').filter({ hasText: 'Export provenance' }).click();
  await expect(analysisMethods).toContainText('Sidecar SHA-256');
  await analysisMethods.locator('summary').filter({ hasText: 'Export provenance' }).click();
  await analysisMethods.locator('summary').filter({ hasText: 'Series eligibility' }).click();
  expect(await analysisMethods.locator('.atlas-references a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual([
    'https://doi.org/10.1016/j.ijforecast.2022.06.005',
    'https://doi.org/10.64898/2026.03.18.26348748',
    'https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html',
    'https://doi.org/10.1371/journal.pcbi.1008618',
    'https://stacks.cdc.gov/view/cdc/164155',
  ]);
  await page.keyboard.press('Escape');
  await expect(aboutAnalysis).toBeFocused();
  await expect(analysis.getByRole('alert')).toHaveCount(0);
  await expect(analysis.locator('details:not(.atlas-select, .atlas-entry-filters)')).toHaveCount(0);
  await expect(analysis.getByRole('region', { name: 'Country connections', exact: true, includeHidden: true })).toHaveCount(0);
  const analysisHeader = analysis.locator('header').first();
  const topControls = await analysisHeader.locator('select, summary[aria-label="Monitored series"]').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
  expect(topControls).toHaveLength(1);
  await expect(analysis.getByRole('combobox', { name: 'Signal type', exact: true })).toHaveCount(0);
  await analysisHeader.screenshot({ path: `/tmp/atlas-analysis-controls-${width}.png` });
  await selectAtlasOption(analysis, 'Monitored series', { index: 1 });
  await expect(analysis.getByRole('button', { name: 'Evaluate models', exact: true })).toHaveCount(0);
  await expect(analysis.getByRole('button', { name: 'View supporting reports', exact: true })).toHaveCount(0);
  const checkColumns = analysis.getByRole('region', { name: 'Model prediction', exact: true }).locator('svg [role="button"][data-entry-id]');
  const checkRows = analysis.getByRole('region', { name: 'Observation details', exact: true }).locator('.atlas-observation-item');
  const lastId = await checkColumns.last().getAttribute('data-entry-id');
  const lastRow = checkRows.and(analysis.locator(`[data-entry-id="${lastId}"]`));
  await checkColumns.last().locator('rect').hover();
  await expect(lastRow).toHaveAttribute('data-highlighted', 'true');
  await expect.poll(() => lastRow.evaluate(row => {
    const container = row.closest('[aria-label="Observation details"]')!;
    const bounds = container.getBoundingClientRect();
    const entry = row.getBoundingClientRect();
    return entry.top >= bounds.top && entry.bottom <= bounds.bottom + 1;
  })).toBe(true);
  await checkRows.first().hover();
  await expect(checkColumns.first()).toHaveAttribute('data-selected', 'true');
  await checkColumns.last().focus();
  await expect(lastRow).toHaveAttribute('data-highlighted', 'true');
  await analysis.screenshot({ path: `/tmp/atlas-count-hover-${width}.png` });
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
  await checkColumns.last().press('Enter');
  await expect(tabs.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await expect(analysis.locator('details:not(.atlas-select, .atlas-entry-filters)')).toHaveCount(0);
  await aboutAnalysis.click();
  await expect(analysisMethods.locator('h4')).toHaveText('Nigeria Lassa fever · Confirmed cases · weekly reports');
  await page.keyboard.press('Escape');
  expect(await selectedAtlasValue(analysis, 'Monitored series')).toBe('ncdc-lassa-2026-interval-1');
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  await atlasSelect(analysis, 'Model').locator('summary').click();
  await expect(atlasSelect(analysis, 'Model').getByRole('option').first()).toHaveText('Median ensemble');
  await atlasSelect(analysis, 'Model').press('Escape');
  await selectAtlasOption(analysis, 'Model', 'gamma_poisson');
  await selectAtlasOption(analysis, 'Horizon', '2');
  await expect(analysis).not.toContainText('Retrospective evaluation');
  const predictionPanel = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const statsBounds = (await predictionPanel.locator(':scope > [class*="figureSummary"] dl').boundingBox())!;
  const chartBounds = (await predictionPanel.locator('figure').boundingBox())!;
  expect(statsBounds.y).toBeGreaterThanOrEqual(chartBounds.y + chartBounds.height);
  const predictionHelp = predictionPanel.getByRole('button', { name: /^Prediction details for/ });
  const helpBounds = (await predictionHelp.boundingBox())!;
  const predictionBounds = (await predictionPanel.boundingBox())!;
  const predictionPadding = await predictionPanel.locator(':scope > [class*="figureSummary"]').evaluate(element => parseFloat(getComputedStyle(element).paddingRight));
  expect(Math.abs(predictionBounds.x + predictionBounds.width - helpBounds.x - helpBounds.width - predictionPadding)).toBeLessThan(2);
  await predictionHelp.click();
  const predictionDetails = page.getByRole('dialog', { name: /^Prediction details for/ });
  await expect(predictionDetails).toContainText('Available in ATLAS at origin');
  await expect(predictionDetails.locator('dl')).toContainText('No');
  await expect(predictionDetails).toContainText('Central prediction intervals');
  await expect(predictionDetails).toContainText('The values list identifies each training observation and the held-out target');
  await predictionDetails.locator('summary', { hasText: 'Gamma–Poisson local level' }).click();
  await expect(predictionDetails).toContainText('Jeffreys prior');
  await page.keyboard.press('Escape');
  await expect(predictionHelp).toBeFocused();
  const checkHelp = analysis.getByRole('button', { name: /^Count check details for/ });
  await checkHelp.click();
  const checkDetails = page.getByRole('dialog', { name: /^Count check details for/ });
  await expect(checkDetails).toContainText('one-week 95th predictive quantile');
  await page.keyboard.press('Escape');
  await expect(checkHelp).toBeFocused();
  await predictionPanel.screenshot({ path: `/tmp/atlas-prediction-summary-${width}.png` });
  await expect(analysis.getByRole('group', { name: 'Model comparisons', exact: true }).getByRole('article')).toHaveCount(4);
  await selectAtlasOption(analysis, 'Evaluation', 'extrapolation');
  await expect(predictionPanel.locator('svg[aria-label^="Reported counts"]')).toHaveAttribute('aria-label', /prediction for 20 Sept? 2026/);
  await expect(predictionPanel.locator(':scope > [class*="figureSummary"] dl')).toContainText('Not evaluated');
  await page.screenshot({ path: `/tmp/atlas-merged-analysis-${width}.png`, fullPage: width === 390 });
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
  await expect(analysis.getByRole('button', { name: 'Reported observations', exact: true })).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: 'Trends', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-briefing')).toBeVisible();
  await expect(analysis).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyze this series', exact: true })).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();

  expect(await selectedAtlasValue(analysis, 'Monitored series')).toBe('ncdc-lassa-2026-interval-1');
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await expect(analysis.getByRole('region', { name: 'Signal overview' })).toHaveCount(0);
  await expect(analysis.getByRole('group', { name: 'Signals views', exact: true })).toHaveCount(0);
  await expect(analysis.getByRole('region', { name: 'First country connections', exact: true })).toHaveCount(0);
  await selectAtlasOption(analysis, 'Analysis view', 'spatial');
  await expect(page.locator('.atlas-connection').first()).toBeVisible();

  await tabs.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Report content' })).toHaveCount(0);
  await expect(page.locator('.atlas-timeline-next')).toBeVisible();
  await page.getByRole('button', { name: 'Source coverage', exact: true }).click();
  const coverage = page.getByRole('dialog', { name: 'Source coverage', exact: true });
  await expect(coverage.locator('.atlas-source-network')).toBeVisible();
  await expect(coverage.locator('.atlas-coverage-filters').getByRole('heading', { name: 'Topics', exact: true })).toBeVisible();
  await expect(coverage.getByRole('button', { name: 'Next topic page', exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/atlas-merged-sources-${width}.png`, fullPage: width === 390 });
  await coverage.getByRole('button', { name: 'Close Source coverage', exact: true }).click();
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(analysis, 'Analysis view', 'relationships');
  await expect(page.locator('.atlas-connection').first()).toBeVisible();
  await expect(page.locator('.atlas-report-tools')).toHaveCount(0);
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  const risk = page.getByRole('region', { name: 'Source risk assessments', exact: true }).getByRole('article', { name: 'Salmonella in sprouted seeds', exact: true });
  await expect(risk).toContainText('People in EU/EEA countries who frequently consume sprouted seeds');
  await expect(risk.getByRole('group', { name: 'Hazard and exposure', exact: true })).toContainText('The investigation links Salmonella Bovismorbificans ST377 to sprouted seeds');
  await risk.getByRole('button', { name: 'One Health', exact: true }).click();
  const health = page.getByRole('region', { name: 'One Health evidence', exact: true });
  await expect(health).toContainText('Interviewed cases reporting sprout consumption');
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.atlas-workspace-scroll')?.scrollTo(0, 0); });
  const controlBottom = await health.locator('.atlas-oh-tools').evaluate(el => el.getBoundingClientRect().bottom);
  const networkTop = await health.locator('.atlas-oh-layout').evaluate(el => el.getBoundingClientRect().top);
  expect(networkTop - controlBottom).toBeCloseTo(20, 0);
  const diagramLeft = await health.locator('.atlas-oh-network').evaluate(el => el.getBoundingClientRect().left);
  const laneLeft = await health.locator('.atlas-oh-lane').first().evaluate(el => el.getBoundingClientRect().left);
  expect(laneLeft).toBeCloseTo(diagramLeft, 0);
  const viewBounds = await health.locator('summary[aria-label="One Health view"]').boundingBox();
  const reportBounds = await health.locator('summary[aria-label="One Health report"]').boundingBox();
  expect(viewBounds).not.toBeNull();
  expect(reportBounds).not.toBeNull();
  const filterBounds = await health.locator('.atlas-entry-filters > summary').boundingBox();
  expect(reportBounds!.x).toBeGreaterThan(viewBounds!.x);
  expect(reportBounds!.x + reportBounds!.width).toBeLessThan(filterBounds!.x);
  expect(Math.abs(viewBounds!.y + viewBounds!.height / 2 - reportBounds!.y - reportBounds!.height / 2)).toBeLessThan(2);
  await page.screenshot({ path: `/tmp/atlas-one-health-toolbar-${width}.png`, fullPage: width === 390 });
  await health.locator('.atlas-oh-tools').screenshot({ path: `/tmp/atlas-one-health-controls-${width}.png` });
  await expect(health.getByRole('button', { name: 'Source risk assessment', exact: true })).toHaveCount(0);
  await expect(health.locator('.atlas-oh-tools .atlas-scope-trigger')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'About Analysis', exact: true })).toHaveCount(0);
  const aboutHealth = page.locator('.atlas-workspace-footer').getByRole('button', { name: 'About One Health', exact: true });
  await aboutHealth.click();
  const methodsDialog = page.getByRole('dialog', { name: 'About One Health', exact: true });
  await expect(methodsDialog).toBeVisible();
  await methodsDialog.press('Escape');
  await expect(aboutHealth).toBeFocused();
  await page.locator('.atlas-workspace-footer').screenshot({ path: `/tmp/atlas-one-health-footer-${width}.png` });
  await expect(health.locator('.atlas-oh-figure > header')).toHaveCount(0);
  const reviewHelp = health.getByRole('button', { name: /^Review scope for/ });
  await expect(health.locator('.atlas-oh-list-title').getByRole('button', { name: /^Review scope for/ })).toBeVisible();
  await expect(health.locator('.atlas-oh-key .atlas-scope-trigger')).toHaveCount(0);
  const listTitleBounds = (await health.locator('.atlas-oh-list-title').boundingBox())!;
  const reviewHelpBounds = (await reviewHelp.boundingBox())!;
  expect(Math.abs(reviewHelpBounds.x + reviewHelpBounds.width - listTitleBounds.x - listTitleBounds.width)).toBeLessThan(2);
  await reviewHelp.click();
  await expect(health.getByRole('dialog', { name: /^Review scope for/ })).toBeVisible();
  await health.getByRole('button', { name: 'Close review scope', exact: true }).click();
  await health.locator('.atlas-oh-figure').screenshot({ path: `/tmp/atlas-one-health-network-help-${width}.png` });
  await health.locator('summary[aria-label="One Health view"]').click();
  await health.getByRole('option', { name: 'Evidence', exact: true }).click();
  await expect(health.locator('thead th').first().getByRole('button', { name: /^Review scope for/ })).toBeVisible();
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.atlas-workspace-scroll')?.scrollTo(0, 0); });
  expect(await health.locator('.atlas-oh-layout').evaluate(el => el.getBoundingClientRect().top - el.parentElement!.querySelector('.atlas-oh-tools')!.getBoundingClientRect().bottom)).toBeCloseTo(20, 0);
  await expect(health).not.toContainText('Marked cells identify evidence types');
  await expect(health.locator('.atlas-oh-relationship-badges').first()).toContainText('Source reported');
  await reviewHelp.click();
  await expect(health.getByRole('dialog', { name: /^Review scope for/ })).toBeVisible();
  await health.getByRole('button', { name: 'Close review scope', exact: true }).click();
  const evidenceRows = health.locator('.atlas-oh-matrix tbody tr');
  await evidenceRows.nth(1).locator('th > button').press('Enter');
  await expect(evidenceRows.nth(1)).toHaveAttribute('data-selected', 'true');
  await evidenceRows.first().locator('td').filter({ hasText: '—' }).first().click();
  await expect(evidenceRows.first()).toHaveAttribute('data-selected', 'true');
  await expect(evidenceRows.nth(1)).toHaveAttribute('data-selected', 'false');
  await evidenceRows.nth(1).hover();
  await expect(evidenceRows.nth(1)).toHaveCSS('cursor', /pointer/);
  await health.locator('.atlas-oh-figure').screenshot({ path: `/tmp/atlas-one-health-evidence-hover-${width}.png` });
  await health.locator('.atlas-oh-figure').screenshot({ path: `/tmp/atlas-one-health-evidence-help-${width}.png` });
  await health.locator('summary[aria-label="One Health view"]').click();
  await health.getByRole('option', { name: 'Network', exact: true }).click();
  await health.getByRole('button', { name: 'View reports', exact: true }).click();
  const report = page.locator('.atlas-report[data-evidence="true"]').first();
  await expect(report).toHaveAttribute('open', '');
  await report.getByRole('button', { name: 'Source risk assessment', exact: true }).click();
  await expect(risk).toContainText('People in EU/EEA countries who frequently consume sprouted seeds');
  await risk.getByRole('button', { name: 'View report', exact: true }).click();
  await report.locator('.atlas-report-assessment-links summary').first().click();
  const relationship = report.locator('.atlas-report-assessment-links details button').last();
  const relationshipId = await relationship.getAttribute('data-assessment-id');
  await page.screenshot({ path: `/tmp/atlas-report-assessments-${width}.png`, fullPage: width === 390 });
  await relationship.click();
  const selectedAssessment = page.locator('.atlas-connection[data-assessment-id][data-selected="true"]');
  await expect(selectedAssessment).toBeVisible();
  await expect(selectedAssessment).toHaveAttribute('data-assessment-id', relationshipId!);
  await expect(selectedAssessment.locator('header')).toBeFocused();
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  await risk.getByRole('button', { name: 'One Health', exact: true }).click();
  await health.locator('summary[aria-label="One Health view"]').click();
  await expect(health.getByRole('option', { name: /^Environment/ })).toHaveCount(0);
  await health.getByRole('option', { name: /^Timeline/ }).click();
  const layers = health.getByRole('group', { name: 'Timeline layers' });
  await expect(layers.getByRole('switch')).toHaveCount(3);
  await layers.getByRole('switch', { name: 'Observations', exact: true }).click();
  await expect(layers.getByRole('switch', { name: 'Observations', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.screenshot({ path: `/tmp/atlas-merged-timeline-${width}.png`, fullPage: width === 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  if (width === 1440) {
    await page.goto('/atlas/');
    await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toBeVisible({ timeout: 120000 });
    await expect(page.getByRole('tab', { name: 'Source coverage', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Report content', exact: true })).toHaveCount(0);
  }
});

test('Floating pages stay clear of the mobile dock', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width: 390, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  const toolbar = page.locator('.atlas-toolbar');
  const control = page.locator('.atlas-pagination[data-floating]');
  await tabs.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(control).toBeHidden();
  const contentWidth = (await page.locator('.atlas-workspace-scroll').boundingBox())!.width;
  await toolbar.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 100));
  for (const name of ['Reports', 'Relationships']) {
    await tabs.getByRole('tab', { name: name === 'Reports' ? 'Reports' : 'Analysis', exact: true }).click();
    if (name === 'Relationships') await selectAtlasOption(page, 'Analysis view', 'relationships');
    await toolbar.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 100));
    await expect(control).toHaveCount(1);
    await expect(control).toBeVisible();
    expect((await page.locator('.atlas-workspace-scroll').boundingBox())!.width).toBe(contentWidth);
    await expect(page.locator('.atlas-workspace-scroll')).toHaveCSS('padding-right', '0px');
    await expect(page.locator('.atlas-workspace .atlas-pagination')).toHaveCount(0);
    await control.getByRole('button', { name: /^Next/ }).click();
    await expect(control.locator('summary')).toContainText('2 /');
  }
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(page, 'Analysis view', 'spatial');
  await control.getByRole('button', { name: /^Next/ }).click();
  await expect(control.locator('summary')).toContainText('2 /');
  await tabs.getByRole('tab', { name: 'One Health', exact: true }).click();
  await page.locator('summary[aria-label="One Health view"]').click();
  await page.getByRole('option', { name: 'Overview', exact: true }).click();
  await expect(control).toBeVisible();
  await control.getByRole('button', { name: /^Next/ }).click();
  await expect(control.locator('summary')).toContainText('2 /');
  const dock = await page.locator('.site-dock').boundingBox();
  const bounds = await control.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(dock!.y - 8);
  await control.locator('summary').click();
  const menu = await control.locator('.atlas-select-options').boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.y + menu!.height).toBeLessThan(dock!.y);
  await control.locator('summary').press('Escape');
  await page.screenshot({ path: '/tmp/atlas-floating-pagination-phone.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await toolbar.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 100));
  await expect(control).toBeVisible();
  const desktop = await control.boundingBox();
  const workspace = await page.locator('.atlas-workspace').boundingBox();
  expect(desktop!.x).toBeGreaterThan(workspace!.x + workspace!.width);
  await page.screenshot({ path: '/tmp/atlas-floating-pagination-desktop.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(control).toBeHidden();
});


test('Network source details match the full left column without sticky drift', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const network = page.locator('.atlas-oh-layout[data-view="network"]');
  await expect(network).toBeVisible();
  const dimensions = () => network.evaluate(element => {
    const left = element.querySelector('.atlas-oh-main')!.getBoundingClientRect();
    const right = element.querySelector('.atlas-oh-detail')!.getBoundingClientRect();
    return { top: right.top - left.top, height: right.height - left.height };
  });
  expect(await dimensions()).toEqual({ top: 0, height: 0 });
  await network.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 120));
  expect(await dimensions()).toEqual({ top: 0, height: 0 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  expect(await dimensions()).toEqual({ top: 0, height: 0 });
  const details = network.locator('.atlas-oh-detail');
  await details.evaluate(element => element.scrollTop = element.scrollHeight);
  expect(await details.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await dimensions()).toEqual({ top: 0, height: 0 });
  await expect(page.locator('.atlas-workspace-scroll')).toHaveJSProperty('scrollTop', 0);
  await page.screenshot({ path: '/tmp/atlas-one-health-matched-columns.png' });
});

test('One Health Overview keeps compact controls and sortable single-line headings', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click({ timeout: 120000 });
  await page.locator('summary[aria-label="One Health view"]').click();
  await page.getByRole('option', { name: 'Overview', exact: true }).click();
  const toolbar = page.locator('.atlas-oh-tools');
  const overview = page.locator('.atlas-oh-overview');
  const search = toolbar.getByRole('searchbox');
  const reset = toolbar.getByRole('button', { name: 'Reset sort', exact: true });
  await expect(reset).toHaveCSS('border-top-width', '0px');
  await expect(reset).toHaveCSS('border-radius', '50%');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const positions = await toolbar.locator('.atlas-oh-view-select > details > summary, input[type="search"], .atlas-oh-sort-reset, .atlas-entry-filters > summary').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return rect.y + rect.height / 2;
    }));
    expect(positions).toHaveLength(4);
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(2);
    await expect(toolbar.getByText(/^\d+ entries$/)).toHaveCount(0);
    const headings = await overview.locator('thead th').evaluateAll(elements => elements.map(element => {
      const button = element.querySelector('button')!;
      const label = button.querySelector('span')!.getBoundingClientRect();
      const icon = button.querySelector('svg')!.getBoundingClientRect();
      return { height: label.height, lineHeight: parseFloat(getComputedStyle(button).lineHeight), fits: element.scrollWidth <= element.clientWidth, aligned: Math.abs(label.y + label.height / 2 - icon.y - icon.height / 2) < 2 };
    }));
    await toolbar.screenshot({ path: `/tmp/atlas-overview-controls-${width}.png` });
    await overview.locator('thead').screenshot({ path: `/tmp/atlas-overview-headings-${width}.png` });
    expect(headings.every(heading => heading.height <= heading.lineHeight + 1 && heading.fits && heading.aligned)).toBe(true);
  }
  const reportHeading = overview.getByRole('columnheader').first();
  await reportHeading.getByRole('button', { name: 'Report entry & review', exact: true }).click();
  await expect(reportHeading).toHaveAttribute('aria-sort', 'ascending');
  await reset.click();
  await expect(overview.getByRole('columnheader').nth(1)).toHaveAttribute('aria-sort', 'descending');
  await expect(reset).toBeDisabled();
  await search.fill('Salmonella');
  await expect(overview.locator('tbody tr').first()).toContainText(/Salmonella/i);
  await search.clear();
  await reportHeading.getByRole('button', { name: 'Overview ordering and scope for Evidence coverage' }).click();
  await expect(page.getByRole('dialog', { name: 'Overview ordering and scope for Evidence coverage' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await expect(toolbar.getByRole('searchbox')).toBeVisible();
  await expect(overview.locator('tbody tr').first()).toBeVisible();
  await page.screenshot({ path: '/tmp/atlas-overview-fullscreen.png' });
});

test('Evidence views share the same gap below the main menu', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  const checkGap = async (selector: string) => {
    const top = page.locator(selector).first();
    await expect(top).toBeVisible();
    await expect.poll(() => top.evaluate(element => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelector('.atlas-workspace-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
      const menu = document.querySelector('.atlas-toolbar')!.getBoundingClientRect();
      return element.getBoundingClientRect().top - menu.bottom;
    })).toBeCloseTo(16, 0);
  };
  for (const mode of ['page', 'fullscreen', 'phone']) {
    if (mode === 'fullscreen') await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
    if (mode === 'phone') {
      await page.getByRole('button', { name: 'Exit full screen' }).press('Enter');
      await page.setViewportSize({ width: 390, height: 844 });
    }
    for (const [tab, selector] of [
      ['Trends', '.atlas-trend-activity > header'],
      ['Analysis', '[aria-label="Experimental analysis"] > header'],
      ['One Health', '.atlas-oh-tools'],
      ['Reports', '.atlas-report-tools'],
      ['Journeys', '.atlas-geographic-journeys, .atlas-connection .atlas-entry-heading'],
    ]) {
      await tabs.getByRole('tab', { name: tab, exact: true }).click();
      await checkGap(selector);
      if (tab === 'Analysis') {
        for (const name of ['relationships', 'spatial']) {
          await selectAtlasOption(page, 'Analysis view', name);
          await checkGap(selector);
        }
      }
    }
    await page.screenshot({ path: `/tmp/atlas-menu-spacing-${mode}.png` });
  }
});

test('Analysis, One Health and Reports keep their control row below the tab menu', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  for (const mode of ['page', 'fullscreen', 'phone']) {
    if (mode === 'fullscreen') {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
    }
    if (mode === 'phone') {
      await page.getByRole('button', { name: 'Exit full screen' }).press('Enter');
      await page.setViewportSize({ width: 390, height: 844 });
    }
    for (const name of ['Analysis', 'One Health', 'Reports']) {
      await tabs.getByRole('tab', { name, exact: true }).click();
      if (name === 'Analysis') await selectAtlasOption(page, 'Analysis view', 'signals');
      const controls = page.locator('.atlas-panel-tools');
      await expect(controls).toBeVisible();
      await page.evaluate(fullscreen => {
        if (fullscreen) document.querySelector('.atlas-workspace-scroll')!.scrollTop = 180;
        else {
          const controls = document.querySelector('.atlas-panel-tools')!.getBoundingClientRect();
          const menu = document.querySelector('.atlas-toolbar')!.getBoundingClientRect();
          window.scrollTo(0, window.scrollY + controls.top - menu.height - 16 + 180);
        }
      }, mode === 'fullscreen');
      const menu = (await page.locator('.atlas-toolbar').boundingBox())!;
      const row = (await controls.boundingBox())!;
      expect(row.y - menu.y - menu.height).toBeCloseTo(16, 0);
      expect(await controls.evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      await page.screenshot({ path: `/tmp/atlas-sticky-controls-${name.replace(' ', '-').toLowerCase()}-${mode}.png` });
      if (name === 'Reports' && mode !== 'fullscreen') {
        const report = page.locator('.atlas-report').first();
        if (!(await report.evaluate(element => element.hasAttribute('open')))) await report.locator(':scope > summary').click();
        await expect(report).toHaveAttribute('open', '');
        const summaryTop = await report.locator(':scope > summary').evaluate(element => parseFloat(getComputedStyle(element).top));
        expect(summaryTop).toBeCloseTo(row.y + row.height + 8, 0);
      }
    }
  }
});

test('Model evaluation fits the workspace and links model cards to the prediction', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await expect(atlasSelect(analysis, 'Analysis view').locator(':scope > summary')).toContainText('Signals');
  const header = analysis.locator('header').first();
  expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await header.screenshot({ path: '/tmp/atlas-analysis-models-toolbar.png' });
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const performance = analysis.getByRole('group', { name: 'Model comparisons', exact: true });
  for (const height of [780, 620]) {
    await page.setViewportSize({ width: 1440, height });
    expect((await prediction.locator('svg').boundingBox())!.height).toBeGreaterThanOrEqual(height <= 700 ? 80 : 150);
    expect(await page.locator('.atlas-workspace-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(analysis.getByRole('region', { name: 'Observation details', exact: true })).toHaveCSS('overflow-y', 'auto');
    expect(await page.locator('.atlas-workspace-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    const tickPositions = await prediction.locator('svg > g > text').evaluateAll(elements => elements.slice(0, 3).map(element => Number(element.getAttribute('y'))));
    expect(Math.abs(tickPositions[1] - tickPositions[0])).toBeGreaterThan(12);
    const beforeScroll = (await prediction.boundingBox())!.y;
    await performance.evaluate(pane => { pane.scrollTop = pane.scrollHeight; });
    expect((await prediction.boundingBox())!.y).toBeCloseTo(beforeScroll, 0);
    await performance.getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).hover();
    await expect(prediction.locator('figcaption')).toContainText('Gamma–Poisson local level');
    expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
    await atlasSelect(analysis, 'Analysis view').locator(':scope > summary').hover();
    await expect(prediction.locator('figcaption')).toContainText('Median ensemble');
    await performance.getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).press('Enter');
    expect(await selectedAtlasValue(analysis, 'Model')).toBe('gamma_poisson');
    await performance.evaluate(pane => { pane.scrollTop = 0; });
    await prediction.getByRole('button', { name: /Gamma–Poisson local level ·/ }).hover();
    const linkedRow = performance.locator('article[data-entry-id="gamma_poisson"]');
    await expect(linkedRow).toHaveAttribute('data-active', 'true');
    expect(await linkedRow.evaluate(row => {
      const container = row.parentElement!.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      return rect.top >= container.top && rect.top + Math.min(rect.height, container.height) <= container.bottom + 1;
    })).toBe(true);
    const points = prediction.locator('svg [role="button"][data-entry-id]');
    const details = analysis.getByRole('region', { name: 'Observation details', exact: true });
    const point = points.first();
    const id = await point.getAttribute('data-entry-id');
    const sourceRow = details.locator(`.atlas-observation-item[data-entry-id="${id}"]`);
    await point.locator("rect").hover();
    await expect(sourceRow).toHaveAttribute('data-highlighted', 'true');
    await expect(point).toHaveAttribute('data-selected', 'true');
    await sourceRow.hover();
    await expect(point).toHaveAttribute('data-selected', 'true');
    await sourceRow.getByRole('button').first().focus();
    await expect(point).toHaveAttribute('data-selected', 'true');
    await points.last().focus();
    const targetId = await points.last().getAttribute('data-entry-id');
    await expect(details.locator(`.atlas-observation-item[data-entry-id="${targetId}"]`)).toHaveAttribute('data-highlighted', 'true');
    expect(await details.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: `/tmp/atlas-evaluation-contained-${height}.png` });
    await selectAtlasOption(analysis, 'Model', 'ensemble_median');
  }
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
});


test('Keyboard observation focus clears a hovered model preview', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  await analysis.getByRole('region', { name: 'Model performance', exact: true }).getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).hover();
  await expect(prediction.locator('figcaption')).toContainText('Gamma–Poisson local level');
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  const observations = analysis.getByRole('region', { name: 'Observation details', exact: true });
  await observations.focus();
  await expect(observations).toBeFocused();
  await expect(analysis.getByRole('region', { name: 'Observation details', exact: true })).toBeVisible();
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  await expect(prediction.locator('figcaption')).toContainText('Median ensemble');
  await analysis.getByRole('region', { name: 'Model performance', exact: true }).getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).hover();
  await expect(prediction.locator('figcaption')).toContainText('Gamma–Poisson local level');
  await selectAtlasOption(analysis, 'Analysis view', 'risk');
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  await expect(prediction.locator('figcaption')).toContainText('Median ensemble');
});

for (const width of [1440, 390]) test(`Prediction highlight stays centered at ${width}px`, async ({ page }, testInfo) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const series = data.forecast_series.find(item => [1, 2].every(horizon => item.backtests.filter(target => target.model_id === 'ensemble_median' && target.horizon_weeks === horizon).length > 1))!;
  expect(series).toBeDefined();
  await page.setViewportSize({ width, height: 780 });
  await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  if (width > 1180) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await selectAtlasOption(analysis, 'Monitored series', series.id);
  await selectAtlasOption(analysis, 'Model', 'ensemble_median');
  await selectAtlasOption(analysis, 'Evaluation', 'backtest');
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const figure = prediction.locator('figure[data-model-active]');
  const svg = figure.locator('svg');
  const band = svg.locator('rect[class*="predictionBand"]');
  const median = svg.locator('circle[class*="predictionPoint"]');
  const intervals = svg.locator('rect[data-level]');
  const legend = figure.getByRole('button', { name: /Median ensemble · 50 \/ 80 \/ 95% intervals/ });
  for (const horizon of [1, 2]) {
    await selectAtlasOption(analysis, 'Horizon', String(horizon));
    const targets = series.backtests.filter(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon).sort((a, b) => a.origin.localeCompare(b.origin));
    for (const target of [targets[0], targets.at(-1)!]) {
      await selectAtlasOption(analysis, 'Historical origin', target.origin);
      await expect(intervals).toHaveCount(target.intervals.length);
      for (const activation of ['legend', 'plot', 'focus']) {
        await atlasSelect(analysis, 'Analysis view').locator(':scope > summary').hover();
        await expect(figure).toHaveAttribute('data-model-active', 'false');
        if (activation === 'legend') await legend.hover();
        else if (activation === 'plot') {
          const hit = svg.locator('rect[fill="transparent"]');
          const hitBounds = (await hit.boundingBox())!;
          const observedBounds = (await svg.locator(`[data-entry-id="${target.target_measure_id}"] rect`).boundingBox())!;
          const top = hitBounds.y + 2;
          const y = top >= observedBounds.y && top <= observedBounds.y + observedBounds.height ? observedBounds.y + observedBounds.height - hitBounds.y + 2 : 2;
          await hit.hover({ position: { x: hitBounds.width / 2, y } });
        }
        else {
          await legend.focus();
          await expect(legend).toBeFocused();
        }
        await expect(figure).toHaveAttribute('data-model-active', 'true');
        await expect.poll(() => band.evaluate(element => Number(getComputedStyle(element).fillOpacity))).toBeGreaterThan(0);
        await expect(band).toHaveCSS('pointer-events', 'none');
        const bandBounds = (await band.boundingBox())!;
        const plotBounds = (await svg.boundingBox())!;
        expect(bandBounds.width).toBeGreaterThan(0);
        expect(bandBounds.x).toBeGreaterThanOrEqual(plotBounds.x);
        expect(bandBounds.x + bandBounds.width).toBeLessThanOrEqual(plotBounds.x + plotBounds.width);
        const bandCenter = bandBounds.x + bandBounds.width / 2;
        for (const mark of [median, ...await intervals.all()]) {
          const bounds = (await mark.boundingBox())!;
          expect(Math.abs(bounds.x + bounds.width / 2 - bandCenter)).toBeLessThanOrEqual(1);
        }
      }
      if (horizon === 2 && target === targets.at(-1)) await figure.screenshot({ path: testInfo.outputPath(`forecast-highlight-${width}.png`) });
      await atlasSelect(analysis, 'Analysis view').locator(':scope > summary').focus();
      const previous = series.observations.filter(item => target.training_measure_ids.includes(item.measure_id)).sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
      const previousPoint = svg.locator(`[role="button"][data-entry-id="${previous.measure_id}"]`);
      await previousPoint.locator('rect').hover();
      await expect(previousPoint).toHaveAttribute('data-selected', 'true');
      await expect(analysis.getByRole('region', { name: 'Observation details', exact: true }).locator(`.atlas-observation-item[data-entry-id="${previous.measure_id}"]`)).toHaveAttribute('data-highlighted', 'true');
    }
  }
});

for (const mode of [
  { name: 'desktop page', width: 1440, height: 900, fullscreen: false },
  { name: 'short fullscreen', width: 1440, height: 620, fullscreen: true },
  { name: 'phone page', width: 390, height: 844, fullscreen: false },
]) test(`Signals views fit the workspace with internal scrolling in ${mode.name}`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.setViewportSize({ width: mode.width, height: mode.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  if (mode.fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const contained = async () => {
    await expect(analysis.locator('details:not(.atlas-select, .atlas-entry-filters)')).toHaveCount(0);
    expect(await analysis.evaluate(element => ({ x: element.scrollWidth - element.clientWidth, y: element.scrollHeight - element.clientHeight }))).toEqual({ x: 0, y: 0 });
    if (mode.width > 600) expect(await analysis.locator('[class*="signalEvaluation"]').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    if (mode.fullscreen) expect(await page.locator('.atlas-workspace-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  };
  await expect(analysis.locator('[class*="evaluationControls"]')).toHaveCSS('border-top-width', '0px');
  for (const label of ['Evaluation', 'Model', 'Horizon', 'Historical origin']) {
    const menu = atlasSelect(analysis, label);
    const trigger = menu.locator(':scope > summary');
    await trigger.focus();
    await trigger.press('Enter');
    await expect(menu.getByRole('option', { selected: true })).toBeFocused();
    const popup = menu.locator('.atlas-select-options');
    const bounds = (await popup.boundingBox())!;
    const region = (await analysis.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(region.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(region.x + region.width);
    expect(await popup.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom - 10));
    })).toBe(true);
    if (label === 'Model') await analysis.screenshot({ path: `/tmp/atlas-model-menu-${mode.width}-${mode.fullscreen}.png` });
    await menu.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(menu).not.toHaveAttribute('open');
  }
  const panel = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const checks = analysis.getByRole('region', { name: 'Count checks', exact: true });
  await expect(checks).toBeVisible();
  await expect(checks.locator('svg')).toHaveCount(1);
  await expect(checks.locator('svg [class*="historyLine"]')).toHaveCount(0);
  await expect(analysis.getByRole('group', { name: 'Signals views', exact: true })).toHaveCount(0);
  const checkSources = analysis.getByRole('region', { name: 'Observation details', exact: true });
  await expect(checkSources).toHaveCSS('overflow-y', 'auto');
  expect((await panel.locator('svg').boundingBox())!.height).toBeGreaterThanOrEqual(mode.fullscreen && mode.height <= 700 ? 80 : 150);
  const predictionBounds = (await panel.boundingBox())!;
  const checksBounds = (await checks.boundingBox())!;
  if (mode.width > 600) {
    expect(checksBounds.y).toBeCloseTo(predictionBounds.y, 0);
    expect(checksBounds.x).toBeGreaterThanOrEqual(predictionBounds.x + predictionBounds.width);
  } else {
    expect(checksBounds.y).toBeGreaterThanOrEqual(predictionBounds.y + predictionBounds.height);
  }
  for (const selector of [':scope > [class*="figureSummary"]', 'figure', 'figure > svg']) {
    const left = (await panel.locator(selector).boundingBox())!;
    const right = (await checks.locator(selector).boundingBox())!;
    expect(left.width).toBeCloseTo(right.width, 0);
    if (selector !== 'figure' || mode.width > 600) expect(left.height).toBeCloseTo(right.height, 0);
    if (mode.width > 600) expect(left.y).toBeCloseTo(right.y, 0);
  }
  expect((await panel.locator(':scope > [class*="figureSummary"]').boundingBox())!.height).toBeLessThan(60);
  for (const figure of [panel, checks]) {
    await expect(figure.locator(':scope > [class*="figureSummary"] > h3')).toHaveCount(0);
    await expect(figure.locator(':scope > h3')).toHaveCount(0);
    const summary = (await figure.locator(':scope > [class*="figureSummary"]').boundingBox())!;
    const plot = (await figure.locator('figure').boundingBox())!;
    expect(summary.y).toBeGreaterThanOrEqual(plot.y + plot.height);
    expect(summary.x + summary.width / 2).toBeCloseTo(plot.x + plot.width / 2, 0);
  }
  const evidencePane = analysis.getByRole('region', { name: 'Observations and sources', exact: true });
  const evidenceBounds = (await evidencePane.boundingBox())!;
  expect(evidenceBounds.height).toBeGreaterThanOrEqual(mode.fullscreen ? 90 : 180);
  if (!mode.fullscreen && mode.width > 600) expect(evidenceBounds.height).toBeGreaterThan((await panel.locator('svg').boundingBox())!.height);
  await analysis.screenshot({ path: `/tmp/atlas-signals-compact-${mode.width}-${mode.fullscreen}.png` });
  const top = (await analysis.boundingBox())!.y;
  await checkSources.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await checkSources.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await checkSources.locator('article').last().evaluate(element => {
    const pane = element.closest('[aria-label="Observation details"]')!.getBoundingClientRect();
    return element.getBoundingClientRect().bottom <= pane.bottom + 1;
  })).toBe(true);
  expect((await analysis.boundingBox())!.y).toBeCloseTo(top, 0);
  await contained();
  await expect(analysis.getByRole('region', { name: 'Observation details', exact: true })).toBeVisible();
  const performance = analysis.getByRole('group', { name: 'Model comparisons', exact: true });
  await expect(performance.getByRole('article')).toHaveCount(4);
  const performancePanel = analysis.getByRole('region', { name: 'Model performance', exact: true });
  const performanceBounds = (await performancePanel.boundingBox())!;
  const observationBounds = (await evidencePane.boundingBox())!;
  if (mode.width > 600) {
    expect(performanceBounds.y).toBeCloseTo(observationBounds.y, 0);
    expect(performanceBounds.x).toBeGreaterThan(observationBounds.x + observationBounds.width);
    expect(performanceBounds.height).toBeCloseTo(observationBounds.height, 0);
  } else expect(performanceBounds.y).toBeGreaterThan(observationBounds.y + observationBounds.height);
  const cardBounds = await performance.getByRole('article').evaluateAll(cards => cards.map(card => {
    const { x, y, width, height } = card.getBoundingClientRect();
    return { x, y, width, height };
  }));
  expect(cardBounds[0].y).toBeCloseTo(cardBounds[1].y, 0);
  expect(cardBounds[2].y).toBeCloseTo(cardBounds[3].y, 0);
  expect(cardBounds[2].y).toBeGreaterThan(cardBounds[0].y);
  await expect(performance).toHaveCSS('scrollbar-width', 'none');
  if (!mode.fullscreen && mode.width > 600) {
    expect(await performance.evaluate(pane => pane.scrollHeight - pane.clientHeight)).toBeLessThanOrEqual(1);
    await expect(analysis.locator('button[aria-label="More models below"]')).toBeHidden();
  }
  expect(await performance.evaluate(pane => pane.scrollWidth - pane.clientWidth)).toBe(0);
  for (const heading of ['Observations', 'Performance']) await expect(analysis.getByRole('heading', { name: heading, exact: true }).locator('svg')).toHaveCount(1);
  const geometry = () => analysis.locator('[class*="signalEvaluation"]').evaluate(grid => {
    const root = grid.getBoundingClientRect();
    return [...grid.querySelectorAll('section[aria-label], figure > svg, figcaption')].map(element => {
      const rect = element.getBoundingClientRect();
      return [rect.x - root.x, rect.y - root.y + grid.scrollTop, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
    });
  });
  const layout = await geometry();
  for (const card of await performance.getByRole('article').all()) {
    const id = await card.getAttribute('data-entry-id');
    await card.hover();
    await expect(panel.locator('figcaption')).toContainText((await card.getAttribute('aria-label'))!);
    expect(await geometry()).toEqual(layout);
    const box = (await card.boundingBox())!;
    await card.click({ position: { x: box.width / 2, y: Math.min(65, box.height / 2) } });
    expect(await selectedAtlasValue(analysis, 'Model')).toBe(id!);
    await expect(card.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(await geometry()).toEqual(layout);
  }
  await performance.getByRole('button', { name: 'Median ensemble', exact: true }).press('Space');
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  expect(await geometry()).toEqual(layout);
  await contained();
  await analysis.screenshot({ path: `/tmp/atlas-model-controls-${mode.width}-${mode.fullscreen}.png` });
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
  await expect(analysis.getByRole('region', { name: 'Observation details', exact: true })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Trends', exact: true }).click();
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await expect(analysis.getByRole('region', { name: 'Count checks', exact: true })).toBeVisible();
  await contained();
  const menu = atlasSelect(analysis, 'Monitored series');
  await menu.locator(':scope > summary').click();
  const observationId = await menu.locator('button[value^="observations:"]').evaluateAll(options => options.sort((a, b) => Number(b.querySelector('[data-kind="count"]')!.textContent!.match(/\d+/)![0]) - Number(a.querySelector('[data-kind="count"]')!.textContent!.match(/\d+/)![0]))[0].getAttribute('value'));
  await menu.getByRole('option').and(menu.locator(`button[value="${observationId}"]`)).click();
  const observations = analysis.getByRole('region', { name: 'Reported observations', exact: true });
  for (const label of ['Model prediction', 'Count checks', 'Observations and sources', 'Model performance']) await expect(observations.getByRole('region', { name: label, exact: true })).toBeVisible();
  for (const label of ['Evaluation', 'Model', 'Horizon', 'Historical origin']) await expect(atlasSelect(observations, label).locator('summary')).toHaveAttribute('aria-disabled', 'true');
  await expect(observations.getByRole('region', { name: 'Count checks', exact: true })).toContainText('No model predictions or baseline checks are published');
  await expect(observations.getByRole('region', { name: 'Model performance', exact: true })).toContainText('No model evaluation');
  await expect(observations.locator('.atlas-observation-chart')).toBeVisible();
  for (const name of ['Model prediction', 'Count checks']) {
    const card = observations.getByRole('region', { name, exact: true });
    await expect(card.locator(':scope > h3')).toHaveCount(0);
    const plot = (await card.locator('figure, [class*="unavailablePlot"]').boundingBox())!;
    const summary = (await card.locator('[class*="figureSummary"]').boundingBox())!;
    expect(summary.y).toBeGreaterThanOrEqual(plot.y + plot.height);
  }
  await expect(observations.locator('svg [class*="interval"]')).toHaveCount(0);
  const sources = observations.getByRole('region', { name: 'Observation details', exact: true });
  await expect(sources).toHaveCSS('overflow-y', 'auto');
  const observationPanel = observations.getByRole('region', { name: 'Observations and sources', exact: true });
  expect((await sources.boundingBox())!.width).toBeGreaterThanOrEqual((await observationPanel.boundingBox())!.width - 18);
  const chart = observations.locator('.atlas-observation-chart');
  expect((await chart.boundingBox())!.height).toBeGreaterThanOrEqual(mode.fullscreen && mode.height <= 700 ? 80 : 150);
  expect((await observations.locator('figcaption').boundingBox())!.y).toBeGreaterThanOrEqual((await chart.boundingBox())!.y + (await chart.boundingBox())!.height - 1);
  await sources.evaluate(element => { element.scrollTop = element.scrollHeight; });
  expect(await sources.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await sources.locator('.atlas-observation-item').last().evaluate(element => element.getBoundingClientRect().bottom <= element.closest('[aria-label="Observation details"]')!.getBoundingClientRect().bottom + 1)).toBe(true);
  await contained();
  await observations.screenshot({ path: `/tmp/atlas-observation-layout-${mode.width}-${mode.fullscreen}.png` });
  expect((await new AxeBuilder({ page }).include('[aria-label="Reported observations"]').analyze()).violations).toEqual([]);
});


test('Performance scroll cue follows overflow and resizing without scrolling the figures', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const cards = analysis.getByRole('group', { name: 'Model comparisons', exact: true });
  const more = analysis.locator('button[aria-label="More models below"]');
  const layout = analysis.locator('[class*="signalEvaluation"]');
  await expect(more).toBeHidden();
  await expect(cards).toHaveCSS('scrollbar-width', 'none');
  await expect(more).toHaveAttribute('aria-controls', (await cards.getAttribute('id'))!);
  await page.setViewportSize({ width: 1440, height: 620 });
  await expect(more).toBeVisible();
  await expect(more).toHaveCSS('border-radius', '50%');
  expect(await layout.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  const plot = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const bounds = await plot.boundingBox();
  await more.press('Enter');
  await expect.poll(() => cards.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await cards.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(more).toBeHidden();
  await expect(more).toHaveAttribute('tabindex', '-1');
  expect(await plot.boundingBox()).toEqual(bounds);
  await cards.evaluate(element => { element.scrollTop = 0; });
  await expect(more).toBeVisible();
  await cards.focus();
  await cards.press('PageDown');
  await expect.poll(() => cards.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await cards.evaluate(element => { element.scrollTop = 0; });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(more).toBeHidden();
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await analysis.screenshot({ path: '/tmp/atlas-model-controls-fullscreen.png' });
});

test('Reported observations retain reviewed connections and model choices', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const modeledId = await selectedAtlasValue(analysis, 'Monitored series');
  await selectAtlasOption(analysis, 'Model', 'gamma_poisson');
  await selectAtlasOption(analysis, 'Horizon', '2');
  await selectAtlasOption(analysis, 'Monitored series', 'observations:ncdc-lassa-2026-cumulative-1');
  const observations = analysis.getByRole('region', { name: 'Reported observations', exact: true });
  const firstPoint = observations.locator('.atlas-observation-chart circle[role="button"]').first();
  await firstPoint.focus();
  await expect(observations.locator('.atlas-observation-item[data-highlighted="true"]')).toHaveCount(1);
  const connection = observations.getByRole('button', { name: /^Comparison from/ }).first();
  await connection.press('Enter');
  const evidence = observations.getByRole('button', { name: 'Comparison evidence', exact: true });
  await evidence.click();
  const dialog = page.getByRole('dialog', { name: 'Comparison evidence', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Source-checked draft');
  await page.keyboard.press('Escape');
  await selectAtlasOption(analysis, 'Monitored series', modeledId!);
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('gamma_poisson');
  expect(await selectedAtlasValue(analysis, 'Horizon')).toBe('2');
  await expect(analysis.getByRole('group', { name: 'Model comparisons', exact: true }).getByRole('article')).toHaveCount(4);
});

test('Prediction selects an exported model when the ensemble is absent', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE || !process.env.ATLAS_RELEASE_FILE, 'Requires the producer Intelligence export and release');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const [series, checksOnly] = data.forecast_series;
  series.backtests = series.backtests.filter(item => item.model_id !== 'ensemble_median');
  series.forecasts = series.forecasts.filter(item => item.model_id !== 'ensemble_median');
  series.metrics = series.metrics.filter(item => item.model_id !== 'ensemble_median');
  checksOnly.backtests = [];
  checksOnly.forecasts = [];
  checksOnly.metrics = [];
  const bytes = Buffer.from(JSON.stringify(data));
  const receipt = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE!, 'utf8'));
  const release = receipt.release ?? receipt;
  release.intelligence.asset = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  await page.route('**/current.json', route => route.fulfill({ json: release }));
  await page.route('**/intelligence/*/intelligence.json', route => route.fulfill({ contentType: 'application/json', body: bytes }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis', exact: true });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await selectAtlasOption(analysis, 'Monitored series', series.id);
  const model = atlasSelect(analysis, 'Model');
  const expectedModel = series.backtests[0].model_id;
  expect(await selectedAtlasValue(analysis, 'Model')).toBe(expectedModel);
  await model.locator('summary').click();
  await expect(model.locator('[role="option"][value="ensemble_median"]')).toHaveCount(0);
  await model.press('Escape');
  const target = series.backtests.filter(item => item.model_id === expectedModel && item.horizon_weeks === 1).sort((a, b) => a.origin.localeCompare(b.origin)).at(-1)!;
  await expect(analysis.getByRole('region', { name: 'Model prediction', exact: true }).locator('[class*="figureSummary"] dd').first()).toHaveText(target.central.toLocaleString('en-GB', { maximumFractionDigits: 2 }));
  await selectAtlasOption(analysis, 'Monitored series', checksOnly.id);
  await expect(model.locator('summary')).toHaveAttribute('aria-disabled', 'true');
  await expect(analysis).toContainText('No eligible origin for this model and horizon.');
  await expect(analysis.locator('svg [data-level]')).toHaveCount(0);
  const checks = analysis.getByRole('region', { name: 'Count checks', exact: true });
  await expect(checks.locator('svg')).toHaveCount(1);
  await expect(checks.locator('svg [class*="historyLine"]')).toHaveCount(0);
  await expect(checks.locator('svg [role="button"][data-entry-id]')).toHaveCount(checksOnly.monitoring_checks.length);
  const values = analysis.getByRole('region', { name: 'Observation details', exact: true });
  await expect(values.locator('article[data-entry-id]')).toHaveCount(checksOnly.observations.length);
  await expect(values.locator('article[data-entry-id] dl')).toHaveCount(checksOnly.monitoring_checks.length);
});

test('Prediction and count checks share a view with every observation, check and model score', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const formatted = (value: number, digits = 2) => value.toLocaleString('en-GB', { maximumFractionDigits: digits });
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  for (const series of data.forecast_series) {
    await selectAtlasOption(analysis, 'Monitored series', series.id);
    const checks = analysis.getByRole('region', { name: 'Count checks', exact: true });
    const checkValues = analysis.getByRole('region', { name: 'Observation details', exact: true });
    await expect(checkValues.locator('article[data-entry-id]')).toHaveCount(series.observations.length);
    await expect(checks.locator('svg')).toHaveCount(1);
    await expect(checks.locator('svg [class*="historyLine"]')).toHaveCount(0);
    await expect(prediction.locator('svg [role="button"][data-entry-id]')).toHaveCount(series.observations.length);
    await expect(atlasSelect(analysis, 'Model')).toBeVisible();
    const renderedChecks = await checkValues.locator('article[data-entry-id]').evaluateAll(rows => rows.filter(row => row.querySelector('dl')).map(row => ({
      id: row.getAttribute('data-entry-id'),
      values: Object.fromEntries(Array.from(row.querySelectorAll('dl > div')).filter(item => ['Expected', 'Threshold', 'Result'].includes(item.querySelector('dt')!.textContent!)).map(item => [item.querySelector('dt')!.textContent, item.querySelector('dd')!.textContent])),
    })).sort((a, b) => a.id!.localeCompare(b.id!)));
    expect(renderedChecks).toEqual(series.monitoring_checks.map(check => ({ id: check.measure_id, values: { Expected: formatted(check.expected), Threshold: formatted(check.threshold), Result: check.above_threshold ? 'Above threshold' : 'Not exceeded' } })).sort((a, b) => a.id.localeCompare(b.id)));
    await expect(prediction.locator('svg [class*="thresholdMark"], svg [class*="expectedPoint"]')).toHaveCount(0);
    expect(await prediction.locator('svg [class*="historyLine"]').count()).toBeGreaterThan(0);
    await expect(checks.locator('svg [class*="thresholdMark"]')).toHaveCount(series.monitoring_checks.length);
    await expect(checks.locator('svg [class*="expectedPoint"]')).toHaveCount(series.monitoring_checks.length);
    const checkedPoints = checks.locator('svg [role="button"][data-entry-id]');
    await expect(checkedPoints).toHaveCount(series.monitoring_checks.length);
    const lastCheck = series.monitoring_checks.slice().sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
    const point = checkedPoints.and(checks.locator(`[data-entry-id="${lastCheck.measure_id}"]`));
    await expect(point).toHaveAttribute('aria-label', new RegExp(`expected ${formatted(lastCheck.expected)}, threshold ${formatted(lastCheck.threshold)}`));
    await point.focus();
    await expect(checkValues.locator(`.atlas-observation-item[data-entry-id="${lastCheck.measure_id}"]`)).toHaveAttribute('data-highlighted', 'true');
    await expect(prediction.locator(`svg [data-entry-id="${lastCheck.measure_id}"]`)).toHaveAttribute('data-selected', 'true');
    expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
    for (const horizon of [1, 2]) {
      const values = analysis.getByRole('region', { name: 'Observation details', exact: true });
      await selectAtlasOption(analysis, 'Horizon', String(horizon));
      await selectAtlasOption(analysis, 'Evaluation', 'backtest');
      const target = series.backtests.filter(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon).sort((a, b) => a.origin.localeCompare(b.origin)).at(-1)!;
      await expect(prediction.locator('[class*="figureSummary"] dd')).toHaveText([formatted(target.central), formatted(target.observed), formatted(target.wis, 3)]);
      expect(await values.locator('article[data-entry-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-entry-id')).sort())).toEqual(series.observations.map(observation => observation.measure_id).sort());
      expect(await values.locator('article[data-training="true"]').evaluateAll(rows => rows.map(row => row.getAttribute('data-entry-id')).sort())).toEqual([...target.training_measure_ids].sort());
      await expect(values.locator('article[data-held-out="true"]')).toHaveAttribute('data-entry-id', target.target_measure_id);
      await expect(values.locator('dl')).toHaveCount(series.monitoring_checks.length);
      for (const metric of series.metrics.filter(item => item.horizon_weeks === horizon)) {
        const row = analysis.getByRole('region', { name: 'Model performance', exact: true }).locator(`article[data-entry-id="${metric.model_id}"]`);
        await expect(row.locator('dd')).toHaveText([String(metric.n), formatted(metric.mae, 3), formatted(metric.wis, 3), metric.relative_wis === null ? 'Not defined' : formatted(metric.relative_wis, 3), ...[.5, .8, .95].map(level => { const coverage = metric.coverage.find(item => item.level === level); return coverage ? `${formatted(coverage.value * 100)}%` : 'Not reported'; })]);
      }
      await selectAtlasOption(analysis, 'Evaluation', 'extrapolation');
      const outlook = series.forecasts.find(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon)!;
      await expect(prediction.locator('[class*="figureSummary"] dd')).toHaveText([formatted(outlook.central), 'Not evaluated', 'Not evaluated']);
      expect(await values.locator('article[data-training="true"]').evaluateAll(rows => rows.map(row => row.getAttribute('data-entry-id')).sort())).toEqual([...outlook.training_measure_ids].sort());
      await expect(values.locator('article[data-held-out="true"]')).toHaveCount(0);
    }
  }
});

for (const width of [1440, 390]) test(`Tab choices survive navigation at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  if (width > 1180) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
    await page.keyboard.press('Enter');
  }
  const visit = async (name: string) => tabs.getByRole('tab', { name, exact: true }).click();
  await visit('Analysis');
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  const series = atlasSelect(analysis, 'Monitored series');
  const firstSeries = await selectedAtlasValue(analysis, 'Monitored series');
  await selectAtlasOption(analysis, 'Model', 'gamma_poisson');
  await selectAtlasOption(analysis, 'Horizon', '2');
  await selectAtlasOption(analysis, 'Historical origin', { index: 1 });
  const chosenOrigin = await selectedAtlasValue(analysis, 'Historical origin');
  await selectAtlasOption(analysis, 'Monitored series', { index: 1 });
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('ensemble_median');
  await selectAtlasOption(analysis, 'Model', 'recent_changes');
  await selectAtlasOption(analysis, 'Monitored series', firstSeries);
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('gamma_poisson');
  expect(await selectedAtlasValue(analysis, 'Horizon')).toBe('2');
  expect(await selectedAtlasValue(analysis, 'Historical origin')).toBe(chosenOrigin);
  await visit('Trends');
  await expect(analysis).toHaveCount(0);
  await visit('Analysis');
  await series.locator(':scope > summary').click();
  const observation = series.getByRole('option').and(series.locator('button[value^="observations:"]')).filter({ hasText: 'Confirmed cases' }).first();
  const observationId = await observation.getAttribute('value');
  await observation.click();
  await visit('Trends');
  await visit('Analysis');
  await expect(page.locator('.atlas-trends')).toHaveCount(0);
  expect(await selectedAtlasValue(analysis, 'Monitored series')).toBe(observationId);
  await selectAtlasOption(analysis, 'Monitored series', firstSeries);
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('gamma_poisson');
  expect(await selectedAtlasValue(analysis, 'Horizon')).toBe('2');
  expect(await selectedAtlasValue(analysis, 'Historical origin')).toBe(chosenOrigin);
  await selectAtlasOption(analysis, 'Analysis view', 'signals');
  await visit('One Health');
  const health = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const healthView = health.locator('summary[aria-label="One Health view"]');
  await healthView.click();
  await health.getByRole('option', { name: 'Evidence', exact: true }).click();
  const chosenReport = await health.locator('summary[aria-label="One Health report"]').innerText();
  await visit('Trends');
  await expect(health).toHaveCount(0);
  await visit('Analysis');
  expect(await selectedAtlasValue(analysis, 'Monitored series')).toBe(firstSeries);
  expect(await selectedAtlasValue(analysis, 'Model')).toBe('gamma_poisson');
  expect(await selectedAtlasValue(analysis, 'Horizon')).toBe('2');
  expect(await selectedAtlasValue(analysis, 'Historical origin')).toBe(chosenOrigin);
  await visit('One Health');
  await expect(healthView).toContainText('Evidence');
  await expect(health.locator('summary[aria-label="One Health report"]')).toHaveText(chosenReport, { useInnerText: true });
  await healthView.click();
  await health.getByRole('option', { name: 'Overview', exact: true }).click();
  const search = health.getByRole('searchbox', { name: 'Search One Health report entries' });
  await search.fill('Lassa');
  await health.locator('thead th').first().getByRole('button', { name: 'Report entry & review', exact: true }).click();
  const order = await health.locator('thead th').first().getAttribute('aria-sort');
  const firstRow = await health.locator('tbody tr').first().getAttribute('data-record-id');
  await visit('Reports');
  const report = page.locator('.atlas-report').first();
  await report.locator(':scope > summary').click();
  await expect(report).toHaveAttribute('open', '');
  await visit('One Health');
  await expect(healthView).toContainText('Overview');
  await expect(search).toHaveValue('Lassa');
  await expect(health.locator('thead th').first()).toHaveAttribute('aria-sort', order!);
  await expect(health.locator('tbody tr').first()).toHaveAttribute('data-record-id', firstRow!);
  await visit('Reports');
  await expect(report).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Source coverage', exact: true }).click();
  await expect(page.locator('.atlas-source-network')).toBeVisible();
  await page.getByRole('button', { name: 'Close Source coverage', exact: true }).click();
  await visit('Analysis');
  await selectAtlasOption(page, 'Analysis view', 'relationships');
  await visit('Journeys');
  await visit('Analysis');
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'relationships');
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) test(`One Health empty views recover at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  if (width > 1180) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
    await page.keyboard.press('Enter');
  }
  await tabs.getByRole('tab', { name: 'One Health', exact: true }).click();
  const health = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const view = health.locator('summary[aria-label="One Health view"]');
  const report = health.locator('summary[aria-label="One Health report"]');
  const chooseView = async (name: string) => {
    await view.click();
    await health.getByRole('option', { name, exact: true }).click();
  };
  const chooseEntry = async (kind: string, empty: boolean) => {
    await report.click();
    await health.getByRole('listbox', { name: 'One Health report' }).getByRole('option').filter({
      has: page.locator(`[data-kind="${kind}"]${empty ? '[data-empty="true"]' : ':not([data-empty="true"])'}`),
    }).first().click();
  };
  await chooseEntry('network', true);
  await expect(health.locator('.atlas-oh-network')).toContainText('No episode or surveillance observations');
  await expect(health.locator('.atlas-oh-node')).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Trends', exact: true }).click();
  await tabs.getByRole('tab', { name: 'One Health', exact: true }).click();
  await expect(health.locator('.atlas-oh-network')).toContainText('No episode or surveillance observations');
  for (const [name, kind] of [['Evidence', 'evidence'], ['Timeline', 'timeline'], ['Sampling', 'sampling']]) {
    await chooseView(name);
    await chooseEntry(kind, true);
    await expect(health.locator('.atlas-oh-layout')).toBeVisible();
    await expect(health.locator('.atlas-oh-detail')).toContainText(kind === 'evidence' ? 'No eligible observations' : 'Select a report with reviewed statements');
    if (kind === 'evidence') await expect(health.locator('.atlas-oh-figure .atlas-scope-trigger')).toHaveCount(0);
    await chooseEntry(kind, false);
    await expect(health.locator('.atlas-oh-detail h3')).toBeVisible();
  }
  await chooseView('Timeline');
  const layers = health.getByRole('group', { name: 'Timeline layers' });
  for (const button of await layers.getByRole('switch').all()) await button.click();
  await expect(health).toContainText('No reviewed statements match this view');
  for (const button of await layers.getByRole('switch').all()) await button.click();
  await expect(health.locator('.atlas-oh-detail h3')).toBeVisible();
  await chooseView('Network');
  await chooseEntry('network', false);
  const network = health.getByRole('group', { name: 'One Health evidence network', exact: true });
  await expect(network).toBeVisible();
  await expect.poll(async () => Number((await network.getAttribute('viewBox'))!.split(' ')[2])).toBeGreaterThan(0);
  expect(await network.locator('[d]').evaluateAll(paths => paths.every(path => !/NaN|Infinity/.test(path.getAttribute('d')!)))).toBe(true);
  const filters = health.locator('.atlas-entry-filters');
  await filters.locator('summary').click();
  for (const name of ['Sampling', 'Reviewed sample fraction', 'Food & commodities']) await filters.getByRole('checkbox', { name, exact: true }).check();
  await expect(health).toContainText('No entries match these filters');
  await filters.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(network).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) test(`About dialogs share presentation at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence sidecar');
  await page.setViewportSize({ width, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  if (width > 1180) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
    await page.keyboard.press('Enter');
  }
  const appearances: unknown[] = [];
  for (const [tab, label] of [['Trends', 'About ATLAS'], ['One Health', 'About One Health'], ['Analysis', 'About Analysis']]) {
    await tabs.getByRole('tab', { name: tab, exact: true }).click();
    const button = page.locator('.atlas-workspace-footer').getByRole('button', { name: label, exact: true });
    await button.click();
    const dialog = page.getByRole('dialog', { name: label, exact: true });
    await expect(dialog.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: `Close ${label}`, exact: true })).toBeFocused();
    appearances.push(await dialog.evaluate(element => {
      const style = (selector: string, properties: string[]) => {
        const computed = getComputedStyle(element.querySelector(selector)!);
        return properties.map(property => computed.getPropertyValue(property));
      };
      return {
        width: element.getBoundingClientRect().width,
        heading: style('header h2', ['font-size', 'line-height', 'gap', 'margin']),
        body: style('.atlas-scope-body', ['padding', 'overflow-y']),
        section: style('h3', ['font-size', 'font-weight', 'line-height', 'gap', 'margin-bottom']),
        text: style('.atlas-literature p:not(.atlas-about-name)', ['font-size', 'line-height', 'margin-bottom', 'color']),
      };
    }));
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (label === 'About ATLAS') {
      await expect(dialog).toContainText('GPT-6 Astra');
      await expect(dialog.getByRole('link', { name: /Download (dataset|measurements)/ })).toHaveCount(0);
    } else {
      await expect(dialog.locator('.atlas-references')).toHaveCSS('font-size', '13px');
      await expect(dialog.locator('.atlas-references')).toHaveCSS('list-style-type', 'decimal');
    }
    expect((await new AxeBuilder({ page }).include('.atlas-about-dialog[open]').analyze()).violations).toEqual([]);
    await dialog.screenshot({ path: `/tmp/${label.toLowerCase().replaceAll(' ', '-')}-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  }
  expect(appearances[1]).toEqual(appearances[0]);
  expect(appearances[2]).toEqual(appearances[0]);
});
