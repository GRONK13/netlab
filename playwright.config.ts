import { defineConfig, devices } from '@playwright/test';

// Browser smoke tests against the built app: the real server serving apps/web/dist
// with a throwaway PGlite database. Run `npm run e2e` (builds first); CI builds, then
// runs `npx playwright test`.
const PORT = 3199;

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The real app plus a stand-in sign-in provider (see e2e/test-server.ts).
    command: 'node e2e/test-server.ts',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    // Every test registers a student from the same address, so allow more than production's 10 a minute.
    env: {
      PORT: String(PORT),
      PUBLIC_URL: `http://127.0.0.1:${PORT}`,
      ALLOWED_EMAIL_DOMAIN: 'usc.edu.ph',
      AUTH_RATE_LIMIT: '100',
    },
  },
});
