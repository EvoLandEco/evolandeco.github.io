import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AtlasSiteBundle, AtlasMapSnapshot } from "../src/lib/atlas-vendor/site-types";
const bundle: AtlasSiteBundle = JSON.parse(readFileSync(".cache/atlas-fixture/atlas-site.json", "utf8"));
const snapshot: AtlasMapSnapshot = JSON.parse(readFileSync(".cache/atlas-fixture/map.json", "utf8"));
const documentCount = bundle.documents.length;
const documentPages = Math.ceil(documentCount / 12);
import AxeBuilder from "@axe-core/playwright";
import fixture from "./atlas-fixture.json";
import { dayNumber, groupGeographicLinks } from "../src/lib/atlas";

const mapRecords = new Map(snapshot.records.map(r => [r.id, r]));
const routeGroups = groupGeographicLinks(snapshot.map_links, mapRecords);

test.beforeEach(async ({ page }) => {
  await page.route(/\/(?:current\.json|releases\/)/, async route => {
    const path = new URL(route.request().url()).pathname;
    const name = path.split("/").at(-1)!;
    if (path === "/current.json") return route.fulfill({ json: fixture.release });
    if (path.startsWith(`/releases/${fixture.export_id}/`) && name in fixture.assets)
      return route.fulfill({ contentType: "application/json", body: readFileSync(`.cache/atlas-fixture/${name}`) });
    return route.abort();
  });
});


async function showPageControl(page: Page) {
  await page.locator('.atlas-toolbar').evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 80));
}

async function select(page: Page, label: string, choice: string) {
  if (label.endsWith("page, side")) await showPageControl(page);
  await page.locator(`summary[aria-label="${label}"]`).click();
  if (["Reporting topic", "Reporting source", "Link type"].includes(label)) {
    const all = { "Reporting topic": "All places & topics", "Reporting source": "All sources", "Link type": "All link types" }[label]!;
    await page.getByRole("checkbox", { name: all, exact: true }).check();
    await page.getByRole("checkbox", { name: choice, exact: true }).check();
    await page.getByRole("checkbox", { name: choice, exact: true }).press("Escape");
  } else await page.getByRole("option", { name: choice, exact: true }).click();
}

async function setWindowDate(page: Page, edge: "start" | "end", date: string) {
  await page.getByRole("slider", { name: `Window ${edge}` }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(dayNumber(date)));
}

