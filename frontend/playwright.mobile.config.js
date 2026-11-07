import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mobile',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
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
      },
    },
    {
      name: 'iphone-15',
      use: {
        ...devices['iPhone 15'],
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});

