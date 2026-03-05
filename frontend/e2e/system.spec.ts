import { test, expect } from '@playwright/test';

test('system tabs render logs and health panels', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'System Health' }).click();
  await expect(page.getByText('Real-time Infrastructure Metrics')).toBeVisible();
  await expect(page.getByText('API Latency')).toBeVisible();

  await page.getByRole('button', { name: 'System Logs' }).click();
  await expect(page.getByText('openclaw-agent-tty1')).toBeVisible();
  await expect(page.getByText('Connected to Polymarket API Node')).toBeVisible();
});
