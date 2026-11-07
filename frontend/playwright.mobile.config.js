import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    defaultBrowserType: 'chromium',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --port 5173 --host 127.0.0.1',
    port: 5173,
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    {
      name: 'android-small',
      use: {
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'iphone-15',
      use: {
        ...devices['iPhone 15'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad (gen 7)'],
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        defaultBrowserType: 'chromium',
      },
    },
  ],
});

