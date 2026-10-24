import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { bundle } from "./atlas-fixture";
import { routeBrowserFixture } from "./atlas-browser-fixture.mjs";

test.beforeEach(async ({ page }) => {
  await routeBrowserFixture(page, bundle, JSON.parse(readFileSync(".cache/atlas-fixture/map.json", "utf8")));
});

test("Map transition moves locations and links together while retaining reporting choices", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-workspace-transition");
  await page.getByRole("button", { name: "3 months", exact: true }).click();
  const route = page.locator('.atlas-link-target').first();
  await route.press("Enter");
  await expect(page.locator('.atlas-route[data-active="true"]')).toHaveCount(1);
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  const state = () => page.locator(".atlas-page").evaluate(element => ({
    dates: [...element.querySelectorAll<HTMLInputElement>('.atlas-ranges input')].map(input => input.value),
    filters: [...element.querySelectorAll('.atlas-filters summary')].map(summary => summary.textContent),
    selected: element.querySelector('.atlas-callout')?.textContent,
  }));
  const before = await state();
  const reset = page.getByRole("button", { name: "Reset globe tilt", exact: true });
  const bounds = await canvas.boundingBox();
  const resetBounds = await reset.boundingBox();
  const toggle = page.getByRole("radio", { name: "Map view", exact: true });
  await toggle.click();
  const frames = await page.getByTestId("atlas-globe").evaluate(element => new Promise<{ mix: number; node: string | null; route: string | null }[]>(resolve => {
    const frames: { mix: number; node: string | null; route: string | null }[] = [];
    const sample = () => {
      const mix = Number(element.querySelector("canvas")?.dataset.mapMix);
      frames.push({ mix, node: element.querySelector('.atlas-globe-pin')?.getAttribute("transform") ?? null,
        route: element.querySelector('.atlas-link-target')?.getAttribute("d") ?? null });
      if (mix === 1) resolve(frames); else requestAnimationFrame(sample);
    };
    sample();
  }));
  expect(frames.some(frame => frame.mix > 0 && frame.mix < 1)).toBe(true);
  expect(new Set(frames.map(frame => frame.node)).size).toBeGreaterThan(3);
  expect(new Set(frames.map(frame => frame.route)).size).toBeGreaterThan(3);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(canvas).toHaveCSS("opacity", "0");
  expect(await canvas.boundingBox()).toEqual(bounds);
  expect(await reset.boundingBox()).toEqual(resetBounds);
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('.atlas-globe-pin[data-occluded="true"]')).toHaveCount(0);
  expect(await state()).toEqual(before);
  await page.screenshot({ path: test.info().outputPath("map-desktop.png") });
  await page.getByRole("radio", { name: "Globe view", exact: true }).press("Enter");
  await expect(canvas).toHaveAttribute("data-map-mix", "0.0000");
  await expect(canvas).toHaveCSS("opacity", "1");
  expect(await canvas.boundingBox()).toEqual(bounds);
  expect(await reset.boundingBox()).toEqual(resetBounds);
  expect(await state()).toEqual(before);
  expect(errors).toEqual([]);
});

test("Map control fits phones and switches directly with reduced motion in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  const toggle = page.getByRole("radio", { name: "Map view", exact: true });
  await toggle.press("Enter");
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-map-mix", "1.0000");
  await page.screenshot({ path: test.info().outputPath("map-phone-light.png") });
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("atlas-globe").scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("map-phone-dark.png") });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await page.locator(".atlas-time-heading").evaluate(element => ({
      heading: element.getBoundingClientRect().toJSON(),
      toggle: element.querySelector(".atlas-view-pill")!.getBoundingClientRect().toJSON(),
      presets: element.querySelector(".atlas-date-presets")!.getBoundingClientRect().toJSON(),
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
    }));
    expect(boxes.presets.right).toBeLessThan(boxes.toggle.left);
    expect(boxes.toggle.right).toBeLessThanOrEqual(boxes.heading.right + 1);
    expect(boxes.presets.y).toBeCloseTo(boxes.toggle.y, 0);
    expect(boxes.presets.height).toBe(boxes.toggle.height);
    expect(boxes.scroll).toBeLessThanOrEqual(boxes.width);
  }
  await page.getByRole("radio", { name: "Globe view", exact: true }).press("Space");
  await expect(canvas).toHaveAttribute("data-map-mix", "0.0000");
  await expect(page.getByRole("radio", { name: "Globe view", exact: true })).toBeFocused();
});

