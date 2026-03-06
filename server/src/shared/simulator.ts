import { env } from '../config/env.js';
import { fetchLivePolymarketMarkets } from '../connectors/polymarket/live.js';
import { appStore } from './store.js';

let tickTimer: NodeJS.Timeout | null = null;
let liveTimer: NodeJS.Timeout | null = null;
let runningSync = false;

async function syncLiveMarkets(): Promise<void> {
  if (runningSync) {
    return;
  }

  runningSync = true;
  const startedAt = Date.now();

  try {
    const markets = await fetchLivePolymarketMarkets();
    appStore.applyLiveMarketSnapshots(markets, Date.now() - startedAt);
  } catch (error) {
    appStore.reportLiveSyncFailure(error instanceof Error ? error.message : 'Unknown live sync failure');
  } finally {
    runningSync = false;
  }
}

export function startSimulator(): void {
  if (!tickTimer) {
    tickTimer = setInterval(() => {
      appStore.tick();
    }, env.tickIntervalMs);
  }

  if (!liveTimer) {
    void syncLiveMarkets();
    liveTimer = setInterval(() => {
      void syncLiveMarkets();
    }, env.liveMarketRefreshMs);
  }
}

export function stopSimulator(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
}
