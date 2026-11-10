import { defineConfig, devices } from '@playwright/test'

// Dashboard specs use a dashboard-, staff- or terms- prefix, including in subfolders.
const DASHBOARD = /(?:^|[\\/])(?:dashboard|staff|terms)-[^\\/]*\.spec\.ts$/

// Health tests run against the built app through the proxy, so the stack must be up.
// E2E_BASE_URL is for a stack on another port (APP_PORT).
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Without the vendor volume, the API on Windows can take 7 to 20 s per request (README, "PHP packages in a Docker volume").
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    // page.route() cannot see requests the service worker makes, so mocked specs would reach the real API.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/dashboard-preview.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // Browser support by engine (decided 2026-11-09): the dashboard (Staff and Administrator, desktop only) runs on the four desktop
    // engines, the user app (PWA) on the two phone emulations only.
    { name: 'chromium', testMatch: DASHBOARD, use: { ...devices['Desktop Chrome'] } },
    { name: 'msedge', testMatch: DASHBOARD, use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'firefox', testMatch: DASHBOARD, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: DASHBOARD, use: { ...devices['Desktop Safari'] } },
    { name: 'android', testIgnore: DASHBOARD, use: { ...devices['Pixel 7'] } },
    { name: 'iphone', testIgnore: DASHBOARD, use: { ...devices['iPhone 13'] } },
  ],
})
