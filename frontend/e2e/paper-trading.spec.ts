import { test, expect } from '@playwright/test';

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:8091/api/v1';

test('settings page shows paper mode and accepts three credential keys', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();

  await expect(page.getByText('Execution Mode')).toBeVisible();
  await expect(page.getByText('Paper Trading')).toBeVisible();
  await expect(page.getByTestId('paper-feed-status')).toHaveText(/Connected|Reconnecting/);

  await page.getByTestId('api-key-input').fill('paper-key-12345');
  await page.getByTestId('api-secret-input').fill('paper-secret-12345');
  await page.getByTestId('passphrase-input').fill('paper-pass-12345');
  await page.getByTestId('save-settings').click();

  await expect(page.getByTestId('credential-status')).toHaveText(/Configured/);

  await expect
    .poll(async () => {
      const response = await request.get(`${apiBase}/trading/status`);
      const json = await response.json();
      return {
        configured: json.data.configured,
        mode: json.data.paperTrading.mode,
        live: json.data.paperTrading.liveDataConnected,
      };
    })
    .toEqual({ configured: true, mode: 'paper', live: true });
});

test('live prices drive simulated fills and positions end-to-end', async ({ page, request }) => {
  const beforeResponse = await request.get(`${apiBase}/trades/fills?limit=20`);
  const beforeJson = await beforeResponse.json();
  const beforeFills = Array.isArray(beforeJson.data) ? beforeJson.data.length : 0;

  await expect
    .poll(async () => {
      const response = await request.get(`${apiBase}/trades/fills?limit=20`);
      const json = await response.json();
      return Array.isArray(json.data) ? json.data.length : 0;
    }, { timeout: 20_000 })
    .toBeGreaterThan(beforeFills);

  const positionsResponse = await request.get(`${apiBase}/portfolio/positions`);
  const positionsJson = await positionsResponse.json();
  expect(Array.isArray(positionsJson.data)).toBeTruthy();
  expect(positionsJson.data.length).toBeGreaterThan(0);

  await page.goto('/');
  await expect(page.getByTestId('recent-fill-row').first()).toBeVisible();

  await page.getByRole('button', { name: 'Portfolio & Positions' }).click();
  await expect(page.getByTestId('position-row').first()).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Paper Trading')).toBeVisible();
  await expect(page.getByText('Live Feed')).toBeVisible();
});
