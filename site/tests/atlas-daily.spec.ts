import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';
import AxeBuilder from '@axe-core/playwright';
import type { DailyData } from '../src/lib/atlas-daily';
import { sourceLogos } from '../src/lib/atlas-identities';

test('Reset clears every watch report highlight through either reset control', async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const data = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  const watch = data.watch_items[0];
  for (const suffix of ['second', 'third']) {
    const documentId = `daily_${suffix}`, findingId = `finding_${suffix}`, evidenceId = `evidence_${suffix}`;
    data.documents.push({ ...data.documents[0], id: documentId, review_id: `review_${suffix}`, finding_ids: [findingId], url: `https://example.org/${suffix}` });
    data.findings.push({ ...data.findings[0], id: findingId, document_id: documentId, review_id: `review_${suffix}`, evidence_ids: [evidenceId] });
    data.evidence.push({ ...data.evidence[0], id: evidenceId, document_id: documentId });
    watch.document_ids.push(documentId); watch.finding_ids.push(findingId); watch.evidence_ids.push(evidenceId); watch.finding_keys.push(`${documentId}:count`);
  }
  data.watch_assessments = structuredClone(data.watch_items);
  await page.route(/\/daily\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('current.json') ? dailyPointer(data) : data) }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('/atlas/');
  const highlights = page.locator('.atlas-report-list > .atlas-report[data-evidence="true"]');
  for (const name of ['Reset all', 'Reset all filters and rules']) {
    await page.getByRole('tab', { name: 'Trends', exact: true }).click();
    await page.locator('.atlas-daily-watch').getByRole('button', { name: 'View reports', exact: true }).click();
    await expect(highlights).toHaveCount(3);
    await expect(highlights.first().locator(':scope > summary')).toBeFocused();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(highlights).toHaveCount(0);
    await expect(page.locator('.atlas-rules > summary')).toHaveAttribute('aria-label', 'Active rules: 0');
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.locator('.atlas-latest-entry').first().click();
  await expect(highlights).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset all filters and rules', exact: true }).click();
  await expect(highlights).toHaveCount(0);
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.locator('.atlas-daily-watch').getByRole('button', { name: 'View reports', exact: true }).click();
  await page.getByRole('button', { name: '3 months', exact: true }).click();
  await expect(highlights).toHaveCount(0);
});

