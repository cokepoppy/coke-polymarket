import { env } from '../../config/env.js';

export type LiveMarketSnapshot = {
  id: string;
  name: string;
  yes: number;
  no: number;
  volume: number;
  liquidity: number;
  updatedAt: number;
  yesTokenId: string;
  noTokenId: string;
  yesOutcome: string;
  noOutcome: string;
};

type GammaMarketRecord = {
  question?: string;
  conditionId?: string;
  liquidityNum?: number;
  volume24hrClob?: number;
  volume24hr?: number;
  updatedAt?: string;
  acceptingOrders?: boolean;
  enableOrderBook?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
};

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function parsePrice(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0.001, Math.min(0.999, parsed));
}

function toSnapshot(record: GammaMarketRecord): LiveMarketSnapshot | null {
  if (!record.active || record.closed || record.archived || !record.acceptingOrders || !record.enableOrderBook) {
    return null;
  }

  const outcomes = parseJsonArray(record.outcomes);
  const prices = parseJsonArray(record.outcomePrices);
  const tokenIds = parseJsonArray(record.clobTokenIds);

  if (outcomes.length !== 2 || prices.length !== 2 || tokenIds.length !== 2) {
    return null;
  }

  const yesIndex = outcomes.findIndex((outcome) => outcome.toLowerCase() === 'yes');
  const resolvedYesIndex = yesIndex >= 0 ? yesIndex : 0;
  const resolvedNoIndex = resolvedYesIndex === 0 ? 1 : 0;

  const yes = parsePrice(prices[resolvedYesIndex]);
  const no = parsePrice(prices[resolvedNoIndex]);
  const id = record.conditionId?.trim();
  const name = record.question?.trim();
  const yesTokenId = tokenIds[resolvedYesIndex]?.trim();
  const noTokenId = tokenIds[resolvedNoIndex]?.trim();

  if (!yes || !no || !id || !name || !yesTokenId || !noTokenId) {
    return null;
  }

  const updatedAt = record.updatedAt ? Date.parse(record.updatedAt) : Date.now();

  return {
    id,
    name,
    yes: Number(yes.toFixed(4)),
    no: Number(no.toFixed(4)),
    volume: Number((record.volume24hrClob ?? record.volume24hr ?? 0).toFixed(2)),
    liquidity: Number((record.liquidityNum ?? 0).toFixed(2)),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    yesTokenId,
    noTokenId,
    yesOutcome: outcomes[resolvedYesIndex] ?? 'Yes',
    noOutcome: outcomes[resolvedNoIndex] ?? 'No',
  };
}

export async function fetchLivePolymarketMarkets(limit = env.liveMarketLimit): Promise<LiveMarketSnapshot[]> {
  const query = new URL('/markets', env.polyGammaHost);
  query.searchParams.set('active', 'true');
  query.searchParams.set('closed', 'false');
  query.searchParams.set('archived', 'false');
  query.searchParams.set('limit', String(Math.max(limit * 3, limit)));

  const response = await fetch(query, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gamma API returned ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected Gamma API payload shape');
  }

  return payload
    .map((item) => toSnapshot(item as GammaMarketRecord))
    .filter((item): item is LiveMarketSnapshot => item !== null)
    .sort((left, right) => (right.volume + right.liquidity) - (left.volume + left.liquidity))
    .slice(0, limit);
}
