import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';

function fixture() {
  const bundle = healthPanelsFixture();
  const original = bundle.one_health_nodes[0];
  const remaining = bundle.records.filter(record => record.id !== original.record_id).slice(0, 120);
  bundle.one_health_nodes.push(...remaining.map((record, index) => ({
    ...original, id: `test-hover-${index}`, key: `hover-${index}`, record_id: record.id,
    record_ids: [record.id], document_ids: [record.document_id], topic_ids: [record.topic_id],
    assertion_ids: bundle.assertions.filter(assertion => assertion.record_id === record.id).slice(0, 1).map(assertion => assertion.id),
    evidence_ids: bundle.evidence.filter(evidence => evidence.record_id === record.id).slice(0, 1).map(evidence => evidence.id),
    eligibility: { ...original.eligibility, record_ids: [record.id] },
  })));
  return bundle;
}

test.beforeEach(async ({ page }) => {
  await routeBrowserFixture(page, fixture(), JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('One Health hover reuses report selection and fixed network geometry', async ({ page }) => {
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const view = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const node = view.locator('.atlas-oh-node').first();
  await expect(node).toBeVisible();
  const report = await view.locator('summary[aria-label="One Health report"]').innerText();
  const result = await node.evaluate(async element => {
    const figure = element.closest('svg')!;
    const geometry = () => ({ viewBox: figure.getAttribute('viewBox'), shape: element.querySelector(':scope > g')!.getAttribute('transform') });
    const before = geometry();
    let filteredItems = 0;
    const filter = Array.prototype.filter;
    Array.prototype.filter = function (...args: Parameters<typeof filter>) {
      if (this.length >= 100) filteredItems += this.length;
      return Reflect.apply(filter, this, args);
    };
    try {
      for (let i = 0; i < 8; i++) {
        element.dispatchEvent(new PointerEvent(i % 2 ? 'pointerout' : 'pointerover', { bubbles: true }));
        await new Promise(requestAnimationFrame);
      }
    } finally { Array.prototype.filter = filter; }
    return { before, after: geometry(), filteredItems };
  });
  expect(result.filteredItems).toBe(0);
  expect(result.after).toEqual(result.before);
  await node.hover();
  await expect(view.locator('.atlas-oh-node-entries [data-entry-id="test-oh-human"]')).toHaveAttribute('data-highlighted', 'true');
  await node.focus();
  await node.press('Enter');
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await expect(view.getByRole('complementary')).toContainText('Synthetic sampled population');
  await expect(view.locator('summary[aria-label="One Health report"]')).toHaveText(report, { useInnerText: true });
});

test('Observation hover avoids repeated scroll measurements and hidden report charts mount on demand', async ({ page }) => {
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.locator('summary[aria-label^="Active rules:"]').click();
  await page.locator('summary[aria-label="Reporting topic"]').click();
  await page.getByRole('checkbox', { name: 'Lassa fever · Nigeria', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Lassa fever · Nigeria', exact: true }).press('Escape');
  await page.locator('summary[aria-label^="Active rules:"]').click();
  const history = page.locator('.atlas-observations');
  await expect(history).toBeVisible();
  await expect(history.locator('.atlas-observation-chart')).toHaveCount(0);
  await history.locator(':scope > summary').click();
  const point = history.locator('circle').first();
  await expect(point).toBeVisible();
  const chart = history.locator('.atlas-observation-chart').first();
  await point.hover();
  const reads = await chart.evaluate(async element => {
    const circle = element.querySelector('circle')!;
    const bounds = Element.prototype.getBoundingClientRect;
    let count = 0;
    Element.prototype.getBoundingClientRect = function (...args) {
      if (this.matches('.atlas-observation-details, .atlas-observation-item')) count++;
      return Reflect.apply(bounds, this, args);
    };
    try {
      for (let i = 0; i < 8; i++) {
        circle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
        await new Promise(requestAnimationFrame);
      }
    } finally { Element.prototype.getBoundingClientRect = bounds; }
    return count;
  });
  expect(reads).toBe(0);
  await history.getByRole('button', { name: /^Scope & source for/ }).first().click();
  const dialog = page.getByRole('dialog').filter({ has: page.locator('.atlas-measure-details') });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('blockquote').first()).toBeVisible();
  await page.keyboard.press('Escape');
  const handle = await history.locator('.atlas-observation-chart').first().elementHandle();
  await history.locator(':scope > summary').click();
  await history.locator(':scope > summary').click();
  expect(await handle!.evaluate(element => element.isConnected)).toBe(true);
  await expect(point).toBeVisible();
});
