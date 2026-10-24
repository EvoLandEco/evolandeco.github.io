import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bundle } from './atlas-fixture';
import { routeBrowserFixture } from './atlas-browser-fixture.mjs';

test('Reporting windows retain globe route styles for unchanged keyed routes', async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.atlas-globe-pins')).toHaveAttribute('data-route-renderer', 'gpu');
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async () => {
    const structure = (group: Element) => [group.getAttribute('data-kind'), !!group.querySelector('.atlas-travel-beam'),
      !!group.querySelector('.atlas-route-beam'), !!group.querySelector('.atlas-route-count text')].join(':');
    const routes = new Map([...document.querySelectorAll('.atlas-globe-pins .atlas-route')].map(group => [group, structure(group)]));
    const reads = new Map<Element, number>();
    const style = window.getComputedStyle;
    window.getComputedStyle = function (element, pseudo) {
      if (routes.has(element)) reads.set(element, (reads.get(element) ?? 0) + 1);
      return style.call(this, element, pseudo);
    };
    try {
      document.querySelector<HTMLButtonElement>('button[aria-label="3 months"]')!.click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    } finally { window.getComputedStyle = style; }
    const retained = [...routes].filter(([group, before]) => group.isConnected && structure(group) === before);
    return { retained: retained.length, removed: [...routes.keys()].filter(group => !group.isConnected).length,
      styleReads: retained.reduce((count, [group]) => count + (reads.get(group) ?? 0), 0) };
  });
  expect(result.retained).toBeGreaterThan(0);
  expect(result.removed).toBeGreaterThan(0);
  expect(result.styleReads).toBe(0);
  await expect(page.locator('.atlas-globe-pins .atlas-link-target').first()).toHaveAttribute('d', /^M/);
});

test('Mode transitions reuse static surfaces and paint on each animation frame', async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await page.getByRole('radio', { name: 'Map view', exact: true }).click();
  const canvas = page.getByTestId('atlas-globe').locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-map-mix', '1.0000');
  for (const mode of ['Network', 'Map']) {
    const result = await page.evaluate(mode => new Promise<{ frames: number; paints: number; clears: Record<string, number>; globeDraws: number; sizeReads: number }>(resolve => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="atlas-globe"] canvas')!;
      const control = document.querySelector<HTMLButtonElement>(`[role="radio"][aria-label="${mode} view"]`)!;
      const clears: Record<string, number> = {};
      let frames = 0, paints = 0, globeDraws = 0, sizeReads = 0;
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      const width = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.className.startsWith('globe-')) clears[this.canvas.className] = (clears[this.canvas.className] ?? 0) + 1;
        return clear.apply(this, args);
      };
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas === canvas) globeDraws++;
        return draw.apply(this, args);
      };
      Object.defineProperty(Element.prototype, 'clientWidth', { ...width, get() {
        if (this instanceof HTMLCanvasElement) sizeReads++;
        return width.get!.call(this);
      } });
      const observer = new MutationObserver(changes => {
        if (changes.some(change => change.attributeName === 'data-network-mix')) paints++;
      });
      observer.observe(canvas, { attributes: true });
      control.click();
      const sample = () => {
        frames++;
        if (Number(canvas.dataset.networkMix) === (mode === 'Network' ? 1 : 0) && frames > 1) {
          observer.disconnect();
          CanvasRenderingContext2D.prototype.clearRect = clear;
          WebGL2RenderingContext.prototype.drawArrays = draw;
          Object.defineProperty(Element.prototype, 'clientWidth', width);
          resolve({ frames, paints, clears, globeDraws, sizeReads });
        } else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }), mode);
    expect(result.paints).toBeGreaterThanOrEqual(result.frames - 2);
    expect(result.clears['globe-network-surface'] ?? 0).toBeLessThanOrEqual(1);
    expect(result.clears['globe-map-surface'] ?? 0).toBeLessThanOrEqual(1);
    expect(result.globeDraws).toBe(0);
    expect(result.sizeReads).toBe(0);
  }
  await page.setViewportSize({ width: 1280, height: 850 });
  const map = page.locator('.globe-map-surface');
  await expect.poll(() => map.evaluate(canvas => {
    const surface = canvas as HTMLCanvasElement;
    return surface.width === Math.round(surface.getBoundingClientRect().width * Math.min(devicePixelRatio, 1.5));
  })).toBe(true);
  expect(await map.evaluate(canvas => {
    const surface = canvas as HTMLCanvasElement;
    return surface.getContext('2d')!.getImageData(0, 0, surface.width, surface.height).data.some((value, i) => i % 4 === 3 && value > 0);
  })).toBe(true);
});

test('Steady route effects paint on every display frame and stop for reduced motion', async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await expect(page.locator('.atlas-globe-pins')).toHaveAttribute('data-route-renderer', 'gpu');
  const sample = () => page.evaluate(() => new Promise<{ frames: number; paints: number; geometryChanges: number }>(resolve => {
    let frames = 0, paints = 0, geometryChanges = 0, framebuffer: WebGLFramebuffer | null = null;
    const bind = WebGL2RenderingContext.prototype.bindFramebuffer, draw = WebGL2RenderingContext.prototype.drawArraysInstanced;
    WebGL2RenderingContext.prototype.bindFramebuffer = function (...args) {
      if ((this.canvas as HTMLCanvasElement).className === 'atlas-route-canvas' && (args[0] === this.FRAMEBUFFER || args[0] === this.DRAW_FRAMEBUFFER)) framebuffer = args[1];
      return bind.apply(this, args);
    };
    WebGL2RenderingContext.prototype.drawArraysInstanced = function (...args) {
      if ((this.canvas as HTMLCanvasElement).className === 'atlas-route-canvas' && !framebuffer && args[3] > 0) paints++;
      return draw.apply(this, args);
    };
    const observer = new MutationObserver(changes => { geometryChanges += changes.filter(change => change.attributeName === 'd' || change.attributeName === 'transform').length; });
    observer.observe(document.querySelector('.atlas-globe-pins')!, { subtree: true, attributes: true });
    const frame = () => {
      if (++frames < 30) { requestAnimationFrame(frame); return; }
      observer.disconnect();
      WebGL2RenderingContext.prototype.bindFramebuffer = bind;
      WebGL2RenderingContext.prototype.drawArraysInstanced = draw;
      resolve({ frames, paints, geometryChanges });
    };
    requestAnimationFrame(frame);
  }));
  for (const mode of ['Globe', 'Map', 'Network']) {
    await page.getByRole('radio', { name: `${mode} view`, exact: true }).click();
    const canvas = page.getByTestId('atlas-globe').locator('canvas').first();
    await expect(canvas).toHaveAttribute('data-network-mix', mode === 'Network' ? '1.0000' : '0.0000');
    if (mode !== 'Network') await expect(canvas).toHaveAttribute('data-map-mix', mode === 'Map' ? '1.0000' : '0.0000');
    const result = await sample();
    expect(result.paints).toBeGreaterThanOrEqual(result.frames - 1);
    expect(result.geometryChanges).toBe(0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.atlas-globe-pins')).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const stopped = await sample();
  expect(stopped.paints).toBe(0);
  expect(stopped.geometryChanges).toBe(0);
});