test("ATLAS figures retain source scope, conflicts and unconnected observations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await select(page, "Reporting topic", "Measles · Guatemala");
  const card = page.locator(".atlas-callout-card");
  await expect(card.locator(".atlas-measure > strong")).toHaveText(["30,371", "26", "25"]);
  await page.locator(".atlas-report > summary").click();
  await expect(page.locator(".atlas-comparison-branches > div")).toHaveCount(2);
  await expect(page.locator(".atlas-comparison")).toContainText("Unresolved");
  await expect(page.locator(".atlas-report .atlas-metrics .atlas-measure > strong")).toHaveText(["30,371"]);
  await expect(page.locator(".atlas-report .atlas-status").filter({ hasText: "Conflicting assertions" })).toHaveCount(1);
  await expect(page.locator(".atlas-comparison header .atlas-status")).toHaveText("Unresolved");
  await expect(page.locator(".atlas-comparison header .atlas-status svg")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(card.locator(".atlas-measure > strong")).toHaveText(["1", "5"]);
  await expect(page.locator('.atlas-connection[data-selected="true"] .atlas-measure-label')).toHaveText(["Imported case", "Contacts isolated"]);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await select(page, "Reporting topic", "Lassa fever · Nigeria");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.locator(".atlas-observations > summary").click();
  await expect(page.locator(".atlas-observation-grid figure").first()).toBeVisible();
  await expect(page.locator(".atlas-observation-grid svg polyline")).toHaveCount(0);
  await setWindowDate(page, "end", "2026-07-01");
  await expect(card.locator(".atlas-measure > strong")).toHaveText(["922", "31"]);
  await expect(page.locator(".atlas-observations")).toHaveCount(0);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "All dates", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("ATLAS entry, date windows, evidence and source focus", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Explore ATLAS from the globe" }).click();
  await expect(page).toHaveURL(/\/atlas\/$/);
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-transition");
  await expect(page.locator(".atlas-trend-activity header > strong")).toContainText(String(documentCount));
  await expect(page.getByRole("button", { name: "1 month", exact: true })).toHaveCount(0);
  for (const name of ["3 months", "6 months", "1 year"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("slider", { name: "Window start" })).toHaveValue(String(dayNumber(name === "3 months" ? "2026-06-25" : "2026-03-26")));
    await expect(page.getByRole("slider", { name: "Window end" })).toHaveValue(String(dayNumber("2026-09-25")));
  }
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await expect(page.locator(".atlas-timeline-next time")).toHaveText(["26 Sept 2026", "30 Sept 2026"]);
  await setWindowDate(page, "end", "2026-09-18");
  await expect(page.locator(".atlas-timeline-next")).toHaveCount(0);
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(page.locator(".atlas-timeline-next")).toBeVisible();
  await page.getByRole("tab", { name: /Geographic links/ }).click();
  await expect(page.locator(".atlas-connection")).toHaveCount(Math.min(12, routeGroups.length));
  await expect(page.locator('.atlas-geographic-route[data-directed="true"] .atlas-geographic-route-arrow')).toHaveCount(routeGroups.slice(0, 12).filter(g => g.entries.at(-1)!.link.directed).length);
  await expect(page.locator('.atlas-geographic-route[data-directed="false"] .atlas-geographic-route-arrow')).toHaveCount(0);
  await expect(page.locator(".atlas-geographic-route").first().locator(".atlas-geographic-route-place > strong")).toHaveText(["Congo - Kinshasa", "France"]);
  await expect(page.locator(".atlas-globe-pins .atlas-route-line").first()).toHaveCSS("fill", "none");
  await select(page, "Link type", "Source hypothesis");
  await expect(page.locator(".atlas-connection")).toHaveCount(Math.min(12, groupGeographicLinks(snapshot.map_links.filter(l => l.type === "hypothesis"), mapRecords).length));
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await select(page, "Reporting topic", "Bundibugyo imported case · France");
  await expect(page.locator(".atlas-location-note")).toContainText("Country reference");
  await page.getByRole("tab", { name: /Geographic links/ }).click();
  await expect(page.locator(".atlas-connection")).toHaveCount(1);
  await page.getByRole("button", { name: "Locate Reported return travel · Bundibugyo" }).click();
  await expect(page.locator(".atlas-evidence blockquote").first()).toBeVisible();
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await setWindowDate(page, "end", "2026-06-26");
  await expect(page.locator(".atlas-connection")).toHaveCount(Math.min(12, groupGeographicLinks(snapshot.map_links.filter(l => l.support.every(([id]) => mapRecords.get(id)!.publication.slice(0, 10) <= "2026-06-26")), mapRecords).length));
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(page.locator(".atlas-connection")).toHaveCount(Math.min(12, routeGroups.length));
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Assessments", exact: true }).click();
  await expect(page.locator(".atlas-connection")).toHaveCount(Math.min(12, snapshot.relationships.length));
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await page.getByRole("button", { name: "Reports from RIVM", exact: true }).click();
  await expect(page.locator(".atlas-filters summary").nth(1)).toContainText("RIVM");
  await expect(page.locator(".atlas-report")).toHaveCount(12);
  await page.locator(".atlas-report > summary").first().click();
  await expect(page.locator(".atlas-report").first().getByRole("link", { name: "Read source" })).toHaveAttribute("href", /^https:/);
  await page.getByRole("link", { name: "Research", exact: true }).click();
  await page.getByRole("link", { name: "ATLAS", exact: true }).click();
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-atlas-transition");
  await expect(page.locator('summary[aria-label="Date basis"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Play reporting window|Pause replay/ })).toHaveCount(0);
  await expect(page.locator(".atlas-range-dates time")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("ATLAS is readable on phones and in both themes", async ({ page }) => {
  for (const width of [360, 768, 1440]) for (const theme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/atlas/");
    await expect(page.getByRole("heading", { name: "ATLAS", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `evidence/atlas-${width}-${theme}.png`, fullPage: true });
  }
});

test("Geographic coverage expands with the reporting window", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-globe-pin")).toHaveCount(179);
  await expect(page.locator(".atlas-globe-pins .atlas-route")).toHaveCount(routeGroups.length);
  await page.getByRole("button", { name: "3 months", exact: true }).click();
  await expect(page.locator(".atlas-globe-pin")).toHaveCount(146);
  await expect(page.locator(".atlas-globe-pins .atlas-route")).toHaveCount(groupGeographicLinks(snapshot.map_links.filter(l => l.support.every(([id]) => mapRecords.get(id)!.publication.slice(0, 10) >= "2026-06-25")), mapRecords).length);
  await page.getByRole("button", { name: "6 months", exact: true }).click();
  await expect(page.locator(".atlas-globe-pin")).toHaveCount(179);
  await expect(page.locator(".atlas-globe-pins .atlas-route")).toHaveCount(routeGroups.length);
});

test("Stationary globes draw their land texture without a render loop", async ({ page }) => {
  const { default: sharp } = await import("sharp");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  const canvas = page.locator('canvas[data-markers]');
  async function landDots() {
    const { data, info } = await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let darkPixels = 0;
    for (let y = Math.floor(info.height * .25); y < info.height * .75; y++)
      for (let x = Math.floor(info.width * .25); x < info.width * .75; x++) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) darkPixels++;
      }
    return darkPixels;
  }
  await expect.poll(landDots).toBeGreaterThan(100);
  await select(page, "Reporting topic", "Bundibugyo reporting · DRC");
  await expect.poll(landDots).toBeGreaterThan(100);
});

test("ATLAS surface interactions, smooth centering and shared range handles", async ({ page }) => {
  await page.goto("/atlas/");
  await select(page, "Reporting topic", "Bundibugyo imported case · France");
  const canvas = page.locator('canvas[data-markers]');
  await expect(canvas).toHaveAttribute("data-tilt", "0.81158");
  const pin = page.locator('.atlas-globe-pin[data-selected="true"]');
  await pin.hover();
  await expect(page.getByRole("tooltip")).toContainText("reports");
  await page.mouse.move(10, 10);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const link = page.locator('.atlas-link-target').first();
  const point = await link.evaluate((element: SVGPathElement) => {
    const p = element.getPointAtLength(element.getTotalLength() * .55);
    const screen = new DOMPoint(p.x, p.y).matrixTransform(element.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.move(point.x, point.y);
  await expect(page.getByRole("tooltip")).toContainText("Reported travel");
  await page.mouse.move(10, 10);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-tilt", "0.22000");
  const target = page.locator('.atlas-globe-pin[aria-label*="Crimean-Congo haemorrhagic fever · Spain"]');
  const before = Number(await canvas.getAttribute("data-angle"));
  await target.focus();
  await target.press("Enter");
  const immediate = Number(await canvas.getAttribute("data-angle"));
  await expect.poll(async () => Number(await canvas.getAttribute("data-tilt")) > .69).toBe(true);
  await expect(canvas).toHaveAttribute("data-tilt", "0.70162");
  const settled = Number(await canvas.getAttribute("data-angle"));
  expect(Math.abs(immediate - before)).toBeLessThan(Math.abs(settled - before));
  const start = page.getByRole("slider", { name: "Window start" });
  const end = page.getByRole("slider", { name: "Window end" });
  const initial = Number(await start.inputValue());
  await start.focus(); await page.keyboard.press("ArrowRight");
  await expect(start).toHaveValue(String(initial + 1));
  const startBox = await start.boundingBox(), endBox = await end.boundingBox();
  expect(startBox?.y).toEqual(endBox?.y);
  expect(startBox?.width).toEqual(endBox?.width);
  const endBefore = Number(await end.inputValue());
  await page.mouse.move(endBox!.x + endBox!.width - 9, endBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(endBox!.x + endBox!.width * .8, endBox!.y + 12, { steps: 8 });
  await page.mouse.up();
  expect(Number(await end.inputValue())).toBeLessThan(endBefore);
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(page.locator('.atlas-link-key')).toHaveCount(0);
  await expect(page.locator('.atlas-timeline-node').first()).toBeVisible();
});

test("Far-side events use subtle rim arrows that follow rotation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/atlas/");
  const hidden = page.locator('.atlas-globe-pin[data-occluded="true"]');
  await expect(hidden.first()).toBeVisible();
  await expect(hidden.first()).toHaveAttribute("tabindex", "0");
  await expect(hidden.first().locator(".atlas-rim-arrow")).toBeVisible();
  await expect(hidden.first().locator(".atlas-event-marker")).toBeHidden();
  const rimPosition = await hidden.first().getAttribute("transform");
  const rimId = await hidden.first().getAttribute("aria-label");
  const visible = page.locator('.atlas-globe-pin[data-occluded="false"]');
  const names = () => visible.evaluateAll(items => items.map(item => item.getAttribute("aria-label")));
  await expect(visible.first()).toBeVisible();
  const before = await names();
  const canvas = page.locator('canvas[data-markers]');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .75, box.y + box.height * .6, { steps: 10 });
  await page.mouse.up();
  await expect.poll(names).not.toEqual(before);
  await expect(page.getByRole("button", { name: rimId!, exact: true })).not.toHaveAttribute("transform", rimPosition!);
  await expect(hidden.first()).toBeVisible();
  await expect(hidden.first()).toHaveAttribute("tabindex", "0");
  await expect(visible.first()).toBeVisible();
});

for (const width of [390, 1280]) test(`ATLAS captures a painted globe before loading data at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
      const transition = start(update);
      void transition.ready.then(() => {
        document.documentElement.dataset.capturedGlobe = document.querySelector<HTMLCanvasElement>('.atlas-globe-frame canvas')?.dataset.markers ?? "unpainted";
      });
      return transition;
    }) as typeof document.startViewTransition;
  });
  let release!: () => void;
  const download = new Promise<void>(resolve => { release = resolve; });
  let requestedDuringTransition: boolean | undefined;
  await page.route("**/current.json", async route => {
    requestedDuringTransition = await page.locator("html").getAttribute("data-atlas-transition") !== null;
    if (width === 1280) await download;
    await route.fallback();
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Explore ATLAS from the globe" }).click();
  try {
    await expect(page.locator("html")).toHaveAttribute("data-captured-globe", "9");
    await expect(page.locator("html")).not.toHaveAttribute("data-atlas-transition");
    if (width === 1280) await expect(page.getByRole("status")).toContainText("Loading reports");
  } finally { release(); }
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  expect(requestedDuringTransition).toBe(false);
});

test("ATLAS returns to Home through a shrinking globe transition", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/atlas/");
    await select(page, "Reporting topic", "Crimean-Congo haemorrhagic fever · Spain");
    await expect(page.locator('canvas[data-markers]')).toHaveAttribute("data-tilt", "0.70162");
    const wide = (await page.locator('.atlas-globe-frame').boundingBox())!.width;
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute("data-atlas-transition", "active");
    const globe = page.locator('.globe-interaction > .globe-frame');
    await expect(globe).toHaveCSS("view-transition-name", "atlas-globe");
    expect((await globe.boundingBox())!.width).toBeLessThan(wide);
    await expect(globe.locator('canvas[data-markers]')).toHaveAttribute("data-tilt", "0.70162");
    await expect(page.locator('html')).not.toHaveAttribute("data-atlas-transition");
    await expect(globe).toHaveCSS("view-transition-name", "none");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).not.toHaveAttribute("data-atlas-transition");
});

test("Event and link info use connected callouts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await select(page, "Reporting topic", "Bundibugyo imported case · France");
  const pin = page.locator('.atlas-globe-pin[data-selected="true"]');
  const connector = page.locator('.atlas-callout-connector');
  async function verifyCardEndpoint() {
    await expect(connector.locator('path')).toHaveAttribute("d", /^M[\d.,-]+ [HV][\d.-]+ [HV][\d.-]+ [HV][\d.-]+$/);
    await expect.poll(async () => page.evaluate(() => {
      const path = document.querySelector('.atlas-callout-connector path') as SVGPathElement;
      const card = document.querySelector('.atlas-callout-card')!.getBoundingClientRect();
      const point = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
      const midpoints = [[card.left, (card.top + card.bottom) / 2], [card.right, (card.top + card.bottom) / 2], [(card.left + card.right) / 2, card.top], [(card.left + card.right) / 2, card.bottom]];
      return Math.min(...midpoints.map(([x, y]) => Math.hypot(point.x - x, point.y - y)));
    })).toBeLessThan(1);
  }
  async function verifyAttachment() {
    await expect.poll(async () => page.evaluate(() => {
      const pin = document.querySelector('.atlas-globe-pin[data-selected="true"]') as SVGGElement;
      const dot = document.querySelector('.atlas-callout-connector circle') as SVGCircleElement;
      const p = new DOMPoint(0, 0).matrixTransform(pin.getScreenCTM()!);
      const q = new DOMPoint(dot.cx.baseVal.value, dot.cy.baseVal.value).matrixTransform(dot.getScreenCTM()!);
      return Math.hypot(p.x - q.x, p.y - q.y);
    })).toBeLessThan(1);
    await verifyCardEndpoint();
  }
  await expect(connector).toBeVisible();
  await verifyAttachment();
  await pin.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await verifyAttachment();
  await page.mouse.move(5, 5);
  await expect(page.getByRole("region", {name: "Selected map item"})).toBeVisible();
  await expect(page.locator('.atlas-callout-card')).toHaveCount(1);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await verifyAttachment();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('.atlas-link-target').first().focus();
  await expect(page.getByRole("tooltip")).toContainText("Reported travel");
  await verifyCardEndpoint();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", {name: "Selected map item"})).toContainText("Reported travel");
  await expect(connector).toBeVisible();
  await verifyCardEndpoint();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});

test("Closing globe selections restores the overview orientation", async ({ page }) => {
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/atlas/");
    const canvas = page.locator('canvas[data-markers]');
    await expect(canvas).toBeVisible();
    const before = {
      angle: Number(await canvas.getAttribute("data-angle")),
      tilt: await canvas.getAttribute("data-tilt"),
    };
    await page.locator('summary[aria-label="Reporting topic"]').click();
    const firstTopic = page.getByRole('checkbox', { name: 'Bundibugyo imported case · France', exact: true });
    await firstTopic.evaluate(input => input.addEventListener('click', () => {
      const globe = document.querySelector('canvas[data-markers]')!;
      globe.setAttribute('data-selection-angle', globe.getAttribute('data-angle')!);
    }, { once: true, capture: true }));
    await firstTopic.check();
    before.angle = Number(await canvas.getAttribute('data-selection-angle'));
    await firstTopic.press('Escape');
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", "0.81158");
    await select(page, "Reporting topic", "Crimean-Congo haemorrhagic fever · Spain");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", "0.70162");
    await page.getByRole("button", { name: "Clear globe selection", exact: true }).click();
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", before.tilt!);
    const restored = Number(await canvas.getAttribute("data-angle"));
    expect(Math.abs(Math.atan2(Math.sin(restored - before.angle), Math.cos(restored - before.angle)))).toBeLessThan(.15);
    await expect(page.getByRole("region", { name: "Selected map item" })).toHaveCount(0);

    const link = page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true });
    await link.focus(); await page.keyboard.press("Enter");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", "-0.05061");
    await page.getByRole("button", { name: "Reset all", exact: true }).click();
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", before.tilt!);

    await select(page, "Reporting topic", "Bundibugyo imported case · France");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", "0.81158");
    await select(page, "Reporting topic", "All places & topics");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute("data-tilt", before.tilt!);
  }
});

test("View evidence scrolls to matching reports and highlights their support", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: width === 390 ? "reduce" : "no-preference" });
    await page.goto("/atlas/");
    await select(page, "Reporting topic", "Bundibugyo imported case · France");
    await page.getByRole("link", { name: "View evidence", exact: true }).click();
    const highlighted = page.locator('.atlas-report[data-evidence="true"]');
    await expect(page.getByRole("tab", { name: /^Reports/ })).toHaveAttribute("aria-selected", "true");
    await expect(highlighted).toHaveCount(12);
    await expect(page.locator('summary[aria-label="Report page, side"] > span')).toHaveAttribute('title', 'Page 1 of 2 · 12 relevant');
    await expect(highlighted.first().locator('summary').first()).toBeFocused();
    const logo = await highlighted.first().locator('.atlas-source-logo').boundingBox();
    expect(Math.abs(logo!.x + logo!.width / 2 - (await highlighted.first().boundingBox())!.x)).toBeLessThan(2);
    await expect.poll(async () => Math.abs((await highlighted.first().boundingBox())!.y - 96)).toBeLessThan(1);

    await showPageControl(page);
    await page.getByRole("navigation", { includeHidden: true, name: "Report pages, side" }).getByRole("button", { name: "Next report page" }).click();
    await expect(highlighted).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Report chronology" })).toBeFocused();
    await page.getByRole("button", { name: "Reset all", exact: true }).click();
    await page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: /^Geographic links/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("link", { name: "View evidence", exact: true }).click();
    await expect(page.getByRole("tab", { name: /^Reports/ })).toHaveAttribute("aria-selected", "true");
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toHaveAttribute("id", "atlas-report-doc_4b8a9787326794ee4ae84824");
    await expect.poll(async () => {
      const box = (await highlighted.boundingBox())!;
      return box.y >= 95 && box.y + box.height < 1000;
    }).toBe(true);
    await expect(highlighted.locator('summary').first()).toBeFocused();
    await page.getByRole("button", { name: "Reset all", exact: true }).click();
    await expect(highlighted).toHaveCount(0);
  }
});


test("Report pages cover every document and reset with the reporting scope", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  const top = page.getByRole("navigation", { includeHidden: true, name: "Report pages, side" });
  const reports = page.locator(".atlas-report");
  const seen: string[] = [];
  for (let index = 0; index < documentPages; index++) {
    await expect(top).toContainText(`${index + 1} / ${documentPages}`);
    await showPageControl(page);
    await expect(reports).toHaveCount(Math.min(12, documentCount - index * 12));
    seen.push(...await reports.evaluateAll(nodes => nodes.map(n => n.id)));
    if (index < documentPages - 1) await top.getByRole("button", { name: "Next report page" }).click();
  }
  expect(seen.length).toBe(documentCount);
  expect(new Set(seen).size).toBe(documentCount);
  await expect(top.getByRole("button", { name: "Next report page" })).toBeDisabled();
  await expect(page.locator(".atlas-timeline-next")).toBeVisible();
  await expect(page.locator(".atlas-report-tools")).toHaveAttribute("data-timeline", "true");
  await select(page, "Report page, side", `Page 2 of ${documentPages}`);
  await expect(reports.first()).toHaveAttribute("id", seen[12]);
  await expect(page.getByRole("heading", { name: "Report chronology" })).toBeFocused();
  await select(page, "Reporting source", "RIVM");
  await expect(reports).toHaveCount(12);
  await expect(top).toContainText("1 / 2");
  await setWindowDate(page, "start", "2026-09-15");
  await expect(reports).toHaveCount(0);
  await expect(page.locator(".atlas-empty")).toBeVisible();
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(reports).toHaveCount(12);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(top).toContainText(`1 / ${documentPages}`);
  await showPageControl(page);
  await expect(top.getByRole("button", { name: "Previous report page" })).toBeDisabled();
  await select(page, "Report page, side", `Page ${documentPages} of ${documentPages}`);
  await setWindowDate(page, "start", "2026-07-01");
  await expect(top).toContainText("1 /");
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(reports.first()).toHaveAttribute("id", seen[0]);
});

test("Assessment evidence and source coverage land on their report pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await select(page, "Report page, side", `Page ${documentPages} of ${documentPages}`);
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Assessments", exact: true }).click();
  const assessment = page.locator(".atlas-connection").first();
  await assessment.getByText("Evidence & scope", { exact: true }).click();
  await assessment.getByRole("button", { name: "View report", exact: true }).first().click();
  const target = page.locator('.atlas-report[data-evidence="true"]');
  await expect(target).toHaveCount(1);
  await expect(target).toHaveAttribute("id", "atlas-report-doc_7641c48c3fa91de32057ede8");
  await expect(target.locator("summary").first()).toBeFocused();
  await expect.poll(async () => (await target.boundingBox())!.y >= 95 && (await target.boundingBox())!.y < 300).toBe(true);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await page.getByRole("button", { name: "Reports from RIVM", exact: true }).click();
  await expect(target).toHaveCount(12);
  await expect(target.first()).toHaveAttribute("id", "atlas-report-doc_6e527328bfd8ac3062b57f81");
  await expect(target.first().locator("summary").first()).toBeFocused();
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await page.locator(".atlas-source-network").getByRole("button", { name: "Bundibugyo imported case · France", exact: true }).click();
  await expect(target).toHaveCount(4);
  await expect(target.first().locator("summary").first()).toBeFocused();
});

test("Disputed location badges retain neutral symbols", async ({ page }) => {
  await page.goto("/atlas/");
  await select(page, "Reporting topic", "Cholera · Taiwan");
  const badge = page.locator(".atlas-callout-card .atlas-location-badge").filter({ hasText: "TW" });
  await expect(badge).toBeVisible();
  await expect(badge.locator("svg")).toBeVisible();
  await expect(badge.locator("img")).toHaveCount(0);
});

test("Globe cards show location badges and readable details in both themes", async ({ page }) => {
  for (const width of [360, 1280]) for (const theme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await page.goto("/atlas/");
    await select(page, "Reporting topic", "Bundibugyo imported case · France");
    const card = page.locator(".atlas-callout-card");
    await expect(card.locator(".atlas-location-badge")).toHaveCount(1);
    await expect(card.getByRole("img", { name: "France", exact: true })).toBeVisible();
    await expect(card.locator(".atlas-location-flag")).toHaveAttribute("src", "https://flagcdn.com/w40/fr.webp");
    await expect(card).toContainText("13 reports");
    await page.locator('.atlas-globe-pin[data-selected="true"]').hover();
    await expect(page.getByRole("tooltip").getByRole("img", { name: "France", exact: true })).toBeVisible();
    await page.mouse.move(5, 5);
    await page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(card.locator(".atlas-location-badge")).toHaveCount(2);
    await expect(card.locator(".atlas-location-badge").first()).toHaveAttribute("aria-label", "Congo - Kinshasa");
    await expect(card.locator(".atlas-location-badge").last()).toHaveAttribute("aria-label", "France");
    await expect(card).toContainText("1 report");
    await expect(card.locator("time")).toHaveText("26 Jun 2026");
    const bounds = (await card.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).include(".atlas-observatory").analyze();
    expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
  }
});

for (const theme of ['light', 'dark']) test(`Source coverage paints images inside their labels in ${theme} mode`, async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
  await page.goto('/atlas/');
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  const graph = page.locator('.atlas-source-network');
  const { default: sharp } = await import('sharp');
  const images = [graph.locator('.atlas-location-flag').nth(0), graph.locator('.atlas-location-flag').nth(1), graph.locator('.institution-logo img').first()];
  for (const image of images) {
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await image.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(graph).toHaveAttribute('data-highlighted', 'false');
    await expect(image).toHaveCSS('filter', 'none');
    const { data, info } = await sharp(await image.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let colored = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const rgb = [data[i], data[i + 1], data[i + 2]];
      if (Math.max(...rgb) > 110 && Math.max(...rgb) - Math.min(...rgb) > 70) colored++;
    }
    expect(colored / (info.width * info.height)).toBeGreaterThan(.05);
  }
  await graph.locator('.atlas-coverage-topic').nth(4).focus();
  const logo = graph.locator('.atlas-coverage-source[data-active="true"] .institution-logo img').first();
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toHaveCSS('filter', 'none');
  await page.screenshot({ path: `/tmp/atlas-source-labels-${browserName}-${theme}.png` });
});

test("Source coverage highlights connected logos, locations and paths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  const graph = page.locator(".atlas-source-network");
  const edge = graph.locator(".atlas-coverage-edge").filter({ hasText: "RIVM" });
  await expect(graph.locator(".atlas-coverage-source .institution-logo img")).toHaveCount(bundle.channels.length);
  await expect(graph.locator(".atlas-coverage-topic .atlas-location-badge").first()).toBeVisible();
  await edge.scrollIntoViewIfNeeded();
  await page.mouse.move(5, 5);
  await edge.focus();
  await expect(graph.locator('.atlas-coverage-edge[data-active="true"]')).toHaveCount(1);
  await expect(graph.locator('.atlas-coverage-node[data-active="true"]')).toHaveCount(2);
  await expect(graph.locator('.atlas-coverage-beam')).toHaveCount(0);
  await expect(page.locator('.atlas-network-caption')).toHaveCount(0);
  await expect.poll(() => graph.locator('.atlas-coverage-node[data-active="false"]').first().evaluate(el => Number(getComputedStyle(el).opacity))).toBe(.2);
  const hoveredEdge = graph.locator('.atlas-coverage-edge').filter({ hasText: 'ECDC · Malaria' });
  await graph.getByRole("button", { name: "Malaria · Frankfurt", exact: true }).scrollIntoViewIfNeeded();
  const point = await hoveredEdge.locator('.atlas-coverage-hit').evaluate(el => {
    const path = el as SVGPathElement;
    const p = path.getPointAtLength(path.getTotalLength() * .95).matrixTransform(path.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(point.x, point.y);
  await expect(hoveredEdge).toHaveAttribute('data-active', 'true');
  await expect(graph.locator('.atlas-coverage-edge[data-active="true"]')).toHaveCount(1);
  await expect(graph.locator('.atlas-coverage-node[data-active="true"]')).toHaveCount(2);
  const source = graph.getByRole("button", { name: "Reports from ECDC_CDTR", exact: true });
  await source.hover();
  expect(await graph.locator('.atlas-coverage-edge[data-active="true"]').count()).toBeGreaterThan(5);
  await expect(graph.locator('.atlas-coverage-source[data-active="true"]')).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(graph.locator('.atlas-coverage-edge[data-active="true"]')).toHaveCount(1);
  await edge.press("Enter");
  await expect(page.getByRole("tab", { name: /^Reports/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(1);
  await expect(page.locator('.atlas-report > summary')).toBeFocused();

  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await graph.getByRole("button", { name: "Chikungunya · France", exact: true }).focus();
  expect(await graph.locator('.atlas-coverage-edge[data-active="true"]').count()).toBeGreaterThan(0);
  await expect(graph.locator('.atlas-coverage-topic[data-active="true"]')).toHaveCount(1);
  await expect(graph.locator('.atlas-coverage-beam')).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('.atlas-network-scroll').analyze();
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

test("ATLAS keeps compact surface markers and pauses globe rendering during inspection", async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { draws: 0, shaders: 0 };
    Object.defineProperty(window, 'globeRenderStats', { value: stats });
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const draw = prototype.drawArrays, shader = prototype.createShader;
      prototype.drawArrays = function (...args) { stats.draws++; return draw.apply(this, args); };
      prototype.createShader = function (...args) { stats.shaders++; return shader.apply(this, args); };
    }
  });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.goto('/atlas/');
  const globe = page.locator('.atlas-globe-frame');
  await expect(globe.locator('canvas')).toHaveCount(1);
  const marker = globe.locator('.atlas-globe-pin[data-occluded="false"]').first();
  await expect(marker.locator('.atlas-event-marker')).toHaveAttribute('transform', /rotate\(.*\) scale\(.*,1\)/);
  await expect(marker.locator('.atlas-event-ring')).toHaveAttribute('r', '7');
  await expect(marker.locator('.atlas-event-pulse')).toHaveCSS('animation-name', 'atlas-event-ripple');
  await expect(globe.locator('.atlas-route[data-kind="movement"]')).toHaveCount(routeGroups.filter(group => group.entries.at(-1)!.link.type === 'movement').length);
  await expect(globe.locator('.atlas-route[data-kind="shared_event"] .atlas-route-line').first()).toHaveCSS('stroke-dasharray', '10px, 5px');
  await expect(globe.locator('.atlas-route[data-kind="hypothesis"] .atlas-route-line').first()).toHaveCSS('stroke-dasharray', '1px, 5px');
  const markerBox = (await marker.boundingBox())!;
  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await expect(page.getByRole('tooltip')).toBeVisible();
  const stats = () => page.evaluate(() => ({ ...(window as unknown as { globeRenderStats: { draws: number; shaders: number } }).globeRenderStats }));
  const inspected = await stats();
  await page.waitForTimeout(250);
  expect(await stats()).toEqual(inspected);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(globe.locator('.atlas-globe-pins')).toHaveAttribute('data-playing', 'false');
  await expect(marker.locator('.atlas-event-pulse')).toHaveCSS('animation-name', 'none');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  expect(await stats()).toEqual(inspected);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await stats()).draws).toBeGreaterThan(inspected.draws);
  expect((await stats()).shaders).toBe(inspected.shaders);
  await page.locator('.main-column > footer').scrollIntoViewIfNeeded();
  await expect(globe.locator('.atlas-globe-pins')).toHaveAttribute('data-playing', 'false');
  await expect(marker.locator('.atlas-event-pulse')).toHaveCSS('animation-name', 'none');
  const offscreen = await stats();
  await page.waitForTimeout(250);
  expect(await stats()).toEqual(offscreen);
});

test("ATLAS assertion branches show section evidence and respect partial windows", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto('/atlas/');
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await select(page, 'Reporting topic', 'Lassa fever · Nigeria');
  const report = page.locator('#atlas-report-doc_380dc945a639019612fbbdd0');
  await report.locator('summary').first().click();
  await expect(report.locator('.atlas-comparison')).toHaveCount(2);
  await expect(report.locator('.atlas-comparison[data-kind="contradiction"] .atlas-assertion > strong')).toHaveText(['increase', '17 in week 31; 4 in week 32']);
  await expect(report.locator('.atlas-comparison[data-kind="different_scope"] .atlas-assertion > strong')).toHaveText(['4Confirmed cases', '1,021Confirmed cases']);
  await report.locator('.atlas-assertion-evidence').first().locator('summary').click();
  await expect(report.locator('.atlas-assertion-evidence').first().locator('blockquote')).toBeVisible();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByLabel('Reset all', { exact: true }).click();
  await select(page, 'Reporting topic', 'Cholera · Central African Republic');
  const repeated = page.locator('.atlas-comparison[data-kind="republication"]').first();
  await page.locator('.atlas-report > summary').filter({ hasText: 'Repeated reporting' }).first().click();
  await expect(repeated).toBeVisible();
  await repeated.locator('.atlas-assertion-report').last().click();
  await expect(page.locator('.atlas-report[data-evidence="true"][open]')).toBeVisible();
  await setWindowDate(page, "start", "2026-08-24");
  await expect(page.locator('.atlas-comparison[data-kind="republication"]')).toHaveCount(0);
});


test("Six-month findings paginate in coverage and unlocated topics stay off the globe", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  const topics = page.locator(".atlas-coverage-topic");
  await expect(topics).toHaveCount(24);
  const first = await topics.first().getAttribute("aria-label");
  await showPageControl(page);
  await page.getByRole("navigation", { includeHidden: true, name: "Topic pages, side", exact: true }).getByRole("button", { name: "Next topic page", exact: true }).click();
  await expect(topics).toHaveCount(24);
  await expect(topics.first()).not.toHaveAttribute("aria-label", first!);
  const unlocated = bundle.topics.find(t => !t.place_ids.length && t.id.startsWith("report-item:") && bundle.topics.filter(other => other.label === t.label).length === 1)!;
  await select(page, "Reporting topic", unlocated.label);
  await expect(topics).toHaveCount(1);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await expect(page.locator(".atlas-report").first()).toBeVisible();
  await expect(page.locator('.atlas-globe-pin[data-selected="true"]')).toHaveCount(0);
  await expect(page.locator('.atlas-callout-card')).toHaveCount(0);
  await expect(page.locator('canvas[data-markers]')).not.toHaveAttribute("data-tilt", /NaN/);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await expect(topics).toHaveCount(1);
  await expect(page.getByRole("navigation", { includeHidden: true, name: /^Topic pages/ })).toHaveCount(0);
  await page.getByRole("button", { name: "About ATLAS", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download dataset", exact: true })).toHaveAttribute("href", /\/releases\/[a-f0-9]{64}\/atlas-site\.json$/);
});

test("Home-style travel beams animate while hovering and stop for reduced motion", async ({ page }) => {
  await page.goto("/atlas/");
  const legendBeam = page.locator(".atlas-legend-arrow");
  await expect(page.locator('.atlas-link-legend [data-kind="movement"] linearGradient')).toHaveAttribute("gradientUnits", "userSpaceOnUse");
  expect(await legendBeam.evaluate(el => el instanceof HTMLElement)).toBe(true);
  await expect(legendBeam).toHaveCSS("will-change", "transform, opacity");
  const legendPosition = await legendBeam.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => legendBeam.evaluate(el => getComputedStyle(el).transform)).not.toBe(legendPosition);
  const link = page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('.atlas-route[data-active="true"] .atlas-travel-beam path')).toHaveCount(3);
  await expect(page.locator('.atlas-route[data-active="true"] .atlas-route-arrow')).toHaveCount(0);
  await link.focus();
  const arrow = page.locator('.atlas-route[data-active="true"] .atlas-travel-beam path').last();
  const gradient = page.locator('.atlas-route[data-active="true"] linearGradient');
  await expect(gradient).toHaveAttribute("gradientUnits", "userSpaceOnUse");
  await expect(gradient.locator("stop").first()).toHaveAttribute("stop-opacity", "0");
  await expect(gradient.locator("stop").last()).toHaveAttribute("stop-opacity", "0");
  await expect(gradient.locator("stop").nth(2)).toHaveAttribute("offset", "12%");
  expect(await page.locator(".atlas-globe-pins").evaluate(svg => {
    const lastNode = [...svg.querySelectorAll(".atlas-globe-pin")].at(-1)!;
    return [...svg.querySelectorAll(".atlas-route")].every(route => Boolean(lastNode.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);

  await expect(arrow).not.toHaveAttribute("d", "");
  const before = await arrow.getAttribute("d");
  await expect.poll(() => arrow.getAttribute("d")).not.toBe(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(legendBeam).toHaveCSS("animation-name", "none");
  await page.waitForTimeout(700);
  const still = await arrow.getAttribute("d");
  await page.waitForTimeout(150);
  await expect(arrow).toHaveAttribute("d", still!);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("DRC compact figures show repeated totals once with their reporting sources", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await select(page, "Reporting topic", "Bundibugyo reporting · DRC");
  await page.locator('.atlas-globe-pin[data-selected="true"]').hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  const card = page.locator(".atlas-callout-card");
  await expect(card.locator(".atlas-measure > strong")).toHaveText(["7,890", "3,799"]);
  const cases = card.locator(".atlas-measure").filter({ has: page.locator(".atlas-measure-label", { hasText: "Confirmed cases" }) });
  await expect(cases.locator(".atlas-measure-sources")).toContainText("ECDC");
  await expect(cases.locator(".atlas-measure-sources")).toContainText("WHO");
  await select(page, "Reporting source", "WHO · DON");
  await page.locator('.atlas-globe-pin[aria-label*="Bundibugyo reporting · DRC"]').hover();
  await expect(card.locator(".atlas-measure > strong")).toHaveText(["7,890", "3,799"]);
  await expect(card.locator(".atlas-measure-sources").first()).not.toContainText("ECDC");
});


for (const width of [390, 1280]) test(`ATLAS shows streamed download progress at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(dark => {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (!String(input).endsWith('/atlas-site.json')) return response;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const split = Math.floor(bytes.length / 4);
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(bytes.slice(0, split));
        window.addEventListener('atlas-test-resume', () => { controller.enqueue(bytes.slice(split)); controller.close(); }, { once: true });
      } }), { headers: response.headers });
    };
  }, width === 1280);
  await page.goto('/atlas/');
  const bar = page.getByRole('progressbar', { name: 'Reports download' });
  await expect.poll(() => bar.evaluate((element: HTMLProgressElement) => element.position)).toBeGreaterThan(0.2);
  expect(await bar.evaluate((element: HTMLProgressElement) => element.position)).toBeLessThan(1);
  await expect(page.getByRole('status')).toContainText('Downloading reports and map');
  expect(await bar.getAttribute('max')).toBe(String(fixture.release.assets['atlas-site.json'].bytes + fixture.release.assets['map.json'].bytes));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(bar).toBeInViewport();
  await page.screenshot({ path: `/tmp/atlas-download-progress-${width}.png` });
  await page.evaluate(() => window.dispatchEvent(new Event('atlas-test-resume')));
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  await expect(bar).toHaveCount(0);
});

