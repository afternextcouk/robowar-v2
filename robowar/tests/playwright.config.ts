/**
 * ROBOWAR V2 — Playwright Configuration
 * Author: İREM (QA & Simulation Specialist)
 * Jira: YPY-42
 */

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["list"],
    ["html", { outputFolder: "../test-results/playwright-report", open: "never" }],
    ["json", { outputFile: "../test-results/playwright-results.json" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Locale & timezone for deterministic date-related tests
    locale: "en-US",
    timezoneId: "Europe/Istanbul",
  },

  projects: [
    // Desktop browsers
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },

    // MetaMask E2E — Chromium only (extensions only work in Chromium)
    {
      name: "metamask-flow",
      testMatch: "**/onboarding.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        // In a real CI setup, you'd use a MetaMask extension fixture
        // For mock wallet tests, standard Chromium is sufficient
        channel: "chrome",
      },
    },
  ],

  // Start the Vite dev server before running E2E tests
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: "../frontend",
  },

  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  outputDir: "../test-results/playwright-artifacts",
  globalSetup: undefined,
  globalTeardown: undefined,
});
