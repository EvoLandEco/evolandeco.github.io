import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import type { AtlasSiteBundle } from '../src/lib/atlas-vendor/browser/0.3/atlas.js';

test('Dated unresolved reports keep attributed assessments and publishers without logo assets', async ({ page }) => {
  test.skip(!process.env.ATLAS_REPORT_ASSESSMENT_FIXTURE, 'Requires the producer assessment fixture');
  const root = process.env.ATLAS_REPORT_ASSESSMENT_FIXTURE!;
  const site = readFileSync(join(root, 'structured/atlas-site.json'));
  const map = readFileSync(join(root, 'snapshot.json'));
  const bundle: AtlasSiteBundle = JSON.parse(site.toString());
  bundle.metrics.contract_version = '0.4.0';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await routeBrowserFixture(page, bundle, JSON.parse(map.toString()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1466, height: 832 });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const report = page.locator('.atlas-report-list > .atlas-report');
  await expect(report).toHaveCount(1);
  await expect(report.locator('.atlas-report-date')).toContainText('2 Jul 2026');
  await expect(report.locator('.atlas-report-date')).toContainText(bundle.channels[0].name);
  await expect(report.locator('.atlas-source-logo img')).toHaveCount(0);
  await report.locator(':scope > summary').click();
  await expect(report.locator('summary .atlas-status, .atlas-source-assessments')).toHaveCount(0);
  await expect(report.locator('[data-assessment-kind]')).toHaveCount(0);
  await report.getByText('Evidence & scope', { exact: true }).click();
  const entries = report.locator('[data-assessment-kind]');
  await expect(entries).toHaveCount(4);
  for (const assessment of bundle.report_assessments!) {
    const entry = entries.filter({ hasText: assessment.label });
    await expect(entry.locator('strong')).toHaveText(assessment.label);
    await expect(entry.locator(':scope > p').nth(1)).toHaveText(assessment.scope);
    await expect(entry.locator(':scope > .atlas-item-meta')).toHaveText(assessment.authority.value!);
    await entry.locator('summary').click();
    await expect(entry.locator('blockquote')).toHaveText(assessment.evidence_ids.map(id => bundle.evidence.find(span => span.id === id)!.quote));
    await entry.locator('summary').click();
  }
  await report.screenshot({ path: '/tmp/atlas-report-assessments-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await report.screenshot({ path: '/tmp/atlas-report-assessments-phone.png' });
  expect(errors).toEqual([]);
});
