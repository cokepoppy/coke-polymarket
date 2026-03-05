import { test, expect } from '@playwright/test';

test('dashboard loads and shows key sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('OpenClaw')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'dashboard' })).toBeVisible();
  await expect(page.getByText('Total Profit (Lifetime)')).toBeVisible();
  await expect(page.getByText('Recent Fills')).toBeVisible();
});

test('switch tabs and filter live markets', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Live Markets' }).click();
  await expect(page.getByRole('heading', { name: 'Live Market Feeds' })).toBeVisible();

  const search = page.getByPlaceholder('Search markets by name or keyword...');
  await search.fill('non-existent-market-keyword');
  await expect(page.getByText('No markets found')).toBeVisible();

  await search.fill('BTC');
  await expect(page.getByText('Will BTC hit $100k in March?')).toBeVisible();
});

test('kill switch toggles engine button state', async ({ page }) => {
  await page.goto('/');

  const killSwitchButton = page.getByRole('button', { name: 'Kill Switch' });
  await expect(killSwitchButton).toBeVisible();
  await killSwitchButton.click();

  const startEngineButton = page.getByRole('button', { name: 'Start Engine' });
  await expect(startEngineButton).toBeVisible();
  await startEngineButton.click();

  await expect(page.getByRole('button', { name: 'Kill Switch' })).toBeVisible();
});