test("The expanding surface can reverse before reaching the map", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-workspace-transition");
  const globe = page.getByTestId("atlas-globe"), canvas = globe.locator("canvas").first();
  const toggle = page.getByRole("radio", { name: "Map view", exact: true });
  await toggle.click();
  const opening = await page.evaluate(() => new Promise<{ image: string; mix: number; opacity: string }>(resolve => {
    const frame = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="atlas-globe"] canvas')!;
      const mix = Number(canvas.dataset.mapMix);
      if (mix < .45) { requestAnimationFrame(frame); return; }
      const surface = document.querySelector<HTMLCanvasElement>('.globe-map-surface')!;
      const image = surface.toDataURL(), opacity = getComputedStyle(canvas).opacity;
      document.querySelector<HTMLButtonElement>('.atlas-projection-slider [aria-label="Globe view"]')!.click();
      resolve({ image, mix, opacity });
    };
    frame();
  }));
  expect(opening.mix).toBeLessThan(1);
  expect(opening.opacity).toBe("0");
  writeFileSync(test.info().outputPath("surface-opening.png"), Buffer.from(opening.image.split(",")[1], "base64"));
  await expect(canvas).toHaveAttribute("data-map-mix", "0.0000");
  await expect(canvas).toHaveCSS("opacity", "1");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("All six view transitions move the same nodes and links without moving controls or losing selections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Click to enter full screen" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-workspace-transition");
  await page.locator('.atlas-link-target').first().press("Enter");
  const selected = await page.locator('.atlas-callout').textContent();
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  const box = await canvas.boundingBox(), controls = await page.locator('.atlas-projection-slider').boundingBox();
  const handle = await canvas.elementHandle();
  for (const mode of ["Map", "Network", "Globe", "Network", "Map", "Globe"]) {
    const frames = await page.evaluate(mode => new Promise<{ map: number; network: number; nodes: number[][]; path: string; time: number }[]>(resolve => {
      const surface = document.querySelector<HTMLCanvasElement>('[data-testid="atlas-globe"] canvas')!;
      const frames: { map: number; network: number; nodes: number[][]; path: string; time: number }[] = [];
      const sample = () => {
        const map = Number(surface.dataset.mapMix), network = Number(surface.dataset.networkMix);
        frames.push({ map, network, time: performance.now(), nodes: [...document.querySelectorAll('.atlas-globe-pin')].map(node => {
          const matrix = (node as SVGGraphicsElement).transform.baseVal.consolidate()!.matrix;
          return [matrix.e, matrix.f];
        }), path: document.querySelector('.atlas-link-target')!.getAttribute('d')! });
        const finished = mode === "Network" ? network === 1 : network === 0 && map === (mode === "Map" ? 1 : 0);
        if (frames.length > 1 && finished) resolve(frames); else requestAnimationFrame(sample);
      };
      document.querySelector<HTMLButtonElement>(`.atlas-projection-slider [aria-label="${mode} view"]`)!.click();
      sample();
    }), mode);
    expect(frames.length).toBeGreaterThan(3);
    expect(new Set(frames.map(frame => frame.path)).size).toBeGreaterThan(3);
    expect(frames.every(frame => frame.nodes.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x > 0 && x < 1000 && y > 0 && y < 1000))).toBe(true);
    expect(frames.every((frame, i) => i === 0 || frame.nodes.every(([x, y], n) => {
      const previous = frames[i - 1];
      return Math.hypot(x - previous.nodes[n][0], y - previous.nodes[n][1]) < 8 * (frame.time - previous.time) + 1;
    }))).toBe(true);
    expect(await canvas.boundingBox()).toEqual(box);
    expect(await page.locator('.atlas-projection-slider').boundingBox()).toEqual(controls);
    expect(await handle!.evaluate(node => node === document.querySelector('[data-testid="atlas-globe"] canvas'))).toBe(true);
    expect(await page.locator('.atlas-callout').textContent()).toBe(selected);
    if (mode === "Network") {
      await expect(canvas).toHaveCSS("opacity", "0");
      await expect(page.locator('.globe-map-surface')).toHaveCSS("opacity", "0");
      await expect(page.locator('.atlas-globe-pin[data-occluded="true"]')).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath("network-desktop.png") });
    }
  }
  expect(errors).toEqual([]);
});

test("The slider supports keyboard selection, phone layouts, and interrupted network transitions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  const globe = page.getByRole("radio", { name: "Globe view", exact: true });
  await globe.press("End");
  await expect(page.getByRole("radio", { name: "Network view", exact: true })).toBeFocused();
  const interrupted = await page.evaluate(() => new Promise<number>(resolve => {
    const sample = () => {
      const surface = document.querySelector<HTMLCanvasElement>('[data-testid="atlas-globe"] canvas')!;
      const mix = Number(surface.dataset.networkMix);
      if (mix < .3) { requestAnimationFrame(sample); return; }
      document.querySelector<HTMLButtonElement>('.atlas-projection-slider [aria-label="Map view"]')!.click();
      resolve(mix);
    };
    sample();
  }));
  expect(interrupted).toBeLessThan(1);
  const canvas = page.getByTestId("atlas-globe").locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-map-mix", "1.0000");
  await expect(canvas).toHaveAttribute("data-network-mix", "0.0000");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio", { name: "Map view", exact: true }).press("ArrowRight");
  await expect(canvas).toHaveAttribute("data-network-mix", "1.0000");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("radio", { name: "Network view", exact: true }).scrollIntoViewIfNeeded();
    const overflow = await page.locator('.atlas-controls').evaluate(element => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      control: element.scrollWidth - element.clientWidth,
    }));
    expect(overflow.page).toBeLessThanOrEqual(0);
    expect(overflow.control).toBeLessThanOrEqual(0);
  }
  await page.screenshot({ path: test.info().outputPath("network-phone.png") });
  await page.getByRole("radio", { name: "Network view", exact: true }).press("Home");
  await expect(globe).toBeFocused();
  await expect(globe).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("atlas-globe").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-map-mix", "0.0000");
  await expect(canvas).toHaveAttribute("data-network-mix", "0.0000");
});
