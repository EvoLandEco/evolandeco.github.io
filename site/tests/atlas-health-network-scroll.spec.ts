import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';

async function openNetwork(page: Page, connections = false) {
  const data = healthPanelsFixture();
  const node = data.one_health_nodes[0];
  const domains = ['human', 'animal', 'environment', 'food', 'unknown'] as const;
  data.one_health_nodes = Array.from({ length: 20 }, (_, index) => ({
    ...node,
    id: index === 0 ? node.id : `test-network-${index}`,
    key: `network-${index}`,
    label: `Synthetic observation ${index + 1}`,
    domain: domains[index % domains.length],
  }));
  if (connections) data.one_health_relations = [
    'Reported sprout consumption',
    'Genomic association of water and representative human isolates',
    'Producer F rinsing-water isolate matched representative human sequences',
  ].map((label, index) => ({
    ...node, id: `test-connection-${index}`, key: `connection-${index}`, label,
    from_node_id: data.one_health_nodes[index].id, to_node_id: data.one_health_nodes[index + 1].id,
    kind: index === 0 ? 'exposure' : 'genomic_association', basis: 'source_reported',
    scope: 'Synthetic connection', reason: 'Synthetic support', evidence_types: [],
    directed: false, direction_basis: 'not_reported', source_certainty: { value: null, status: 'not_reported' },
    reviewed_at: '2026-09-29', reviewed_by: 'Synthetic fixture', review_state: 'source_checked_draft',
    source_assertion_id: 'test-oh-assertion',
  }));
  await routeBrowserFixture(page, data, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  await expect(page.locator('.atlas-oh-node')).toHaveCount(20);
}

test.describe('Connection entries', () => {
  test.beforeEach(async ({ page }) => openNetwork(page, true));
  for (const fullscreen of [false, true]) {
    test(`Wrapped connection entries retain spacing (${fullscreen ? 'fullscreen' : 'page'})`, async ({ page }, testInfo) => {
      if (fullscreen) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
      for (const width of [1280, 820, 390]) {
        await page.setViewportSize({ width, height: 720 });
        const entries = page.locator('.atlas-oh-relations .atlas-oh-entry');
        await expect(entries).toHaveCount(3);
        const bounds = await entries.evaluateAll(elements => elements.map(element => {
          const row = element.getBoundingClientRect();
          const content = element.querySelector('.atlas-oh-list-content')!.getBoundingClientRect();
          return { top: row.top, bottom: row.bottom, contentBottom: content.bottom };
        }));
        for (let index = 0; index < bounds.length; index++) {
          expect(bounds[index].bottom - bounds[index].contentBottom).toBeGreaterThanOrEqual(7.5);
          if (index) expect(bounds[index].top - bounds[index - 1].bottom).toBeGreaterThanOrEqual(3.5);
        }
        await entries.last().click();
        await expect(entries.last()).toHaveAttribute('aria-pressed', 'true');
      }
      await page.locator('.atlas-oh-relations').screenshot({ path: testInfo.outputPath('wrapped-connections.png') });
    });
  }

});

test.describe('Network scrolling', () => {
  test.beforeEach(async ({ page }) => openNetwork(page));

  test('Network cue scrolls the fullscreen diagram and follows its bottom edge', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    const diagram = page.getByRole('region', { name: 'One Health network diagram', exact: true });
    const more = page.locator('button[aria-label="More network observations below"]');
    await expect(diagram).toHaveCSS('scrollbar-width', 'none');
    await expect(more).toBeVisible();
    await expect(more).toHaveCSS('border-radius', '50%');
    await expect(more).toHaveAttribute('aria-controls', (await diagram.getAttribute('id'))!);
    const frame = (await page.locator('.atlas-oh-network-frame').boundingBox())!;
    const cue = (await more.boundingBox())!;
    expect(cue.y + cue.height).toBeLessThanOrEqual(frame.y + frame.height);
    await more.focus();
    await more.press('Enter');
    await expect.poll(() => diagram.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await diagram.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(more).toBeHidden();
    await expect(more).toHaveAttribute('tabindex', '-1');
    await diagram.evaluate(element => { element.scrollTop = 0; });
    await expect(more).toBeVisible();
    await diagram.focus();
    await diagram.press('PageDown');
    await expect.poll(() => diagram.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await diagram.evaluate(element => { element.scrollTop = 0; });
    await page.locator('.atlas-oh-figure').screenshot({ path: testInfo.outputPath('network-scroll-cue.png') });
    expect((await new AxeBuilder({ page }).include('.atlas-oh-network-frame').analyze()).violations).toEqual([]);
  });

  test('Network cues disappear when the diagram fits and return after resizing', async ({ page }) => {
    const more = page.locator('button[aria-label="More network observations below"]');
    await expect(more).toBeHidden();
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    await expect(more).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 1400 });
    await expect(more).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(more).toBeVisible();
  });

  test('Narrow diagrams retain horizontal scrolling without a vertical cue', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 950 });
    const diagram = page.getByRole('region', { name: 'One Health network diagram', exact: true });
    const more = page.locator('button[aria-label="More network observations below"]');
    const left = page.locator('button[aria-label="Scroll network left"]');
    const right = page.locator('button[aria-label="Scroll network right"]');
    await expect(diagram).toHaveCSS('scrollbar-width', 'none');
    await expect(more).toBeHidden();
    await expect(left).toBeHidden();
    await expect(right).toBeVisible();
    await right.click();
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expect(right).toBeHidden();
    await expect(left).toBeVisible();
    await expect(more).toBeHidden();
    await left.click();
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBe(0);
    await expect(left).toBeHidden();
    await expect(right).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.atlas-oh-figure').screenshot({ path: testInfo.outputPath('network-horizontal-cue.png') });
  });

  test('Network cues reconnect when returning from another One Health view', async ({ page }) => {
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    const more = page.locator('button[aria-label="More network observations below"]');
    await expect(more).toBeVisible();
    await page.locator('summary[aria-label="One Health view"]').click();
    await page.getByRole('option', { name: 'Evidence', exact: true }).click();
    await expect(more).toHaveCount(0);
    await page.locator('summary[aria-label="One Health view"]').click();
    await page.getByRole('option', { name: 'Network', exact: true }).click();
    await expect(more).toBeVisible();
    await more.click();
    await expect.poll(() => page.locator('.atlas-oh-network').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  });

});
