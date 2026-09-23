import { expect, test, type Page } from '@playwright/test';

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url || 'unknown source'})`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test('app entry renders without runtime errors', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  await page.goto('/');

  await expect(page).toHaveTitle(/TripFlow/);
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toEqual([]);
});

test('privacy page renders and links to support', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  await page.goto('/privacy');

  await expect(page).toHaveTitle(/TripFlow/);
  await expect(page.getByText(/^(隐私政策|Privacy policy)$/i).first()).toBeVisible();
  await page.getByRole('link', { name: /支持与帮助|Support/i }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByText(/^(支持与帮助|Support)$/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('support page renders and returns to TripFlow', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  await page.goto('/support');

  await expect(page).toHaveTitle(/TripFlow/);
  await expect(page.getByText(/^(支持与帮助|Support)$/i).first()).toBeVisible();
  await page.getByRole('link', { name: /返回 TripFlow|Back to TripFlow/i }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test('unknown routes show the localized recovery page and return home', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  const response = await page.goto('/expired-invite-example');
  expect(response?.status()).toBe(404);

  await expect(page).toHaveTitle(/页面不存在|Page not found/);
  await expect(page.getByText(/这个页面不存在|This page does not exist/i)).toBeVisible();
  await expect(page.getByText(/邀请码有有效期|invite codes expire/i)).toBeVisible();
  await page.getByRole('link', { name: /回到 TripFlow|Back to TripFlow/i }).click();
  await expect(page).toHaveURL(/\/$/);
  const expectedRouteMiss = `console: Failed to load resource: the server responded with a status of 404 (Not Found) (${new URL('/expired-invite-example', page.url()).toString()})`;
  expect(errors.filter((error) => error !== expectedRouteMiss)).toEqual([]);
});
