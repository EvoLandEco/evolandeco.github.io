import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 180000,
  testDir: "tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", testMatch: "atlas-relationship-motion.spec.ts", use: { browserName: "webkit", deviceScaleFactor: 3, isMobile: true, hasTouch: true, actionTimeout: 30000 } },
  ],
  reporter: [["list"], ["json", { outputFile: "evidence/browser-tests.json" }]],
  webServer: process.env.CI ? {
    command: "python3 -m http.server 3000 --bind 127.0.0.1 --directory out",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  } : undefined,
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    trace: "retain-on-failure",
  },
});
