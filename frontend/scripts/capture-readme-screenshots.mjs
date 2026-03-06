import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = path.resolve(process.cwd(), '../docs/screenshots');

async function capture() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'dashboard.png') });

  await page.getByRole('button', { name: 'Portfolio & Positions' }).click();
  await page.getByText('Active Positions').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'portfolio.png') });

  await page.getByRole('button', { name: 'Live Markets' }).click();
  await page.getByRole('heading', { name: 'Live Market Feeds' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'live-markets.png') });

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Execution Mode').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'settings-paper-trading.png') });

  await page.getByRole('button', { name: 'System Health' }).click();
  await page.getByText('Real-time Infrastructure Metrics').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'system-health.png') });

  await page.getByRole('button', { name: 'System Logs' }).click();
  await page.getByText('openclaw-agent-tty1').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'system-logs.png') });

  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
