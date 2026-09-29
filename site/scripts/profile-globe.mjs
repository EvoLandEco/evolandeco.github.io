import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'no-preference' });
page.setDefaultTimeout(30000);
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
await page.addInitScript(() => {
  window.globeProfile = { draws: 0, attributes: 0 };
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const draw = prototype.drawArrays;
    prototype.drawArrays = function (...args) { window.globeProfile.draws++; return draw.apply(this, args); };
  }
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (...args) {
    if (this instanceof SVGElement) window.globeProfile.attributes++;
    return setAttribute.apply(this, args);
  };
});
if (process.env.ATLAS_PROFILE_DATA_ORIGIN) await page.addInitScript(origin => {
  const fetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (/^\/(?:current\.json|releases\/)/.test(url.pathname)) {
      const target = origin + url.pathname + url.search;
      input = input instanceof Request ? new Request(target, input) : target;
    }
    return fetch(input, init);
  };
}, process.env.ATLAS_PROFILE_DATA_ORIGIN);
const results = [];
const origin = process.env.ATLAS_PROFILE_BASE_URL ?? 'http://127.0.0.1:3000';
const duration = 3000;
const metrics = async () => ({
  ...Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])),
  ...await page.evaluate(() => window.globeProfile),
});
async function sample(route, state) {
  console.error(`Profiling ${route} ${state}`);
  await page.waitForTimeout(1000);
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const before = await metrics();
    await page.waitForTimeout(duration);
    const after = await metrics();
    runs.push(Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'draws', 'attributes'].map(k => [k, +((after[k] - before[k]) * (k.endsWith('Duration') ? 1000 : 1)).toFixed(2)])));
  }
  results.push({ route, state, windowMs: duration, median: Object.fromEntries(Object.keys(runs[0]).map(k => [k, runs.map(r => r[k]).sort((a,b) => a-b)[1]])) });
}
try {
  for (const route of ['/', '/atlas/']) {
    await page.goto(origin + route);
    if (route === '/atlas/') await page.locator('.atlas-page[data-ready="true"]').waitFor();
    await page.locator('canvas[data-angle]').first().waitFor();
    await page.waitForTimeout(2000);
    await sample(route, 'rotating');
    if (route === '/atlas/') {
      await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
      await sample(route, 'workspace');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await sample(route, 'reduced-motion');
      await page.getByRole('button', { name: 'Exit full screen' }).click();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    await page.locator('.main-column > footer').scrollIntoViewIfNeeded();
    await sample(route, 'offscreen');
  }
} finally { await browser.close(); }
const output = JSON.stringify(results, null, 2);
await writeFile(process.argv[2] ?? '/tmp/globe-profile.json', output);
console.log(output);
