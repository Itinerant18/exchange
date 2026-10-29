import { test, expect } from '@playwright/test';

const BACKEND = 'http://127.0.0.1:5000/api/v1';

async function backendCall(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

test.describe('auth error messages', () => {
  test.beforeEach(async () => {
    await test.step('cleanup transient test accounts', async () => {
      for (const email of [
        'e2e-login@example.com',
        'e2e-register-weak@example.com',
        'e2e-register-dup@example.com',
      ]) {
        try {
          await backendCall('/auth/login', { email, password: 'does-not-matter' });
        } catch {}
      }
    });

    // Make sure the Vite dev server and backend are reachable.
    const viteResp = await fetch('http://127.0.0.1:5173/src/features/auth/pages/LoginPage.jsx');
    expect(viteResp.status, 'Vite dev server should be reachable').toBe(200);
    const backendResp = await fetch(`${BACKEND}/health`);
    expect(backendResp.status, 'Backend health endpoint should be reachable').toBe(200);
  });

  test('login shows Invalid email or password for bad credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('e2e-login@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  });

  test('register shows weak password message for short password', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/display name/i).fill('E2E Weak');
    await page.getByLabel(/email address/i).fill('e2e-register-weak@example.com');
    await page.getByLabel(/password/i).fill('short');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Password must be 10–128 characters and include both letters and digits',
    );
  });

  test('register shows email already registered message for duplicate email', async ({ page }) => {
    const email = `e2e-register-dup-${Date.now()}@example.com`;

    await test.step('create the account via API first', async () => {
      const created = await backendCall('/auth/register', {
        name: 'E2E Dup',
        email,
        password: 'password1234',
        phone: '+919876543210',
      });
      expect(created).toHaveProperty('data.user.email', email);
    });

    await page.goto('/register');
    await page.getByLabel(/display name/i).fill('E2E Dup');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/password/i).fill('password1234');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toContainText(
      'An account with this email already exists',
    );
  });
});
