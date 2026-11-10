import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4183";

export default defineConfig({
  testDir: "./tests/browser",
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 15_000,
  globalTimeout: 120_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview frontend --host 127.0.0.1 --port 4183 --strictPort",
    url: baseURL,
    env: { API_PROXY_TARGET: "http://127.0.0.1:3183" },
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 3_000 },
  },
});
