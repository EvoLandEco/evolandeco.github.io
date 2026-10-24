import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Profile all six ATLAS mode transitions at device resolution', async ({ page }, info) => {
  test.skip(!process.env.ATLAS_PROFILE, 'Run with ATLAS_PROFILE to capture transition timings.');
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 982, deviceScaleFactor: 2, mobile: false });
  await client.send('Performance.enable');
  const browserClient = await page.context().browser()!.newBrowserCDPSession();
  const { gpu } = await browserClient.send('SystemInfo.getInfo');
  await page.goto('/atlas/');
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true', { timeout: 90000 });
  await page.getByRole('button', { name: 'Click to enter full screen' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await expect(page.locator('.atlas-globe-pins')).toHaveAttribute('data-route-renderer', 'gpu');
  await expect(page.locator('.globe-map-surface')).toHaveCount(1);
  const workload = await page.getByTestId('atlas-globe').evaluate(root => ({
    nodes: root.querySelectorAll('.atlas-globe-pin').length,
    routes: root.querySelectorAll('.atlas-link-target').length,
    canvases: [...root.querySelectorAll('canvas')].map(canvas => ({ class: canvas.className, width: canvas.width, height: canvas.height })),
  }));
  if (process.env.ATLAS_CPU_PROFILE) {
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 1000 });
    await client.send('Profiler.start');
  }
  if (process.env.ATLAS_TRACE) await client.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,benchmark',
    transferMode: 'ReturnAsStream',
  });
  const transitions = [];
  for (const mode of ['map', 'network', 'globe', 'network', 'map', 'globe']) {
    const before = await client.send('Performance.getMetrics');
    const frames = await page.evaluate(mode => new Promise<{ elapsed: number; frames: number[]; paints: number[] }>(resolve => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="atlas-globe"] canvas')!;
      const control = document.querySelector<HTMLButtonElement>(`[role="radio"][aria-label="${mode[0].toUpperCase() + mode.slice(1)} view"]`)!;
      const frames: number[] = [], paints: number[] = [], started = performance.now();
      let previousFrame = started, previousPaint = started;
      const observer = new MutationObserver(changes => {
        if (!changes.some(change => change.attributeName === 'data-map-mix' || change.attributeName === 'data-network-mix')) return;
        const now = performance.now(); paints.push(now - previousPaint); previousPaint = now;
      });
      observer.observe(canvas, { attributes: true });
      control.click();
      const sample = (now: number) => {
        frames.push(now - previousFrame); previousFrame = now;
        const map = Number(canvas.dataset.mapMix), network = Number(canvas.dataset.networkMix);
        const done = mode === 'map' ? map === 1 && network === 0 : mode === 'network' ? network === 1 : map === 0 && network === 0;
        if (done && frames.length > 1) { observer.disconnect(); resolve({ elapsed: performance.now() - started, frames, paints }); }
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }), mode);
    const after = await client.send('Performance.getMetrics');
    const metrics = Object.fromEntries(after.metrics.filter(metric => /Duration|Count/.test(metric.name)).map(metric => [metric.name, metric.value - (before.metrics.find(prior => prior.name === metric.name)?.value ?? 0)]));
    const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)];
    transitions.push({ mode, elapsed: frames.elapsed, frames: frames.frames.length, paintedFrames: frames.paints.length,
      rafMedian: quantile(frames.frames.slice(1), .5), rafP95: quantile(frames.frames.slice(1), .95), paintMedian: quantile(frames.paints, .5), paintP95: quantile(frames.paints, .95), metrics });
  }
  const profile = process.env.ATLAS_CPU_PROFILE ? (await client.send('Profiler.stop')).profile : null;
  if (process.env.ATLAS_TRACE) {
    const completed = new Promise<string>(resolve => client.once('Tracing.tracingComplete', event => resolve(event.stream!)));
    await client.send('Tracing.end');
    const stream = await completed;
    let trace = '';
    for (;;) {
      const chunk = await client.send('IO.read', { handle: stream });
      trace += chunk.data;
      if (chunk.eof) break;
    }
    await client.send('IO.close', { handle: stream });
    writeFileSync(info.outputPath('transition-trace.json'), trace);
  }
  const times = new Map<number, number>();
  profile?.samples?.forEach((id, i) => times.set(id, (times.get(id) ?? 0) + (profile.timeDeltas?.[i] ?? 0)));
  const functions = profile?.nodes.map(node => ({ name: node.callFrame.functionName, url: node.callFrame.url, line: node.callFrame.lineNumber, ms: (times.get(node.id) ?? 0) / 1000 })).filter(row => row.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 40);
  const result = { gpu: { devices: gpu.devices, features: gpu.featureStatus }, workload, transitions, functions };
  writeFileSync(info.outputPath('transition-profile.json'), JSON.stringify(result, null, 2));
  if (profile) writeFileSync(info.outputPath('transition.cpuprofile'), JSON.stringify(profile));
  console.log(JSON.stringify(result));
});