test("ATLAS download errors leave a retry that loads verified reports", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  let unavailable = true;
  await page.route("**/current.json", route => unavailable ? route.fulfill({ status: 503, body: "Unavailable" }) : route.fallback());
  await page.goto("/atlas/");
  await expect(page.locator(".atlas-page").getByRole("alert")).toContainText("Reports could not be loaded.");
  await expect(page.locator(".atlas-report")).toHaveCount(0);
  await expect.poll(() => page.locator("#contact").evaluate(element => element.getBoundingClientRect().top >= innerHeight)).toBe(true);
  unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".atlas-trend-activity header > strong")).toContainText(String(documentCount));
  await expect(page.locator(".atlas-page").getByRole("alert")).toHaveCount(0);
});

for (const width of [390, 1280]) test(`Expanded evidence headings stay reachable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 1280 ? "dark" : "light" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await expect(page.locator(".atlas-page")).toHaveAttribute("data-ready", "true");
  const report = page.locator(".atlas-report").first();
  await report.locator(":scope > summary").click();
  const quote = report.locator(".atlas-claim details").first();
  await expect(report.locator(".atlas-metric-context")).toHaveCount(1);
  await expect(report.locator(".atlas-metric-context")).toContainText("23 September 2026");
  await expect(report.locator(".atlas-measure > small")).toHaveCount(0);
  await expect(report.locator(".atlas-claim > p").first()).toHaveCSS("font-size", "16px");
  await quote.locator("summary").click();
  await expect(quote).toHaveAttribute("open", "");
  await report.evaluate(entry => window.scrollTo({ top: scrollY + entry.getBoundingClientRect().top + 180, behavior: "instant" }));
  await expect.poll(async () => Math.round((await report.locator(":scope > summary").boundingBox())!.y)).toBe(0);
  await report.locator(":scope > summary").click();
  await expect(report).not.toHaveAttribute("open", "");
  await expect.poll(async () => (await report.locator(":scope > summary").boundingBox())!.y).toBeGreaterThanOrEqual(-1);
  for (const name of ["Geographic links", "Assessments"]) {
    await page.getByRole("tab", { name: name === "Assessments" ? "Reports" : name, exact: true }).click();
    if (name === "Assessments") await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Assessments", exact: true }).click();
    const entry = page.locator(".atlas-connection").first();
    const disclosure = entry.locator("details").first();
    await disclosure.locator(":scope > summary").click();
    await expect(disclosure).toHaveAttribute("open", "");
    const heading = entry.locator(":scope > .atlas-entry-heading");
    await entry.evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top + 160, behavior: "instant" }));
    await expect.poll(async () => Math.round((await heading.boundingBox())!.y)).toBe(0);
    await heading.getByRole("button", { name: /Collapse details/ }).click();
    await expect(entry.locator("details[open]")).toHaveCount(0);
    await expect(heading).toBeFocused();
    await expect.poll(async () => (await heading.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) test(`Trends filter observations and navigate to evidence at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "light" : "dark" });
  await page.goto("/atlas/");
  await expect(page.getByRole("tab").first()).toHaveAccessibleName("Trends");
  await expect(page.getByRole("tab", { name: "Trends", exact: true })).toHaveAttribute("aria-selected", "true");
  const trends = page.locator(".atlas-trends");
  await expect(trends.getByRole("heading", { name: "Reporting activity" })).toBeVisible();
  const bars = await trends.locator(".atlas-activity-bars").boundingBox();
  const coverageChart = await trends.locator('.atlas-trend-coverage svg[role="img"]').boundingBox();
  expect(Math.abs(bars!.height - coverageChart!.height)).toBeLessThan(1);
  const counts = await trends.locator(".atlas-activity-track b").allTextContents();
  expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(documentCount);
  await expect(trends.locator('.atlas-trend-coverage svg[role="img"]')).toHaveAttribute("aria-label", /19 of 785 records/);
  await select(page, "Reporting topic", "Lassa fever · Nigeria");
  await select(page, "Observation series", "Lassa fever · Nigeria · Confirmed cases · interval");
  await expect(trends.locator(".atlas-observation-grid circle")).toHaveCount(4);
  await expect(trends.locator(".atlas-observation-grid svg polyline")).toHaveCount(0);
  await expect(trends.locator(".atlas-observation-source strong")).toHaveText(["31", "14", "4", "12"]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await trends.locator(".atlas-observation-source").last().click();
  await expect(page.getByRole("tab", { name: "Reports", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(1);
  await page.getByRole("tab", { name: "Trends", exact: true }).click();
  await setWindowDate(page, "end", "2026-07-01");
  await expect(trends).toContainText("No observations across multiple dates");
  await expect(trends.locator(".atlas-observation-grid")).toHaveCount(0);
});

for (const width of [360, 1280]) test(`Reporting dates follow handles without overlap at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  const labels = page.locator(".atlas-range-dates time");
  const presetsControl = page.getByRole("group", { name: "Reporting window presets" });
  await expect(presetsControl.locator('[aria-pressed="true"]')).toHaveAccessibleName("All dates");
  for (const name of ["3 months", "6 months", "1 year", "All dates"]) {
    await presetsControl.getByRole("button", { name, exact: true }).click();
    await expect(presetsControl.locator('[aria-pressed="true"]')).toHaveAccessibleName(name);
  }
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  await expect(labels).toHaveText(["26 Mar 2026", "25 Sept 2026"]);
  const heading = await page.locator(".atlas-time-heading strong").boundingBox();
  const presets = await page.getByRole("group", { name: "Reporting window presets" }).boundingBox();
  expect(Math.abs(heading!.y + heading!.height / 2 - presets!.y - presets!.height / 2)).toBeLessThan(2);
  for (const date of ["2026-09-25", "2026-06-25", "2026-03-26"]) {
    await setWindowDate(page, "start", date);
    await setWindowDate(page, "end", date);
    await expect(labels.first()).toHaveAttribute("datetime", date);
    await expect(labels.last()).toHaveAttribute("datetime", date);
    const a = await labels.first().boundingBox(), b = await labels.last().boundingBox();
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
    expect(a!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(width);
  }
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await page.getByRole("slider", { name: "Window start" }).press("ArrowRight");
  await expect(labels.first()).toHaveText("27 Mar 2026");
  await expect(presetsControl.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) test(`Route history retains evidence and the globe renderer at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "light" : "dark" });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function(type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) document.documentElement.dataset.globeContexts = String(Number(document.documentElement.dataset.globeContexts || 0) + 1);
      return Reflect.apply(original, this, [type, ...args]);
    } });
  });
  await page.goto("/atlas/");
  const group = routeGroups.find(g => g.entries.length > 2 && g.entries[0].date !== g.entries.at(-1)!.date)!;
  const latest = group.entries.at(-1)!;
  await expect(page.locator(".atlas-link-target")).toHaveCount(routeGroups.length);
  const link = page.locator(".atlas-link-target");
  await link.and(page.getByRole("button", { name: latest.link.label, exact: true })).first().focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("region", { name: "Selected map item" });
  const history = card.getByRole("slider", { name: "Link history", exact: true });
  await expect(history).toHaveValue(String(group.entries.length - 1));
  const contexts = await page.locator("html").getAttribute("data-globe-contexts");
  await history.focus();
  await history.press("Home");
  await expect(history).toHaveValue("0");
  await expect(history).toBeFocused();
  await expect(card.locator(".atlas-callout-title")).toHaveText(group.entries[0].link.label);
  await expect(card.locator(".atlas-link-history time")).toHaveAttribute("datetime", group.entries[0].date);
  if (width === 1280) await expect(page.locator("html")).toHaveAttribute("data-globe-contexts", contexts!);
  await card.getByRole("link", { name: "View evidence" }).click();
  await expect(page.locator('.atlas-report[data-evidence="true"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(page.locator(".atlas-link-target")).toHaveCount(routeGroups.length);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) test(`Links and assessments paginate and reset at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  for (const [tab, entity, attribute, ids] of [
    ["Geographic links", "Geographic link", "data-link-id", routeGroups.map(g => g.entries.at(-1)!.link.id)],
    ["Assessments", "Assessment", "data-assessment-id", snapshot.relationships.map(a => a.id)],
  ] as const) {
    await page.getByRole("tab", { name: tab === "Assessments" ? "Reports" : new RegExp(`^${tab}`), exact: true }).click();
    if (tab === "Assessments") await page.getByRole("group", {name:"Report content"}).getByRole("button", {name:"Assessments",exact:true}).click();
    const entries = page.locator(".atlas-connection");
    const pages = Math.ceil(ids.length / 12);
    const shown = () => entries.evaluateAll((items, attr) => items.map(item => item.getAttribute(attr)), attribute);
    expect(await shown()).toEqual(ids.slice(0, 12));
    await showPageControl(page);
    await page.getByRole("navigation", { includeHidden: true, name: `${entity} pages, side` }).getByRole("button", { name: `Next ${entity.toLowerCase()} page` }).click();
    await expect.poll(shown).toEqual(ids.slice(12, 24));
    await expect(page.locator(tab === "Assessments" ? "#atlas-assessments-heading" : "#atlas-links-heading")).toBeFocused();
    await select(page, `${entity} page, side`, `Page ${pages} of ${pages}`);
    await expect.poll(shown).toEqual(ids.slice((pages - 1) * 12));
    await expect(page.getByRole("navigation", { includeHidden: true, name: `${entity} pages, side` }).getByRole("button", { name: `Next ${entity.toLowerCase()} page` })).toBeDisabled();
    await page.getByRole("button", { name: "3 months", exact: true }).click();
    await expect(page.getByRole("navigation", { includeHidden: true, name: `${entity} pages, side` })).toContainText("1 /");
    await page.getByRole("button", { name: "All dates", exact: true }).click();
    await expect.poll(shown).toEqual(ids.slice(0, 12));
  }
  const last = routeGroups.at(-1)!.entries.at(-1)!.link;
  await page.locator(".atlas-link-target").and(page.getByRole("button", { name: last.label, exact: true })).last().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`.atlas-connection[data-link-id="${last.id}"]`)).toHaveAttribute("data-selected", "true");
  const pages = Math.ceil(routeGroups.length / 12);
  await expect(page.getByRole("navigation", { includeHidden: true, name: "Geographic link pages, side" })).toContainText(`${pages} / ${pages}`);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) test(`Unified filters show and clear every active scope at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" });
  await page.goto("/atlas/");
  const openRules = async () => { if (await page.locator(".atlas-rules").getAttribute("open") === null) await page.locator(".atlas-rules > summary").click(); };
  const panel = page.getByRole("region", { name: "Filters and selections" });
  const reset = panel.getByRole("button", { name: "Reset all", exact: true });
  await expect(reset).toBeDisabled();
  await page.locator('summary[aria-label="Reporting topic"]').click();
  const search = page.getByRole("searchbox", { name: "Search reporting topic" });
  await search.fill("Bundibugyo imported case");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await search.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Trends", exact: true })).toHaveAttribute("aria-selected", "true");
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove topic filter" })).toContainText("Bundibugyo imported case · France");
  await expect(reset).toHaveAttribute("data-active", "true");
  await expect(page.locator(".atlas-link-target")).toHaveCount(1);
  await select(page, "Link type", "Source hypothesis");
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove route type filter" })).toContainText("Source hypothesis");
  await expect(page.locator(".atlas-link-target")).toHaveCount(0);
  await panel.getByRole("button", { name: "Remove route type filter" }).click();
  await expect(page.locator(".atlas-link-target")).toHaveCount(1);
  await page.getByRole("button", { name: "3 months", exact: true }).click();
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove dates filter" })).toBeVisible();
  await page.getByRole("button", { name: "Clear globe selection", exact: true }).click();
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove topic filter" })).toHaveCount(0);
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove dates filter" })).toBeVisible();
  await reset.click();
  await expect(reset).toBeDisabled();
  await expect(page.getByRole("button", { name: "All dates", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("slider", { name: "Replay publication date" })).toHaveCount(0);
  await expect(page.locator(".atlas-link-target")).toHaveCount(routeGroups.length);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("group", { name: "Report content" }).getByRole("button", { name: "Source coverage", exact: true }).click();
  await page.getByRole("button", { name: "Reports from RIVM", exact: true }).click();
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove source filter" })).toContainText("RIVM");
  await openRules();
  await expect(panel.getByRole("button", { name: "Clear evidence highlights" })).toBeVisible();
  await panel.getByRole("button", { name: "Clear evidence highlights" }).click();
  await expect(page.locator('.atlas-report[data-evidence="true"]')).toHaveCount(0);
  await openRules();
  await expect(panel.getByRole("button", { name: "Remove source filter" })).toBeVisible();
  await reset.click();
  await page.locator('summary[aria-label="Reporting topic"]').click();
  await search.fill("not-a-real-topic");
  await expect(page.getByText("No matches", { exact: true })).toBeVisible();
  await search.press("Escape");
  await page.locator('summary[aria-label="Reporting topic"]').click();
  await expect(search).toHaveValue("");
  await search.press("Escape");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});



for (const width of [390, 1280]) test(`Checkbox filters combine topics, sources and route types at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" });
  await page.goto("/atlas/");
  const labels = ["Bundibugyo reporting · DRC", "Bundibugyo imported case · France"];
  const topics = snapshot.tracks.filter(t => labels.includes(t.label)).map(t => t.id);
  const sources = ["ECDC_CDTR", "WHO_DON"];
  for (const [label, choices] of [["Reporting topic", labels], ["Reporting source", ["ECDC", "WHO · DON"]], ["Link type", ["Reported travel", "Shared event"]]] as const) {
    const menu = page.locator(".atlas-select").filter({ has: page.locator(`summary[aria-label="${label}"]`) });
    await menu.locator("summary").click();
    for (const choice of choices) {
      await menu.getByRole("checkbox", { name: choice, exact: true }).check();
      await expect(menu).toHaveAttribute("open", "");
      await expect(menu.getByRole("checkbox", { name: choice, exact: true })).toBeChecked();
    }
    await expect(menu.locator("summary")).toContainText("2 selected");
    await menu.getByRole("checkbox", { name: choices[1], exact: true }).press("Escape");
  }
  const rows = snapshot.records.filter(r => topics.includes(r.track) && sources.includes(r.source));
  const linkRows = snapshot.map_links.filter(l => ["movement", "shared_event"].includes(l.type) && (topics.includes(l.from.track) || topics.includes(l.to.track)) && l.support.some(([id]) => sources.includes(mapRecords.get(id)!.source)));
  await expect(page.getByRole("tab", { name: "Reports", exact: true }).locator("b")).toHaveText(String(new Set(rows.map(r => r.document_id)).size));
  await expect(page.locator(".atlas-link-target")).toHaveCount(groupGeographicLinks(linkRows, mapRecords).length);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  const expectedDocuments = [...new Set(rows.map(r => r.document_id))].sort((a, b) => bundle.documents.find(d => d.id === b)!.publication.localeCompare(bundle.documents.find(d => d.id === a)!.publication) || a.localeCompare(b));
  await expect(page.locator(".atlas-report")).toHaveCount(Math.min(12, expectedDocuments.length));
  expect(await page.locator(".atlas-report").evaluateAll(items => items.map(item => item.id))).toEqual(expectedDocuments.slice(0, 12).map(id => `atlas-report-${id}`));
  await page.locator('summary[aria-label="Reporting source"]').click();
  await page.getByRole("checkbox", { name: "WHO · DON", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "WHO · DON", exact: true }).press("Escape");
  await expect(page.getByRole("tab", { name: "Reports", exact: true }).locator("b")).toHaveText(String(new Set(rows.filter(r => r.source === "ECDC_CDTR").map(r => r.document_id)).size));
  await page.getByRole("button", { name: "Reset all", exact: true }).click();
  await expect(page.locator(".atlas-link-target")).toHaveCount(routeGroups.length);
  await page.locator('summary[aria-label="Reporting source"]').click();
  await expect(page.getByRole("checkbox", { name: "All sources", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "ECDC", exact: true })).not.toBeChecked();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
  await page.getByRole("checkbox", { name: "All sources", exact: true }).press("Escape");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [390, 1280]) test(`Many filter selections stay compact at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" });
  await page.goto("/atlas/");
  const menu = page.locator('.atlas-select').filter({ has: page.locator('summary[aria-label="Reporting topic"]') });
  await menu.locator('summary').click();
  const choices = menu.getByRole('checkbox');
  const names = await choices.evaluateAll(items => items.slice(1, 16).map(item => item.parentElement!.textContent!));
  for (const name of names) await menu.getByRole('checkbox', { name, exact: true }).check();
  await choices.nth(15).press('Escape');
  await page.locator('.atlas-rules > summary').click();
  const chip = page.getByRole('button', { name: 'Remove topic filter', exact: true });
  await expect(chip).toHaveText('Topics · 15 selected');
  for (const name of names) expect(await chip.getAttribute('title')).toContain(name);
  expect((await chip.boundingBox())!.height).toBeLessThanOrEqual(32);
  await menu.locator('summary').click();
  await expect(menu.getByRole('checkbox', { checked: true })).toHaveCount(15);
  await choices.nth(15).press('Escape');
  await page.locator('.atlas-rules > summary').click();
  await chip.click();
  await expect(chip).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});



for (const width of [390, 1280]) test(`Reviewed Trends render only permitted connections at ${width}px`, async ({ page }) => {
  const { createHash } = await import("node:crypto");
  const { reviewedFixture } = await import("./atlas-reviewed-fixture");
  const { reviewedSelectorSha256 } = await import("../src/lib/atlas-contract");
  const candidate = reviewedFixture(bundle);
  const { createResearch } = await import("../src/lib/atlas-comparisons");
  const research = createResearch(candidate);
  const visibleSeries = research.selectedResearch(new Set(candidate.records.map(r => r.id))).reviewed_series;
  const series = visibleSeries[0];
  const bytes = Buffer.from(JSON.stringify(candidate));
  const mapBytes = process.env.ATLAS_REVIEWED_CANDIDATE ? readFileSync(new URL("../snapshot.json", `file://${process.env.ATLAS_REVIEWED_CANDIDATE}`)) : readFileSync(".cache/atlas-fixture/map.json");
  const release = { ...fixture.release, contract_version: "1.1.0", selector_sha256: reviewedSelectorSha256,
    assets: { ...fixture.release.assets, "atlas-site.json": { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length }, "map.json": { sha256: createHash("sha256").update(mapBytes).digest("hex"), bytes: mapBytes.length } } };
  await page.route("**/current.json", route => route.fulfill({ json: release }));
  await page.route("**/atlas-site.json", route => route.fulfill({ contentType: "application/json", body: bytes }));
  await page.route("**/map.json", route => route.fulfill({ contentType: "application/json", body: mapBytes }));
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: width === 390 ? "dark" : "light" });
  await page.goto("/atlas/");
  const plot = page.locator('.atlas-trend-observations figure');
  await expect(plot.locator('.atlas-observation-connection')).toHaveCount(series.connections.length);
  await expect(plot.locator('circle')).toHaveCount(series.members.length);
  for (const reviewed of visibleSeries) {
    await select(page, "Observation series", reviewed.label);
    await expect(plot.locator('.atlas-observation-connection')).toHaveCount(reviewed.connections.length);
    await expect(plot.locator('circle')).toHaveCount(reviewed.members.length);
  }
  await select(page, "Observation series", series.label);
  if (process.env.ATLAS_REVIEWED_CANDIDATE) { await plot.scrollIntoViewIfNeeded(); await page.screenshot({ path: `/tmp/atlas-reviewed-chart-${width}.png` }); }

  await plot.locator('.atlas-observation-connection').first().press('Enter');
  const evidence = plot.getByLabel('Selected observation evidence');
  await expect(evidence.locator(':scope > div')).toHaveCount(2);
  await evidence.getByText('Comparison method & evidence', { exact: true }).click();
  await expect(evidence).toContainText(series.reason);
  await expect(evidence).toContainText('Source-checked draft');
  await expect(evidence).toContainText('Published');
  await expect(page.locator('.atlas-trend-coverage svg[role="img"]')).toHaveAttribute("aria-label", /records have extracted figures/);
  if (process.env.ATLAS_REVIEWED_CANDIDATE) { await plot.scrollIntoViewIfNeeded(); await page.screenshot({ path: `/tmp/atlas-reviewed-trends-${width}.png` }); }
  const hidden = candidate.metrics.reviewed_series[0].members[1].eligibility.record_ids[0];
  const date = candidate.records.find(r => r.id === hidden)!.publication.slice(0, 10);
  await setWindowDate(page, 'start', new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10));
  const remaining = new Set(candidate.records.filter(r => r.publication.slice(0, 10) > date).map(r => r.id));
  const filtered = research.selectedResearch(remaining).reviewed_series.find(s => s.series_id === series.series_id)!;
  await expect(plot.locator('.atlas-observation-connection')).toHaveCount(filtered.connections.length);
  await expect(plot.locator('circle')).toHaveCount(filtered.members.length);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map(v => v.id)).toEqual([]);
});


