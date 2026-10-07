import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareBrowserView, type AtlasBrowserCore, type AtlasBrowserManifest, type AtlasBrowserMap, type AtlasDetailCollections, type AtlasBrowserDetailIndex, type AtlasBrowserDetailPartition } from '../src/lib/atlas-browser';
import { healthEntryIndex, healthPanelForEntry } from '../src/lib/atlas-health-entries';
import { observationTimeLabel } from '../src/lib/atlas-health-time';
import type { AtlasRelease } from '../src/lib/atlas-release';
import { createResearch } from '../src/lib/atlas-comparisons';
import { metricValue } from '../src/lib/atlas-metrics';
import { formatDate, supported } from '../src/lib/atlas';
import { validateNetworkTransport, parseNetworkAnalysis, selectNetworkReview } from '../src/lib/atlas-network-analysis';

function candidate() {
  test.skip(!process.env.ATLAS_BROWSER_CANDIDATE, 'Requires the validated browser transport candidate');
  expect(process.env.ATLAS_RELEASE_FILE).toBeTruthy();
  const directory = process.env.ATLAS_BROWSER_CANDIDATE!;
  const release = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE!, 'utf8')) as AtlasRelease;
  const manifestBytes = readFileSync(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString()) as AtlasBrowserManifest;
  const descriptor = { sha256: createHash('sha256').update(manifestBytes).digest('hex'), bytes: manifestBytes.length };
  const core = JSON.parse(readFileSync(path.join(directory, manifest.core), 'utf8')) as AtlasBrowserCore;
  const { data, select } = prepareBrowserView(core, release.export_id);
  const selection = select(data.snapshot.publication_from, data.snapshot.publication_until);
  const health = selection.one_health!;
  const entries = healthEntryIndex(health);
  const index = JSON.parse(readFileSync(path.join(directory, manifest.detail_index), 'utf8')) as AtlasBrowserDetailIndex;
  function read<K extends keyof AtlasDetailCollections>(collection: K, id: string): AtlasDetailCollections[K] {
    const wire = collection.startsWith('map.') ? collection : `site.${collection}`;
    const row = index.collections[wire].find(row => row[0] === id)!;
    const partition = JSON.parse(readFileSync(path.join(directory, index.partitions[row[1]]), 'utf8')) as AtlasBrowserDetailPartition;
    return partition.rows.find(row => row.collection === wire && row.id === id)!.value as AtlasDetailCollections[K];
  }
  const label = (recordId: string) => {
    const record = data.records.find(record => record.id === recordId)!;
    return `${data.topics.find(topic => topic.id === record.topic_id)!.label} · ${data.documents.find(document => document.id === record.document_id)!.title}`;
  };
  return { directory, release, manifest, descriptor, data, health, entries, index, selection, select, read, label };
}

