import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/listings',
  '/lend',
  '/blog',
  '/blog/sustainable-couture-rental-revolution',
];

test.describe('Mobile Foundation & Viewport Tests', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`Route ${route} has no horizontal overflow`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const isNoOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 1;
      });

      expect(isNoOverflow).toBe(true);
    });

    test(`Route ${route} has no sub-16px input font size on mobile viewports`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Input auto-zoom rule applies to mobile touch viewports');
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const sub16Inputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'));
        return inputs
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          })
          .map((el) => {
            const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
            return { tag: el.tagName, name: el.name || el.id || el.placeholder, fontSize };
          })
          .filter((item) => item.fontSize < 15.9);
      });

      expect(sub16Inputs).toEqual([]);
    });

    test(`Route ${route} interactive controls satisfy minimum touch target guidelines`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Tap target requirements apply to mobile touch devices');
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      const violations = await page.evaluate(() => {
        const interactive = Array.from(document.querySelectorAll('button:not([hidden]), [role="button"], input[type="submit"], input[type="button"], nav a'));
        return interactive
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return false;
            }
            // Skip inline links inside body text paragraphs
            if (el.tagName === 'A' && el.closest('p') && !el.classList.contains('btn')) {
              return false;
            }
            // Filter targets below standard 36px threshold (44px target token with safe margin)
            return rect.width < 36 || rect.height < 36;
          })
          .map((el) => ({
            tag: el.tagName,
            text: (el.textContent || '').trim().slice(0, 30),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          }));
      });

      expect(violations).toEqual([]);
    });
  }
});

