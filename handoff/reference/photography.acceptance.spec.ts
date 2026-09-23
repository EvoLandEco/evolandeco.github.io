import { expect, test } from "@playwright/test";

// Select the data context of the separately built test server.
const dataContext = process.env.PHOTOGRAPHY_E2E_DATA;
if (dataContext !== "empty" && dataContext !== "fixture") {
  throw new Error("Set PHOTOGRAPHY_E2E_DATA to empty or fixture for the matching test server.");
}

const destinationLabels = ["Home", "Research", "Papers", "Software", "About", "Photography"];
const destinationPaths = ["/", "/research", "/publications", "/software", "/about", "/photography"];

test("Photography is the sixth primary destination", async ({ page }) => {
  await page.goto("/photography");
  const links = page.getByTestId("primary-navigation").getByRole("link");
  await expect(links).toHaveCount(6);
  for (let i = 0; i < destinationLabels.length; i++) {
    await expect(links.nth(i)).toHaveAccessibleName(destinationLabels[i]);
    await expect(links.nth(i)).toHaveAttribute("href", destinationPaths[i]);
    await expect(links.nth(i)).toBeVisible();
  }
  await expect(links.nth(5)).toHaveAttribute("aria-current", "page");
});

test("Dotted Map is real and static", async ({ page }) => {
  await page.goto("/photography");
  const map = page.getByTestId("signature-dotted-map");
  await expect(map.locator("svg")).toBeVisible();
  expect(await map.locator("circle").count()).toBeGreaterThan(0);
  await expect(map.locator("animate")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-motion-state", "static");
});

test("six labels fit a 360px phone without horizontal clipping", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/photography");
  const links = page.getByTestId("primary-navigation").getByRole("link");
  for (let i = 0; i < 6; i++) {
    const box = await links.nth(i).boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Navigation link has no visible bounds.");
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits).toBe(true);
});

if (dataContext === "empty") {
  test("unconfirmed content does not claim zero visits", async ({ page }) => {
    await page.goto("/photography");
    await expect(page.getByTestId("photography-empty")).toContainText("Albums are being curated.");
    await expect(page.getByTestId("travel-count")).toHaveCount(0);
    await expect(page.locator("[data-album-id]")).toHaveCount(0);
    await expect(page.locator("[data-photo-id]")).toHaveCount(0);
    const response = await page.goto("/photography/netherlands");
    expect(response?.status()).toBe(404);
  });
} else {
  test("travel, albums and photos have independent totals", async ({ page }) => {
    await page.goto("/photography");
    await expect(page.getByTestId("travel-count")).toHaveAttribute("data-count", "3");
    await expect(page.getByTestId("travel-count-label")).toHaveText("countries documented");
    await expect(page.getByTestId("album-count")).toHaveAttribute("data-count", "2");
    await expect(page.getByTestId("photo-count")).toHaveAttribute("data-count", "3");
    const countries = page.getByTestId("country-list");
    await expect(countries.locator('[data-country-code="FR"]')).toContainText("Album not published");
    await expect(countries.locator('[data-country-code="FR"]').getByRole("link")).toHaveCount(0);
    await expect(countries.locator('[data-country-code="BE"]')).toHaveCount(0);
    await expect(countries.locator('[data-country-code="DE"]')).toHaveCount(0);
  });

  test("country album exposes only its approved photos", async ({ page }) => {
    const response = await page.goto("/photography/netherlands");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main [data-photo-link]")).toHaveCount(2);
    await expect(page.locator('main [data-photo-id="fixture-nl-draft"]')).toHaveCount(0);
    await expect(page.getByTestId("primary-navigation").getByRole("link", { name: "Photography", exact: true }))
      .toHaveAttribute("aria-current", "page");
  });

  test("viewer maintains photo URLs and restores its originating link", async ({ page }) => {
    await page.goto("/photography/netherlands");
    const trigger = page.locator('a[data-photo-link][href="/photography/netherlands/fixture-nl-landscape"]');
    await trigger.focus();
    await trigger.press("Enter");
    const viewer = page.getByTestId("photo-viewer");
    await expect(viewer).toBeVisible();
    await expect(page).toHaveURL(/\/photography\/netherlands\/fixture-nl-landscape$/);
    await viewer.getByRole("button", { name: "Next photo", exact: true }).click();
    await expect(page).toHaveURL(/\/photography\/netherlands\/fixture-nl-portrait$/);
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
    await expect(page).toHaveURL(/\/photography\/netherlands$/);
    await expect(trigger).toBeFocused();
  });

  test("a direct full-photo visit is a page rather than an orphan modal", async ({ page }) => {
    const response = await page.goto("/photography/netherlands/fixture-nl-landscape");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("photo-viewer")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("img").first()).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /back to.*album/i })).toBeVisible();
  });

  test("hidden and unknown routes return real 404 responses", async ({ request }) => {
    for (const path of [
      "/photography/belgium", "/photography/france", "/photography/germany",
      "/photography/not-a-country", "/photography/netherlands/not-a-photo",
      "/photography/netherlands/fixture-nl-draft",
    ]) {
      expect((await request.get(path)).status()).toBe(404);
    }
    expect((await request.get("/photography/media/fixture-be-private.webp")).status()).toBe(404);
  });

  test("album and full-photo links work without JavaScript", async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error("Set baseURL to the fixture production test server.");
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto("/photography/netherlands");
      const link = page.locator('a[data-photo-link][href="/photography/netherlands/fixture-nl-landscape"]');
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/photography\/netherlands\/fixture-nl-landscape$/);
      await expect(page.getByRole("main").getByRole("img").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
