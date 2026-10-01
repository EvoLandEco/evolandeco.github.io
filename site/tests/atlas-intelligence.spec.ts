import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { intelligenceSchema } from '../src/lib/atlas-intelligence';

test.use({ baseURL: process.env.ATLAS_INTELLIGENCE_PREVIEW_URL ?? 'http://127.0.0.1:3005' });

test.beforeEach(async ({ page }) => {
  if (process.env.ATLAS_RELEASE_FILE) {
    const receipt = JSON.parse(readFileSync(process.env.ATLAS_RELEASE_FILE, 'utf8'));
    await page.route('**/current.json', route => route.fulfill({ json: receipt.release ?? receipt }));
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
  expect(await tabs.getByRole('tab').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(['Trends', 'Analysis', 'One Health', 'Reports', 'Geographic links']);
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
  await expect(analysis.locator('details')).toHaveCount(0);
  const analysisHeader = analysis.locator('header').first();
  const topControls = await analysisHeader.locator('select').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
  expect(topControls).toHaveLength(2);
  await expect(analysisHeader.locator('select').first()).toHaveCSS('border-top-width', '0px');
  expect(Math.abs(topControls[0] - topControls[1])).toBeLessThan(2);
  await analysisHeader.screenshot({ path: `/tmp/atlas-analysis-controls-${width}.png` });
  await analysis.getByRole('combobox', { name: 'Monitored series', exact: true }).selectOption({ index: 1 });
  await expect(analysis.getByRole('button', { name: 'Evaluate models', exact: true })).toHaveCount(0);
  await expect(analysis.getByRole('button', { name: 'View supporting reports', exact: true })).toHaveCount(0);
  const checkColumns = analysis.locator('svg [role="button"][data-entry-id]');
  const checkRows = analysis.locator('tr[data-entry-id]');
  await checkColumns.last().hover({ position: { x: 5, y: 10 } });
  await expect(checkRows.last()).toHaveAttribute('data-selected', 'true');
  expect(await checkRows.last().evaluate(row => {
    const container = row.closest('table')!.parentElement!;
    const bounds = container.getBoundingClientRect();
    const entry = row.getBoundingClientRect();
    return entry.top >= bounds.top && entry.bottom <= bounds.bottom + 1;
  })).toBe(true);
  await checkRows.first().hover();
  await expect(checkColumns.first()).toHaveAttribute('data-selected', 'true');
  await checkColumns.last().focus();
  await expect(checkRows.last()).toHaveAttribute('data-selected', 'true');
  if (width > 1180) {
    const rowBounds = (await checkRows.last().boundingBox())!;
    const workspaceBounds = (await page.locator('.atlas-workspace-scroll').boundingBox())!;
    expect(rowBounds.y + rowBounds.height).toBeLessThanOrEqual(workspaceBounds.y + workspaceBounds.height);
  }
  await analysis.screenshot({ path: `/tmp/atlas-count-hover-${width}.png` });
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
  await checkColumns.last().press('Enter');
  await expect(tabs.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await analysis.getByRole('button', { name: 'Model evaluation', exact: true }).click();
  await expect(analysis.locator('summary')).toHaveCount(0);
  await aboutAnalysis.click();
  await expect(analysisMethods.locator('h4')).toHaveText('Nigeria Lassa fever · Confirmed cases · weekly reports');
  await page.keyboard.press('Escape');
  await expect(analysis.getByRole('combobox', { name: 'Monitored series', exact: true })).toHaveValue('ncdc-lassa-2026-interval-1');
  await expect(analysis.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('ensemble_median');
  await expect(analysis.getByRole('combobox', { name: 'Model', exact: true }).locator('option').first()).toHaveText('Median ensemble');
  await analysis.getByRole('combobox', { name: 'Model', exact: true }).selectOption('gamma_poisson');
  await analysis.getByRole('combobox', { name: 'Horizon', exact: true }).selectOption('2');
  await expect(analysis).not.toContainText('Retrospective evaluation');
  const predictionPanel = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const statsBounds = (await predictionPanel.locator('dl').boundingBox())!;
  const chartBounds = (await predictionPanel.locator('figure').boundingBox())!;
  expect(statsBounds.y + statsBounds.height).toBeLessThanOrEqual(chartBounds.y);
  const predictionHelp = predictionPanel.getByRole('button', { name: /^Prediction details for/ });
  const helpBounds = (await predictionHelp.boundingBox())!;
  const predictionBounds = (await predictionPanel.boundingBox())!;
  expect(Math.abs(helpBounds.x + helpBounds.width - predictionBounds.x - predictionBounds.width)).toBeLessThan(2);
  await predictionHelp.click();
  const predictionDetails = page.getByRole('dialog', { name: /^Prediction details for/ });
  await expect(predictionDetails).toContainText('Available in ATLAS at origin');
  await expect(predictionDetails.locator('dl')).toContainText('No');
  await expect(predictionDetails).toContainText('Central prediction intervals');
  await expect(predictionDetails).toContainText('Reported observations supplied at the historical origin');
  await predictionDetails.locator('summary', { hasText: 'Gamma–Poisson local level' }).click();
  await expect(predictionDetails).toContainText('Jeffreys prior');
  await page.keyboard.press('Escape');
  await expect(predictionHelp).toBeFocused();
  await predictionPanel.screenshot({ path: `/tmp/atlas-prediction-summary-${width}.png` });
  await expect(analysis.getByRole('table').filter({ has: page.locator('caption', { hasText: 'Hindcast performance' }) }).getByRole('row')).toHaveCount(5);
  await analysis.getByRole('combobox', { name: 'Evaluation', exact: true }).selectOption('extrapolation');
  await expect(predictionPanel.getByRole('img')).toHaveAttribute('aria-label', /prediction for 20 Sept? 2026/);
  await expect(predictionPanel.locator('dl')).toContainText('Not evaluated');
  await page.screenshot({ path: `/tmp/atlas-merged-analysis-${width}.png`, fullPage: width === 390 });
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
  await expect(analysis.getByRole('button', { name: 'Reported observations', exact: true })).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: 'Trends', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('summary[aria-label="Observation series"]')).toContainText('Suspected cases');
  await expect(page.getByRole('button', { name: 'Analyze this series', exact: true })).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();

  await expect(analysis.getByRole('combobox', { name: 'Monitored series', exact: true })).toHaveValue('ncdc-lassa-2026-interval-1');
  await analysis.getByRole('button', { name: 'Signals', exact: true }).click();
  await analysis.getByRole('combobox', { name: 'Signal type', exact: true }).selectOption('all');
  const signalOverview = analysis.getByRole('region', { name: 'Signal overview' });
  await expect(signalOverview).toBeVisible();
  await expect(signalOverview).toContainText('No count exceedances in this selection.');
  await expect(signalOverview.getByRole('button', { name: /Count exceedances/ })).toBeVisible();
  const recentSignals = signalOverview.locator('[aria-label="Recent signals"]');
  await expect(recentSignals.getByRole('button')).toHaveCount(6);
  await expect(recentSignals.getByRole('button').first()).toHaveCSS('border-top-width', '0px');
  await signalOverview.screenshot({ path: `/tmp/atlas-all-signals-${width}.png` });
  const recentTitle = await recentSignals.locator('button strong').nth(1).innerText();
  await recentSignals.getByRole('button').nth(1).click();
  await expect(analysis.getByRole('combobox', { name: 'Signal type', exact: true })).toHaveValue('network_first_appearance');
  await expect(analysis.getByRole('region', { name: 'Signal evidence' }).getByRole('heading', { level: 3 })).toHaveText(recentTitle);
  const connectionSearch = analysis.getByRole('searchbox', { name: 'Search country connections' });
  await connectionSearch.fill('not-a-connection');
  await expect(analysis).toContainText('No matching connections.');
  await expect(analysis.getByRole('region', { name: 'Signal evidence' })).toHaveCount(0);
  await connectionSearch.fill('Measles');
  const connectionList = analysis.locator('[aria-label="Monitoring signals"]');
  await expect(connectionList.getByRole('button').first()).toContainText('Measles');
  await expect(connectionList.getByRole('button').first()).toHaveCSS('border-top-width', '0px');
  await connectionList.getByRole('button').nth(1).press('Enter');
  await expect(connectionList.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await connectionSearch.clear();
  expect(await connectionList.getByRole('button').evaluateAll(buttons => buttons.every(button => {
    const row = button.getBoundingClientRect();
    const content = button.querySelector('span')!.getBoundingClientRect();
    return content.top >= row.top && content.bottom <= row.bottom;
  }))).toBe(true);
  await analysis.screenshot({ path: `/tmp/atlas-country-signals-${width}.png` });

  await analysis.getByRole('button', { name: /^View geographic link:/ }).first().click();
  await expect(tabs.getByRole('tab', { name: 'Geographic links', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-connection[data-selected="true"]')).toBeVisible();

  await tabs.getByRole('tab', { name: 'Reports', exact: true }).click();
  const reports = page.getByRole('group', { name: 'Report content', exact: true });
  await expect(reports.getByRole('button')).toHaveCount(3);
  const dateBounds = await page.locator('.atlas-timeline-next').boundingBox();
  const switchBounds = await reports.boundingBox();
  expect(Math.abs(dateBounds!.y + dateBounds!.height / 2 - switchBounds!.y - switchBounds!.height / 2)).toBeLessThan(2);
  if (width === 390) {
    await expect(reports.locator('button > span').first()).toBeHidden();
    await expect(reports.locator('button > b').first()).toBeHidden();
    await page.locator('.atlas-report-tools').screenshot({ path: '/tmp/atlas-compact-report-switch.png' });
  }
  await reports.getByRole('button', { name: 'Source coverage', exact: true }).click();
  await expect(page.locator('.atlas-source-network')).toBeVisible();
  await expect(page.locator('.atlas-report-tools')).toHaveAttribute('data-coverage', 'true');
  await expect(page.locator('.atlas-coverage-headings')).toContainText('Reporting topics');
  await expect(page.locator('.atlas-report-context')).toContainText('Captured');
  await expect(page.locator('.atlas-report-context')).toContainText('Next update');
  await expect(page.locator('.atlas-report-tools')).not.toHaveAttribute('data-timeline');
  if (width > 1180) await expect(page.locator('.atlas-workspace-footer').getByRole('button', { name: /Next/ })).toBeVisible();
  await page.screenshot({ path: `/tmp/atlas-merged-sources-${width}.png`, fullPage: width === 390 });
  await reports.getByRole('button', { name: 'Source coverage', exact: true }).press('ArrowLeft');
  await expect(reports.getByRole('button', { name: 'Assessments', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.atlas-timeline-next')).toHaveCount(0);
  const categories = page.getByRole('group', { name: 'Assessment category', exact: true });
  const categoryBounds = await categories.boundingBox();
  const assessmentSwitchBounds = await reports.boundingBox();
  expect(Math.abs(categoryBounds!.y + categoryBounds!.height / 2 - assessmentSwitchBounds!.y - assessmentSwitchBounds!.height / 2)).toBeLessThan(2);
  expect(categoryBounds!.x + categoryBounds!.width).toBeLessThan(assessmentSwitchBounds!.x);
  await page.locator('.atlas-report-tools').screenshot({ path: `/tmp/atlas-assessment-switch-${width}.png` });
  await page.getByRole('group', { name: 'Assessment category', exact: true }).getByRole('button', { name: 'Source risk assessments', exact: true }).click();
  const risk = page.getByRole('region', { name: 'Source risk assessments', exact: true });
  await expect(risk).toContainText('People in EU/EEA countries who frequently consume sprouted seeds');
  await expect(risk).toContainText('Illness probability: not estimated');
  await risk.getByRole('button', { name: 'One Health evidence', exact: true }).click();
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
  const filterBounds = await health.locator('.atlas-oh-entry-filters > summary').boundingBox();
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
  await page.getByRole('group', { name: 'Assessment category', exact: true }).getByRole('button', { name: 'Source risk assessments', exact: true }).click();
  await risk.getByRole('button', { name: 'One Health evidence', exact: true }).click();
  await health.locator('summary[aria-label="One Health view"]').click();
  await expect(health.getByRole('option', { name: /^Environment/ })).toHaveCount(0);
  await health.getByRole('option', { name: /^Timeline/ }).click();
  const layers = health.getByRole('group', { name: 'Timeline layers' });
  await expect(layers.getByRole('button')).toHaveCount(3);
  await layers.getByRole('button', { name: 'Observations', exact: true }).click();
  await expect(layers.getByRole('button', { name: 'Observations', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: `/tmp/atlas-merged-timeline-${width}.png`, fullPage: width === 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  if (width === 1440) {
    await page.goto('/atlas/');
    await expect(page.getByRole('tab', { name: 'Analysis', exact: true })).toBeVisible({ timeout: 120000 });
    await expect(page.getByRole('tab', { name: 'Source coverage', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Report content', exact: true }).getByRole('button')).toHaveCount(3);
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
  const reports = page.getByRole('group', { name: 'Report content', exact: true });
  for (const name of ['Reports', 'Assessments', 'Source coverage']) {
    await reports.getByRole('button', { name, exact: true }).click();
    await toolbar.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 100));
    await expect(control).toHaveCount(1);
    await expect(control).toBeVisible();
    expect((await page.locator('.atlas-workspace-scroll').boundingBox())!.width).toBe(contentWidth);
    await expect(page.locator('.atlas-workspace-scroll')).toHaveCSS('padding-right', '0px');
    await expect(page.locator('.atlas-workspace .atlas-pagination')).toHaveCount(0);
    await control.getByRole('button', { name: /^Next/ }).click();
    await expect(control.locator('summary')).toContainText('2 /');
  }
  await tabs.getByRole('tab', { name: 'Geographic links', exact: true }).click();
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
    const positions = await toolbar.locator('.atlas-oh-view-select > details > summary, input[type="search"], .atlas-oh-sort-reset, .atlas-oh-entry-filters > summary').evaluateAll(elements => elements.map(element => {
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
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.atlas-workspace-scroll')?.scrollTo(0, 0); });
    const menu = (await page.locator('.atlas-toolbar').boundingBox())!;
    const row = (await top.boundingBox())!;
    expect(row.y - menu.y - menu.height).toBeCloseTo(16, 0);
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
      ['Reports', '.atlas-report-switch'],
      ['Geographic links', '.atlas-connection .atlas-entry-heading'],
    ]) {
      await tabs.getByRole('tab', { name: tab, exact: true }).click();
      await checkGap(selector);
      if (tab === 'Reports') {
        for (const name of ['Assessments', 'Source coverage', 'Reports']) {
          await page.getByRole('group', { name: 'Report content', exact: true }).getByRole('button', { name, exact: true }).click();
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
      if (name === 'Analysis') await page.getByRole('button', { name: 'Model evaluation', exact: true }).click();
      const controls = page.locator('.atlas-panel-tools');
      await expect(controls).toBeVisible();
      await expect(controls).toHaveCSS('position', 'sticky');
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

test('Model evaluation fits the workspace and links model rows to the prediction', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  const tabs = page.getByRole('tablist', { name: 'Evidence views' });
  await expect(tabs.getByRole('tab')).toHaveCount(5, { timeout: 120000 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).press('Enter');
  await tabs.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await analysis.getByRole('button', { name: 'Model evaluation', exact: true }).click();
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  const performance = analysis.getByRole('table').filter({ has: page.locator('caption', { hasText: 'Hindcast performance' }) });
  const model = analysis.getByRole('combobox', { name: 'Model', exact: true });
  for (const height of [780, 640]) {
    await page.setViewportSize({ width: 1440, height });
    expect(await page.locator('.atlas-workspace-scroll').evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    const figureBounds = (await prediction.boundingBox())!;
    const tickPositions = await prediction.locator('svg > g > text').evaluateAll(elements => elements.slice(0, 3).map(element => Number(element.getAttribute('y'))));
    expect(Math.abs(tickPositions[1] - tickPositions[0])).toBeGreaterThan(12);
    const beforeScroll = figureBounds.y;
    await performance.evaluate(table => { table.parentElement!.scrollTop = table.parentElement!.scrollHeight; });
    expect((await prediction.boundingBox())!.y).toBeCloseTo(beforeScroll, 0);
    await performance.getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).hover();
    await expect(prediction.locator('figcaption')).toContainText('Gamma–Poisson local level');
    await expect(model).toHaveValue('ensemble_median');
    await analysis.getByRole('button', { name: 'Model evaluation', exact: true }).hover();
    await expect(prediction.locator('figcaption')).toContainText('Median ensemble');
    await performance.getByRole('button', { name: 'Gamma–Poisson local level', exact: true }).press('Enter');
    await expect(model).toHaveValue('gamma_poisson');
    await performance.evaluate(table => { table.parentElement!.scrollTop = 0; });
    await prediction.getByRole('button', { name: /Gamma–Poisson local level ·/ }).hover();
    const linkedRow = performance.locator('tr[data-entry-id="gamma_poisson"]');
    await expect(linkedRow).toHaveAttribute('data-active', 'true');
    expect(await linkedRow.evaluate(row => {
      const container = row.closest('table')!.parentElement!.getBoundingClientRect();
      const rect = row.getBoundingClientRect();
      return rect.top >= container.top && rect.bottom <= container.bottom + 1;
    })).toBe(true);
    await page.screenshot({ path: `/tmp/atlas-evaluation-contained-${height}.png` });
    await model.selectOption('ensemble_median');
  }
  expect((await new AxeBuilder({ page }).include('[aria-label="Experimental analysis"]').analyze()).violations).toEqual([]);
});


test('The default ensemble displays producer predictions and scores for every series and horizon', async ({ page }) => {
  test.skip(!process.env.ATLAS_INTELLIGENCE_FILE, 'Requires the producer Intelligence export');
  const data = intelligenceSchema.parse(JSON.parse(readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!, 'utf8')));
  const formatted = (value: number, digits = 2) => value.toLocaleString('en-GB', { maximumFractionDigits: digits });
  await page.setViewportSize({ width: 1440, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(process.env.ATLAS_INTELLIGENCE_TEST_PATH ?? '/atlas/experimental/');
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  const analysis = page.getByRole('region', { name: 'Experimental analysis' });
  await analysis.getByRole('button', { name: 'Model evaluation', exact: true }).click();
  const prediction = analysis.getByRole('region', { name: 'Model prediction', exact: true });
  for (const series of data.forecast_series) {
    await analysis.getByRole('combobox', { name: 'Monitored series', exact: true }).selectOption(series.id);
    await expect(analysis.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('ensemble_median');
    for (const horizon of [1, 2]) {
      await analysis.getByRole('combobox', { name: 'Horizon', exact: true }).selectOption(String(horizon));
      await analysis.getByRole('combobox', { name: 'Evaluation', exact: true }).selectOption('backtest');
      const target = series.backtests.filter(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon).sort((a, b) => a.origin.localeCompare(b.origin)).at(-1)!;
      await expect(prediction.locator('header dd')).toHaveText([formatted(target.central), formatted(target.observed), formatted(target.wis, 3)]);
      const metric = series.metrics.find(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon)!;
      const row = analysis.locator('tr[data-entry-id="ensemble_median"]');
      await expect(row.locator('td').nth(0)).toHaveText(String(metric.n));
      await expect(row.locator('td').nth(2)).toHaveText(formatted(metric.wis, 3));
      await analysis.getByRole('combobox', { name: 'Evaluation', exact: true }).selectOption('extrapolation');
      const outlook = series.forecasts.find(item => item.model_id === 'ensemble_median' && item.horizon_weeks === horizon)!;
      await expect(prediction.locator('header dd')).toHaveText([formatted(outlook.central), 'Not evaluated', 'Not evaluated']);
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
  await analysis.getByRole('button', { name: 'Model evaluation', exact: true }).click();
  const series = analysis.getByRole('combobox', { name: 'Monitored series', exact: true });
  const firstSeries = await series.inputValue();
  const model = analysis.getByRole('combobox', { name: 'Model', exact: true });
  const horizon = analysis.getByRole('combobox', { name: 'Horizon', exact: true });
  const origin = analysis.getByRole('combobox', { name: 'Historical origin', exact: true });
  await model.selectOption('gamma_poisson');
  await horizon.selectOption('2');
  await origin.selectOption({ index: 1 });
  const chosenOrigin = await origin.inputValue();
  await series.selectOption({ index: 1 });
  await expect(model).toHaveValue('ensemble_median');
  await model.selectOption('recent_changes');
  await series.selectOption(firstSeries);
  await expect(model).toHaveValue('gamma_poisson');
  await expect(horizon).toHaveValue('2');
  await expect(origin).toHaveValue(chosenOrigin);
  await visit('Trends');
  await expect(analysis).toHaveCount(0);
  if (width > 1180) await page.getByRole('group', { name: 'Trend figure' }).getByRole('button', { name: 'Observations', exact: true }).click();
  const observationSeries = page.locator('summary[aria-label="Observation series"]');
  await observationSeries.click();
  await page.getByRole('option', { name: /Confirmed cases/ }).first().click();
  const chosenObservation = await observationSeries.innerText();
  await visit('Analysis');
  await expect(page.locator('.atlas-trends')).toHaveCount(0);
  await expect(model).toHaveValue('gamma_poisson');
  await expect(horizon).toHaveValue('2');
  await expect(origin).toHaveValue(chosenOrigin);
  await analysis.getByRole('button', { name: 'Signals', exact: true }).click();
  await analysis.getByRole('combobox', { name: 'Signal type', exact: true }).selectOption('network_first_appearance');
  await analysis.getByRole('searchbox', { name: 'Search country connections' }).fill('Measles');
  await visit('One Health');
  const health = page.getByRole('region', { name: 'One Health evidence', exact: true });
  const healthView = health.locator('summary[aria-label="One Health view"]');
  await healthView.click();
  await health.getByRole('option', { name: 'Evidence', exact: true }).click();
  const chosenReport = await health.locator('summary[aria-label="One Health report"]').innerText();
  await visit('Trends');
  await expect(health).toHaveCount(0);
  await expect(observationSeries).toHaveText(chosenObservation, { useInnerText: true });
  if (width > 1180) await expect(page.getByRole('group', { name: 'Trend figure' }).getByRole('button', { name: 'Observations', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await visit('Analysis');
  await expect(analysis.getByRole('combobox', { name: 'Signal type', exact: true })).toHaveValue('network_first_appearance');
  await expect(analysis.getByRole('searchbox', { name: 'Search country connections' })).toHaveValue('Measles');
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
  const reportTabs = page.getByRole('group', { name: 'Report content', exact: true });
  await reportTabs.getByRole('button', { name: 'Reports', exact: true }).click();
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
  await reportTabs.getByRole('button', { name: 'Source coverage', exact: true }).click();
  await visit('Geographic links');
  await visit('Reports');
  await expect(reportTabs.getByRole('button', { name: 'Source coverage', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.atlas-source-network')).toBeVisible();
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
  for (const button of await layers.getByRole('button').all()) await button.click();
  await expect(health).toContainText('No reviewed statements match this view');
  for (const button of await layers.getByRole('button').all()) await button.click();
  await expect(health.locator('.atlas-oh-detail h3')).toBeVisible();
  await chooseView('Network');
  await chooseEntry('network', false);
  const network = health.getByRole('group', { name: 'One Health evidence network', exact: true });
  await expect(network).toBeVisible();
  await expect.poll(async () => Number((await network.getAttribute('viewBox'))!.split(' ')[2])).toBeGreaterThan(0);
  expect(await network.locator('[d]').evaluateAll(paths => paths.every(path => !/NaN|Infinity/.test(path.getAttribute('d')!)))).toBe(true);
  const filters = health.locator('.atlas-oh-entry-filters');
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
      await expect(dialog.getByRole('link', { name: 'Download dataset', exact: true })).toHaveCount(1);
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