test('Mobile watch cards load three at a time without an inner scroll area', async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const data = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  const attention = ['watch', 'heightened', 'urgent'] as const;
  data.watch_items = Array.from({ length: 7 }, (_, index) => ({ ...data.watch_items[0], id: `watch_${index}`, key: `event_${index}`, attention: attention[index % attention.length] }));
  data.watch_assessments = structuredClone(data.watch_items);
  await page.route(/\/daily\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('current.json') ? dailyPointer(data) : data) }));
  await page.setViewportSize({ width: 390, height: 832 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('/atlas/');
  const cards = page.locator('.atlas-daily-watch:visible');
  const more = page.getByRole('button', { name: 'Load more', exact: true });
  await expect(cards.locator('[title="Editorial attention"]')).toHaveText(['Watch', 'Heightened attention', 'Urgent follow-up']);
  for (const label of await cards.locator('[title="Editorial attention"]').all()) {
    await expect(label.locator('svg')).toBeVisible();
    await expect(label.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  for (const count of [3, 6, 7]) {
    await expect(cards).toHaveCount(count);
    await expect(page.locator('.atlas-watch-list')).toHaveCSS('overflow-y', 'visible');
    expect(await page.locator('.atlas-watch-list').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    const watch = await page.locator('.atlas-watch').boundingBox(), latest = await page.locator('.atlas-latest').boundingBox();
    expect(watch!.y + watch!.height).toBeLessThan(latest!.y);
    if (count < 7) await more.click();
  }
  await expect(more).toHaveCount(0);
  await page.reload();
  await expect(cards).toHaveCount(3);
  await page.setViewportSize({ width: 1466, height: 832 });
  await expect(cards).toHaveCount(7);
  await expect(more).not.toBeVisible();
});

test('Source marks decode from local assets', async ({ page, baseURL }) => {
  await page.setContent(`<div style="display:flex;gap:20px;padding:24px">${[...new Set(Object.values(sourceLogos))].map(file => `<img alt="${file}" width="32" height="32" style="object-fit:contain" src="${baseURL}/logos/atlas/${file}">`).join('')}</div>`);
  for (const img of await page.getByRole('img').all()) {
    await expect(img).toHaveJSProperty('complete', true);
    expect(await img.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.screenshot({ path: '/tmp/atlas-source-marks.png' });
});

for (const width of [390, 1466]) test(`Daily reports retain evidence and stay outside scientific panels at ${width}px`, async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const browserManifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const data = dailyFixture(releaseSchema.parse(fixture.release), browserManifest.source.manifest.sha256);
  await page.route(/\/daily\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('current.json') ? dailyPointer(data) : data) }));
  await page.setViewportSize({ width, height: 832 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-daily-watch')).toContainText('12 reported cases in France');
  await expect(page.getByRole('heading', { name: 'Reporting activity', exact: true })).toBeVisible();
  await expect(page.locator('.atlas-disease-ring')).toBeVisible();
  if (width === 1466) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).click();
    const watch = await page.locator('.atlas-watch').boundingBox(), latest = await page.locator('.atlas-latest').boundingBox();
    expect(watch!.y).toBeCloseTo(latest!.y, 0);
    expect(watch!.height).toBeCloseTo(latest!.height, 0);
    expect(watch!.x + watch!.width).toBeLessThan(latest!.x);
  }
  await page.screenshot({ path: `/tmp/atlas-daily-${width}.png`, fullPage: width === 390 });
  await expect(page.getByRole('button', { name: 'Daily sources', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Daily sources', exact: true })).toHaveCount(0);
  const weeklyCount = await page.locator('.atlas-trend-activity header strong').innerText();
  const latest = page.locator('.atlas-latest-entry');
  await expect(latest.locator('.atlas-status')).toHaveCount(0);
  await expect(latest.first()).toContainText('Latest daily report');
  await expect(latest.first().locator('img')).toHaveAttribute('src', '/logos/atlas/spf.svg');
  await expect(page.locator('.atlas-latest-list')).not.toContainText('Investigation in France');
  const publicationDates = await latest.locator('time').evaluateAll(elements => elements.map(element => element.getAttribute('datetime')));
  expect(publicationDates).toEqual([...publicationDates].sort().reverse());
  await latest.first().click();
  await expect(page.locator('#atlas-report-daily_latest')).toHaveAttribute('open', '');
  await expect(page.locator('#atlas-report-daily_latest')).toContainText('Weekly review pending');
  await expect(page.locator('#atlas-report-daily_latest .atlas-daily-processing')).toHaveCount(1);
  await expect(page.locator('#atlas-report-daily_latest > summary img')).toHaveAttribute('src', '/logos/atlas/spf.svg');
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(page.locator('.atlas-daily-watch details')).toHaveCount(0);
  await page.locator('.atlas-daily-watch').getByRole('button', { name: 'View reports', exact: true }).click();
  await expect(page.locator('.atlas-report-list > .atlas-report[data-evidence="true"]')).toHaveCount(1);
  await expect(page.locator('.atlas-report-focus')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show all reports', exact: true })).toHaveCount(0);
  const report = page.locator('#atlas-report-daily_doc');
  await report.locator(':scope > summary').click();
  await expect(report).toHaveAttribute('open', '');
  await expect(report).toContainText('Weekly review pending');
  await expect(report.locator('.atlas-daily-processing')).toHaveCount(1);
  await expect(report.locator('.atlas-daily-finding, .atlas-daily-places, .atlas-report-body .atlas-status')).toHaveCount(0);
  await expect(report.locator('.atlas-report-meta').first()).toContainText('Captured 7 Oct 2026');
  await expect(report.getByRole('link', { name: 'Read source' })).toHaveAttribute('href', 'https://example.org/daily');
  await expect(report.locator('.atlas-claim > p')).toHaveText('12 reported cases in France.');
  await report.getByText('Source quotation', { exact: true }).click();
  await expect(report.locator('.atlas-claim')).toContainText('Unconfirmed');
  await expect(report.locator('.atlas-quotation-pair')).toContainText('Enquête en France');
  await expect(report.locator('.atlas-quotation-translation')).toContainText('Investigation in France');
  await page.locator('.atlas-rules > summary').click();
  await page.getByRole('button', { name: 'Clear evidence highlights', exact: true }).click();
  await page.locator('.atlas-rules > summary').press('Escape');
  await expect(page.locator('.atlas-report-list > .atlas-report[data-evidence="true"]')).toHaveCount(0);
  await expect(page.locator('#atlas-report-daily_latest')).toBeVisible();
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.locator('summary[aria-label="Reporting source"]').click();
  const sourceMenu = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Reporting source"]') });
  await sourceMenu.getByRole('checkbox', { name: 'Santé publique France', exact: true }).check();
  await sourceMenu.getByRole('checkbox', { name: 'Santé publique France', exact: true }).press('Escape');
  await expect(page.locator('.atlas-daily-watch')).toBeVisible();
  await expect(page.locator('.atlas-trend-activity header strong')).toHaveText('2 reports');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-daily-report')).toHaveCount(2);
  await page.locator('summary[aria-label="Reporting disease"]').click();
  const diseaseMenu = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Reporting disease"]') });
  await diseaseMenu.getByRole('checkbox', { name: /Unclassified disease/ }).check();
  await diseaseMenu.getByRole('checkbox', { name: /Unclassified disease/ }).press('Escape');
  await expect(page.locator('.atlas-daily-report')).toHaveCount(0);
  await expect(page.locator('.atlas-report-prelude')).not.toContainText('no reviewed disease');
  expect(weeklyCount).not.toEqual('2 reports');
});

for (const width of [390, 1466]) test(`The sealed daily preview exposes every selected watch fact and its source evidence at ${width}px`, async ({ page }) => {
  test.skip(!process.env.ATLAS_DAILY_PREVIEW || !process.env.ATLAS_DAILY_FILE, 'Requires the matching sealed daily release');
  const data: DailyData = JSON.parse(readFileSync(process.env.ATLAS_DAILY_FILE!, 'utf8'));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 832 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(data.generated_at) });
  await page.goto(process.env.ATLAS_DAILY_PREVIEW!);
  await expect(page.locator('.atlas-daily-attention-scope')).toHaveAttribute('aria-label', 'Weekly reviewed reports');
  if (width === 1466) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(data.watch_items.length);
  if (width === 390) {
    await expect(page.locator('.atlas-daily-watch:visible')).toHaveCount(Math.min(3, data.watch_items.length));
    while (await page.getByRole('button', { name: 'Load more', exact: true }).isVisible()) await page.getByRole('button', { name: 'Load more', exact: true }).click();
  }
  for (const card of await page.locator('.atlas-daily-watch').all()) {
    const id = await card.getAttribute('data-daily-watch');
    const item = data.watch_items.find(item => item.id === id)!;
    await expect(card.locator('h3')).not.toHaveText('');
    await expect(card.locator('.atlas-watch-facts > div')).toHaveCount(item.key_facts.length);
    await expect(card.locator('.atlas-watch-kicker')).toContainText(item.location_label);
    if (item.development_date) await expect(card.locator('.atlas-watch-kicker time')).toContainText(item.date_basis === 'source_report_date' ? 'Report' : 'Event');
    await expect(card.locator('.atlas-watch-diagnosis > strong')).toHaveText(item.diagnostic_label);
    await expect(card.locator('.atlas-watch-facts dt')).toHaveText(item.key_facts.map(fact => fact.label));
    await expect(card.locator('.atlas-watch-facts dd')).toHaveText(item.key_facts.map(fact => fact.text));
    await expect(card.locator('details')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'View reports', exact: true })).toBeVisible();
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).include('.atlas-watch').include('.atlas-latest').analyze()).violations).toEqual([]);
  if (width === 1466) await expect.poll(() => page.locator('.atlas-latest-list').evaluate(el => el.children.length === Math.max(1, Math.floor((Math.round(el.getBoundingClientRect().height) - 84) / 84)) + 1)).toBe(true);
  await page.screenshot({ path: `/tmp/atlas-daily-live-${width}.png` });
  const item = data.watch_items.find(item => item.document_ids.length > 1) ?? data.watch_items[0];
  if (item) {
    const card = page.locator(`[data-daily-watch="${item.id}"]`);
    await card.getByRole('button', { name: 'View reports', exact: true }).click();
    await expect(page.locator('.atlas-report-focus')).toHaveCount(0);
    await expect(page.locator('.atlas-report-list > .atlas-report')).toHaveCount(12);
    const reports = page.locator('.atlas-report-list > .atlas-report[data-evidence="true"]');
    await expect(reports).toHaveCount(item.document_ids.length);
    for (const summary of await reports.locator(':scope > summary').all()) await summary.click();
    await expect.poll(async () => new Set(await reports.getByRole('link', { name: 'Read source', exact: true }).evaluateAll(elements => elements.map(element => element.getAttribute('href')))))
      .toEqual(new Set(data.documents.filter(doc => item.document_ids.includes(doc.id)).map(doc => doc.url)));
    await page.screenshot({ path: `/tmp/atlas-watch-relevant-reports-${width}.png` });
    await page.locator('.atlas-rules > summary').click();
    await expect(page.getByRole('button', { name: 'Clear evidence highlights', exact: true })).toContainText(`${item.document_ids.length} reports`);
    await page.getByRole('button', { name: 'Clear evidence highlights', exact: true }).click();
    await page.locator('.atlas-rules > summary').press('Escape');
    await expect(reports).toHaveCount(0);
    for (const name of ['Reset all', 'Reset all filters and rules']) {
      await page.getByRole('tab', { name: 'Trends', exact: true }).click();
      await card.getByRole('button', { name: 'View reports', exact: true }).click();
      await expect(reports).toHaveCount(item.document_ids.length);
      await page.getByRole('button', { name, exact: true }).click();
      await expect(reports).toHaveCount(0);
    }
    await expect(page.locator('.atlas-report-list > .atlas-report')).toHaveCount(12);
    await page.getByRole('tab', { name: 'Trends', exact: true }).click();
    if (width === 1466) await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await card.screenshot({ path: `/tmp/atlas-daily-watch-card-${width}.png` });
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 1466]) test(`Daily watch board supports empty and multiple selected events at ${width}px`, async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const data = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  const selected = data.watch_items[0];
  data.documents[1].finding_ids = ['finding_second'];
  data.findings.push({ ...data.findings[0], id: 'finding_second', key: 'second', document_id: 'daily_latest', review_id: 'review_latest', evidence_ids: ['evidence_second'] });
  data.evidence.push({ ...data.evidence[0], id: 'evidence_second', document_id: 'daily_latest' });
  data.watch_items = [];
  await page.route(/\/daily\//, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('current.json') ? dailyPointer(data) : data) }));
  await page.setViewportSize({ width, height: 832 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-daily-attention-scope')).toBeVisible();
  await expect(page.locator('.atlas-daily-watch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0);
  await expect(page.locator('.atlas-watch-list')).toContainText('No current watch selections');
  await expect(page.locator('.atlas-latest-list')).toContainText('Investigation in France');
  data.watch_items = [selected, { ...selected, id: 'watch_second', key: 'second', label: 'Second test event', finding_keys: ['daily_latest:second'], development_finding_keys: ['daily_latest:second'], follow_up_finding_keys: ['daily_latest:second'], criteria: [{ ...selected.criteria[0], finding_keys: ['daily_latest:second'] }], key_facts: [{ ...selected.key_facts[0], finding_keys: ['daily_latest:second'], finding_ids: ['finding_second'] }], finding_ids: ['finding_second'], evidence_ids: ['evidence_second'], document_ids: ['daily_latest'] }];
  data.watch_assessments = structuredClone(data.watch_items);
  await page.reload();
  const cards = page.locator('.atlas-daily-watch');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0);
  const boxes = await cards.evaluateAll(elements => elements.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, overflow: el.scrollWidth - el.clientWidth })));
  expect(boxes.every(box => box.overflow <= 1)).toBe(true);
  expect(boxes[0].x).toBe(boxes[1].x);
  const watchBox = await page.locator('.atlas-watch').boundingBox(), latestBox = await page.locator('.atlas-latest').boundingBox();
  if (width === 1466) {
    expect(watchBox!.y).toBeCloseTo(latestBox!.y, 0);
    expect(watchBox!.x + watchBox!.width).toBeLessThan(latestBox!.x);
  } else {
    expect(watchBox!.x).toBe(latestBox!.x);
    expect(watchBox!.y + watchBox!.height).toBeLessThan(latestBox!.y);
  }
  await expect(cards.locator('details')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('.atlas-watch').analyze()).violations).toEqual([]);
  await page.locator('.atlas-watch-cards').screenshot({ path: `/tmp/atlas-watch-hero-multiple-${width}.png` });
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await expect(cards).toHaveCount(2);
  await page.reload();
  await expect(cards).toHaveCount(2);
  data.watch_items = [];
  data.daily_id = 'e'.repeat(64);
  await page.reload();
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.atlas-watch-list')).toContainText('No current watch selections');
  await expect(page.locator('.atlas-latest-list')).toContainText('Investigation in France');
  await expect(page.getByRole('button', { name: 'Daily sources', exact: true })).toHaveCount(0);
});
