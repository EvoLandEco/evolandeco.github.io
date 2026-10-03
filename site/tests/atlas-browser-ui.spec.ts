import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareBrowserView, type AtlasBrowserCore, type AtlasBrowserManifest, type AtlasBrowserMap, type AtlasDetailCollections } from '../src/lib/atlas-browser';
import type { AtlasBrowserDetailIndex, AtlasBrowserDetailPartition } from '../src/lib/atlas-vendor/browser/browser_transport.js';
import { healthEntryIndex, healthPanelForEntry } from '../src/lib/atlas-health-entries';
import { observationTimeLabel } from '../src/lib/atlas-health-time';
import type { AtlasRelease } from '../src/lib/atlas-release';

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
  return { directory, release, manifest, descriptor, data, health, entries, index, selection, read, label };
}

async function serve(page: Page, source: ReturnType<typeof candidate>, beforeAsset?: (asset: string) => Promise<void>) {
  const { directory, release, manifest, descriptor } = source;
  const requests: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/current.json', route => route.fulfill({ json: { ...release, browser: { transport_version: '0.1.0', manifest: descriptor } } }));
  await page.route(`**/releases/${release.export_id}/browser/${descriptor.sha256}/**`, async route => {
    const asset = route.request().url().split(`/browser/${descriptor.sha256}/`)[1];
    requests.push(asset);
    await beforeAsset?.(asset);
    if (route.request().failure()) return;
    await route.fulfill({ contentType: 'application/json', body: readFileSync(path.join(directory, asset)) });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  return { requests, errors, details: () => requests.filter(asset => manifest.assets[asset]?.kind === 'detail') };
}

async function choose(view: Page | Locator, label: string, value: string) {
  const menu = view.locator(`summary[aria-label="${label}"]`).locator('..');
  await menu.locator('summary').click();
  const search = menu.getByRole('searchbox');
  if (await search.count()) await search.fill(value);
  await menu.getByRole('option', { name: value, exact: true }).click();
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
    await choose(view, 'One Health report', label(second.record_id));
    await expect.poll(() => requests.includes(blockedPath)).toBe(true);
    await expect(detail.getByRole('status')).toHaveText('Loading source details…');
    await expect(detail.locator('blockquote')).toHaveCount(0);
    await choose(view, 'One Health report', label(first.record_id));
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
  await expect(dialog.locator('blockquote').first()).toHaveText(measure.evidence_references.flatMap(reference => reference.quotes)[0]);
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
  await choose(view, 'One Health report', label(sampling.record_id));
  const samplingNode = [...health.nodes, ...health.undated_nodes].find(node => node.id === sampling.node_id)!;
  const rowIndex = samplingRows.filter(row => healthPanelForEntry(row, sampling.record_id, entries.get(sampling.record_id)!.nodeIds)).findIndex(row => row.id === sampling.id);
  await view.getByRole('table', { name: 'Reviewed sampling and positivity' }).locator('tbody tr').nth(rowIndex).getByRole('button', { name: samplingNode.label, exact: true }).click();
  await expect(detail.locator('h3')).toHaveText(samplingNode.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', sampling.evidence_ids[0]).quote);
  const measureId = sampling.positive_measure_id ?? sampling.tested_measure_id;
  if (measureId) await expect(detail.locator('.atlas-oh-measure')).toContainText(read('metrics.measures', measureId).label);
  await setMode('Timeline');
  const timing = health.timings.find(row => row.evidence_ids.length)!;
  await choose(view, 'One Health report', label(timing.record_id));
  const timingNode = [...health.nodes, ...health.undated_nodes].find(node => node.id === timing.node_id)!;
  await view.getByRole('button', { name: `${timingNode.label}. ${timing.time.kind.replaceAll('_', ' ')}. ${observationTimeLabel(timing.time)}`, exact: true }).press('Enter');
  await expect(detail.locator('h3')).toHaveText(timingNode.label);
  await expect(detail.locator('blockquote').first()).toHaveText(read('evidence', timing.evidence_ids[0]).quote);
  const context = health.contexts.find(row => row.evidence_ids.length)!;
  await choose(view, 'One Health report', label(context.record_id));
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
  await choose(view, 'One Health report', label(emptyRecord));
  await expect(view.locator('.atlas-oh-node')).toHaveCount(0);
  await expect(detail).toContainText('No eligible observations. Try another report or filter.');
  expect(errors).toEqual([]);
});