for (const width of [390, 1280]) test(`Reporting window uses only its two range handles at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("button", { name: "3 months", exact: true }).click();
  const range = page.locator('.atlas-ranges');
  await expect(range.getByRole('slider')).toHaveCount(2);
  await expect(range.getByRole('button')).toHaveCount(0);
  const start = page.getByRole('slider', { name: 'Window start', exact: true });
  const end = page.getByRole('slider', { name: 'Window end', exact: true });
  const before = [await start.inputValue(), await end.inputValue()];
  await range.scrollIntoViewIfNeeded();
  const track = (await page.locator('.atlas-range-track').boundingBox())!;
  await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.click(track.x + track.width / 2, track.y + track.height / 2);
  expect([await start.inputValue(), await end.inputValue()]).toEqual(before);
  await start.press('ArrowRight');
  await expect(start).toHaveValue(String(Number(before[0]) + 1));
  await end.press('ArrowLeft');
  await expect(end).toHaveValue(String(Number(before[1]) - 1));
  await page.getByRole('button', { name: 'All dates', exact: true }).click();
  await expect(page.locator('.atlas-link-target')).toHaveCount(routeGroups.length);
  await page.locator('.atlas-controls').screenshot({ path: `/tmp/atlas-window-controls-${width}.png` });
});

for (const theme of ["light", "dark"] as const) test(`Evidence highlight pulses three times in ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: theme });
  await page.goto("/atlas/");
  const entrance = page.getByRole("button", { name: "Click to enter full screen" });
  await entrance.focus(); await entrance.press("Enter");
  await expect(page.locator('html')).not.toHaveAttribute('data-atlas-workspace-transition');
  await page.getByRole("button", { name: "Reported return travel · Bundibugyo", exact: true }).focus();
  await page.keyboard.press("Enter");
  const evidence = page.getByRole("link", { name: "View evidence", exact: true });
  await evidence.click();
  const report = page.locator('.atlas-report[data-evidence="true"]').first();
  const heading = report.locator(':scope > summary');
  const pulse = () => heading.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.id === "atlas-evidence-pulse").map(a => ({ state: a.playState, iterations: a.effect!.getTiming().iterations, duration: a.effect!.getTiming().duration })));
  await expect.poll(pulse).toEqual([{ state: "running", iterations: 3, duration: 1150 }]);
  await expect(heading).toBeFocused();
  await page.screenshot({ path: `/tmp/atlas-report-highlight-${theme}.png` });
  await expect.poll(pulse, { timeout: 5000 }).toEqual([]);
  await expect(report).toHaveAttribute('data-evidence', 'true');
  await expect(heading).toHaveCSS('background-image', 'none');
  expect(await heading.evaluate(el => {
    const highlight = getComputedStyle(el, '::after');
    return { opacity: highlight.opacity, radius: highlight.borderRadius };
  })).toEqual({ opacity: '0.35', radius: '12px' });
  await evidence.click();
  await expect.poll(pulse).toEqual([{ state: "running", iterations: 3, duration: 1150 }]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(pulse).toEqual([]);
});

