import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke test (task 1.10.3). It drives the real app against a local
 * worker with a stubbed AI binding, so it proves the wiring without spending
 * money on inference.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8799",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "bun run e2e:server",
    url: "http://localhost:8799/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
