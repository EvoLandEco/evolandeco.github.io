import { atlasSelect, selectAtlasOption } from './atlas-select-actions';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';

const subjects = [{ id: 'subject-a', label: 'Sample subject A' }, { id: 'subject-b', label: 'Sample subject B' }];
test.beforeEach(async ({ page }) => {
  const data = structuredClone(bundle);
  data.diseases = subjects;
  data.disease_reviews = data.records.map((record, index) => ({
    id: `review-${record.id}`, record_id: record.id, kind: 'single_disease', disease_ids: [subjects[index % 3 ? 0 : 1].id],
    reason: 'Synthetic animation fixture', reviewed_at: '2026-10-01', reviewed_by: 'Test', review_status: 'source_checked_draft', evidence_ids: [],
    eligibility: { rule: 'all_supporting_records_in_window', record_ids: [record.id], partial: 'hide_relationship_keep_visible_assertions' },
  }));
  const fixture = await routeBrowserFixture(page, data, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const daily = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  await page.route(/\/daily\//, route => route.fulfill({ json: route.request().url().endsWith('current.json') ? dailyPointer(daily) : daily }));
  await page.setViewportSize({ width: 1466, height: 832 });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(1);
});

test('Lazy tabs retain visible content and animate after the view is ready', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const loading = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/_next/static/chunks/*.js', async route => { requested(); await ready; await route.continue(); });
  const previous = await page.locator('.atlas-trends').elementHandle();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await loading;
  await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.atlas-trends')).toBeVisible();
  await expect(page.locator('.atlas-view-loading, #atlas-panel .atlas-panel-loading')).toHaveCount(0);
  expect(await previous!.evaluate(node => node.isConnected)).toBe(true);
  expect(await page.locator('#atlas-panel').evaluate(node => node.getAnimations().some(animation => animation.id === 'atlas-content-change'))).toBe(false);
  await page.locator('.atlas-rules > summary').click();
  await page.locator('summary[aria-label="Reporting topic"]').click();
  await page.locator('.atlas-filter-advanced input[type="checkbox"]').nth(1).check();
  await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('summary[aria-label="Reporting topic"]').click();
  await page.getByRole('button', { name: 'Remove topic filter', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.atlas-rules > summary').click();
  const committed = page.evaluate(async () => {
    let frames = 0;
    const start = performance.now();
    await new Promise<void>(resolve => {
      const sample = () => {
        const panel = document.getElementById('atlas-panel')!;
        if (panel.querySelector('[aria-label="Experimental analysis"]') && panel.getAnimations().some(animation => animation.id === 'atlas-content-change')) { frames++; resolve(); }
        else if (performance.now() - start < 2000) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return frames;
  });
  release();
  expect(await committed).toBe(1);
  await expect(page.getByRole('region', { name: 'Experimental analysis', exact: true })).toBeVisible();
  await expect(page.locator('#atlas-panel')).toHaveAttribute('aria-busy', 'false');
});

test('Leaving a loading tab prevents its late response from replacing the selected view', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const loading = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/_next/static/chunks/*.js', async route => { requested(); await ready; await route.continue(); });
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  await loading;
  await expect(page.locator('#atlas-panel .atlas-panel-loading')).toBeVisible();
  await expect(page.locator('#atlas-panel .atlas-panel-loading strong')).toHaveText('Loading One Health');
  await expect(page.locator('.atlas-trends')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-report-list')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-view-loading, #atlas-panel .atlas-panel-loading')).toHaveCount(0);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.locator('#atlas-panel')).toHaveAttribute('aria-labelledby', 'atlas-tab-reports');
  await expect(page.locator('.atlas-one-health')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-reports-transition');
});

test('One Health selection finishes sliding while its content loads', async ({ page }, info) => {
  await page.getByRole('tab', { name: 'One Health', exact: true }).scrollIntoViewIfNeeded();
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const loading = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/_next/static/chunks/*.js', async route => { requested(); await ready; await route.continue(); });
  const movement = page.evaluate(async () => {
    const positions = new Set<number>();
    let nativeSlide = false;
    document.getElementById('atlas-tab-one-health')!.click();
    const start = performance.now();
    await new Promise<void>(resolve => {
      const sample = () => {
        const indicator = document.querySelector('.atlas-tab-indicator')!;
        positions.add(Math.round(indicator.getBoundingClientRect().x * 10));
        nativeSlide ||= indicator.getAnimations().some(animation => animation.id === 'atlas-tab-slide' && animation.playState === 'running');
        if (performance.now() - start < 700) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { positions: positions.size, nativeSlide };
  });
  await loading;
  const selected = page.getByRole('tab', { name: 'One Health', exact: true });
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  const pending = page.locator('#atlas-panel .atlas-panel-loading');
  await expect(pending).toHaveAttribute('role', 'status');
  await expect(pending).toBeVisible();
  await expect(pending.locator('strong')).toHaveText('Loading One Health');
  await expect(pending).toContainText('Preparing observations and source evidence…');
  const mark = pending.locator('.atlas-panel-loading-mark');
  await expect(mark).toHaveCSS('width', '70px');
  await expect(mark).toHaveCSS('height', '70px');
  await expect(mark.locator('svg.lucide-heart-handshake')).toBeVisible();
  expect(await mark.evaluate(node => getComputedStyle(node, '::before').animationName)).toBe('atlas-panel-loading-orbit');
  const center = await pending.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const loader = element.querySelector('.atlas-panel-loading-content')!.getBoundingClientRect();
    return { x: loader.x + loader.width / 2 - bounds.x - bounds.width / 2, y: loader.y + loader.height / 2 - bounds.y - bounds.height / 2 };
  });
  expect(center.x).toBeCloseTo(0, 0);
  expect(center.y).toBeCloseTo(0, 0);
  await expect(page.locator('.atlas-view-loading, .atlas-trends')).toHaveCount(0);
  const motion = await movement;
  expect(motion.positions).toBeGreaterThan(3);
  expect(motion.nativeSlide).toBe(true);
  const destination = (await selected.boundingBox())!;
  const indicator = (await page.locator('.atlas-tab-indicator').boundingBox())!;
  expect(indicator.x).toBeCloseTo(destination.x, 0);
  expect(indicator.width).toBeCloseTo(destination.width, 0);
  await page.screenshot({ path: info.outputPath('one-health-loading.png'), scale: 'css' });
  release();
  await expect(page.locator('.atlas-one-health')).toBeVisible();
  await expect(page.locator('#atlas-panel')).toHaveAttribute('aria-busy', 'false');
  await expect(pending).toHaveCount(0);
});

test('Interrupted tab slides settle on the selected view and respect reduced motion', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('atlas-tab-reports')!.click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    document.getElementById('atlas-tab-one-health')!.click();
    await new Promise(requestAnimationFrame);
    document.getElementById('atlas-tab-trends')!.click();
  });
  const selected = page.getByRole('tab', { name: 'Trends', exact: true });
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#atlas-panel')).toHaveAttribute('aria-labelledby', 'atlas-tab-trends');
  await expect.poll(() => page.locator('.atlas-tab-indicator').evaluate(node => node.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  const destination = (await selected.boundingBox())!;
  expect((await page.locator('.atlas-tab-indicator').boundingBox())!.x).toBeCloseTo(destination.x, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('#atlas-panel')).toHaveAttribute('aria-labelledby', 'atlas-tab-reports');
  expect(await page.locator('.atlas-tab-indicator').evaluate(node => node.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  const reports = (await page.getByRole('tab', { name: 'Reports', exact: true }).boundingBox())!;
  expect((await page.locator('.atlas-tab-indicator').boundingBox())!.x).toBeCloseTo(reports.x, 0);
});

test('Analysis selector supports keyboard navigation and restores the selected view', async ({ page }) => {
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const menu = atlasSelect(page, 'Analysis view');
  const trigger = menu.locator(':scope > summary');
  await expect(trigger).toContainText('Signals');
  await trigger.press('Enter');
  await expect(menu.getByRole('option')).toHaveCount(4);
  await expect(menu.getByRole('option').locator('.atlas-select-choice-title')).toHaveText(['Signals & forecasts', 'Risk assessments', 'Spatial links', 'Report relationships']);
  await menu.getByRole('option', { selected: true }).press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'relationships');
  await expect(trigger).toBeFocused();
  await expect(page.locator('.atlas-connection').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Report content' })).toHaveCount(0);
  await expect(page.locator('.atlas-report-list')).toBeVisible();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await expect(trigger).toContainText('Relationships');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await selectAtlasOption(page, 'Analysis view', 'signals');
  await expect(page.locator('.atlas-analysis')).toHaveAttribute('data-view', 'signals');
});

for (const visited of [false, true]) test(`Relationship navigation focuses its heading, Analysis visited ${visited}`, async ({ page }) => {
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  if (visited) {
    await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
    await selectAtlasOption(page, 'Analysis view', 'risk');
    await expect(page.getByRole('region', { name: 'Source risk assessments', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  }
  const report = page.locator('.atlas-report:not(.atlas-daily-report)').first();
  await report.locator(':scope > summary').click();
  await report.locator('.atlas-report-assessment-links > details > summary').first().click();
  const relationship = report.locator('button[data-assessment-id]').first();
  const id = await relationship.getAttribute('data-assessment-id');
  await relationship.click();
  await expect(page.locator(`[id="atlas-assessment-${id}"]`)).toBeFocused();
});

for (const fullscreen of [false, true]) test(`Latest reports morphs into Reports, full screen ${fullscreen}`, async ({ page }, info) => {
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await expect.poll(() => page.locator('.atlas-latest-list > li').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  await page.getByRole('button', { name: 'View all reports', exact: true }).scrollIntoViewIfNeeded();
  const previews = await page.locator('.atlas-latest-list > li:not([inert])').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    const clip = node.closest('.atlas-latest-body')!.getBoundingClientRect();
    return { id: (node as HTMLElement).dataset.reportId!, visible: rect.bottom > Math.max(0, clip.top) && rect.top < Math.min(innerHeight, clip.bottom) };
  }));
  const ids = previews.filter(entry => entry.visible).map(entry => entry.id);
  expect(ids.length).toBeGreaterThan(0);
  const pillStart = (await page.locator('.atlas-tab-indicator').boundingBox())!.x;
  await page.addStyleTag({ content: `html[data-atlas-reports-transition]::view-transition-group(*), html[data-atlas-reports-transition]::view-transition-old(*), html[data-atlas-reports-transition]::view-transition-new(*) { animation-play-state: paused !important; animation-delay: -.1s !important; }` });
  await page.addStyleTag({ content: `html[data-atlas-reports-transition]::view-transition-group(atlas-reports-toolbar), html[data-atlas-reports-transition]::view-transition-group(atlas-reports-context) { animation-play-state: running !important; animation-delay: 0s !important; }` });
  await page.getByRole('button', { name: 'View all reports', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-atlas-reports-transition', 'active');
  await expect(page.locator('html')).toHaveCSS('view-transition-name', 'none');
  await expect(page.locator('.atlas-page')).toHaveCSS('view-transition-name', 'none');
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  const names = await page.locator('.atlas-report-list > .atlas-report').evaluateAll(nodes => nodes.map(node => ({ id: node.id, name: getComputedStyle(node.querySelector(':scope > summary .atlas-source-logo')!).viewTransitionName })));
  for (const [index, id] of ids.entries()) expect(names.find(node => node.id === `atlas-report-${id}`)?.name).toBe(`atlas-report-${index}-1`);
  for (const entry of previews.filter(entry => !entry.visible)) expect(names.find(node => node.id === `atlas-report-${entry.id}`)?.name).toBe('none');
  const menu = await page.evaluate(() => {
    const root = document.documentElement;
    const group = (name: string) => getComputedStyle(root, `::view-transition-group(${name})`);
    const indicator = group('atlas-reports-tab-indicator');
    const position = new DOMMatrix(indicator.transform);
    const title = group('atlas-report-0-3');
    const titlePosition = new DOMMatrix(title.transform);
    const targetTitle = document.querySelector('[style*="atlas-report-0-3"]')!.getBoundingClientRect();
    const target = document.getElementById('atlas-tab-reports')!.getBoundingClientRect();
    return {
      pillX: position.m41,
      pillCenter: position.m41 + parseFloat(indicator.width) / 2,
      sampleY: position.m42 + 4,
      targetX: target.x,
      targetCenter: target.x + target.width / 2,
      toolbarLayer: Number(group('atlas-reports-toolbar').zIndex),
      pillLayer: Number(group('atlas-reports-tab-indicator').zIndex),
      labelsLayer: Number(group('atlas-reports-tabs').zIndex),
      oldLabels: getComputedStyle(root, '::view-transition-old(atlas-reports-tabs)').opacity,
      newLabels: getComputedStyle(root, '::view-transition-new(atlas-reports-tabs)').opacity,
      title: { x: titlePosition.m41, y: titlePosition.m42, width: parseFloat(title.width), height: parseFloat(title.height) },
      targetTitle: { x: targetTitle.x, y: targetTitle.y, width: targetTitle.width, height: targetTitle.height },
    };
  });
  expect(menu.pillX).toBeGreaterThan(pillStart + 1);
  expect(menu.pillX).toBeLessThan(menu.targetX - 1);
  expect(menu.pillLayer).toBeGreaterThan(menu.toolbarLayer);
  expect(menu.labelsLayer).toBeGreaterThan(menu.pillLayer);
  expect(menu.oldLabels).toBe('0');
  expect(menu.newLabels).toBe('1');
  expect(await page.locator('#atlas-panel').evaluate(el => el.getAnimations().some(animation => animation.id === 'atlas-content-change'))).toBe(false);
  const surfaces = ['.atlas-tabs', '.atlas-timeline-next-label > span:first-child', '.atlas-timeline-next-label > span:last-child', '.atlas-coverage-control', '.atlas-report-switch', '.atlas-toolbar-reset', '.atlas-toolbar [role="switch"]',
    ...(fullscreen ? ['.atlas-heading h1', '.atlas-fullscreen-exit'] : [])];
  const surfaceBoxes = await Promise.all(surfaces.map(selector => page.locator(selector).boundingBox()));
  const toolbarBox = (await page.locator('.atlas-toolbar').boundingBox())!;
  const screenshot = await page.screenshot({ path: info.outputPath('reports-mid-expansion.png'), scale: 'css' });
  const { data, info: bitmap } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const red = (x: number) => data[(Math.floor(menu.sampleY) * bitmap.width + Math.floor(x)) * bitmap.channels];
  expect(red(menu.targetCenter) - red(menu.pillCenter)).toBeGreaterThan(8);
  const titleInk = [menu.title, menu.targetTitle].map(box => {
    let ink = 0;
    for (let y = Math.max(0, Math.ceil(box.y)); y < Math.min(bitmap.height, Math.floor(box.y + box.height)); y++) {
      for (let x = Math.max(0, Math.ceil(box.x)); x < Math.min(bitmap.width, Math.floor(box.x + box.width)); x++) {
        const offset = (y * bitmap.width + x) * bitmap.channels;
        if (Math.max(data[offset], data[offset + 1], data[offset + 2]) < 160) ink++;
      }
    }
    return ink;
  });
  expect(Math.max(...titleInk), 'incoming report title stays legible during expansion').toBeGreaterThan(80);
  await page.addStyleTag({ content: `html[data-atlas-reports-transition]::view-transition-group(*), html[data-atlas-reports-transition]::view-transition-old(*), html[data-atlas-reports-transition]::view-transition-new(*) { animation-play-state: running !important; }` });
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-reports-transition');
  const settled = await sharp(await page.screenshot({ path: info.outputPath('reports-expanded.png'), scale: 'css' })).removeAlpha().raw().toBuffer();
  for (const [label, top, height] of [['toolbar fill', toolbarBox.y + 3, 3], ['toolbar border', toolbarBox.y + toolbarBox.height - 1, 1]] as const) {
    let difference = 0, channels = 0;
    for (let y = Math.floor(top); y < Math.floor(top) + height; y++) {
      for (let x = Math.ceil(toolbarBox.x + 32); x < Math.floor(toolbarBox.x + toolbarBox.width - 32); x++) {
        const offset = (y * bitmap.width + x) * bitmap.channels;
        for (let channel = 0; channel < 3; channel++) { difference += Math.abs(data[offset + channel] - settled[offset + channel]); channels++; }
      }
    }
    expect(difference / channels, `${label} remains painted during expansion`).toBeLessThan(1);
  }
  for (const [index, box] of surfaceBoxes.entries()) {
    let duringInk = 0, settledInk = 0;
    for (let y = Math.max(0, Math.ceil(box!.y)); y < Math.min(bitmap.height, Math.floor(box!.y + box!.height)); y++) {
      for (let x = Math.max(0, Math.ceil(box!.x)); x < Math.min(bitmap.width, Math.floor(box!.x + box!.width)); x++) {
        const offset = (y * bitmap.width + x) * bitmap.channels;
        if (Math.min(data[offset], data[offset + 1], data[offset + 2]) < 230) duringInk++;
        if (Math.min(settled[offset], settled[offset + 1], settled[offset + 2]) < 230) settledInk++;
      }
    }
    expect(settledInk, `${surfaces[index]} has visible text`).toBeGreaterThan(50);
    expect(duringInk, `${surfaces[index]} remains painted during expansion`).toBeGreaterThan(settledInk * .7);
  }
  await expect(page.locator('.atlas-tab-indicator')).toHaveCSS('view-transition-name', 'none');
  await expect(page.locator('#atlas-report-heading')).toBeFocused();
  const first = (await page.locator('.atlas-report-list > .atlas-report').first().boundingBox())!;
  const tools = (await page.locator('.atlas-report-tools').boundingBox())!;
  expect(first.y).toBeGreaterThanOrEqual(tools.y + tools.height - 1);
  await expect(page.locator('[style*="view-transition-name"]')).toHaveCount(0);
  expect((await page.locator('.atlas-report-list > .atlas-report').evaluateAll(nodes => nodes.map(node => node.id))).slice(0, previews.length)).toEqual(previews.map(entry => `atlas-report-${entry.id}`));
  if (fullscreen) await page.locator('.atlas-workspace-scroll').evaluate(node => { node.scrollTop += 180; });
  else await page.evaluate(() => window.scrollBy({ top: 180, behavior: 'instant' }));
  const scrolledHeader = await page.locator('.atlas-report-tools').evaluate(node => {
    const tools = node.getBoundingClientRect();
    const toolbar = document.querySelector('.atlas-toolbar')!.getBoundingClientRect();
    return { gap: tools.top - toolbar.bottom, painted: node.contains(document.elementFromPoint(tools.x + tools.width / 2, tools.y + tools.height / 2)) };
  });
  expect(scrolledHeader.gap).toBeCloseTo(16, 0);
  expect(scrolledHeader.painted).toBe(true);
});

for (const fullscreen of [false, true]) for (const elapsed of [.1, .34, .62]) test(`Report expansion stays within its container at ${elapsed}s, full screen ${fullscreen}`, async ({ page }, info) => {
  if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await page.addStyleTag({ content: `.atlas-overview-column { opacity: 0 !important; }
    html[data-atlas-reports-transition]::view-transition-old(*),
    html[data-atlas-reports-transition]::view-transition-new(*) {
      animation-play-state: paused !important;
      animation-delay: -.1s !important;
    }
    html[data-atlas-reports-transition]::view-transition-group(*) {
      animation-play-state: paused !important;
      animation-delay: -${elapsed}s !important;
    }` });
  await page.getByRole('button', { name: 'View all reports', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-atlas-reports-transition', 'active');
  await expect(page.locator('.atlas-report-list')).toBeVisible();
  const bounds = (await page.locator('.atlas-workspace').boundingBox())!;
  const scroll = (await page.locator('.atlas-workspace-scroll').boundingBox())!;
  if (elapsed === .62) {
    const height = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement, '::view-transition-group(atlas-report-timeline)').height));
    expect(Math.abs(height - scroll.height)).toBeLessThan(2);
  }
  const names = await page.locator('[style*="view-transition-name"]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.viewTransitionName).filter(name => /^atlas-report-\d+-\d+$/.test(name)));
  const hide = ['atlas-report-timeline', ...names].map(name => `html[data-atlas-reports-transition]::view-transition-group(${name})`).join(',') + ' { opacity: 0 !important; }';
  const visible = await page.screenshot({ path: info.outputPath(`reports-clip-${elapsed}.png`), scale: 'css' });
  const hiddenStyle = await page.addStyleTag({ content: hide });
  const hidden = await page.screenshot({ path: info.outputPath(`reports-removed-${elapsed}.png`), scale: 'css' });
  await hiddenStyle.evaluate(node => node.parentNode?.removeChild(node));
  const { data, info: bitmap } = await sharp(visible).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const removed = await sharp(hidden).removeAlpha().raw().toBuffer();
  let inside = 0, outside = 0, outsideScroll = 0;
  const excess = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
    const offset = (y * bitmap.width + x) * bitmap.channels;
    if (Math.abs(data[offset] - removed[offset]) + Math.abs(data[offset + 1] - removed[offset + 1]) + Math.abs(data[offset + 2] - removed[offset + 2]) <= 20) continue;
    if (x < scroll.x - 1 || x > scroll.x + scroll.width + 1 || y < scroll.y - 1 || y > scroll.y + scroll.height + 1) outsideScroll++;
    if (x < bounds.x - 1 || x > bounds.x + bounds.width + 1 || y < bounds.y - 1 || y > bounds.y + bounds.height + 1) {
      outside++;
      excess.left = Math.min(excess.left, x); excess.top = Math.min(excess.top, y);
      excess.right = Math.max(excess.right, x); excess.bottom = Math.max(excess.bottom, y);
    }
    else inside++;
  }
  expect(inside, `visible timeline pixels at ${elapsed}s`).toBeGreaterThan(100);
  expect(outside, `timeline pixels outside ${JSON.stringify(bounds)} at ${elapsed}s: ${JSON.stringify(excess)}; outside scroll: ${outsideScroll}`).toBe(0);
});

test('Filters interpolate figure values and remove entries without fading the panel or globe', async ({ page }) => {
  await page.getByRole('group', { name: 'Reporting attention period' }).getByRole('button').click();
  await expect(page.locator('.atlas-disease-segment')).toHaveCount(2);
  await page.locator('summary[aria-label="Reporting disease"]').click();
  await expect(page.getByRole('checkbox', { name: subjects[0].label, exact: true })).toBeVisible();
  const result = await page.evaluate(async label => {
    const bars = [...document.querySelectorAll<HTMLElement>('.atlas-activity-track > span')];
    const arc = document.querySelector<SVGPathElement>(`.atlas-disease-segment[aria-label^="${label}:"] .atlas-disease-arc`)!;
    const globe = document.querySelector('.atlas-globe-frame canvas');
    const watch = document.querySelector<HTMLElement>('.atlas-watch-cards > div')!;
    const before = bars.map(el => el.getBoundingClientRect().height);
    const paths = new Set([arc.getAttribute('d')]);
    const heights = bars.map(el => new Set([el.getBoundingClientRect().height]));
    const layoutHeights = bars.map(el => new Set([getComputedStyle(el).height]));
    const watchOpacity = new Set<string>();
    let refresh = false, nativeBars = false, circleError = 0;
    (Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(el => el.getAttribute('aria-label') === label)!).click();
    const start = performance.now();
    await new Promise<void>(resolve => {
      const sample = () => {
        paths.add(arc.getAttribute('d'));
        bars.forEach((bar, index) => {
          heights[index].add(bar.getBoundingClientRect().height);
          layoutHeights[index].add(getComputedStyle(bar).height);
          nativeBars ||= bar.getAnimations().some(animation => (animation.effect as KeyframeEffect).getKeyframes().some(frame => typeof frame.transform === 'string'));
        });
        watchOpacity.add(getComputedStyle(watch).opacity);
        const point = arc.getPointAtLength(arc.getTotalLength() / 3);
        circleError = Math.max(circleError, Math.abs(Math.hypot(point.x - 72, point.y - 72) - 58));
        refresh ||= document.getAnimations().some(animation => animation.id === 'atlas-content-change');
        if (performance.now() - start < 700) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { before, barFrames: heights.map(set => set.size), layoutFrames: layoutHeights.map(set => set.size), nativeBars, paths: paths.size, circleError, watchFrames: watchOpacity.size,
      retained: bars.every(el => el.isConnected) && arc.isConnected, globeRetained: !!globe && globe === document.querySelector('.atlas-globe-frame canvas'), refresh };
  }, subjects[0].label);
  expect(result.retained).toBe(true);
  expect(result.globeRetained).toBe(true);
  expect(result.refresh).toBe(false);
  expect(Math.max(...result.barFrames)).toBeGreaterThan(3);
  expect(Math.max(...result.layoutFrames)).toBe(1);
  expect(result.nativeBars).toBe(true);
  expect(result.paths).toBeGreaterThan(3);
  expect(result.circleError).toBeLessThan(.1);
  expect(result.watchFrames).toBeGreaterThan(3);
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(0);
  await expect(page.locator('.atlas-disease-segment')).toHaveCount(1);
  await expect(page.locator('.atlas-latest-list [data-report-id="daily_latest"]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: subjects[0].label, exact: true }).uncheck();
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(1);
  await expect(page.locator('.atlas-latest-list [data-report-id="daily_latest"]')).toHaveCount(1);
});

test('Tab pill slides and ordinary report navigation uses the tab transition', async ({ page }) => {
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  const result = await page.evaluate(async () => {
    const positions = new Set<number>();
    (document.getElementById('atlas-tab-reports') as HTMLElement).click();
    const start = performance.now();
    let contentTransition = false;
    await new Promise<void>(resolve => {
      const sample = () => {
        const pill = document.querySelector('.atlas-tab-indicator')!;
        positions.add(Math.round(pill.getBoundingClientRect().x));
        contentTransition ||= document.querySelector('#atlas-panel')!.getAnimations().some(animation => animation.id === 'atlas-content-change');
        if (performance.now() - start < 700) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return { positions: positions.size, contentTransition, native: !!document.documentElement.dataset.atlasReportsTransition };
  });
  expect(result.positions).toBeGreaterThan(3);
  expect(result.contentTransition).toBe(true);
  expect(result.native).toBe(false);
  const pill = (await page.locator('.atlas-tab-indicator').boundingBox())!;
  const selected = (await page.getByRole('tab', { name: 'Reports', exact: true }).boundingBox())!;
  expect(pill.x).toBeCloseTo(selected.x, 0);
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.locator('.atlas-latest-entry').first().click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-reports-transition');
  await expect(page.locator('.atlas-report[open]')).toBeVisible();
});

test('Reduced motion skips animation and reporting windows retain the bar chart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const chart = await page.locator('.atlas-activity-bars').elementHandle();
  const retainedMonth = await page.locator('.atlas-activity-bars > button').last().elementHandle();
  await page.getByRole('button', { name: '3 months', exact: true }).click();
  expect(await chart!.evaluate(node => node.isConnected)).toBe(true);
  expect(await retainedMonth!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'View all reports', exact: true }).click();
  await expect(page.locator('#atlas-report-heading')).toBeFocused();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-reports-transition');
  expect(await page.locator('#atlas-panel').evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
});