async function serve(page: Page, source: ReturnType<typeof candidate>, beforeAsset?: (asset: string) => Promise<void>) {
  const { directory, release, manifest, descriptor } = source;
  if (release.intelligence && process.env.ATLAS_INTELLIGENCE_FILE && !process.env.ATLAS_PUBLIC_BROWSER) {
    await page.route(`**/intelligence/${release.intelligence.experiment_id}/intelligence.json`, route => route.fulfill({ contentType: 'application/json', body: readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!) }));
  }
  const requests: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/current.json', route => route.fulfill({ json: { ...release, browser: { transport_version: manifest.transport_version, manifest: descriptor } } }));
  await page.route(`**/releases/${release.export_id}/browser/${descriptor.sha256}/**`, async route => {
    const asset = route.request().url().split(`/browser/${descriptor.sha256}/`)[1];
    requests.push(asset);
    await beforeAsset?.(asset);
    if (route.request().failure()) return;
    if (process.env.ATLAS_PUBLIC_BROWSER) await route.continue();
    else await route.fulfill({ contentType: 'application/json', body: readFileSync(path.join(directory, asset)) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  return { requests, errors, details: () => requests.filter(asset => manifest.assets[asset]?.kind === 'detail') };
}

async function choose(view: Page | Locator, label: string, value: string, id?: string) {
  const menu = view.locator(`summary[aria-label="${label}"]`).locator('..');
  await menu.locator('summary').click();
  const search = menu.getByRole('searchbox');
  if (await search.count()) await search.fill(value);
  const option = menu.getByRole('option', { name: value, exact: true });
  await (id ? option.and(menu.locator(`button[value="${id}"]`)) : option).click();
}

async function expectCountryText(locator: Locator, text: string) {
  await expect(locator).toBeAttached();
  const value = await locator.evaluate(element => {
    const copy = element.cloneNode(true) as Element;
    for (const flag of copy.querySelectorAll('.atlas-country-inline')) {
      const next = flag.nextSibling;
      if (next?.nodeType === Node.TEXT_NODE && next.textContent?.startsWith('\u00a0')) next.textContent = next.textContent.slice(1);
      flag.remove();
    }
    return copy.textContent;
  });
  expect(value).toBe(text);
}

test('One Health restores A after an interrupted B detail request without stale evidence', async ({ page }) => {
  const source = candidate();
  const { health, entries, index, label } = source;
  const evidenceOwners = new Map(index.collections['site.evidence'].map(([id, owner]) => [id, index.partitions[owner]]));
  const first = health.nodes[0];
  const second = health.nodes.find(node => node.evidence_ids.length && node.record_id !== first.record_id &&
    !entries.get(node.record_id)!.nodeIds.has(first.id) && evidenceOwners.get(node.evidence_ids[0]) !== evidenceOwners.get(first.evidence_ids[0]))!;
  expect(first.evidence_ids.length).toBeGreaterThan(0);
  expect(second).toBeTruthy();
  const blockedPath = evidenceOwners.get(second.evidence_ids[0])!;
  const evidence = source.read('evidence', first.evidence_ids[0]);
  let unblock!: () => void;
  const blocked = new Promise<void>(resolve => { unblock = resolve; });
  const { requests, errors, details } = await serve(page, source, asset => asset === blockedPath ? blocked : Promise.resolve());
  try {
    await page.getByRole('tab', { name: 'One Health', exact: true }).click();
    const view = page.getByRole('region', { name: 'One Health evidence', exact: true });
    const detail = view.getByRole('complementary', { name: 'One Health source details' });
    await expect(detail.locator('h3')).toHaveText(first.label);
    await expect(detail.locator('.atlas-oh-source blockquote').first()).toHaveText(evidence.quote);
    await choose(view, 'One Health report', label(second.record_id), second.record_id);
    await expect.poll(() => requests.includes(blockedPath)).toBe(true);
    await expect(detail.getByRole('status')).toHaveText('Loading source details…');
    await expect(detail.locator('blockquote')).toHaveCount(0);
    await choose(view, 'One Health report', label(first.record_id), first.record_id);
    await expect(detail.locator('h3')).toHaveText(first.label);
    await expect(detail.locator('.atlas-oh-source blockquote').first()).toHaveText(evidence.quote);
    unblock();
    const count = details().length;
    await view.locator('.atlas-oh-node').last().hover();
    await expect(view.locator('.atlas-oh-node-entries [data-highlighted="true"]')).toHaveCount(1);
    await expect(detail.locator('h3')).toHaveText(first.label);
    await expect(detail.locator('.atlas-oh-source blockquote').first()).toHaveText(evidence.quote);
    expect(details().length).toBe(count);
    expect(errors).toEqual([]);
  } finally { unblock(); }
});

test('Reports hydrate exact claims and comparison evidence across collapse and pagination', async ({ page }) => {
  const source = candidate();
  const comparison = source.read('comparisons', source.selection.comparison_ids[0]);
  const assertion = comparison.participant_ids.map(id => source.read('assertions', id)).find(row => row.evidence_ids.length)!;
  const record = source.read('map.records', assertion.record_id);
  const evidence = source.read('evidence', assertion.evidence_ids[0]);
  const documents = source.data.documents.filter(document => source.data.records.some(record => record.document_id === document.id))
    .sort((a, b) => b.publication.localeCompare(a.publication) || a.id.localeCompare(b.id));
  const pageIndex = Math.floor(documents.findIndex(document => document.id === record.document_id) / 12);
  const pages = Math.ceil(documents.length / 12);
  const { errors, details } = await serve(page, source);
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const changePage = (index: number) => choose(page, 'Report page, bottom', `Page ${index + 1} of ${pages}`);
  await changePage(pageIndex);
  const report = page.locator(`#atlas-report-${record.document_id}`);
  await report.locator(':scope > summary').click();
  await expect(report.locator('.atlas-claim > p').filter({ hasText: record.claims[0].text })).toHaveCount(1);
  const branch = report.locator('.atlas-comparison').filter({ has: page.locator('.atlas-comparison-reason', { hasText: comparison.reason }) })
    .locator('.atlas-assertion').nth(comparison.participant_ids.indexOf(assertion.id));
  await expect(branch).toContainText(comparison.participant_labels[assertion.id as keyof typeof comparison.participant_labels]);
  await branch.locator('summary').click();
  await expectCountryText(branch.locator('blockquote').first(), evidence.quote);
  await branch.locator('summary').click();
  await expect(branch.locator('blockquote')).toHaveCount(0);
  await branch.locator('summary').click();
  await expectCountryText(branch.locator('blockquote').first(), evidence.quote);
  const requests = details().length;
  await report.locator(':scope > summary').click();
  await report.locator(':scope > summary').click();
  await expect(branch.locator('blockquote').first()).toBeVisible();
  expect(details().length).toBe(requests);
  await changePage(pageIndex === 0 ? 1 : 0);
  await expect(report).toHaveCount(0);
  await changePage(pageIndex);
  await expect(report).toHaveAttribute('open', '');
  await expect(report.locator('.atlas-claim > p').filter({ hasText: record.claims[0].text })).toHaveCount(1);
  await branch.locator('summary').click();
  await expectCountryText(branch.locator('blockquote').first(), evidence.quote);
  expect(errors).toEqual([]);
});

test('Selected geographic evidence unmounts on manual collapse and restores exact source quotations', async ({ page }) => {
  const source = candidate();
  const map = JSON.parse(readFileSync(path.join(source.directory, source.manifest.map_core), 'utf8')) as AtlasBrowserMap;
  const { errors } = await serve(page, source);
  await page.getByRole('tab', { name: 'Geographic links', exact: true }).click();
  const entries = page.locator('.atlas-connection[data-link-id]');
  await expect(entries.first()).toBeVisible();
  const ids = await entries.evaluateAll(elements => elements.map(element => element.getAttribute('data-link-id')));
  const link = map.map_links.find(link => ids.includes(link.id) && link.support.some(([id, index]) =>
    source.read('map.records', String(id)).claims.some(claim => claim.claim_index === index && claim.quotes.length)))!;
  const quotes = link.support.flatMap(([id, index]) => source.read('map.records', String(id)).claims.find(claim => claim.claim_index === index)!.quotes);
  const entry = page.locator(`.atlas-connection[data-link-id="${link.id}"]`);
  const disclosure = entry.locator('details').filter({ has: page.locator('.atlas-evidence-summary') });
  await expect(disclosure.locator('.atlas-evidence')).toHaveCount(0);
  await entry.getByRole('button', { name: `Locate ${link.label}`, exact: true }).click();
  await expect(entry).toHaveAttribute('data-selected', 'true');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure.locator('blockquote')).toHaveText(quotes);
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(disclosure.locator('.atlas-evidence')).toHaveCount(0);
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure.locator('blockquote')).toHaveText(quotes);
  const other = page.locator(`.atlas-connection[data-link-id="${ids.find(id => id !== link.id)}"]`);
  await other.getByRole('button', { name: /^Locate / }).click();
  await expect(entry).toHaveAttribute('data-selected', 'false');
  await expect(disclosure.locator('.atlas-evidence')).toHaveCount(0);
  await entry.getByRole('button', { name: `Locate ${link.label}`, exact: true }).click();
  await expect(disclosure.locator('blockquote')).toHaveText(quotes);
  expect(errors).toEqual([]);
});

test('Trends hydrate exact measure scope and reviewed series passages on disclosure', async ({ page }) => {
  const source = candidate();
  const series = source.selection.reviewed_series.find(series => series.connections.some(connection => connection.evidence_ids.length))!;
  const fullSeries = source.read('metrics.reviewed_series', series.series_id);
  const { errors } = await serve(page, source);
  await choose(page, 'Observation series', series.label);
  const plot = page.locator('.atlas-trend-observations figure');
  const measure = source.read('metrics.measures', series.members[0].measure_id);
  await plot.getByRole('button', { name: /^Scope & source/ }).first().click();
  const dialog = page.getByRole('dialog', { name: /^Scope & source/ });
  const measureQuotes = measure.evidence_references.flatMap(reference => reference.quotes);
  await expect(dialog.locator('blockquote')).toHaveCount(measureQuotes.length);
  for (const [index, quote] of measureQuotes.entries()) await expectCountryText(dialog.locator('blockquote').nth(index), quote);
  await expect(dialog.locator('.atlas-measure-details > a')).toHaveAttribute('href', measure.source_url);
  await page.keyboard.press('Escape');
  await expect(dialog.locator('blockquote')).toHaveCount(0);
  const connection = series.connections.find(connection => connection.evidence_ids.length)!;
  await plot.locator(`[data-connection="${connection.id}"]`).press('Enter');
  const selected = plot.getByLabel('Selected observation evidence');
  await selected.getByText('Comparison method & evidence', { exact: true }).click();
  const quotes = fullSeries.evidence.filter(row => connection.evidence_ids.includes(row.id)).map(row => row.quote);
  await expect(selected.locator('blockquote')).toHaveText(quotes);
  await selected.getByText('Comparison method & evidence', { exact: true }).click();
  await expect(selected.locator('blockquote')).toHaveCount(0);
  await selected.getByText('Comparison method & evidence', { exact: true }).click();
  await expect(selected.locator('blockquote')).toHaveText(quotes);
  expect(errors).toEqual([]);
});

test('One Health views retain source evidence, sampling measures and empty selections', async ({ page }) => {
  const source = candidate();
  const { health, entries, label, read } = source;
  const { errors } = await serve(page, source);
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const view = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const detail = view.getByRole('complementary');
  const setMode = (name: string) => choose(view, 'One Health view', name);
  await expect(view.locator('.atlas-oh-node').first()).toBeVisible();
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', health.nodes[0].evidence_ids[0]).quote);
  await setMode('Evidence');
  const relation = health.relations.find(row => entries.get(health.nodes[0].record_id)!.nodeIds.has(row.from_node_id))!;
  await expect(view.getByRole('table')).toBeVisible();
  await expect(detail.locator('h3')).toHaveText(relation.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('assertions', relation.source_assertion_id).text);
  await setMode('Overview');
  await expect(view.locator('.atlas-oh-overview-scroll tbody tr').first()).toBeVisible();
  await expect(view.getByRole('complementary')).toHaveCount(0);
  await setMode('Sampling');
  const samplingRows = [...health.sampling_assessments, ...health.undated_sampling_assessments];
  const sampling = samplingRows.find(row => row.evidence_ids.length && (row.positive_measure_id || row.tested_measure_id))!;
  await choose(view, 'One Health report', label(sampling.record_id), sampling.record_id);
  const samplingNode = [...health.nodes, ...health.undated_nodes].find(node => node.id === sampling.node_id)!;
  const rowIndex = samplingRows.filter(row => healthPanelForEntry(row, sampling.record_id, entries.get(sampling.record_id)!.nodeIds)).findIndex(row => row.id === sampling.id);
  await view.getByRole('table', { name: 'Reviewed sampling and positivity' }).locator('tbody tr').nth(rowIndex).getByRole('button', { name: samplingNode.label, exact: true }).click();
  await expect(detail.locator('h3')).toHaveText(samplingNode.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', sampling.evidence_ids[0]).quote);
  const measureId = sampling.positive_measure_id ?? sampling.tested_measure_id;
  if (measureId) await expect(detail.locator('.atlas-oh-measure')).toContainText(read('metrics.measures', measureId).label);
  await setMode('Timeline');
  const timing = health.timings.find(row => row.evidence_ids.length)!;
  await choose(view, 'One Health report', label(timing.record_id), timing.record_id);
  const timingNode = [...health.nodes, ...health.undated_nodes].find(node => node.id === timing.node_id)!;
  await view.getByRole('button', { name: `${timingNode.label}. ${timing.time.kind.replaceAll('_', ' ')}. ${observationTimeLabel(timing.time)}`, exact: true }).press('Enter');
  await expect(detail.locator('h3')).toHaveText(timingNode.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', timing.evidence_ids[0]).quote);
  const context = health.contexts.find(row => row.evidence_ids.length)!;
  await choose(view, 'One Health report', label(context.record_id), context.record_id);
  if (source.data.records.filter(record => label(record.id) === label(context.record_id)).length > 1) {
    const document = source.data.documents.find(document => document.record_ids.includes(context.record_id))!;
    await expect(view.locator('summary[aria-label="One Health report"]')).toContainText(`Captured ${formatDate(document.capture)}`);
    const menu = view.locator('summary[aria-label="One Health report"]').locator('..');
    await menu.locator('summary').click();
    await menu.getByRole('searchbox').fill(label(context.record_id));
    for (const option of await menu.getByRole('option').all()) await expect(option).toContainText('Captured');
    await page.screenshot({ path: '/tmp/atlas17-capture-choices.png' });
    await menu.getByRole('searchbox').press('Escape');
  }
  await view.locator('.atlas-oh-time-point').filter({ has: page.locator('.atlas-oh-time-label strong', { hasText: context.label }) }).press('Enter');
  await expect(detail.locator('h3')).toHaveText(context.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', context.evidence_ids[0]).quote);
  const layers = view.getByRole('group', { name: 'Timeline layers' });
  for (const name of ['Observations', 'Environment', 'Interventions']) await layers.getByRole('button', { name, exact: true }).click();
  await expect(detail).toContainText('Select a report with reviewed statements for this view.');
  await expect(detail.locator('blockquote')).toHaveCount(0);
  await expect(view.locator('.atlas-oh-time-point')).toHaveCount(0);
  const emptyRecord = [...entries].find(([, entry]) => entry.counts.network === 0)![0];
  await setMode('Network');
  await choose(view, 'One Health report', label(emptyRecord), emptyRecord);
  await expect(view.locator('.atlas-oh-node')).toHaveCount(0);
  await expect(detail).toContainText('No eligible observations. Try another report or filter.');
  expect(errors).toEqual([]);
});

test('Largest report retains every figure and claim with measured open and tab timings', async ({ page }, testInfo) => {
  const source = candidate();
  const records = new Map(source.data.records.map(record => [record.id, record]));
  const measures = new Map(source.data.metrics.measures.map(measure => [measure.measure_id, measure]));
  const totals = new Map<string, number>();
  for (const panel of source.selection.panels.filter(panel => panel.kind === 'record')) {
    const document = records.get(panel.id)!.document_id;
    totals.set(document, (totals.get(document) ?? 0) + panel.measure_ids.length);
  }
  const documentId = [...totals].sort((a, b) => b[1] - a[1])[0][0];
  const recordIds = new Set(source.data.records.filter(record => record.document_id === documentId).map(record => record.id));
  const assertions = new Map(source.data.assertions.map(assertion => [assertion.id, assertion]));
  const compared = new Set(source.data.comparisons.filter(comparison => source.selection.comparison_ids.includes(comparison.id) && comparison.participant_ids.some(id => recordIds.has(assertions.get(id)!.record_id)))
    .flatMap(comparison => comparison.participant_ids).map(id => assertions.get(id)!.measure_id));
  const expected = source.selection.panels.filter(panel => panel.kind === 'record' && recordIds.has(panel.id)).flatMap(panel => [...new Set(panel.measure_ids)].filter(id => !compared.has(id))).map(id => measures.get(id)!);
  const claims = [...recordIds].flatMap(id => source.read('map.records', id).claims);
  const documents = [...source.data.documents].sort((a, b) => b.publication.localeCompare(a.publication) || a.id.localeCompare(b.id));
  const pageIndex = Math.floor(documents.findIndex(document => document.id === documentId) / 12), pages = Math.ceil(documents.length / 12);
  const { errors } = await serve(page, source);
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await choose(page, 'Report page, bottom', `Page ${pageIndex + 1} of ${pages}`);
  const report = page.locator(`#atlas-report-${documentId}`);
  const measurement = async () => ({ performance: (await session.send('Performance.getMetrics')).metrics.filter(metric => ['JSHeapUsedSize', 'JSHeapTotalSize', 'TaskDuration'].includes(metric.name)), dom: await session.send('Memory.getDOMCounters') });
  await session.send('HeapProfiler.collectGarbage');
  const before = await measurement(), start = Date.now();
  await report.locator(':scope > summary').click();
  await expect(report.locator('.atlas-measure')).toHaveCount(expected.length);
  await expect(report.locator('.atlas-claim > p')).toHaveCount(claims.length);
  await expect(report.locator('.atlas-scope-dialog')).toHaveCount(0);
  const openMs = Date.now() - start, opened = await measurement();
  await session.send('HeapProfiler.collectGarbage');
  const openedAfterGC = await measurement();
  expect((await report.locator('.atlas-measure > strong').allTextContents()).sort()).toEqual(expected.map(metricValue).sort());
  const switchStart = Date.now();
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(report.locator('.atlas-measure')).toHaveCount(expected.length);
  const returnMs = Date.now() - switchStart;
  await page.screenshot({ path: '/tmp/atlas17-largest-report.png' });
  await report.locator(':scope > summary').click();
  await session.send('HeapProfiler.collectGarbage');
  const collapsed = await measurement();
  const receipt = JSON.stringify({ export_id: source.release.export_id, document_id: documentId, cpu_throttle: 4, measures: expected.length, claims: claims.length, open_ms: openMs, tab_round_trip_ms: returnMs, before, opened, opened_after_gc: openedAfterGC, collapsed, caveat: 'Desktop Chromium JavaScript heap and DOM counters; not total process, GPU or physical iPhone memory. Before, opened_after_gc and collapsed samples follow explicit garbage collection.' }, null, 2);
  await testInfo.attach('largest-report-performance.json', { contentType: 'application/json', body: receipt });
  if (process.env.ATLAS_PERFORMANCE_RECEIPT) writeFileSync(process.env.ATLAS_PERFORMANCE_RECEIPT, receipt + '\n');
  expect(errors).toEqual([]);
});

test('Strict quantities and mixed-precision source dates survive report and timeline rendering', async ({ page }) => {
  const source = candidate();
  const strict = source.data.metrics.measures.find(measure => 'qualifier' in measure && measure.qualifier === 'more_than')!;
  const documentId = source.data.records.find(record => record.id === strict.source_record_id)!.document_id;
  const documents = [...source.data.documents].sort((a, b) => b.publication.localeCompare(a.publication) || a.id.localeCompare(b.id));
  const pageIndex = Math.floor(documents.findIndex(document => document.id === documentId) / 12), pages = Math.ceil(documents.length / 12);
  const { errors } = await serve(page, source);
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await choose(page, 'Report page, bottom', `Page ${pageIndex + 1} of ${pages}`);
  const report = page.locator(`#atlas-report-${documentId}`);
  await report.locator(':scope > summary').click();
  const card = report.locator('.atlas-measure').filter({ has: page.getByRole('button', { name: `Scope & source for ${strict.label}`, exact: true }) });
  await expect(card.locator(':scope > strong')).toHaveText(`>${new Intl.NumberFormat('en-GB').format(strict.value!)}`);
  await card.getByRole('button').click();
  await expect(page.getByRole('dialog', { name: `Scope & source for ${strict.label}`, exact: true }).locator('.atlas-scope-value > strong')).toHaveText(`>${new Intl.NumberFormat('en-GB').format(strict.value!)}`);
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button')).toBeFocused();
  await expect(card.locator('.atlas-scope-dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const view = page.getByRole('region', { name: 'One Health evidence', exact: true });
  await choose(view, 'One Health view', 'Timeline');
  const timing = source.health.timings.find(row => row.time.precision === 'mixed')!;
  await choose(view, 'One Health report', source.label(timing.record_id), timing.record_id);
  const node = source.health.nodes.find(node => node.id === timing.node_id)!;
  const label = observationTimeLabel(timing.time);
  await view.getByRole('button', { name: `${node.label}. ${timing.time.kind.replaceAll('_', ' ')}. ${label}`, exact: true }).press('Enter');
  await expect(view.getByRole('complementary')).toContainText(label);
  await expect(view.getByRole('complementary')).toContainText('Precisionmixed');
  await page.screenshot({ path: '/tmp/atlas17-mixed-dates.png' });
  expect(errors).toEqual([]);
});

test('A tall One Health network fills its column and scrolls independently', async ({ page }) => {
  const source = candidate();
  const [recordId] = [...source.entries].find(([id, entry]) => source.label(id).toLowerCase().includes('alfalfa') && entry.nodeIds.size >= 12)!;
  const { errors } = await serve(page, source);
  await page.setViewportSize({ width: 1466, height: 832 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await page.getByRole('tab', { name: 'One Health', exact: true }).click();
  const view = page.getByRole('region', { name: 'One Health evidence', exact: true });
  await choose(view, 'One Health report', source.label(recordId), recordId);
  const network = view.locator('.atlas-oh-network');
  const svg = network.locator(':scope > svg');
  for (const viewport of [{ width: 1466, height: 832 }, { width: 1742, height: 1190 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => svg.evaluate(element => {
      const svg = element as SVGSVGElement;
      return Math.abs(svg.getBoundingClientRect().width - svg.viewBox.baseVal.width * svg.getScreenCTM()!.a);
    })).toBeLessThan(1);
    expect(await network.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    const before = await network.boundingBox();
    await svg.locator('.atlas-oh-node').last().scrollIntoViewIfNeeded();
    expect(await network.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await network.boundingBox()).toEqual(before);
    expect(await page.locator('.atlas-workspace-scroll').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await network.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `/tmp/atlas-network-width-${viewport.width}.png` });
  }
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Undated sources verify separately, preserve complete evidence and never enter dated reporting', async ({ page }) => {
  test.skip(!process.env.ATLAS_SUPPLEMENT_FIXTURE, 'Requires the reviewed source supplement fixture');
  const source = candidate();
  const directory = process.env.ATLAS_SUPPLEMENT_FIXTURE!;
  const supplement = JSON.parse(readFileSync(path.join(directory, 'source-supplement.json'), 'utf8')) as import('../src/lib/atlas-supplement').SourceSupplement;
  const descriptor = JSON.parse(readFileSync(path.join(directory, 'descriptor.json'), 'utf8'));
  const datedIdentity = JSON.stringify(source.release);
  let supplementReads = 0, corrupt = true;
  await page.route(`**/supplements/${descriptor.sha256}/source-supplement.json`, route => {
    supplementReads++;
    return route.fulfill({ contentType: 'application/json', body: corrupt ? '{}' : readFileSync(path.join(directory, 'source-supplement.json')) });
  });
  const { errors } = await serve(page, { ...source, release: { ...source.release, source_supplement: descriptor } });
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const reportCount = await page.getByRole('tab', { name: 'Reports', exact: true }).textContent();
  const globeCounts = await page.locator('.atlas-network-stats').textContent();
  const section = page.locator('.atlas-undated-sources');
  const access = page.locator('.atlas-workspace-footer').getByRole('button', { name: 'Undated sources', exact: true });
  await expect(access).toBeVisible();
  await expect(page.locator('.atlas-report-tools')).toHaveAttribute('data-timeline', 'true');
  await expect(page.locator('#atlas-panel > .atlas-undated-sources')).toHaveCount(0);
  expect(supplementReads).toBe(0);
  await access.click();
  await expect(section.getByRole('alert')).toContainText('could not be verified');
  expect(await page.getByRole('tab', { name: 'Reports', exact: true }).textContent()).toBe(reportCount);
  corrupt = false;
  await section.getByRole('button', { name: 'Try again' }).click();
  await expect(section.getByRole('region', { name: 'Undated source findings' })).toBeVisible();
  expect(supplementReads).toBe(2);
  const scopeSummary = section.locator('summary').filter({ hasText: 'Evidence & scope' });
  await page.getByRole('button', { name: 'Close Undated sources', exact: true }).press('Shift+Tab');
  await expect(scopeSummary).toBeFocused();
  await scopeSummary.press('Tab');
  await expect(page.getByRole('button', { name: 'Close Undated sources', exact: true })).toBeFocused();
  await expect(section).toContainText(`Captured ${formatDate(supplement.documents[0].capture)}`);
  await expect(section).toContainText('Publication date not reported');
  await expect(section.locator('.atlas-claim > p')).toHaveText(supplement.records.flatMap(record => record.claims.map(claim => claim.text)));
  for (const summary of await section.locator('.atlas-claim summary').all()) await summary.click();
  await expect(section.locator('blockquote')).toHaveText(supplement.evidence.map(span => span.quote));
  for (const span of await section.locator('blockquote').all()) await expect(span).toBeVisible();
  await section.getByText('Review & disclosures', { exact: true }).click();
  for (const disclosure of supplement.records[0].disclosures) await expect(section.getByText(disclosure, { exact: true })).toBeVisible();
  await expect(section.locator('.atlas-measure > strong')).toHaveText(supplement.records[0].measures.map(metricValue));
  await section.getByRole('button', { name: /^Scope & source/ }).first().click();
  const modal = page.getByRole('dialog', { name: /^Scope & source/ });
  await expect(modal).toContainText(supplement.records[0].measures[0].semantic_note);
  await expect(modal.locator('blockquote')).toHaveText(supplement.evidence[0].quote);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Undated sources', exact: true })).toBeVisible();
  await expect(page.locator('.atlas-report-list')).not.toContainText(supplement.documents[0].title);
  expect(await page.getByRole('tab', { name: 'Reports', exact: true }).textContent()).toBe(reportCount);
  expect(await page.locator('.atlas-network-stats').textContent()).toBe(globeCounts);
  await page.getByRole('button', { name: 'Close Undated sources', exact: true }).click();
  await page.getByRole('button', { name: '3 months', exact: true }).click();
  await access.click();
  await expect(section.getByRole('region', { name: 'Undated source findings' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-undated-sources-phone.png' });
  await page.getByRole('button', { name: 'Close Undated sources', exact: true }).click();
  await page.setViewportSize({ width: 1466, height: 832 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await expect(page.locator('.atlas-report-tools')).toHaveAttribute('data-timeline', 'true');
  await page.screenshot({ path: '/tmp/atlas-dated-timeline-desktop.png' });
  await access.click();
  await expect(section).toBeVisible();
  await page.screenshot({ path: '/tmp/atlas-undated-sources-desktop.png' });
  expect(JSON.stringify(source.release)).toBe(datedIdentity);
  expect(errors).toEqual([]);
});


test('The complete candidate renders its matching network review on demand', async ({ page }) => {
  test.skip(!process.env.ATLAS_NETWORK_CANDIDATE, 'Requires the matching network analysis');
  const source = candidate(), root = process.env.ATLAS_NETWORK_CANDIDATE!;
  const transportBytes = readFileSync(path.join(root, 'network-transport.json'));
  const analysisBytes = readFileSync(path.join(root, 'network-analysis.json'));
  const transport = validateNetworkTransport(JSON.parse(transportBytes.toString()), source.release);
  const analysis = parseNetworkAnalysis(JSON.parse(analysisBytes.toString()), transport);
  const map = JSON.parse(readFileSync(path.join(source.directory, source.manifest.map_core), 'utf8')) as AtlasBrowserMap;
  const records = new Set(source.data.records.map(row => row.id));
  const expected = selectNetworkReview(analysis, map.map_links.filter(link => supported(link.support, records)).map(link => link.id), records);
  let requests = 0;
  await page.route('**/releases/*/network-transport.json', route => process.env.ATLAS_PUBLIC_BROWSER ? route.continue() : route.fulfill({ contentType: 'application/json', body: transportBytes }));
  await page.route('**/network-analysis/*/network-analysis.json', route => {
    requests++;
    return process.env.ATLAS_PUBLIC_BROWSER ? route.continue() : route.fulfill({ contentType: 'application/json', body: analysisBytes });
  });
  const { errors } = await serve(page, source);
  await page.getByRole('button', { name: 'All dates', exact: true }).click();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Network methods & references for Country network statistics' }).click();
  const review = page.getByRole('region', { name: 'Network evidence review' });
  await expect(review).toContainText(`${expected.units.length} → ${expected.partialUnits}`);
  await expect(review).toContainText(`${expected.assessed} of ${expected.units.length} statements inspected`);
  await expect(review).toContainText(`${expected.groups.length} groups covering ${expected.reviewed} statements`);
  await expect(review).toContainText('Adjusted rankings unavailable for the full dataset.');
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});


test('Report assessment exports retain exact attribution and quotations in the dated chronology', async ({ page }) => {
  const source = candidate();
  test.skip(source.data.contract_version !== '1.8.0', 'Requires report assessment contract 1.8');
  const ids = new Set(source.data.records.map(record => record.id));
  const assessments = createResearch(source.data, source.select).reportAssessments(ids, [...ids]);
  expect(assessments).toHaveLength(9);
  const documents = [...new Set(assessments.map(row => row.document_id))];
  expect(documents).toHaveLength(4);
  const { errors, requests } = await serve(page, source);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'All dates', exact: true }).click();
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  for (const id of documents) {
    const report = page.locator(`#atlas-report-${id}`);
    const document = source.data.documents.find(doc => doc.id === id)!;
    const channel = source.data.channels.find(row => row.id === document.channel_id)!;
    await expect(report.locator('.atlas-report-date')).toContainText(formatDate(document.publication));
    await expect(report.locator('.atlas-report-date')).toContainText(channel.name);
    const relevant = assessments.filter(row => row.document_id === id);
    await report.locator(':scope > summary').click();
    await expect(report.locator('[data-assessment-kind]')).toHaveCount(0);
    await report.getByText('Evidence & scope', { exact: true }).click();
    const entries = report.locator('[data-assessment-kind]');
    await expect(entries).toHaveCount(relevant.length);
    for (const assessment of relevant) {
      const entry = entries.filter({ has: page.locator('strong', { hasText: assessment.label }) });
      await expect(entry).toHaveAttribute('data-assessment-kind', assessment.kind);
      await expect(entry).toHaveAttribute('data-status', assessment.status);
      await expect(entry.locator('strong')).toHaveText(assessment.label);
      await expect(entry.locator(':scope > p').nth(1)).toHaveText(assessment.scope);
      await expect(entry.locator(':scope > .atlas-item-meta')).toHaveText(assessment.authority.value!);
      await entry.locator('summary').click();
      await expect(entry.locator('blockquote')).toHaveCount(assessment.evidence_ids.length);
      for (const [index, evidenceId] of assessment.evidence_ids.entries()) {
        await expectCountryText(entry.locator('blockquote').nth(index), source.read('evidence', evidenceId).quote);
      }
      await entry.locator('summary').click();
    }
    await report.locator(':scope > summary').click();
  }
  expect(requests.some(path => path.includes('undefined'))).toBe(false);
  await page.screenshot({ path: '/tmp/atlas-attributed-reports-desktop.png' });
  await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const report = page.locator(`#atlas-report-${documents[0]}`);
  await report.locator(':scope > summary').click();
  await expect(report.locator('[data-assessment-kind]').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
