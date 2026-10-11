import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { selectAtlasOption } from './atlas-select-actions';

test('Signed observation values stay inside the plot with percentage-point units', async ({ page }) => {
  const source = healthPanelsFixture();
  source.contract_version = '1.9.0';
  source.metrics.contract_version = '0.5.0';
  const series = source.metrics.series.find(series => {
    const measure = source.metrics.measures.find(measure => measure.measure_id === series.measure_ids[0])!;
    return measure.disease.value === 'Lassa fever' && measure.label === 'Confirmed cases' && measure.count_kind === 'interval';
  })!;
  for (const [index, id] of series.measure_ids.entries()) {
    Object.assign(source.metrics.measures.find(measure => measure.measure_id === id)!, {
      value: [-2, 0, 1, 2][index], unit: 'percentage_points', label: 'Synthetic positivity change', ratio_basis: 'source_reported',
      percentage_point_comparison: { baseline: 'Synthetic baseline', comparison: 'Synthetic follow-up', operation: 'comparison_minus_baseline' },
    });
  }
  await routeBrowserFixture(page, source, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await selectAtlasOption(page, 'Analysis view', 'signals');
  await selectAtlasOption(page, 'Monitored series', { label: 'Lassa fever · Nigeria · Synthetic positivity change · interval' });
  const figure = page.locator('.atlas-analysis-observations figure');
  const plot = figure.locator('.atlas-observation-chart');
  await expect(plot.locator('circle')).toHaveCount(4);
  await expect(figure.locator('figcaption strong')).toHaveText('Synthetic positivity change (pp)');
  const geometry = await plot.evaluate(svg => ({
    height: (svg as SVGSVGElement).viewBox.baseVal.height,
    points: [...svg.querySelectorAll('circle')].map(point => Number(point.getAttribute('cy'))),
  }));
  expect(geometry.points.every(y => y >= 18 && y <= geometry.height - 30)).toBe(true);
  expect(geometry.points[0]).toBeGreaterThan(geometry.points[3]);
  await expect(plot.locator('g > text').first()).toHaveText('-2');
});

for (const width of [390, 1466]) test(`Percentage-point evidence retains comparison and baseline at ${width}px`, async ({ page }, testInfo) => {
  const source = healthPanelsFixture();
  source.contract_version = '1.9.0';
  source.metrics.contract_version = '0.5.0';
  const documents = source.documents.filter(document => source.records.some(record => record.document_id === document.id))
    .sort((a, b) => b.publication.localeCompare(a.publication) || b.capture.localeCompare(a.capture) || a.id.localeCompare(b.id));
  const reportDocument = documents.find(document => source.metrics.measures.some(measure => measure.source_reference.document_id === document.id))!;
  const measure = source.metrics.measures.find(measure => measure.source_reference.document_id === reportDocument.id)!;
  Object.assign(measure, { value: -1.5, unit: 'percentage_points', label: 'Synthetic positivity change', ratio_basis: 'source_reported',
    percentage_point_comparison: { baseline: 'Week 36', comparison: 'Week 37', operation: 'comparison_minus_baseline' } });
  await routeBrowserFixture(page, source, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const index = Math.floor(documents.indexOf(reportDocument) / 12);
  if (index) {
    await page.locator('.atlas-toolbar').evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 80));
    await selectAtlasOption(page, 'Report page, bottom', { label: `Page ${index + 1} of ${Math.ceil(documents.length / 12)}` });
  }
  const report = page.locator(`#atlas-report-${reportDocument.id}`);
  await report.locator(':scope > summary').click();
  const figure = report.locator('.atlas-measure').filter({ has: page.getByText('Synthetic positivity change', { exact: true }) });
  await expect(figure.locator(':scope > strong')).toHaveText('-1.5 pp');
  await figure.getByRole('button', { name: 'Scope & source for Synthetic positivity change', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Scope & source for Synthetic positivity change', exact: true });
  const details = dialog.locator('.atlas-measure-details');
  await expect(details).toContainText('Percentage points');
  await expect(details.locator('dt').filter({ hasText: /^Comparison$/ }).locator('+ dd')).toHaveText('Week 37');
  await expect(details.locator('dt').filter({ hasText: /^Baseline$/ }).locator('+ dd')).toHaveText('Week 36');
  await expect(details).toContainText('Comparison − baseline');
  await expect(details.locator('blockquote').first()).toHaveText(measure.evidence_references[0].quotes[0]);
  await dialog.screenshot({ path: testInfo.outputPath('percentage-point-evidence.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
