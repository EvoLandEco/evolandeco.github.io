import { test, expect } from '@playwright/test';

test('Reported travel beams finish entering their destination before restarting', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page[data-ready="true"]')).toBeVisible();
  await page.locator('.atlas-link-target').first().press('Enter');
  await page.mouse.move(0, 0);
  const route = page.locator('.atlas-globe-pins .atlas-route[data-kind="movement"]').first();
  await expect.poll(() => route.evaluate(el => {
    const line = el.querySelector<SVGPathElement>('.atlas-route-line')!;
    const beam = el.querySelector<SVGPathElement>('.atlas-travel-beam > path')!;
    if (!beam.getAttribute('d')) return false;
    const destination = line.getPointAtLength(line.getTotalLength());
    const tip = beam.getPointAtLength(beam.getTotalLength());
    const gradient = el.querySelector('linearGradient')!;
    const head = { x: gradient.x1.baseVal.value, y: gradient.y1.baseVal.value };
    const tail = { x: gradient.x2.baseVal.value, y: gradient.y2.baseVal.value };
    const fraction = Math.hypot(tip.x - tail.x, tip.y - tail.y) / Math.hypot(head.x - tail.x, head.y - tail.y);
    return Math.hypot(tip.x - destination.x, tip.y - destination.y) < .05 && fraction > .2 && fraction < .6;
  }), { timeout: 10000, intervals: [50] }).toBe(true);
  await page.screenshot({ path: '/tmp/atlas-travel-arrival.png' });
  await expect.poll(() => route.evaluate(el => {
    const line = el.querySelector<SVGPathElement>('.atlas-route-line')!;
    const beam = el.querySelector<SVGPathElement>('.atlas-travel-beam > path')!;
    if (!beam.getAttribute('d')) return false;
    const destination = line.getPointAtLength(line.getTotalLength());
    const tip = beam.getPointAtLength(beam.getTotalLength());
    return Math.hypot(tip.x - destination.x, tip.y - destination.y) > 1;
  }), { timeout: 6000, intervals: [50] }).toBe(true);
});
