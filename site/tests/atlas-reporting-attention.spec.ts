import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';
import { bundle } from './atlas-fixture';
import { releaseSchema } from '../src/lib/atlas-release';
import { dailyFixture, dailyPointer } from './atlas-daily-fixture';

for (const width of [390, 1466]) test(`Reporting attention periods preserve scientific scope at ${width}px`, async ({ page }) => {
  const fixture = await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  const manifest = JSON.parse(fixture.bodies[`/releases/${fixture.release.export_id}/browser/${fixture.release.browser.manifest.sha256}/manifest.json`].toString());
  const daily = dailyFixture(releaseSchema.parse(fixture.release), manifest.source.manifest.sha256);
  await page.route(/\/daily\//, route => route.fulfill({ json: route.request().url().endsWith('current.json') ? dailyPointer(daily) : daily }));
  await page.setViewportSize({ width, height: 832 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-07T12:00:00Z') });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-daily-watch')).toContainText('Investigation in France');
  if (width === 1466) await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  const period = page.getByRole('group', { name: 'Reporting attention period', exact: true });
  const weekly = period.getByRole('button', { name: 'Weekly', exact: true });
  const monthly = period.getByRole('button', { name: 'Monthly', exact: true });
  const ring = page.locator('.atlas-disease-ring');
  const activity = await page.locator('.atlas-trend-activity header strong').innerText();
  const reports = (await page.getByRole('tab', { name: 'Reports', exact: true }).textContent())!;
  const range = await page.locator('.atlas-range-dates time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')));
  await expect(period.getByRole('button')).toHaveText(['Weekly']);
  await expect(ring.locator('svg')).toHaveAttribute('aria-label', 'Reporting attention by subject across 0 report entries published 1 Oct 2026 to 7 Oct 2026; not disease incidence');
  await expect(ring.getByRole('button')).toHaveCount(0);
  const monthlyCount = bundle.records.filter(row => row.publication.slice(0, 10) >= '2026-09-08' && row.publication.slice(0, 10) <= '2026-10-07').length;
  expect(monthlyCount).toBeGreaterThan(0);
  const monthlyLabel = new RegExp(`^Reporting attention by subject across ${monthlyCount} report entries published 8 Sept? 2026 to 7 Oct 2026; not disease incidence$`);
  await weekly.press('Enter');
  await expect(period.getByRole('button')).toHaveText(['Monthly']);
  await expect(monthly).toBeVisible();
  await expect(weekly).toHaveCount(0);
  await expect(ring.locator('svg')).toHaveAttribute('aria-label', monthlyLabel);
  await expect(ring.getByRole('button')).toHaveCount(1);
  await expect(ring.getByRole('button')).toHaveAttribute('aria-label', `Unclassified: ${monthlyCount} report entries (100%). View reports`);
  await expect(page.locator('.atlas-trend-activity header strong')).toHaveText(activity);
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveText(reports);
  expect(await page.locator('.atlas-range-dates time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')))).toEqual(range);
  await ring.getByRole('button').press('Enter');
  await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.atlas-report[data-evidence="true"]').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await expect(period.getByRole('button')).toHaveText(['Monthly']);
  await expect(ring.locator('svg')).toHaveAttribute('aria-label', monthlyLabel);
  await expect(page.locator('.atlas-trend-activity header strong')).toHaveText(activity);
  await monthly.click();
  await expect(period.getByRole('button')).toHaveText(['Weekly']);
  await expect(ring.getByRole('button')).toHaveCount(0);
  await expect(ring.locator('svg')).toHaveAttribute('aria-label', 'Reporting attention by subject across 0 report entries published 1 Oct 2026 to 7 Oct 2026; not disease incidence');
});

for (const [width, height, workspace] of [[390,950,false], [1280,950,false], [1280,720,true]] as const) {
  test(`Reporting attention infocards at ${width}×${height}, workspace ${workspace}`, async ({page}) => {
    test.skip(!process.env.ATLAS_PRESENTATION_PREVIEW && !process.env.ATLAS_ONE_HEALTH_CANDIDATE && !process.env.ATLAS_HEALTH_PARTIAL, 'Requires the private preview');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:width===390?'reduce':'no-preference',colorScheme:width===390?'dark':'light'});
    await page.goto(process.env.ATLAS_PRESENTATION_PREVIEW ?? '/atlas/');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready','true');
    if (workspace) {
      const entrance = page.getByRole('button',{name:'Click to enter full screen'});
      await entrance.focus(); await entrance.press('Enter');
    }
    const period = page.getByRole('group', { name: 'Reporting attention period', exact: true });
    await expect(period.getByRole('button')).toHaveText(['Weekly']);
    await period.getByRole('button', { name: 'Weekly', exact: true }).click();
    await expect(period.getByRole('button')).toHaveText(['Monthly']);
    const ring = page.locator('.atlas-disease-ring');
    await expect(ring).toBeVisible();
    await expect(ring.locator('svg')).toHaveAttribute('aria-label', /report entries published .+ to .+; not disease incidence$/);
    await expect(page.locator('.atlas-trend-coverage > header > svg')).toBeVisible();
    expect(await page.locator('.atlas-trend-coverage > header > svg').evaluate(el=>el.getBoundingClientRect().width)).toBe(17);
    await expect(page.getByText('Subjects & coverage',{exact:true})).toHaveCount(0);
    const segments = ring.getByRole('button');
    expect(await segments.count()).toBeGreaterThan(1);
    await ring.evaluate(el => el.scrollIntoView({ block: 'center' }));
    for (let i=0; i<await segments.count(); i++) {
      const segment = segments.nth(i);
      const label = (await segment.getAttribute('aria-label'))!.split(':')[0];
      const point = await segment.locator('.atlas-disease-arc').evaluate(el => {
        const path = el as SVGPathElement;
        const p = path.getPointAtLength(path.getTotalLength()/2);
        const screen = new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM()!);
        return {x:screen.x,y:screen.y};
      });
      await expect(segment.locator('.atlas-disease-arc')).toHaveCSS('stroke-linecap','round');
      await page.mouse.move(point.x,point.y);
      await expect(page.getByRole('tooltip')).toContainText(label);
      await expect.poll(() => segment.locator('.atlas-disease-arc').evaluate(el => {
        const matrix = new DOMMatrix(getComputedStyle(el).transform);
        return Math.round(Math.hypot(matrix.e,matrix.f));
      })).toBe(width===390?0:5);
      await expect(segments.nth((i+1)%await segments.count()).locator('.atlas-disease-arc')).toHaveCSS('opacity','0.5');
      expect(await page.locator('.atlas-disease-infocard').evaluate(el => {
        const r=el.getBoundingClientRect();
        return r.left>=0 && r.right<=innerWidth && r.top>=0 && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      })).toBe(true);
    }
    await page.screenshot({path:`/tmp/atlas-reporting-attention-${width}-${height}.png`});
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await segments.first().focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    expect((await new AxeBuilder({page}).include('.atlas-trend-coverage').analyze()).violations).toEqual([]);
    await segments.first().press('Enter');
    await expect(page.getByRole('tab',{name:'Reports',exact:true})).toHaveAttribute('aria-selected','true');
    expect(errors).toEqual([]);
  });
}
