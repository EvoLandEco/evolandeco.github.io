import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const client = await page.context().newCDPSession(page);
await client.send('Performance.enable');
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
const work = async () => (await client.send('Performance.getMetrics')).metrics.find(m => m.name === 'TaskDuration').value * 1000;
async function hover(selector) {
  const start = await work();
  const frameTimes = await page.evaluate(async selector => {
    const times = [];
    for (const node of [...document.querySelectorAll(selector)].slice(0, 15)) {
      const start = performance.now();
      node.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      times.push(performance.now() - start);
      node.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    return times;
  }, selector);
  return { taskMs: await work() - start, frameTimes };
}
const results = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
async function sample(tab) {
  await page.waitForTimeout(1000);
  const start = await work();
  await page.waitForTimeout(3000);
  const idleMs = await work() - start;
  const globeHover = await hover('.atlas-globe-pin[data-occluded="false"]');
  const panelHover = tab === 'One Health' ? await hover('.atlas-oh-node') : null;
  const counts = await page.evaluate(() => ({
    elements: document.querySelectorAll('*').length,
    closedMenuElements: document.querySelectorAll('.atlas-select:not([open]) .atlas-select-options *').length,
  }));
  results.push({ tab, idleMs, ...counts, globeHover, panelHover });
  console.log(tab, counts.elements, Math.round(globeHover.taskMs));
}
try {
  await page.goto((process.env.ATLAS_PROFILE_BASE_URL ?? 'http://localhost:3001') + '/atlas/');
  await page.locator('.atlas-page[data-ready="true"]').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
  await page.keyboard.press('Enter');
  for (const tab of ['Trends', 'Reports', 'One Health', 'Geographic links', 'Source coverage']) {
    if (!await page.getByRole('tab', { name: tab, exact: true }).count()) continue;
    await page.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === 'One Health') await page.locator('.atlas-oh-node').first().waitFor();
    await sample(tab);
    if (tab === 'Reports') {
      await page.getByRole('button', { name: 'Assessments', exact: true }).click();
      await sample('Assessments');
    }
  }
} finally {
  await browser.close();
}
await writeFile(process.argv[2] ?? '/tmp/atlas-panels-profile.json', JSON.stringify({ results, errors }, null, 2));
