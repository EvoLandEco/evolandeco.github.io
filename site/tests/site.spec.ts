import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = ["/", "/research", "/publications", "/software", "/blog", "/photography"];
test("Desktop and mobile layouts, themes, navigation and accessibility", async ({
  page,
}) => {
  for (const width of [360, 768, 1440])
    for (const theme of ["light", "dark"])
      for (const route of routes) {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({
          colorScheme: theme as "light" | "dark",
          reducedMotion: "reduce",
        });
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(
          page.getByTestId("primary-navigation").locator(".site-dock").getByRole("link"),
        ).toHaveCount(6);
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(
          axe.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
        await page.screenshot({
          path: `evidence/${route.slice(1) || "home"}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
});
test("Selected publications, thesis and citation files", async ({
  page,
  request,
}) => {
  await page.goto("/publications");
  await expect(
    page.locator('[data-publication-status="peer-reviewed"]'),
  ).toHaveCount(5);
  await expect(
    page.locator('[data-publication-status="preprint"]'),
  ).toHaveCount(2);
  await expect(page.getByLabel("Search publications")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download citations/ })).toHaveCount(0);
  await expect(page.locator("[data-publication-id]:visible")).toHaveCount(7);
  await expect(page.locator('.publication-group > h2').first()).toHaveText('Preprints');
  await expect(page.locator('.publisher-emblem img')).toHaveCount(7);
  const corrected = await request.get('/citations/resistance-2020.bib');
  expect(await corrected.text()).toContain('Qin, T.-J.');
  const pdf = await request.get("/Tianjian-Qin-CV.pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.locator(".thesis-book img")).toBeVisible();
  const selected = await request.get("/selected-publications.bib");
  expect(await selected.text()).not.toContain("10.1093/jpe/rtab074");
  const bib = await request.get("/citations/netforge-2026.bib");
  expect(await bib.text()).toContain("10.64898/2026.09.15.751711");
});
test("Gallery modal, history, keyboard, focus and direct image routes", async ({
  page,
}) => {
  await page.goto("/photography/sample-landscapes");
  const first = page.locator("[data-photo-link]").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("photo-viewer")).toBeVisible();
  await expect(page).toHaveURL(/mountain-lake/);
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/river-valley/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("photo-viewer")).not.toBeVisible();
  await expect(first).toBeFocused();
  await page.goForward();
  await expect(page.getByTestId("photo-viewer")).toBeVisible();
  await page.reload();
  await expect(page.locator("h1")).toContainText("fjord");
  await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
  await page.goto("/photography");
  expect(
    await page.locator('[data-testid="signature-dotted-map"] circle').count(),
  ).toBeGreaterThan(1000);
  await expect(page.locator("animate")).toHaveCount(0);
  await expect(page.getByTestId("travel-count")).toHaveCount(0);
});
test("Decorative motion settles and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /pause|play globe|resume motion/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Research experience", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hero > div:first-child a")).toHaveCount(3);
  await expect(
    page.getByText("China → Netherlands", { exact: true }),
  ).toHaveCount(0);
  for (const name of ["Teaching & service", "Languages"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  const globe = page.getByTestId("signature-globe");
  await expect(globe.locator(".globe-beam")).toHaveCount(10);
  await expect(globe.locator("linearGradient")).toHaveCount(10);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(globe).toHaveAttribute("data-motion-state", "paused", {
    timeout: 7000,
  });
  const canvas = globe.locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-markers", "9");
  await expect(canvas).toHaveAttribute("data-arcs", "10");
  const angle = await canvas.getAttribute("data-angle");
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  expect(await canvas.getAttribute("data-angle")).toBe(angle);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/software");
  await expect(page.locator('.terminal-group[data-kind="developed"] .terminal-entry')).toHaveCount(7);
  await expect(page.getByRole("link", { name: "HerdLink Source", exact: true })).toHaveAttribute("href", "https://github.com/EvoLandEco/herdlink-web");
  await expect(page.locator(".terminal-stack").first()).toContainText("Python");
  await expect(page.locator(".software-terminal")).toContainText("evesim");
  const cloud = page.getByTestId("signature-icon-cloud");
  await cloud.scrollIntoViewIfNeeded();
  await expect(cloud.locator("canvas")).toHaveAttribute("data-ready", "true");
  await expect(cloud).toHaveAttribute("data-motion-state", "paused");
  await expect(
    page.getByRole("button", { name: /pause|play|show full output/i }),
  ).toHaveCount(0);
  await page.goto("/about");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#education .timeline-icon")).toHaveCount(3);
  await expect(
    page.locator("#education [data-timeline-line]").first(),
  ).toBeVisible();
});
test("Core content and full-image routes without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of [
    ...routes,
    "/research/netforge",
    "/photography/sample-wild-places",
    "/photography/sample-wild-places/canyon",
  ]) {
    await page.goto("http://127.0.0.1:3000" + route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("img", { name: "Tianjian Qin", exact: true })).toBeVisible();
  }
  await context.close();
});
test("Unknown and private routes return 404; details remain readable", async ({
  page,
  request,
}) => {
  for (const route of [
    "/research/not-a-project",
    "/photography/private-album",
    "/photography/sample-light/unknown",
  ])
    expect((await request.get(route)).status()).toBe(404);
  for (const slug of [
    "evolutionary-inference",
    "netforge",
    "herdlink",
    "one-health",
  ])
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/research/" + slug);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `evidence/research-${slug}-${width}.png`,
        fullPage: true,
      });
    }
});

test("Album search and embedded technical articles", async ({ page }) => {
  await page.goto("/photography");
  await page.getByLabel("Search collections").fill("zz-no-album");
  await expect(page.locator("[data-album-id]:visible")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("No matching albums");
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(page.locator("[data-album-id]:visible")).toHaveCount(3);
  await page.goto("/writing/hybrid-corop-farm");
  const article = page.frameLocator("iframe").first();
  await expect(article.locator(".blog-post-body")).toBeVisible();
  await expect(article.locator(".blog-post-body")).toContainText("Laplacian");
  const simulation = article.frameLocator("iframe").first();
  await expect(simulation.locator("#mapSvg")).toBeVisible();
  await expect
    .poll(() => simulation.locator("#mapSvg path").count(), { timeout: 30000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page
        .locator("iframe")
        .first()
        .evaluate((el) => el.clientHeight),
    )
    .toBeGreaterThan(1200);
  await page.screenshot({
    path: "evidence/article-hybrid-corop-farm.png",
    fullPage: true,
  });
});

test("Portrait profile preview supports hover, keyboard and tap", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "About Tianjian Qin" });
  const card = page.getByRole("region", { name: "Tianjian Qin profile" });
  await trigger.hover();
  await expect(card).toBeVisible();
  await expect(card.getByText("Postdoctoral Researcher", { exact: true })).toBeVisible();
  await card.hover();
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 360, height: 900 });
  await trigger.click();
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await page.mouse.click(350, 700);
  await expect(card).toBeHidden();
});

test("Dock magnification follows placement and motion preferences", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const link = page.locator(".site-dock a").first();
  const icon = link.locator(".nav-item");
  await link.hover();
  await expect.poll(async () => Math.round((await icon.boundingBox())!.width)).toBe(44);
  await page.setViewportSize({ width: 360, height: 900 });
  await link.hover();
  await expect.poll(async () => (await icon.boundingBox())!.width).toBeGreaterThan(50);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => Math.round((await icon.boundingBox())!.width)).toBe(44);
});

test("Research approach keeps its connections and respects motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/research");
  const diagram = page.getByTestId("signature-beam");
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toHaveAttribute("data-motion-state", "running");
  await expect(diagram.locator(".approach-symbol")).toHaveCount(6);
  await expect(diagram.locator("linearGradient")).toHaveCount(5);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => diagram.locator(".approach-network > svg:not(.network-backdrop) > path:first-child").evaluateAll(paths =>
      paths.length === 5 && paths.every(path => (path as SVGPathElement).getTotalLength() > 30)
    )).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const positions = await diagram.locator(".approach-symbol").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
  expect(positions[0]).toBeLessThan(positions[3]);
  expect(positions[3]).toBeLessThan(positions[4]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(diagram).toHaveAttribute("data-motion-state", "paused");
  await expect(diagram.locator("linearGradient")).toHaveCount(0);
  await expect(diagram.getByRole("img")).toHaveAccessibleName(/observations feed models and inference/);
});

test("Research presents its visual introduction; software has an aligned terminal catalogue", async ({ page }) => {
  await page.goto('/research');
  await expect(page.getByRole('heading', { name: 'Research & applications', exact: true })).toHaveCount(0);
  await expect(page.locator('.research-field')).toHaveCount(0);
  await expect(page.locator('.research-intro').getByTestId('signature-beam')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'From observations to understanding' })).toHaveCount(0);
  await expect(page.locator('[data-programme-id]')).toHaveCount(4);
  await expect(page.locator('[data-programme-id="nextdai"]')).toContainText('In development');
  await page.goto('/software');
  await expect(page.locator('#tools .project-thumbnail')).toHaveCount(0);
  await expect(page.locator('#tools .terminal-entry')).toHaveCount(10);
  await expect(page.locator('#tools .terminal-links a')).toHaveCount(15);
  const chips = page.locator('#tools .terminal-tech');
  expect(await chips.count()).toBeGreaterThan(10);
  expect(await chips.locator('img, svg').count()).toBe(await chips.count());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => {
    const positions = await page.locator('#tools .terminal-stack').evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().left)));
    return new Set(positions).size;
  }).toBe(1);
});

test('Theme button switches and remembers the selected appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('Header labels appear only when the bottom dock has enough room', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const [route, label] of [['/', 'About me'], ['/research', 'Research'], ['/publications', 'Publications'], ['/software', 'Software'], ['/blog', 'Blog'], ['/photography', 'Footprint']]) {
    await page.goto(route);
    await expect(page.locator('.dock-page-label')).toHaveText(label);
    await expect(page.locator('.dock-page-label')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.locator('.dock-page-label')).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (route !== '/') await expect(page.locator('.page-head .eyebrow')).toBeHidden();
  }
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator('.dock-page-label')).toBeHidden();
  await expect(page.locator('.page-head .eyebrow')).toHaveCount(0);
});

test("Research glyph background pauses offscreen and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/research");
  const glyphs = page.locator(".approach-glyphs");
  await expect(glyphs).toHaveAttribute("data-motion-state", "running");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(glyphs).toHaveAttribute("data-motion-state", "paused");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const pixels = await glyphs.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.waitForTimeout(750);
  expect(await glyphs.evaluate((canvas: HTMLCanvasElement, pixels) => canvas.toDataURL() === pixels, pixels)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(glyphs).toHaveAttribute("data-motion-state", "paused");
});

test("Blog collects explorations and notes with working reader routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/blog");
  expect(await page.locator('.site-dock a').evaluateAll(links => links.map(a => a.getAttribute('href')))).toEqual(['/', '/research/', '/publications/', '/software/']);
  await expect(page.locator('.blog-experiment')).toHaveCount(4);
  await expect(page.locator('.blog-note')).toHaveCount(6);
  const notes = await page.locator('.blog-note').evaluateAll(links => links.map(a => a.getAttribute('href')!));
  for (const href of notes) {
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Blog · Migrating' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('article > iframe')).toBeVisible();
  }
  await page.goto('/blog/explore/evolab');
  await expect(page.locator('.exploration-frame')).toHaveAttribute('src', '/explorations/evolab.html');
  await page.goto('/software');
  await expect(page.getByRole('heading', { name: 'Technical notes' })).toHaveCount(0);
});

test("Globe callout reveals an accessible HerdLink link", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Open HerdLink (opens in a new tab)' });
  await expect(link).toHaveAttribute('href', 'https://herdlink.nl');
  await expect(link).toHaveAttribute('target', '_blank');
  await page.locator('.globe-frame').hover();
  await expect(link).toHaveCSS('opacity', '1');
  await link.hover();
  await expect(link).toHaveCSS('pointer-events', 'auto');
  await page.mouse.move(0, 0);
  await link.focus();
  await expect(link).toHaveCSS('opacity', '1');
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const phone = await touch.newPage();
  await phone.goto('/');
  await expect(phone.locator('.globe-herdlink')).toHaveCSS('opacity', '1');
  await touch.close();
});

test("Embedded notes and explorations share controls and follow the site theme", async ({ page }) => {
  const legacyRequests: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/legacy/')) legacyRequests.push(request.url()); });
  const paths = ['/writing/herdlink', '/writing/integrating-pytorch-models-in-r-package', '/writing/hybrid-corop-farm', '/writing/protocol-transforming-phylogeny-to-gcn', '/writing/subspecies-level-diversification', '/writing/convert-html-to-pdf-with-nodejs-and-puppeteer', '/blog/explore/evolab', '/blog/explore/hybrid-networks', '/blog/explore/spatial-hex-lab', '/blog/explore/hexagon-grid'];
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByText('Original article', { exact: true })).toHaveCount(0);
    const frame = page.frameLocator('main iframe').first();
    await expect(frame.locator('[href^="/legacy/"], [src^="/legacy/"]')).toHaveCount(0);
    await expect(frame.locator('link[href="/reading/controls.css"]')).toHaveCount(1);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(frame.locator('html')).toHaveClass(/dark/);
    await expect(frame.locator('body')).toHaveCSS('color', 'rgb(232, 237, 245)');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await expect(frame.locator('html')).not.toHaveClass(/dark/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(legacyRequests).toEqual([]);
  await page.goto('/blog/explore/evolab');
  const sim = page.frameLocator('.exploration-frame');
  await sim.locator('#stepButton').click();
  await sim.locator('#resetButton').click();
  await expect(sim.locator('#startButton')).toBeEnabled();
  await page.goto('/writing/integrating-pytorch-models-in-r-package');
  await page.frameLocator('article > iframe').locator('#toggleAll').click();
});

test("Sample map pins open collections and covers show a lens", async ({ page }) => {
  await page.goto('/photography');
  await expect(page.locator('.album-count, .album-sample')).toHaveCount(0);
  await expect(page.locator('.album-caption h3')).toHaveText(['Norway', 'United States', 'New Zealand']);
  await expect(page.locator('.album-open')).toHaveText(['Let’s go', 'Let’s go', 'Let’s go']);
  const pins = page.locator('.collection-pin');
  await expect(pins).toHaveCount(3);
  const cards = page.locator('.album-card');
  for (let i = 0; i < 3; i++) {
    await expect(pins.nth(i)).toHaveAttribute('href', (await cards.nth(i).getAttribute('href'))!);
    await expect(pins.nth(i)).toHaveAttribute('aria-label', /sample collection/);
  }
  await cards.first().locator('.album-lens').hover({ position: { x: 120, y: 110 } });
  await expect(cards.first().locator('.album-lens-overlay')).toBeVisible();
  await cards.first().click();
  await expect(page).toHaveURL(/\/photography\/sample-landscapes\/?$/);
});


test("Animated theme switcher persists the selected theme", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.goto('/photography');
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('html')).not.toHaveAttribute('data-magicui-theme-vt', 'active');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});


test("Migrating destinations cannot navigate from the dock", async ({ page }) => {
  await page.goto('/');
  for (const name of ['Blog', 'Footprint']) {
    const item = page.getByRole('link', { name: `${name} · Migrating` });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).not.toHaveAttribute('href');
    await item.click({ force: true });
    await expect(page).toHaveURL(/\/$/);
    await item.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
  }
});


test("Icon cloud keeps running while visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto('/software/');
  const cloud = page.getByTestId('signature-icon-cloud');
  await expect(cloud).toHaveAttribute('data-motion-state', 'running');
  await page.waitForTimeout(5000);
  await expect(cloud).toHaveAttribute('data-motion-state', 'running');
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cloud).toHaveAttribute('data-motion-state', 'paused');
});

test("Pointer focus does not hold the globe callout open", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto('/');
  for (const selector of ['.globe-frame', '.globe-herdlink']) {
    await page.locator('.globe-frame').hover();
    await page.locator(selector).evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once: true }));
    await page.locator(selector).click();
    await page.mouse.move(0, 0);
    await expect(page.locator('.globe-herdlink')).toHaveCSS('opacity', '0');
  }
  await page.keyboard.press('Tab');
  await page.locator('.globe-frame').focus();
  await expect(page.locator('.globe-herdlink')).toHaveCSS('opacity', '1');
});

test("Globe animation avoids stylesheet churn and cleans up renderer wrappers", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto('/');
  const globe = page.getByTestId('signature-globe');
  await expect(globe).toHaveAttribute('data-motion-state', 'running');
  const canvas = globe.locator('canvas[data-markers]');
  const angle = await canvas.getAttribute('data-angle');
  const writes = await page.evaluate(async () => {
    const style = [...document.head.querySelectorAll('style')].find(el => el.textContent === ':root{}');
    if (!style) throw new Error('Globe anchor stylesheet missing');
    let writes = 0;
    const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(style, { childList: true, characterData: true, subtree: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
    observer.disconnect();
    return writes;
  });
  expect(writes).toBe(0);
  expect(await canvas.getAttribute('data-angle')).not.toBe(angle);
  for (let i = 0; i < 3; i++) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(globe).toHaveAttribute('data-motion-state', 'paused');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(globe).toHaveAttribute('data-motion-state', 'running');
  }
  await expect(page.locator('.globe-frame > div > canvas[data-markers]')).toHaveCount(1);
});
