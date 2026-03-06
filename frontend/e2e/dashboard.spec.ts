import { test, expect } from '@playwright/test';

test('dashboard loads and navigation works against live paper backend', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('OpenClaw')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'dashboard' })).toBeVisible();
  await expect(page.getByText('Total Profit (Lifetime)')).toBeVisible();
  await expect(page.getByTestId('recent-fills-panel')).toBeVisible();

  await page.getByRole('button', { name: 'Live Markets' }).click();
  await expect(page.getByRole('heading', { name: 'Live Market Feeds' })).toBeVisible();
  await expect(page.getByTestId('market-card').first()).toBeVisible();

  const search = page.getByPlaceholder('Search markets by name or keyword...');
  await search.fill('non-existent-market-keyword');
  await expect(page.getByText('No markets found')).toBeVisible();

  await search.fill('bit');
  await expect(page.getByTestId('market-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Portfolio & Positions' }).click();
  await expect(page.getByText('Active Positions')).toBeVisible();
});

test('kill switch toggles engine state from the header', async ({ page }) => {
  await page.goto('/');

  const killSwitchButton = page.getByRole('button', { name: 'Kill Switch' });
  await expect(killSwitchButton).toBeVisible();
  await killSwitchButton.click();

  const startEngineButton = page.getByRole('button', { name: 'Start Engine' });
  await expect(startEngineButton).toBeVisible();
  await startEngineButton.click();
  await expect(page.getByRole('button', { name: 'Kill Switch' })).toBeVisible();
});
