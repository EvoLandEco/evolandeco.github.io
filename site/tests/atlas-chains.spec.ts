import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { routeBrowserFixture } from "./atlas-browser-fixture.mjs";
import { createResearch } from "../src/lib/atlas-comparisons";
import type { AtlasSiteBundle } from "../src/lib/atlas-contract";

for (const width of [390, 1280]) test(`Reviewed chain maps preserve nodes, explicit edges and evidence at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_CHAINS_CANDIDATE, "Supply the validated ATLAS chain candidate");
  const path = process.env.ATLAS_CHAINS_CANDIDATE!;
  const bundle: AtlasSiteBundle = JSON.parse(readFileSync(path, "utf8"));
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync(new URL("../snapshot.json", `file://${path}`), "utf8")));
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" });
  await page.goto("/atlas/");
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Observations', exact: true }).click();
  const observations = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Observation series"]') });
  const plot = page.locator('.atlas-trend-observations figure');
  const selectedPoint = plot.locator('.atlas-observation-item').filter({ hasText: '14 Jun 2026' });
  await selectedPoint.getByRole('button', { name: /^Scope & source for/ }).click();
  const scopeDialog = page.locator('.atlas-scope-dialog[open]');
  const warning = scopeDialog.locator('.atlas-status');
  await expect(warning).toHaveText('Source date mismatch');
  await expect(warning.locator('svg')).toHaveCSS('width', '13px');
  await expect(warning.locator('svg')).toHaveCSS('height', '13px');
  await expect(warning.locator('svg')).toHaveCSS('margin-top', '0px');
  expect((await warning.boundingBox())!.height).toBeLessThan(30);
  await expect(scopeDialog.locator('.atlas-measure-details a svg')).toHaveCSS('width', '12px');
  await page.screenshot({ path: `/tmp/atlas-observation-badge-${width}.png` });
  await page.keyboard.press("Escape");
  const values = plot.getByRole('group', { name: 'Values & sources', exact: true });
  await expect(values).toBeVisible();
  await expect(plot.locator('summary').filter({ hasText: /^Values & sources$/ })).toHaveCount(0);
  await values.getByRole('button', { name: /^Scope & source for/ }).first().click();
  await expect(scopeDialog.locator('.atlas-measure-details a svg')).toHaveCSS('width', '12px');
  await page.keyboard.press('Escape');
  await expect(plot.locator('.atlas-observation-item')).toHaveCount(await plot.locator('.atlas-observation-chart circle').count());
  await observations.locator('summary').click();
  await expect(observations.getByRole('searchbox')).toBeFocused();
  await expect(observations.getByRole('option').first().locator('.atlas-select-badge')).toHaveCount(3);
  await page.screenshot({ path: `/tmp/atlas-series-badges-${width}.png` });
  await observations.getByRole('searchbox').fill('confirmed');
  const option = observations.getByRole('option').first();
  const optionLabel = await option.getAttribute('aria-label');
  expect(optionLabel!.toLowerCase()).toContain('confirmed');
  await observations.getByRole('searchbox').press('ArrowDown');
  await expect(option).toBeFocused();
  await option.press('Enter');
  await expect(observations.locator('summary > span')).toHaveAttribute('title', optionLabel!);
  await expect(observations.locator('summary .atlas-select-badge')).toHaveCount(3);
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  const figure = page.locator('.atlas-chain-figure');
  const selected = createResearch(bundle).selectedResearch(new Set(bundle.records.map(r => r.id))).reviewed_chains;
  for (const chain of selected) {
    await page.locator('summary[aria-label="Reviewed chain"]').click();
    await expect(page.getByRole('option').first().locator('.atlas-select-badge').first()).toBeVisible();
    if (chain.id === selected[0].id) await page.screenshot({ path: `/tmp/atlas-path-badges-${width}.png` });
    await page.getByRole("option", { name: chain.label, exact: true }).click();
    await expect(figure).toHaveAttribute("aria-label", chain.label);
    await expect(figure.locator('.atlas-chain-nodes li')).toHaveCount(chain.nodes.length);
    await expect(figure.locator('.atlas-chain-pin[data-unlocated]')).toHaveCount(chain.nodes.filter(n => !n.place_id).length);
    await expect(figure.locator('.atlas-chain-connections > li > details > summary')).toHaveCount(chain.edges.length);
    await expect(figure.locator('.atlas-chain-pin')).toHaveCount(chain.nodes.length);
    for (const [index, node] of chain.nodes.entries()) {
      const codes = node.place_id ? bundle.places.find(p => p.id === node.place_id)!.area_codes : [];
      const pin = figure.locator('.atlas-chain-pin').filter({ has: page.locator('title', { hasText: node.label }) });
      await expect(pin.locator('.atlas-location-badge')).toHaveCount(codes.length);
      await expect(figure.locator('.atlas-chain-nodes li').nth(index).locator('.atlas-location-badge')).toHaveCount(codes.length);
      for (const [i, code] of codes.entries()) await expect(pin.locator('.atlas-location-badge').nth(i)).toHaveText(code);
    }
    await expect(figure.locator('.atlas-chain-edge:not([data-schematic])')).toHaveCount(chain.drawable_edge_ids.length);
    const badgeBounds = await figure.locator('.atlas-chain-pin foreignObject').evaluateAll(elements => elements.map(el => {
      const box = el.getBoundingClientRect(), map = el.closest('svg')!.getBoundingClientRect();
      const complete = [...el.querySelectorAll('.atlas-location-badge')].every(badge => {
        const tag = badge.getBoundingClientRect();
        return tag.left >= box.left - .5 && tag.right <= box.right + .5 && tag.top >= box.top - .5 && tag.bottom <= box.bottom + .5;
      });
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, complete, inside: box.x >= map.x && box.right <= map.right && box.y >= map.y && box.bottom <= map.bottom };
    }));
    for (const [i, a] of badgeBounds.entries()) {
      expect(a.inside).toBe(true);
      expect(a.complete).toBe(true);
      for (const b of badgeBounds.slice(i + 1)) expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, JSON.stringify({ chain: chain.label, a, b })).toBe(true);
    }

    if (chain.nodes.some(n => !n.place_id)) await page.locator('.atlas-chain-section').screenshot({ path: `/tmp/atlas-unlocated-chain-${width}.png` });
    if (chain.id === selected[0].id) await page.locator('.atlas-chain-section').screenshot({ path: `/tmp/atlas-chain-figure-${width}.png` });
    const cluster = figure.locator('.atlas-chain-cluster').first();
    if (await cluster.count()) {
      await expect(cluster).toContainText(/Shared location · \d+ events/);
      const member = figure.locator('.atlas-chain-pin[data-cluster]').last();
      const label = await member.getAttribute('aria-label');
      await member.press('Enter');
      await expect(figure.locator('.atlas-chain-nodes li')).toHaveCount(chain.nodes.length);
      await expect(figure.getByLabel('Selected chain evidence').locator('..').locator(':scope > summary')).toContainText(label!);
      await figure.locator('.atlas-chain-entry[open] > summary').click();
      await expect(figure.locator('.atlas-chain-nodes li')).toHaveCount(chain.nodes.length);
      if (chain.label === 'Latvia measles: reported exposure and contacts') await page.locator('.atlas-chain-section').screenshot({ path: `/tmp/atlas-chain-members-${width}.png` });
    }
    await figure.locator('.atlas-chain-connections > li > details > summary').first().click();
    await expect(figure.getByLabel('Selected chain evidence').locator('..')).toContainText(chain.edges[0].label);
    if (chain.id === selected[0].id) await figure.locator('.atlas-chain-connections').screenshot({ path: `/tmp/atlas-chain-route-${width}.png` });
    await figure.getByText('Source evidence', { exact: true }).click();
    await expect(figure.locator('blockquote')).toHaveCount(chain.edges[0].evidence_ids.length);
  }
  const unlocated = figure.locator('.atlas-chain-pin[data-unlocated]');
  await expect(unlocated).toBeVisible();
  await expect(figure.locator('.atlas-chain-edge[data-schematic]')).toHaveCount(1);
  await unlocated.first().click();
  await expect(figure.getByLabel('Selected chain evidence').locator('..')).toContainText(selected.at(-1)!.nodes.find(n => !n.place_id)!.label);
  await figure.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/atlas-chains-${width}.png` });
  await figure.getByRole('button', { name: 'View reports', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.locator('summary[aria-label="Reviewed chain"]').click();
  await page.getByRole('option', { name: 'MV Hondius: selected episode reports', exact: true }).click();
  await page.getByRole('slider', { name: 'Window start', exact: true }).evaluate(input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(Date.parse('2026-06-01T00:00:00Z') / 86400000));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(figure).toContainText('Partial selection');
  await expect(figure.locator('.atlas-chain-nodes li')).toHaveCount(1);
  await expect(figure.locator('.atlas-chain-edge')).toHaveCount(0);
  await expect(figure.locator('.atlas-chain-map')).toHaveCount(1);
  await expect(figure.locator('.atlas-chain-land')).toHaveAttribute('d', '');
  await expect(unlocated).toBeVisible();
  await expect(unlocated).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
});

for (const workspace of [false, true]) test(`Chain and observation selection animates without remounting figures (workspace: ${workspace})`, async ({ page }) => {
  test.skip(!process.env.ATLAS_CHAINS_CANDIDATE, "Supply the validated ATLAS chain candidate");
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', entry => { if (/not an animatable|NaN|Infinity/.test(entry.text())) problems.push(entry.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: workspace ? 'dark' : 'light' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  await expect(page.locator('.atlas-chain-pin').first()).toBeVisible();
  if (workspace) {
    const canvas = page.getByTestId('atlas-globe').locator('canvas').first();
    const point = await canvas.evaluate(el => {
      const b = el.getBoundingClientRect();
      for (const dx of [0, -.15, .15, -.25, .25]) for (const dy of [0, .15, -.15]) {
        const x = b.left + b.width * (.5 + dx), y = b.top + b.height * (.5 + dy);
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
      throw new Error('No exposed globe surface');
    });
    await page.mouse.move(point.x, point.y);
    await expect(page.getByRole('button', { name: 'Click to enter full screen' })).toHaveAttribute('data-visible', 'true');
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  }
  const reviewButton = page.getByRole('button', { name: 'Scope & review', exact: true });
  const reviewDialog = page.getByRole('dialog', { name: 'Scope & review', exact: true });
  await reviewButton.click();
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByRole('heading', { name: 'Scope', exact: true })).toBeVisible();
  await expect(reviewDialog.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  const closeReview = reviewDialog.getByRole('button', { name: 'Close scope and review' });
  await expect(closeReview).toBeFocused();
  await closeReview.press('Tab');
  await expect(closeReview).toBeFocused();
  await reviewDialog.screenshot({ path: `/tmp/atlas-journey-review-${workspace ? 'dark' : 'light'}.png` });
  await closeReview.press('Escape');
  await expect(reviewDialog).not.toBeVisible();
  await expect(reviewButton).toBeFocused();
  if (workspace) await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  const panelBox = (await page.locator('.atlas-chain-map-panel').boundingBox())!;
  const helpBox = (await reviewButton.boundingBox())!;
  expect(helpBox.x + helpBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  expect(helpBox.y - panelBox.y).toBeCloseTo(10, 0);
  expect(panelBox.x + panelBox.width - helpBox.x - helpBox.width).toBeCloseTo(10, 0);
  await page.getByRole('region', { name: 'Journey details', exact: true }).screenshot({ path: `/tmp/atlas-journey-panel-${workspace ? 'dark' : 'light'}.png` });
  const map = page.locator('.atlas-chain-map'), chart = page.locator('.atlas-trend-observations .atlas-observation-chart');
  const mapHandle = await map.elementHandle();
  const pins = map.locator('.atlas-chain-pin');
  const nodeEntries = page.locator('.atlas-chain-nodes .atlas-chain-entry');
  const journeyPane = page.getByRole('region', { name: 'Journey details', exact: true });
  await expect(journeyPane).toHaveCSS('overflow-y', 'auto');
  if (!workspace) expect((await journeyPane.boundingBox())!.height).toBeLessThanOrEqual(340);
  await map.scrollIntoViewIfNeeded();
  await journeyPane.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const mapScroll = await page.evaluate(() => scrollY);
  await pins.first().hover();
  await expect.poll(() => nodeEntries.first().locator('summary').evaluate(el => {
    const pane = el.closest('.atlas-chain-details')!, group = el.closest('.atlas-chain-group')!;
    return el.getBoundingClientRect().top >= pane.getBoundingClientRect().top + group.querySelector('summary')!.getBoundingClientRect().height;
  })).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(mapScroll);
  await expect(nodeEntries.first()).toHaveAttribute('data-highlighted', 'true');
  await expect(nodeEntries.first()).not.toHaveAttribute('open');
  await nodeEntries.nth(1).locator('summary').hover();
  await expect(pins.nth(1)).toHaveAttribute('data-highlighted', 'true');
  const routes = map.locator('.atlas-chain-edge');
  const routeEntries = page.locator('.atlas-chain-connections .atlas-chain-entry');
  await map.scrollIntoViewIfNeeded();
  const routePoint = await routes.last().locator('.atlas-chain-edge-line').evaluate(el => {
    const path = el as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.move(routePoint.x, routePoint.y);
  await expect(routeEntries.last()).toHaveAttribute('data-highlighted', 'true');
  await expect.poll(() => routeEntries.last().locator('summary').evaluate(el => el.getBoundingClientRect().bottom <= el.closest('.atlas-chain-details')!.getBoundingClientRect().bottom)).toBe(true);
  await routeEntries.last().locator('summary').hover();
  await expect(routes.last()).toHaveAttribute('data-highlighted', 'true');
  await page.locator('.atlas-chain-section').screenshot({ path: `/tmp/atlas-chain-hover-${workspace}.png` });
  await page.mouse.move(0, 0);
  await expect(map.locator('[data-highlighted]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Observations', exact: true }).click();
  const chartHandle = await chart.elementHandle();
  await chart.scrollIntoViewIfNeeded();
  const circles = chart.locator('circle');
  const rows = page.locator('.atlas-trend-observations .atlas-observation-item');
  const position = await circles.nth(3).evaluate(el => {
    const circle = el as SVGCircleElement, svg = circle.ownerSVGElement!;
    const point = new DOMPoint(circle.cx.baseVal.value, svg.viewBox.baseVal.height - 38).matrixTransform(svg.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.move(position.x, position.y);
  await expect(circles.nth(3)).toHaveAttribute('data-highlighted', 'true');
  await expect(rows.nth(3)).toHaveAttribute('data-highlighted', 'true');
  await expect(chart.locator('.atlas-observation-guide')).toHaveAttribute('d', /^M[\d.]+ 18V[\d.]+$/);
  await expect(chart.locator('.atlas-observation-guide')).toHaveCSS('stroke-width', '1px');
  await expect(page.getByLabel('Selected observation evidence')).toHaveCount(0);
  const observationPane = page.getByRole('region', { name: 'Observation details', exact: true });
  await expect(observationPane).toHaveCSS('overflow-y', 'auto');
  if (!workspace) expect((await observationPane.boundingBox())!.height).toBeLessThanOrEqual(340);
  expect(await observationPane.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const chartScroll = await page.evaluate(() => scrollY);
  const lastPoint = await circles.last().evaluate(el => {
    const c = el as SVGCircleElement;
    const p = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(c.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(lastPoint.x, lastPoint.y);
  await expect(rows.last()).toHaveAttribute('data-highlighted', 'true');
  await expect.poll(() => rows.last().evaluate(el => {
    const box = el.getBoundingClientRect(), pane = el.closest('.atlas-observation-details')!.getBoundingClientRect();
    return box.top >= pane.top && box.bottom <= pane.bottom;
  })).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(chartScroll);
  const detailScroll = await observationPane.evaluate(el => el.scrollTop);
  await page.mouse.move(lastPoint.x, lastPoint.y + 1);
  expect(await observationPane.evaluate(el => el.scrollTop)).toBe(detailScroll);
  await rows.nth(1).locator('.atlas-observation-row').hover();
  await expect(circles.nth(1)).toHaveAttribute('data-highlighted', 'true');
  await expect(circles.nth(3)).not.toHaveAttribute('data-highlighted');
  await page.locator('.atlas-trend-observations').screenshot({ path: `/tmp/atlas-observation-hover-${workspace}.png` });
  await chart.locator('.atlas-observation-connection').first().focus();
  await rows.nth(1).dispatchEvent('pointerout');
  await expect(rows.nth(0)).toHaveAttribute('data-highlighted', 'true');
  await expect(rows.nth(1)).toHaveAttribute('data-highlighted', 'true');
  await chart.locator('.atlas-observation-connection').first().blur();
  await page.mouse.move(0, 0);
  await expect(chart.locator('.atlas-observation-guide')).toHaveCount(0);

  await page.locator('.atlas-chain-pin').first().press('Enter');
  await expect(page.getByLabel('Selected chain evidence')).toBeVisible();
  const groups = page.locator('.atlas-chain-group');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0).locator(':scope > summary')).toContainText('Nodes');
  await expect(groups.nth(1).locator(':scope > summary')).toContainText('Routes');
  await page.getByLabel('Selected chain evidence').getByText('Source evidence', { exact: true }).click();
  {
    const pane = page.locator('.atlas-chain-details');
    await pane.evaluate(el => { el.scrollTop += 100; });
    const groupHeader = (await groups.first().locator(':scope > summary').boundingBox())!;
    const entryHeader = (await page.locator('.atlas-chain-entry[open] > summary').boundingBox())!;
    expect(Math.abs(entryHeader.y - groupHeader.y - groupHeader.height)).toBeLessThan(2);
    await pane.screenshot({ path: '/tmp/atlas-journey-sticky.png' });
  }
  await groups.first().locator(':scope > summary').press('Enter');
  await expect(groups.first()).not.toHaveAttribute('open');
  await expect(page.getByLabel('Selected chain evidence')).toHaveCount(0);
  await map.locator('.atlas-chain-pin').first().hover();
  await expect(groups.first()).toHaveAttribute('open');
  await expect(page.getByLabel('Selected chain evidence')).toHaveCount(0);
  await map.locator('.atlas-chain-pin').first().press('Enter');
  await expect(groups.first()).toHaveAttribute('open');
  await expect(page.getByLabel('Selected chain evidence')).toBeVisible();
  await page.locator('.atlas-chain-entry[open] > summary').press('Enter');
  await expect(page.getByLabel('Selected chain evidence')).toHaveCount(0);
  await page.locator('summary[aria-label="Reviewed chain"]').click();
  const landTransition = map.evaluate(el => new Promise<boolean>(resolve => {
    const observer = new MutationObserver(() => {
      if (el.querySelectorAll('.atlas-chain-land').length > 1) {
        clearTimeout(timeout); observer.disconnect(); resolve(true);
      }
    });
    const timeout = setTimeout(() => { observer.disconnect(); resolve(false); }, 5000);
    observer.observe(el, { childList: true, subtree: true });
  }));
  await page.getByRole('option', { name: 'Latvia measles: reported exposure and contacts', exact: true }).click();
  expect(await mapHandle!.evaluate(el => el.isConnected)).toBe(true);
  await expect(page.getByLabel('Selected chain evidence')).toHaveCount(0);
  expect(await landTransition).toBe(true);
  await expect(map.locator('.atlas-chain-land')).toHaveCount(1);
  await expect(map.locator('.atlas-chain-land').locator('..')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(map.locator('.atlas-chain-pin').first()).toHaveCSS('opacity', '1');
  await map.locator('.atlas-chain-pin').first().press('Enter');
  await expect(page.getByLabel('Selected chain evidence')).toBeVisible();
  await chart.locator('.atlas-observation-connection').first().press('Enter');
  await expect(page.getByLabel('Selected observation evidence')).toBeVisible();
  await page.locator('summary[aria-label="Observation series"]').click();
  await page.getByRole('option', { name: 'Nigeria Lassa fever · Confirmed cases · weekly reports', exact: true }).click();
  expect(await chartHandle!.evaluate(el => el.isConnected)).toBe(true);
  await expect(page.getByLabel('Selected observation evidence')).toHaveCount(0);
  await expect(chart.locator('circle').first()).toHaveAttribute('r', '5');
  await chart.locator('.atlas-observation-connection').first().press('Enter');
  await expect(page.getByLabel('Selected observation evidence')).toBeVisible();
  for (const label of ['MV Hondius: selected episode reports', 'Latvia measles: reported journey']) {
    await page.locator('summary[aria-label="Reviewed chain"]').click();
    await page.getByRole('option', { name: label, exact: true }).press('Enter');
  }
  await expect(map.locator('.atlas-chain-land')).toHaveCount(1);
  await expect(map.locator('.atlas-chain-pin')).toHaveCount(3);
  await expect(page.locator('.atlas-chain-figure')).toHaveAttribute('aria-label', 'Latvia measles: reported journey');
  expect(problems).toEqual([]);
  await expect.poll(() => map.locator('.atlas-chain-pin').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  if (workspace) await page.screenshot({ path: '/tmp/atlas-figure-transitions.png' });
  for (const action of ['date column', 'dot', 'keyboard']) {
    await chart.scrollIntoViewIfNeeded();
    const dot = chart.locator('circle').last();
    const id = await rows.last().getAttribute('data-entry-id');
    const bundle = JSON.parse(readFileSync(process.env.ATLAS_CHAINS_CANDIDATE!, 'utf8'));
    const measure = bundle.metrics.measures.find((m: { measure_id: string }) => m.measure_id === id);
    const record = bundle.records.find((r: { id: string }) => r.id === measure.source_reference.record_id);
    if (action === 'date column') {
      const position = await dot.evaluate(el => {
        const circle = el as SVGCircleElement, svg = circle.ownerSVGElement!;
        const p = new DOMPoint(circle.cx.baseVal.value, svg.viewBox.baseVal.height - 38).matrixTransform(svg.getScreenCTM()!);
        return { x: p.x, y: p.y };
      });
      await page.mouse.move(position.x, position.y);
      await expect(dot).toHaveAttribute('data-highlighted', 'true');
      await page.mouse.click(position.x, position.y);
    } else if (action === 'dot') await dot.click();
    else await dot.press('Enter');
    const report = page.locator(`[id="atlas-report-${record.document_id}"]`);
    await expect(report).toHaveAttribute('data-evidence', 'true');
    await expect(report).toHaveAttribute('open');
    await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  }
});
