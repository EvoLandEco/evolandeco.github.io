import { bundle } from "./atlas-fixture";
import { routeBrowserFixture } from "./atlas-browser-fixture.mjs";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import fixture from "./atlas-fixture.json";

test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
});

async function openAtlas(page: Page, fullscreen = true) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  if (fullscreen) {
    await page.getByRole("button", { name: "Click to enter full screen" }).click();
    await expect(page.locator(".atlas-page")).toHaveAttribute("data-fullscreen", "true");
    await expect(page.locator("html")).not.toHaveAttribute("data-atlas-workspace-transition");
  }
  return errors;
}

async function surface(page: Page, corner: "ne" | "nw" | "se" | "sw") {
  return page.getByTestId("atlas-globe").locator("canvas").first().evaluate((canvas, corner) => {
    const box = canvas.getBoundingClientRect();
    const xs = corner.endsWith("e") ? [.65, .7, .6] : [.35, .3, .4];
    const ys = corner.startsWith("n") ? [.35, .3, .4] : [.65, .7, .6];
    for (const xRatio of xs) for (const yRatio of ys) {
      const x = box.left + box.width * xRatio, y = box.top + box.height * yRatio;
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
    }
    throw new Error(`No exposed globe surface in ${corner}`);
  }, corner);
}

async function pose(page: Page) {
  return page.getByTestId("atlas-globe").locator("canvas").first().evaluate(canvas => ({
    angle: Number(canvas.dataset.angle), tilt: Number(canvas.dataset.tilt),
  }));
}

async function dragSurface(page: Page, dx: number, dy: number) {
  const point = await surface(page, "ne");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 6 });
  await page.mouse.up();
}

async function overlayPoint(page: Page, selector: string) {
  return page.getByTestId("atlas-globe").locator(selector).evaluateAll(elements => {
    for (const element of elements) {
      const matrix = (element as SVGGraphicsElement).getScreenCTM();
      if (!matrix) continue;
      const length = element instanceof SVGPathElement ? element.getTotalLength() : 0;
      if (element instanceof SVGPathElement && length === 0) continue;
      for (const fraction of [.2, .4, .6, .8]) {
        const local = element instanceof SVGPathElement ? element.getPointAtLength(length * fraction) : new DOMPoint(0, 0);
        const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
        const target = document.elementFromPoint(point.x, point.y);
        if (target && element.contains(target)) return { x: point.x, y: point.y };
      }
    }
    throw new Error("No visible globe overlay target");
  });
}

async function reportingState(page: Page) {
  return page.locator(".atlas-page").evaluate(atlas => ({
    dates: [...atlas.querySelectorAll<HTMLInputElement>('.atlas-ranges input')].map(input => input.value),
    presets: [...atlas.querySelectorAll('.atlas-date-presets button')].map(button => button.getAttribute("aria-pressed")),
    filters: [...atlas.querySelectorAll('.atlas-filters summary')].map(summary => summary.textContent),
    checked: [...atlas.querySelectorAll<HTMLInputElement>('.atlas-filters input[type="checkbox"]')].map(input => [input.getAttribute("aria-label"), input.value, input.checked]),
    counts: [...atlas.querySelectorAll('.atlas-tabs button b')].map(count => count.textContent),
    tab: atlas.querySelector('.atlas-tabs [aria-selected="true"]')?.getAttribute("aria-label"),
  }));
}

for (const kind of ["link", "node"] as const) test(`Selecting a ${kind} keeps its card pinned throughout the camera flight`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = await openAtlas(page);
  const point = await overlayPoint(page, kind === "link" ? ".atlas-link-target" : ".atlas-globe-pin");
  await page.mouse.move(point.x, point.y);
  const card = page.locator(".atlas-callout-card");
  await expect(card).toBeVisible();
  const title = await card.locator(".atlas-callout-title").textContent();
  const before = await pose(page);
  await page.mouse.click(point.x, point.y);
  await expect(card).toHaveAttribute("data-pinned", "true");
  const samples = await page.evaluate(() => new Promise<{ title: string | null; pinned: string | undefined; visible: string; same: boolean; x: number; y: number }[]>(resolve => {
    const card = document.querySelector<HTMLElement>(".atlas-callout-card")!;
    const samples: { title: string | null; pinned: string | undefined; visible: string; same: boolean; x: number; y: number }[] = [];
    const start = performance.now();
    const sample = (time: number) => {
      const current = document.querySelector<HTMLElement>(".atlas-callout-card")!;
      const box = current.getBoundingClientRect();
      samples.push({ title: current.querySelector(".atlas-callout-title")!.textContent, pinned: current.dataset.pinned,
        visible: getComputedStyle(current).visibility, same: current === card, x: box.x, y: box.y });
      if (time - start < 850) requestAnimationFrame(sample); else resolve(samples);
    };
    requestAnimationFrame(sample);
  }));
  expect(samples.length).toBeGreaterThan(10);
  expect([...new Set(samples.map(sample => sample.title))]).toEqual([title]);
  expect(samples.every(sample => sample.pinned === "true" && sample.visible === "visible" && sample.same)).toBe(true);
  expect(Math.max(...samples.map(sample => sample.x)) - Math.min(...samples.map(sample => sample.x))).toBeLessThan(1);
  expect(Math.max(...samples.map(sample => sample.y)) - Math.min(...samples.map(sample => sample.y))).toBeLessThan(1);
  expect(await pose(page)).not.toEqual(before);

  // Moving geometry can enter a stationary pointer without a pointermove event.
  await page.locator('.atlas-globe-pin').first().dispatchEvent("pointerover", { pointerType: "mouse" });
  await expect(card).toHaveAttribute("data-pinned", "true");
  const other = await overlayPoint(page, '.atlas-globe-pin');
  await page.mouse.move(other.x, other.y);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card).toHaveAttribute("data-pinned", "true");
  await expect(card.locator(".atlas-callout-title")).toHaveText(title!);
  expect(errors).toEqual([]);
});

