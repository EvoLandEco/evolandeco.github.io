import { expect, test, type Page } from "@playwright/test";

// Integrate this contract with a production-server Playwright configuration.
// The data attributes below identify content, not hidden replacement elements.
const routes = ["/", "/research", "/publications", "/software", "/about", "/photography"];
const paperIds = [
  "evonn-2026", "eve-2025", "wetlands-2022", "resistance-2020",
  "traits-2019", "growth-2019", "sediment-2018", "water-2018",
  "netforge-2026", "relatedness-2026",
];
const toolkitLabels = [
  "Python", "R", "C++", "JavaScript", "PyTorch", "React", "D3.js",
  "Docker", "Git", "Linux", "SQL", "Three.js", "Vite", "Bash", "LaTeX",
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport);
}

for (const route of routes) {
  test(`direct route and visible content: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId("profile-name")).toHaveText("Tianjian Qin");
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("complete bibliography and publication status", async ({ page }) => {
  await page.goto("/publications");
  for (const id of paperIds) {
    await expect(page.locator(`[data-publication-id="${id}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-publication-status="peer-reviewed"]')).toHaveCount(8);
  await expect(page.locator('[data-publication-status="preprint"]')).toHaveCount(2);
  await expect(page.locator('[data-publication-id="netforge-2026"]'))
    .toContainText("Preprint");
  await expect(page.locator('[data-publication-id="evonn-2026"]'))
    .toContainText("Systematic Biology");
  await expect(page.locator('[data-publication-id="growth-2019"] [data-equal-contribution="true"]'))
    .toHaveCount(2);
});

test("programme and contribution roles", async ({ page }) => {
  await page.goto("/research");
  await expect(page.locator('[data-programme-id="nextdai"]')).toContainText("In development");
  await expect(page.locator('[data-programme-id="imbit"]')).toContainText("Completed");
  await page.goto("/software");
  for (const id of ["treestats", "ddd", "daisie"]) {
    await expect(page.locator(`[data-software-id="${id}"]`)).toContainText("Collaborator");
  }
});

test("toolkit has a complete semantic representation", async ({ page }) => {
  await page.goto("/software");
  const list = page.getByTestId("toolkit-list");
  for (const label of toolkitLabels) {
    await expect(list.getByText(label, { exact: true })).toBeVisible();
  }
});

test("core visuals are real components, not named placeholders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("signature-globe").locator("canvas")).toBeVisible();
  await page.goto("/research");
  await expect(page.getByTestId("signature-beam").locator("svg").first()).toBeVisible();
  await page.goto("/software");
  await page.getByTestId("signature-icon-cloud").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("signature-icon-cloud").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("signature-terminal")).toContainText("software.index");
  await page.goto("/photography");
  await expect(page.getByTestId("signature-dotted-map").locator("svg")).toBeVisible();
  expect(await page.getByTestId("signature-dotted-map").locator("circle").count()).toBeGreaterThan(0);
  await expect(page.getByTestId("signature-dotted-map").locator("animate")).toHaveCount(0);
});

test("reduced motion is represented in the controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [route, ids] of [
    ["/", ["signature-globe"]],
    ["/research", ["signature-beam"]],
    ["/software", ["signature-terminal", "signature-icon-cloud"]],
    ["/photography", ["signature-dotted-map"]],
  ] as const) {
    await page.goto(route);
    for (const id of ids) {
      const panel = page.getByTestId(id);
      await panel.scrollIntoViewIfNeeded();
      await expect(panel).toHaveAttribute("data-motion-state", /^(paused|static)$/);
    }
  }
  // Add frame/orientation checks: a state label alone cannot prove stopped motion.
});

test("the CV download is a PDF", async ({ request }) => {
  const response = await request.get("/Tianjian-Qin-CV.pdf");
  expect(response.ok()).toBe(true);
  const body = await response.body();
  expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
});

test("essential content works without JavaScript", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Set Playwright baseURL to the production test server.");
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    for (const route of routes) {
      await page.goto(route);
      const main = page.getByRole("main");
      await expect(main).toBeVisible();
      const heading = main.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();
      const visuallyReadable = await heading.evaluate(element => {
        let node: Element | null = element;
        while (node) {
          const style = getComputedStyle(node);
          if (Number(style.opacity) === 0 || style.visibility === "hidden" || style.display === "none") {
            return false;
          }
          node = node.parentElement;
        }
        return true;
      });
      expect(visuallyReadable).toBe(true);
      await expectNoHorizontalOverflow(page);
    }
    await page.goto("/publications");
    for (const id of paperIds) {
      await expect(page.locator(`[data-publication-id="${id}"]`)).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

test("unknown research slugs return 404", async ({ page }) => {
  const response = await page.goto("/research/does-not-exist");
  expect(response?.status()).toBe(404);
});
