import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'no-preference' });
page.setDefaultTimeout(30000);
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
const results = [];
const origin = process.env.ATLAS_PROFILE_BASE_URL ?? 'http://127.0.0.1:3000';
try {
for (const route of ['/', '/atlas/']) {
  console.error(`Profiling ${origin}${route}`);
  await page.goto(`${origin}${route}`);
  if (route === '/atlas/') await page.locator('.atlas-page[data-ready="true"]').waitFor();
  await page.locator('canvas[data-angle]').first().waitFor();
  await page.waitForTimeout(2000);
  for (const visible of [true, false]) {
    if (!visible) await page.locator('.main-column > footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const before = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      await page.waitForTimeout(4000);
      const after = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      runs.push(Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(k => [k, +(1000 * (after[k] - before[k])).toFixed(2)])));
    }
    results.push({ route, visible, windowMs: 4000, medianMs: Object.fromEntries(Object.keys(runs[0]).map(k => [k, runs.map(r => r[k]).sort((a, b) => a - b)[1]])) });
  }
}
} finally { await browser.close(); }
const output = JSON.stringify(results, null, 2);
await writeFile(process.argv[2] ?? '/tmp/globe-profile.json', output);
console.log(output);