for (const kind of ["link", "node"] as const) test(`Pointer previews wait for the ${kind} centering flight to finish`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = await openAtlas(page);
  const point = await overlayPoint(page, kind === "link" ? ".atlas-link-target" : ".atlas-globe-pin");
  await page.mouse.click(point.x, point.y);
  const card = page.getByRole("region", { name: "Selected map item" });
  await expect(card).toBeVisible();
  const title = await card.locator(".atlas-callout-title").textContent();
  const result = await page.evaluate(() => new Promise<{ pinned: boolean; titles: (string | null)[]; poses: number; previews: number }>(resolve => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="atlas-globe"] canvas')!;
    const start = performance.now(), titles = new Set<string | null>(), poses = new Set<string>();
    let pinned = true, previews = 0;
    const sample = (time: number) => {
      const card = document.querySelector<HTMLElement>(".atlas-callout-card")!;
      pinned &&= card.dataset.pinned === "true";
      titles.add(card.querySelector(".atlas-callout-title")!.textContent);
      poses.add(`${canvas.dataset.angle}:${canvas.dataset.tilt}`);
      if (time - start >= 300) { resolve({ pinned, titles: [...titles], poses: poses.size, previews }); return; }
      const targets = document.querySelectorAll(".atlas-link-target, .atlas-globe-pin");
      targets[previews++ % targets.length].dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(result.previews).toBeGreaterThan(5);
  expect(result.poses).toBeGreaterThan(5);
  expect(result.pinned).toBe(true);
  expect(result.titles).toEqual([title]);

  await page.evaluate(() => new Promise<void>(resolve => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="atlas-globe"] canvas')!;
    let previous = "", still = 0;
    const sample = () => {
      const pose = `${canvas.dataset.angle}:${canvas.dataset.tilt}`;
      still = pose === previous ? still + 1 : 0; previous = pose;
      if (still === 3) resolve(); else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  const hoverPoint = await overlayPoint(page, ".atlas-globe-pin");
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card).toBeVisible();
  expect(errors).toEqual([]);
});

test("The pinned connector follows the globe through hover scaling", async ({ page }) => {
  const errors = await openAtlas(page, false);
  const pin = page.locator('.atlas-globe-pin').first();
  await pin.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("region", { name: "Selected map item" });
  await expect(card).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const initial = await page.getByTestId("atlas-globe").boundingBox();
  const point = await surface(page, "ne");
  await page.mouse.move(point.x, point.y);
  await expect.poll(async () => (await page.getByTestId("atlas-globe").boundingBox())!.width).toBeGreaterThan(initial!.width * 1.02);
  const box = await card.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 10);
  const distances = await page.evaluate(() => new Promise<number[]>(resolve => {
    const distances: number[] = [], start = performance.now();
    const sample = (time: number) => {
      const pin = document.querySelector<SVGGElement>('.atlas-globe-pin[data-selected="true"]')!;
      const dot = document.querySelector<SVGCircleElement>('.atlas-callout-connector circle')!;
      const p = new DOMPoint().matrixTransform(pin.getScreenCTM()!);
      const q = new DOMPoint(dot.cx.baseVal.value, dot.cy.baseVal.value).matrixTransform(dot.getScreenCTM()!);
      distances.push(Math.hypot(p.x - q.x, p.y - q.y));
      if (time - start < 500) requestAnimationFrame(sample); else resolve(distances);
    };
    requestAnimationFrame(sample);
  }));
  expect(distances.length).toBeGreaterThan(10);
  expect(Math.max(...distances)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test("Fullscreen drag rotates both axes and tilt reset preserves reporting choices", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = await openAtlas(page, false);
  const reset = page.getByRole("button", { name: "Reset globe tilt", exact: true });
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  const overlays = page.locator(".atlas-globe-pins");
  const initial = await pose(page);
  expect(initial.tilt).toBe(.22);
  await expect(canvas).toHaveCSS("touch-action", "pan-y");
  await expect(overlays).toHaveCSS("touch-action", "pan-y");
  await expect(reset).toHaveCount(0);
  await expect(page.locator(".globe-view-controls, [data-globe-view]")).toHaveCount(0);
  await dragSurface(page, 50, 60);
  const normal = await pose(page);
  expect(Math.abs(normal.angle - initial.angle)).toBeGreaterThan(.05);
  expect(normal.tilt).toBe(initial.tilt);
  await expect(page.locator(".atlas-page")).not.toHaveAttribute("data-fullscreen");
  await expect(reset).toHaveCount(0);

  await page.getByRole("button", { name: "3 months", exact: true }).click();
  await page.locator('summary[aria-label="Reporting source"]').click();
  await page.getByRole("checkbox", { name: "ECDC", exact: true }).check();
  await page.getByRole("checkbox", { name: "ECDC", exact: true }).press("Escape");
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-workspace-transition");
  await expect(canvas).toHaveCSS("touch-action", "none");
  await expect(overlays).toHaveCSS("touch-action", "none");
  const state = await reportingState(page);
  const before = await pose(page);
  await dragSurface(page, 45, 65);
  const dragged = await pose(page);
  expect(Math.abs(dragged.angle - before.angle)).toBeGreaterThan(.05);
  expect(Math.abs(dragged.tilt - before.tilt)).toBeGreaterThan(.05);
  await expect(reset).toBeVisible();
  await expect(reset).toHaveAttribute("aria-disabled", "false");
  await expect(page.locator(".globe-view-controls, [data-globe-view]")).toHaveCount(0);
  expect(await reportingState(page)).toEqual(state);
  await reset.click();
  await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  expect((await pose(page)).angle).toBe(dragged.angle);
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  expect(await reportingState(page)).toEqual(state);
  await expect(page.getByRole("button", { name: "Clear globe selection" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Tilt reset is keyboard operable in compact fullscreen with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openAtlas(page);
  const initial = await pose(page);
  const state = await reportingState(page);
  const reset = page.getByRole("button", { name: "Reset globe tilt", exact: true });
  await dragSurface(page, 30, 60);
  const dragged = await pose(page);
  await expect(reset).toBeVisible();
  await expect(reset).toHaveAttribute("aria-disabled", "false");
  await reset.focus();
  await expect(reset).toBeFocused();
  await reset.press("Enter");
  await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  expect((await pose(page)).angle).toBe(dragged.angle);
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(reset).toBeFocused();
  expect(await reportingState(page)).toEqual(state);
  await dragSurface(page, 0, -45);
  await expect(reset).toBeVisible();
  await expect(reset).toHaveAttribute("aria-disabled", "false");
  await page.getByRole("button", { name: /Exit full screen/ }).click();
  await expect(reset).toHaveCount(0);
  await expect(page.locator(".globe-view-controls, [data-globe-view]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Cancelled and overlay drags preserve globe selection controls", async ({ page }) => {
  const errors = await openAtlas(page);
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  const initial = await pose(page);
  const reset = page.getByRole("button", { name: "Reset globe tilt", exact: true });
  const clear = page.getByRole("button", { name: "Clear globe selection" });
  for (const type of ["pointercancel", "lostpointercapture"]) {
    const point = await surface(page, "ne");
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 40, point.y + 35, { steps: 4 });
    await canvas.dispatchEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: point.x + 40, clientY: point.y + 35 });
    await page.mouse.up();
    const stopped = await pose(page);
    await page.mouse.move(point.x + 90, point.y + 70);
    expect(await pose(page)).toEqual(stopped);
    await expect(clear).toHaveCount(0);
    await expect(page.locator(".globe-view-controls, [data-globe-view]")).toHaveCount(0);
    await reset.click();
    await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  }
  for (const selector of [".atlas-globe-pin", ".atlas-link-target"]) {
    const point = await overlayPoint(page, selector);
    const before = await pose(page);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 45, point.y + 35, { steps: 6 });
    await page.mouse.up();
    const dragged = await pose(page);
    expect(Math.abs(dragged.angle - before.angle)).toBeGreaterThan(.05);
    expect(Math.abs(dragged.tilt - before.tilt)).toBeGreaterThan(.05);
    await expect(clear).toHaveCount(0);
    await reset.click();
    await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  }
  const beforeSelection = await pose(page);
  const point = await overlayPoint(page, ".atlas-globe-pin");
  await page.mouse.click(point.x, point.y);
  await expect(clear).toBeVisible();
  await clear.click();
  await expect.poll(() => pose(page)).toEqual(beforeSelection);
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-fullscreen", "true");
  expect(errors).toEqual([]);
});

test("Crossing the normal tilt keeps the drag surface and camera controls fixed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors = await openAtlas(page);
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  const reset = page.getByRole("button", { name: "Reset globe tilt", exact: true });
  const layout = () => page.locator(".atlas-page").evaluate(element => new Promise(resolve => requestAnimationFrame(() => {
    const box = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    resolve({ canvas: box('[data-testid="atlas-globe"] canvas'), reset: box('.atlas-tilt-reset'), toggle: box('.atlas-projection-slider [aria-label="Map view"]') });
  })));
  const initial = await pose(page), before = await layout();
  const width = (await canvas.boundingBox())!.width;
  const resetBox = (await reset.boundingBox())!, toggleBox = (await page.getByRole("radio", { name: "Map view", exact: true }).boundingBox())!;
  expect(resetBox.x + resetBox.width).toBeLessThan(toggleBox.x);
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("atlas-globe").locator(".atlas-tilt-reset")).toHaveCount(0);
  const point = await surface(page, "ne");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  for (const dy of [35, 0, -35, 0, 60]) {
    await page.mouse.move(point.x + 25, point.y + dy, { steps: 4 });
    expect(await layout()).toEqual(before);
    expect((await pose(page)).tilt).toBeCloseTo(initial.tilt + dy / width * 3, 4);
    await expect(reset).toHaveAttribute("aria-disabled", String(dy === 0));
  }
  await page.mouse.up();
  await reset.click();
  await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  expect(await layout()).toEqual(before);
  expect(errors).toEqual([]);
});

test("Repeated tilt resets retain canvas resources and reporting scope", async ({ page }, testInfo) => {
  const errors = await openAtlas(page);
  const frame = page.getByTestId("atlas-globe");
  const initial = await pose(page);
  const state = await reportingState(page);
  await frame.evaluate(frame => {
    const layer = frame.querySelector<HTMLElement>(".atlas-globe-pins");
    Reflect.set(window, "atlasCameraResources", [...frame.querySelectorAll("canvas")].map(canvas => {
      const gpu = canvas === frame.querySelector("canvas") || (canvas.classList.contains("atlas-marker-canvas") && layer?.dataset.renderer === "gpu") || (canvas.classList.contains("atlas-route-canvas") && layer?.dataset.routeRenderer === "gpu");
      return { canvas, context: gpu ? canvas.getContext("webgl2") ?? canvas.getContext("webgl") : null, width: canvas.width, height: canvas.height };
    }));
  });
  const resources = [];
  for (const dy of [40, -60, 55]) {
    await dragSurface(page, 30, dy);
    const dragged = await pose(page);
    await page.getByRole("button", { name: "Reset globe tilt", exact: true }).click();
    await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
    expect((await pose(page)).angle).toBe(dragged.angle);
    const sample = await frame.evaluate(frame => {
      const saved = Reflect.get(window, "atlasCameraResources") as { canvas: HTMLCanvasElement; context: WebGLRenderingContext | null; width: number; height: number }[];
      const canvases = [...frame.querySelectorAll("canvas")];
      return {
        unchanged: canvases.length === saved.length && canvases.every((canvas, i) => canvas === saved[i].canvas && canvas.width === saved[i].width && canvas.height === saved[i].height && (!saved[i].context || (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) === saved[i].context)),
        sizes: canvases.map(canvas => [canvas.width, canvas.height]),
      };
    });
    expect(sample.unchanged).toBe(true);
    expect(await reportingState(page)).toEqual(state);
    resources.push(sample);
  }
  await testInfo.attach("tilt-reset-resources.json", { body: JSON.stringify(resources, null, 2), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("Globe drag guidance follows readiness and fullscreen entry without replaying", async ({ page }) => {
  const errors = await openAtlas(page, false);
  const hint = page.locator(".globe-drag-hint");
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute("data-active", "true");
  await expect(hint).toHaveCSS("pointer-events", "none");
  await expect(hint).toContainText("Drag to rotate");
  const initial = await reportingState(page);
  const point = await surface(page, "ne");
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 12, point.y + 1, { steps: 3 });
  await page.mouse.up();
  await expect(hint).toHaveCount(0);
  expect(await reportingState(page)).toEqual(initial);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("tab", { name: "Trends", exact: true }).click();
  await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: "3 months", exact: true }).click();
  await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(hint).toBeVisible();
  await page.getByRole("button", { name: /Exit full screen/ }).click();
  await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveCount(0, { timeout: 11000 });
  const fullscreenPoint = await surface(page, "ne");
  await page.mouse.click(fullscreenPoint.x, fullscreenPoint.y);
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-fullscreen", "true");
  await expect(hint).toHaveCount(0);
  expect(errors).toEqual([]);
});