for (const width of [390, 1280]) test(`Scope buttons share overlays outside full screen at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await select(page, 'Reporting topic', 'Measles · Guatemala');
  await page.locator('.atlas-report > summary').click();
  const measure = page.locator('.atlas-report .atlas-measure > .atlas-scope-trigger').first();
  const comparison = page.locator('.atlas-comparison > header > .atlas-scope-trigger').first();
  const styles = async (button: typeof measure) => button.evaluate(el => {
    const css = getComputedStyle(el);
    return [css.width, css.height, css.borderRadius, css.color, css.backgroundColor, css.fontSize];
  });
  expect(await styles(comparison)).toEqual(await styles(measure));
  await expect(measure).toHaveCSS('width', '28px');
  await measure.locator('..').screenshot({ path: `/tmp/atlas-regular-scope-tile-${width}.png` });
  for (const button of [measure, comparison]) {
    await button.click();
    const dialog = page.locator('.atlas-scope-dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Close / })).toBeFocused();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: `/tmp/atlas-regular-scope-${button === measure ? 'source' : 'comparison'}-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test('Quotations wrap naturally and France uses its canonical flag', async ({ page }) => {
  const record = snapshot.records.find(r => r.id.endsWith(':france-import'))!;
  const text = record.claims[0].quotes[0];
  expect(text).toContain('\n');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await select(page, 'Reporting topic', 'Bundibugyo imported case · France');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const report = page.locator(`[id="atlas-report-${record.document_id}"]`);
  await report.locator(':scope > summary').click();
  await report.locator('.atlas-claim details > summary').first().click();
  const quote = report.locator('.atlas-claim blockquote').first();
  const flag = quote.locator('img[src$="/fr.webp"]').first();
  await expect(flag).toBeVisible();
  await expect.poll(() => flag.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(quote.locator('img[src$="/fx.webp"]')).toHaveCount(0);
  expect(await quote.textContent()).toContain('\n');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(quote).toHaveCSS('white-space', 'normal');
    expect(await quote.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await quote.screenshot({ path: `/tmp/atlas-quotation-france-${width}.png` });
  }
});

test('EU/EEA report mentions display a loaded EU flag', async ({ page }) => {
  const record = snapshot.records.find(r => r.claims.some(c => c.text.includes('EU/EEA')))!;
  const topic = snapshot.tracks.find(t => t.id === record.track)!;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await select(page, 'Reporting topic', topic.label);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const report = page.locator(`[id="atlas-report-${record.document_id}"]`);
  await report.locator(':scope > summary').click();
  const claim = report.locator('.atlas-claim > p').filter({ hasText: 'EU/EEA' }).first();
  await expect(claim).toBeVisible();
  const flag = claim.locator('img[src$="/eu.webp"]');
  await expect(flag).toHaveCount(1);
  await expect(flag).toBeVisible();
  await expect.poll(() => flag.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await claim.screenshot({ path: '/tmp/atlas-eu-eea-flag.png' });
});

for (const [width, height, workspace] of [[390, 850, false], [1280, 950, false], [1440, 850, true]] as const) test(`Reports switch preserves both views at ${width}px ${workspace ? "workspace" : "page"}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: workspace ? "dark" : "light" });
  await page.goto("/atlas/");
  await expect(page.locator('.atlas-page')).toHaveAttribute('data-ready', 'true');
  if (workspace) {
    await page.getByRole('button', { name: 'Click to enter full screen' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.atlas-page')).toHaveAttribute('data-fullscreen', 'true');
  }
  await expect(page.getByRole('tab', { name: 'Assessments', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const toggle = page.getByRole('group', { name: 'Report content' });
  const reports = toggle.getByRole('button', { name: 'Reports', exact: true });
  const assessments = toggle.getByRole('button', { name: 'Assessments', exact: true });
  const position = workspace ? 'bottom' : 'top';
  const reportPages = page.getByRole('navigation', { name: `Report pages, ${position}` });
  const assessmentPages = page.getByRole('navigation', { name: `Assessment pages, ${position}` });
  await expect(reports).toHaveAttribute('aria-pressed', 'true');
  const dates = page.locator('.atlas-timeline-next');
  const tools = page.locator('.atlas-report-tools');
  await expect(dates).toBeVisible();
  await tools.scrollIntoViewIfNeeded();
  const datesBox = (await dates.boundingBox())!, switchBox = (await toggle.boundingBox())!;
  expect(Math.abs(datesBox.y + datesBox.height / 2 - switchBox.y - switchBox.height / 2)).toBeLessThan(1);
  expect(datesBox.x + datesBox.width).toBeLessThan(switchBox.x);
  const connection = await page.locator('.atlas-report-prelude').evaluate(el => {
    const stem = getComputedStyle(el, '::before');
    const report = el.nextElementSibling!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { x: box.left + parseFloat(stem.left), reportX: report.left, bottom: box.bottom, reportY: report.top };
  });
  expect((await tools.boundingBox())!.y + (await tools.boundingBox())!.height).toBe((await page.locator('.atlas-report-prelude').boundingBox())!.y);
  expect(connection.x).toBe(connection.reportX);
  expect(connection.bottom).toBe(connection.reportY);
  await page.screenshot({ path: `/tmp/atlas-report-dates-${width}.png` });
  if (workspace) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await assessments.click();
    expect(await dates.evaluate(el => el.getAnimations().some(animation => animation instanceof CSSTransition && animation.transitionProperty === 'margin-left'))).toBe(true);
    await expect(dates).toHaveCSS('margin-left', '0px');
    await reports.click();
    await expect(dates).toHaveCSS('margin-left', '48px');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await reportPages.getByRole('button', { name: 'Next report page' }).click();
  await expect(dates).toBeVisible();
  await expect(dates.locator('time')).toHaveText(['26 Sept 2026', '30 Sept 2026']);
  await expect(tools).toHaveAttribute('data-timeline', 'true');
  expect(await page.locator('.atlas-report-prelude').evaluate(el => getComputedStyle(el, '::before').borderLeftWidth)).toBe('1px');
  await assessments.click();
  await expect(dates).toBeVisible();
  await expect(dates.locator('time')).toHaveText(['26 Sept 2026', '30 Sept 2026']);
  await expect(tools).not.toHaveAttribute('data-timeline');
  expect(await tools.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0');
  await expect(dates).toHaveCSS('margin-left', '0px');
  const assessmentTop = (await page.locator('.atlas-connection > .atlas-entry-heading').first().boundingBox())!.y;
  const switchBottom = (await toggle.boundingBox())!.y + (await toggle.boundingBox())!.height;
  expect(assessmentTop - switchBottom).toBeLessThanOrEqual(workspace ? 22 : 70);
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/atlas-assessment-spacing-${width}.png` });
  await assessmentPages.getByRole('button', { name: 'Next assessment page' }).click();
  await assessments.focus();
  await assessments.press('ArrowLeft');
  await expect(reports).toBeFocused();
  await expect(reportPages).toContainText('Page 2 of');
  await reports.press('ArrowRight');
  await expect(assessments).toBeFocused();
  await expect(assessmentPages).toContainText('Page 2 of');
  await page.getByRole('tab', { name: 'Trends', exact: true }).click();
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(assessments).toHaveAttribute('aria-pressed', 'true');
  await expect(assessmentPages).toContainText('Page 2 of');
  await page.getByRole('button', { name: '3 months', exact: true }).click();
  await expect(assessments).toHaveAttribute('aria-pressed', 'true');
  await expect(assessmentPages).toContainText('Page 1 of');
  if (workspace) {
    const switchY = (await toggle.boundingBox())!.y;
    const pagerY = (await assessmentPages.boundingBox())!.y;
    await page.locator('.atlas-workspace-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await toggle.boundingBox())!.y).toBe(switchY);
    expect((await assessmentPages.boundingBox())!.y).toBe(pagerY);
    await expect(page.locator('.atlas-pagination')).toHaveCount(1);
    expect(await page.locator('.atlas-workspace').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  }
  await toggle.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/atlas-reports-switch-${width}.png` });
  expect((await new AxeBuilder({ page }).include('.atlas-workspace').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Report bodies and scope contents render when opened', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await expect(page.locator('.atlas-report')).toHaveCount(12);
  await expect(page.locator('.atlas-report-body')).toHaveCount(0);
  const report = page.locator('.atlas-report').first();
  await report.locator(':scope > summary').click();
  await expect(report.locator('.atlas-report-body')).toBeVisible();
  await expect(page.locator('.atlas-report-body')).toHaveCount(1);
  const scope = report.locator('.atlas-scope-trigger').first();
  await expect(report.locator('.atlas-scope-body > *')).toHaveCount(0);
  await scope.click();
  const dialog = page.getByRole('dialog', { name: /^Scope & source/ });
  await expect(dialog.locator('.atlas-scope-body')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(scope).toBeFocused();
  await expect(report.locator('.atlas-scope-body > *')).toHaveCount(0);
  await scope.click();
  await expect(dialog).toBeVisible();
});

test('Globe and title animations pause while the document is hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/atlas/');
  const pins = page.locator('.atlas-globe-pins');
  const title = page.locator('.atlas-heading .animate-aurora');
  await expect(pins).toHaveAttribute('data-playing', 'true');
  await expect(title).toHaveCSS('animation-play-state', 'running');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(pins).toHaveAttribute('data-playing', 'false');
  await expect(title).toHaveCSS('animation-play-state', 'paused');
  for (const node of await page.locator('.network-node').all()) await expect(node).toHaveCSS('animation-play-state', 'paused');
  const path = page.locator('.atlas-travel-beam > path').first();
  const paused = await path.getAttribute('d');
  await page.waitForTimeout(250);
  await expect(path).toHaveAttribute('d', paused!);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(pins).toHaveAttribute('data-playing', 'true');
  await page.locator('.main-column > footer').scrollIntoViewIfNeeded();
  await expect(title).toHaveCSS('animation-play-state', 'paused');
});

test('Closed selectors release choices and preserve keyboard navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/atlas/');
  const hiddenChoices = page.locator('.atlas-select:not([open]) .atlas-select-options :is([role="option"], input)');
  await expect(hiddenChoices).toHaveCount(0);
  const topic = page.locator('summary[aria-label="Reporting topic"]');
  await topic.focus();
  await topic.press('Enter');
  const search = page.getByRole('searchbox', { name: 'Search reporting topic' });
  await expect(search).toBeFocused();
  await search.fill('Bundibugyo imported case');
  await search.press('ArrowDown');
  await expect(page.getByRole('checkbox').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(topic).toBeFocused();
  await expect(hiddenChoices).toHaveCount(0);
  await topic.press('End');
  await expect(page.getByRole('checkbox').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await topic.press('Enter');
  await expect(search).toHaveValue('');
  await page.locator('.atlas-heading h1').click();
  await expect(hiddenChoices).toHaveCount(0);

  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  const pages = page.locator('summary[aria-label="Report page, side"]');
  await showPageControl(page);
  await pages.focus();
  await pages.press('ArrowDown');
  const second = page.getByRole('option', { name: `Page 2 of ${documentPages}`, exact: true });
  await expect(second).toBeFocused();
  await second.press('Enter');
  await expect(pages).toContainText(`2 / ${documentPages}`);
  await expect(page.locator('#atlas-report-heading')).toBeFocused();
  await expect(hiddenChoices).toHaveCount(0);
  await showPageControl(page);
  await pages.focus();
  await pages.press('Enter');
  await expect(page.getByRole('option', { selected: true })).toBeFocused();
  await page.keyboard.press('Escape');
});


test("Expanded comparisons show one status badge without repeating the report label", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/atlas/");
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  for (const kind of [...new Set(bundle.comparisons.map(comparison => comparison.kind))]) {
    const comparison = bundle.comparisons.find(item => item.kind === kind)!;
    const assertion = bundle.assertions.find(item => item.id === comparison.participant_ids[0])!;
    const record = mapRecords.get(assertion.record_id)!;
    await page.evaluate(() => window.scrollTo(0, 0));
    await select(page, "Reporting topic", snapshot.tracks.find(track => track.id === record.track)!.label);
    const report = page.locator(`#atlas-report-${assertion.document_id}`);
    for (let index = 0; index < documentPages && await report.count() === 0; index++) {
      await showPageControl(page);
      await page.getByRole('button', { name: 'Next report page', exact: true }).click();
    }
    await report.locator(':scope > summary').click();
    const entry = report.locator(`.atlas-comparison[data-kind="${kind}"]`).first();
    await expect(entry).toBeVisible();
    const label = await entry.getAttribute('aria-label');
    await expect(report.locator(':scope > summary .atlas-status').filter({ hasText: label! })).toHaveCount(1);
    await expect(entry.locator('header .atlas-status')).toHaveCount(1);
    await expect(entry.locator('header .atlas-status')).toHaveText(/^(Unresolved|Documented)$/);
    await report.screenshot({ path: `/tmp/atlas-comparison-${kind}.png` });
  }
});
