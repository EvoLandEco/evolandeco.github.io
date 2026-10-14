import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {routeBrowserFixture} from './atlas-browser-fixture.mjs';
import {bundle} from './atlas-fixture';

for (const width of [390, 1466]) test(`Reports reviewer login, close and draft preservation at ${width}px`, async ({page, context}) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  let visits = 0;
  await context.route('https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev/atlas/review/sign-in', route => route.fulfill({contentType: 'text/html', body: `<!doctype html><title>Sign-in fixture</title><button onclick="opener.postMessage({type:'atlas-review-signed-in'},'http://127.0.0.1:3000');window.close()">Verify sign-in</button>`}));
  await context.route('https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev/atlas/review/', route => {
    visits++;
    return route.fulfill({contentType: 'text/html', body: `<!doctype html><html lang="en"><title>Review fixture</title><body>
      <button onclick="parent.postMessage({type:'atlas-review-close'},'http://127.0.0.1:3000')">Close reviewer inbox</button><main><h1>Review issues</h1><label>Rationale<textarea></textarea></label></main>
      <script>addEventListener('message', event => {if (event.data.type === 'atlas-review-theme') document.documentElement.dataset.theme = event.data.theme;});parent.postMessage({type:'atlas-review-ready',ready:true},'http://127.0.0.1:3000');</script>
      </body></html>`});
  });
  await page.setViewportSize({width, height: 832});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/atlas/');
  await page.getByRole('tab', {name: 'Reports', exact: true}).click();
  const reports = page.locator('.atlas-report-list');
  const first = reports.locator('.atlas-report').first();
  await first.locator(':scope > summary').click();
  const reportId = await first.getAttribute('id');
  const reportIds = await reports.locator('.atlas-report').evaluateAll(entries => entries.map(entry => entry.id));
  expect(visits).toBe(0);
  await page.getByRole('button', {name: 'Reviewer login', exact: true}).click();
  const close = page.getByRole('button', {name: 'Close reviewer inbox', exact: true});
  const frame = page.frameLocator('#atlas-reviewer-frame');
  await expect(close).toBeVisible();
  await expect(reports).toBeHidden();
  await expect(page.getByRole('button', {name: 'Next report page'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Continue to sign-in', exact: true})).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {origin: 'https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev', source: window, data: {type: 'atlas-review-signed-in'}})));
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {origin: 'https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev', source: null, data: {type: 'atlas-review-signed-in'}})));
  await expect(page.locator('#atlas-reviewer-frame')).toHaveCount(0);
  const cancelled = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Continue to sign-in', exact: true}).click();
  const cancelledWindow = await cancelled;
  await expect(cancelledWindow.getByRole('button', {name: 'Verify sign-in'})).toBeVisible();
  await close.click();
  await expect.poll(() => cancelledWindow.isClosed()).toBe(true);
  await expect(page.getByRole('button', {name: 'Reviewer login', exact: true})).toBeFocused();
  expect(await reports.locator('.atlas-report').evaluateAll(entries => entries.map(entry => entry.id))).toEqual(reportIds);
  await expect(page.locator(`#${reportId}`)).toHaveAttribute('open', '');
  await page.getByRole('button', {name: 'Reviewer login', exact: true}).click();
  const signingIn = page.waitForEvent('popup');
  await page.getByRole('button', {name: 'Continue to sign-in', exact: true}).click();
  const signInWindow = await signingIn;
  await expect(close).toBeVisible();
  await signInWindow.getByRole('button', {name: 'Verify sign-in'}).click();
  await frame.getByLabel('Rationale').fill('Unsubmitted review text');
  await expect(close).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {origin: 'https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev', source: window, data: {type: 'atlas-review-close'}})));
  await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {origin: 'https://example.org', source: document.querySelector<HTMLIFrameElement>('#atlas-reviewer-frame')!.contentWindow, data: {type: 'atlas-review-close'}})));
  await expect(page.locator('#atlas-reviewer-frame')).toBeVisible();
  await frame.getByRole('button', {name: 'Close reviewer inbox', exact: true}).click();
  await page.getByRole('button', {name: 'Reviewer login', exact: true}).click();
  await expect(frame.getByLabel('Rationale')).toHaveValue('Unsubmitted review text');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  expect(visits).toBe(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(frame.getByRole('button', {name: 'Close reviewer inbox', exact: true})).toBeVisible();
});

test('Reports explains a blocked sign-in window', async ({page}) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.addInitScript(() => { window.open = () => null; });
  await page.goto('/atlas/');
  await page.getByRole('tab', {name: 'Reports', exact: true}).click();
  await page.getByRole('button', {name: 'Reviewer login', exact: true}).click();
  await page.getByRole('button', {name: 'Continue to sign-in', exact: true}).click();
  await expect(page.locator('.atlas-reviewer-sign-in').getByRole('alert')).toHaveText('Allow the sign-in window in your browser, then try again.');
  await expect(page.getByRole('button', {name: 'Close reviewer inbox', exact: true})).toBeVisible();
});
