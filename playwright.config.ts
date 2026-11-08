import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4183";

export default defineConfig({
  testDir: "./tests/browser",
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 15_000,
  globalTimeout: 120_000,
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview frontend --host 127.0.0.1 --port 4183 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 3_000 },
  },
});
