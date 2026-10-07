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
  await expect(page.locator(".globe-view-controls, [data-globe-view]")).toHaveCount(0);
  expect(await reportingState(page)).toEqual(state);
  await reset.click();
  await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  expect((await pose(page)).angle).toBe(dragged.angle);
  await expect(reset).toHaveCount(0);
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
  await reset.focus();
  await expect(reset).toBeFocused();
  await reset.press("Enter");
  await expect.poll(async () => (await pose(page)).tilt).toBe(initial.tilt);
  expect((await pose(page)).angle).toBe(dragged.angle);
  await expect(reset).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Exit full screen/ })).toBeFocused();
  expect(await reportingState(page)).toEqual(state);
  await dragSurface(page, 0, -45);
  await expect(reset).toBeVisible();
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
  await expect(hint).toHaveCount(0, { timeout: 7000 });
  const fullscreenPoint = await surface(page, "ne");
  await page.mouse.click(fullscreenPoint.x, fullscreenPoint.y);
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-fullscreen", "true");
  await expect(hint).toHaveCount(0);
  expect(errors).toEqual([]);
});
