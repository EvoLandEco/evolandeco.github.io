import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

const baseURL = process.env.ATLAS_PROFILE_BASE_URL ?? 'http://127.0.0.1:3006';
const cpuRate = Number(process.env.ATLAS_PROFILE_CPU_RATE ?? 1);
const runCount = Number(process.env.ATLAS_PROFILE_RUNS ?? 3);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const runs = [];
try {
  for (let run = 0; run < runCount; run++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.addInitScript(() => {
      window.audit = { longTasks: [], ready: 0 };
      const observer = new MutationObserver(() => {
        if (document.querySelector('.atlas-page[data-ready="true"]')) {
          window.audit.ready = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ready'] });
      new PerformanceObserver(list => window.audit.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration })))).observe({ type: 'longtask', buffered: true });
    });
    const errors = [], heap = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    page.on('requestfailed', request => { if (request.url().endsWith('.json') && request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
    const memory = setInterval(async () => {
      const sample = await client.send('Runtime.getHeapUsage').catch(() => null);
      if (sample) heap.push({ at: Date.now(), ...sample });
    }, 250);
    try {
      await page.goto(baseURL + '/atlas/');
      await page.locator('.atlas-page[data-ready="true"], .atlas-load-status[role="alert"]').first().waitFor({ timeout: 180000 });
      if (await page.locator('.atlas-load-status[role="alert"]').count()) throw new Error('Dataset loading failed');
      const startupHeap = await client.send('Runtime.getHeapUsage');
      const switches = [];
      for (const [name, ready] of [
        ['One Health', '.atlas-one-health'], ['Reports', '.atlas-report-list'],
        ['Analysis', 'section[aria-label="Experimental analysis"]'], ['Trends', '.atlas-trends'],
      ]) {
        const start = performance.now();
        await page.getByRole('tab', { name, exact: true }).click();
        await page.locator(ready).waitFor({ timeout: 30000 });
        if (await page.locator(`${ready} [role="alert"]`).count()) throw new Error(`${name} failed to load`);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        switches.push({ name, ms: performance.now() - start });
      }
      const capture = await page.evaluate(() => ({ ...window.audit,
        elements: document.querySelectorAll('*').length,
        resources: performance.getEntriesByType('resource').filter(r => r.name.includes('.json')).map(r => ({
          name: r.name, start: r.startTime, end: r.responseEnd, duration: r.duration,
          encoded: r.encodedBodySize, decoded: r.decodedBodySize,
        })),
      }));
      runs.push({ ...capture, switches, errors, startupHeap, heap });
      console.log({ run, readyMs: capture.ready, startupHeap, switches, errors, longestTaskMs: Math.max(0, ...capture.longTasks.map(task => task.ms)) });
    } catch (error) {
      console.error(await page.locator('body').innerText().catch(() => 'Browser closed'), errors);
      throw error;
    } finally {
      clearInterval(memory);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(process.argv[2] ?? '/tmp/atlas-load-profile.json', JSON.stringify({
  date: new Date().toISOString(), baseURL, cpuRate, runCount, data: process.env.ATLAS_PROFILE_LABEL ?? 'public release',
  machine: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model },
  scope: 'Production browser lab; reduced motion isolates data and panel work. Fresh browser context per run. CDP samples JavaScript heap, not total process or GPU memory.',
  runs,
}, null, 2));
