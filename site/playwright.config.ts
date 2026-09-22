import { defineConfig } from "@playwright/test";
export default defineConfig({
  timeout: 180000,
  testDir: "tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "evidence/browser-tests.json" }]],
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    trace: "retain-on-failure",
  },
});
