import { EventEmitter } from 'node:events';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import type {
  CredentialStatus,
  EngineState,
  Fill,
  Market,
  PortfolioAllocation,
  Position,
  ProfitPoint,
  RiskEvent,
  RiskRule,
  StrategyConfig,
  StrategyTag,
  SystemLog,
  SystemMetric,
} from '../types/domain.js';
import { clamp, genId, nowTimeString } from './utils.js';
import type { LiveMarketSnapshot } from '../connectors/polymarket/live.js';

type MarketMeta = {
  yesTokenId: string;
  noTokenId: string;
  yesOutcome: string;
  noOutcome: string;
  source: 'seed' | 'gamma';
};

type PaperTradingStatus = {
  mode: 'paper';
  liveDataConnected: boolean;
  lastSyncAt: number | null;
  lastLatencyMs: number | null;
  source: 'gamma-api' | 'seed';
  marketCount: number;
  cashBalance: number;
  startingCash: number;
  totalEquity: number;
};

const STRATEGY_DESCRIPTIONS: Record<StrategyTag, string> = {
  Arbitrage: 'Exploit temporary Yes + No < 1.00 dislocations using live Polymarket markets',
  'Price Dislocation': 'Fade abrupt price moves on the live tape with paper capital only',
  'Market Maker': 'Paper-quote the tighter side on liquid live markets and recycle inventory',
};

function timeLabel(ts = Date.now()): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function seedProfitCurve(): ProfitPoint[] {
  const intervalMs = 15_000;
  return Array.from({ length: 30 }, (_, index) => ({
    day: timeLabel(Date.now() - (29 - index) * intervalMs),
    profit: 0,
  }));
}

function initialMarkets(): Market[] {
  return [
    {
      id: 'seed-btc-march',
      name: 'Waiting for live Polymarket markets...',
      yes: 0.5,
      no: 0.5,
      prevYes: 0.5,
      prevNo: 0.5,
      volume: 0,
      liquidity: 0,
      strategy: 'Market Maker',
      updatedAt: Date.now(),
    },
  ];
}

function positionId(marketId: string, side: 'Yes' | 'No'): string {
  return `${marketId}:${side}`;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundPrice(value: number): number {
  return Number(value.toFixed(4));
}

function roundSize(value: number): number {
  return Number(value.toFixed(4));
}

function positionLabel(side: 'Yes' | 'No', outcome: string): string {
  if (side === 'Yes') return outcome;
  return outcome;
}

export class AppStore extends EventEmitter {
  private engineState: EngineState = 'RUNNING';
  private profitCurve: ProfitPoint[] = seedProfitCurve();
  private markets: Market[] = initialMarkets();
  private fills: Fill[] = [];
  private positions: Position[] = [];
  private metrics: SystemMetric[] = Array.from({ length: 20 }, (_, i) => ({
    ts: Date.now() - (20 - i) * 1000,
    cpu: 38,
    memoryMb: 780,
    latency: 0,
  }));
  private logs: SystemLog[] = [
    {
      id: genId('log'),
      time: nowTimeString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Paper trader booted. Waiting for live Polymarket feed.',
      ts: Date.now(),
    },
  ];
  private strategies: StrategyConfig[] = [
    {
      name: 'Arbitrage',
      enabled: true,
      description: STRATEGY_DESCRIPTIONS.Arbitrage,
      params: { minEdge: 0.015, maxOrderSize: 1200 },
      updatedAt: Date.now(),
    },
    {
      name: 'Price Dislocation',
      enabled: true,
      description: STRATEGY_DESCRIPTIONS['Price Dislocation'],
      params: { triggerBps: 250, maxOrderSize: 900 },
      updatedAt: Date.now(),
    },
    {
      name: 'Market Maker',
      enabled: true,
      description: STRATEGY_DESCRIPTIONS['Market Maker'],
      params: { spreadBps: 80, quoteBudget: 450 },
      updatedAt: Date.now(),
    },
  ];
  private riskRules: RiskRule[] = [
    { name: 'max_position_usdc', value: 5000, enabled: true, updatedAt: Date.now() },
    { name: 'global_stop_loss_pct', value: 15, enabled: true, updatedAt: Date.now() },
    { name: 'max_orders_per_min', value: 180, enabled: true, updatedAt: Date.now() },
    { name: 'daily_loss_limit', value: 1000, enabled: true, updatedAt: Date.now() },
  ];
  private riskEvents: RiskEvent[] = [];
  private credentialStatus: CredentialStatus = { provider: 'polymarket', configured: false };
  private credentialCiphertext: string | null = null;
  private credentialKeyId: string | null = null;
  private marketMeta = new Map<string, MarketMeta>();
  private paperCash = roundMoney(env.paperStartingCash);
  private realizedPnlTotal = 0;
  private closedTradeCount = 0;
  private winningTradeCount = 0;
  private liveDataConnected = false;
  private liveFeedSource: 'gamma-api' | 'seed' = 'seed';
  private lastSyncAt: number | null = null;
  private lastLatencyMs: number | null = null;
  private lastLiveFailureAt = 0;

  constructor() {
    super();
    this.marketMeta.set('seed-btc-march', {
      yesTokenId: 'seed-yes',
      noTokenId: 'seed-no',
      yesOutcome: 'Yes',
      noOutcome: 'No',
      source: 'seed',
    });
  }

  getEngineState(): EngineState {
    return this.engineState;
  }

  getPaperTradingStatus(): PaperTradingStatus {
    return {
      mode: 'paper',
      liveDataConnected: this.liveDataConnected,
      lastSyncAt: this.lastSyncAt,
      lastLatencyMs: this.lastLatencyMs,
      source: this.liveFeedSource,
      marketCount: this.markets.length,
      cashBalance: roundMoney(this.paperCash),
      startingCash: env.paperStartingCash,
      totalEquity: roundMoney(this.getTotalEquity()),
    };
  }

  startEngine(): EngineState {
    if (this.engineState === 'RUNNING' || this.engineState === 'STARTING') {
      return this.engineState;
    }

    this.engineState = 'STARTING';
    this.emitEvent('engine.state', { state: this.engineState });
    this.pushLog('INFO', 'SYSTEM', 'Engine starting in paper-trading mode');

    setTimeout(() => {
      this.engineState = 'RUNNING';
      this.emitEvent('engine.state', { state: this.engineState });
      this.pushLog('INFO', 'SYSTEM', 'Engine is now running');
    }, 250);

    return this.engineState;
  }

  stopEngine(): EngineState {
    if (this.engineState === 'STOPPED' || this.engineState === 'STOPPING') {
      return this.engineState;
    }

    this.engineState = 'STOPPING';
    this.emitEvent('engine.state', { state: this.engineState });
    this.pushLog('INFO', 'SYSTEM', 'Engine stopping');

    setTimeout(() => {
      this.engineState = 'STOPPED';
      this.emitEvent('engine.state', { state: this.engineState });
      this.pushLog('INFO', 'SYSTEM', 'Engine stopped');
    }, 250);

    return this.engineState;
  }

  killSwitch(): EngineState {
    this.engineState = 'STOPPING';
    this.emitEvent('engine.state', { state: this.engineState });
    this.pushLog('WARN', 'RISK', 'Kill switch activated, paper strategies paused');

    setTimeout(() => {
      this.engineState = 'STOPPED';
      this.emitEvent('engine.state', { state: this.engineState });
      this.pushLog('INFO', 'SYSTEM', 'All paper strategies halted by kill switch');
    }, 100);

    return this.engineState;
  }

  getDashboardSummary() {
    const totalProfit = roundMoney(this.getTotalEquity() - env.paperStartingCash);
    const firstPoint = this.profitCurve[0]?.profit ?? 0;
    const lastPoint = this.profitCurve[this.profitCurve.length - 1]?.profit ?? totalProfit;
    const weeklyProfit = roundMoney(lastPoint - firstPoint);
    const openPnl = roundMoney(this.positions.reduce((sum, position) => sum + position.pnl, 0));
    const winRate = this.closedTradeCount > 0
      ? roundMoney((this.winningTradeCount / this.closedTradeCount) * 100)
      : 0;

    return {
      totalProfit,
      weeklyProfit,
      winRate,
      sharpeRatio: Number((1.2 + Math.min(Math.max(totalProfit / Math.max(env.paperStartingCash, 1), -1), 1) * 1.8).toFixed(2)),
      openPnl,
      tradesToday: this.fills.length,
      engineState: this.engineState,
      updatedAt: Date.now(),
    };
  }

  getProfitCurve(days = 50): ProfitPoint[] {
    return this.profitCurve.slice(-days);
  }

  getFills(limit = 50): Fill[] {
    return this.fills.slice(0, limit);
  }

  getPortfolioSummary(): { totalEquity: number; exposure: number; allocation: PortfolioAllocation[] } {
    const exposure = roundMoney(this.positions.reduce((sum, position) => sum + position.size * position.current, 0));
    const allocationByStrategy = new Map<string, number>();

    for (const position of this.positions) {
      const market = this.markets.find((item) => item.id === position.marketId);
      const bucket = market?.strategy ?? 'Market Maker';
      const notional = position.size * position.current;
      allocationByStrategy.set(bucket, (allocationByStrategy.get(bucket) ?? 0) + notional);
    }

    const allocation: PortfolioAllocation[] = [
      { name: 'USDC (Paper Cash)', value: roundMoney(this.paperCash) },
      { name: 'Active Arbitrage', value: roundMoney(allocationByStrategy.get('Arbitrage') ?? 0) },
      { name: 'Price Dislocation', value: roundMoney(allocationByStrategy.get('Price Dislocation') ?? 0) },
      { name: 'Market Making', value: roundMoney(allocationByStrategy.get('Market Maker') ?? 0) },
    ].filter((item) => item.value > 0 || item.name === 'USDC (Paper Cash)');

    return {
      totalEquity: roundMoney(this.getTotalEquity()),
      exposure,
      allocation,
    };
  }

  getPositions(): Position[] {
    return [...this.positions];
  }

  getMarkets(query?: { q?: string; strategy?: string; page?: number; pageSize?: number }) {
    let rows = [...this.markets];

    if (query?.q) {
      const keyword = query.q.toLowerCase();
      rows = rows.filter((market) => market.name.toLowerCase().includes(keyword));
    }

    if (query?.strategy && query.strategy !== 'All') {
      rows = rows.filter((market) => market.strategy === query.strategy);
    }

    const page = Math.max(1, query?.page ?? 1);
    const pageSize = clamp(query?.pageSize ?? 20, 1, 100);
    const start = (page - 1) * pageSize;

    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  }

  getOrderbook(marketId: string) {
    const market = this.markets.find((item) => item.id === marketId);
    if (!market) {
      return null;
    }

    const spread = Math.max(0.0025, Math.abs(1 - (market.yes + market.no)) / 2);
    const midpoint = market.yes;

    const bids = Array.from({ length: 5 }, (_, index) => ({
      price: roundPrice(clamp(midpoint - spread / 2 - index * 0.002, 0.001, 0.999)),
      size: Math.floor(150 + market.liquidity / 50 + index * 50),
    }));

    const asks = Array.from({ length: 5 }, (_, index) => ({
      price: roundPrice(clamp(midpoint + spread / 2 + index * 0.002, 0.001, 0.999)),
      size: Math.floor(150 + market.liquidity / 55 + index * 50),
    }));

    return {
      marketId: market.id,
      marketName: market.name,
      bids,
      asks,
      ts: Date.now(),
    };
  }

  getStrategies(): StrategyConfig[] {
    return [...this.strategies];
  }

  async updateStrategy(name: StrategyTag, enabled: boolean, params: Record<string, unknown>): Promise<StrategyConfig | null> {
    const found = this.strategies.find((strategy) => strategy.name === name);
    if (!found) {
      return null;
    }

    found.enabled = enabled;
    found.params = { ...found.params, ...params };
    found.updatedAt = Date.now();
    this.pushLog('INFO', 'STRATEGY', `Strategy ${name} updated: enabled=${enabled}`);
    this.emitEvent('strategies.updated', found);

    await repository.upsertStrategyConfig(name, enabled, found.params).catch(() => undefined);
    return found;
  }

  getRiskRules(): RiskRule[] {
    return [...this.riskRules];
  }

  getRiskEvents(limit = 100): RiskEvent[] {
    return this.riskEvents.slice(0, limit);
  }

  async updateRiskRule(name: RiskRule['name'], value: number, enabled: boolean): Promise<RiskRule | null> {
    const found = this.riskRules.find((rule) => rule.name === name);
    if (!found) {
      return null;
    }

    found.value = value;
    found.enabled = enabled;
    found.updatedAt = Date.now();
    this.pushLog('INFO', 'RISK', `Risk rule ${name} updated: value=${value}, enabled=${enabled}`);

    await repository.upsertRiskRule(name, value, enabled).catch(() => undefined);
    return found;
  }

  getMetrics(window = 300): SystemMetric[] {
    return this.metrics.slice(-window);
  }

  getLogs(limit = 200): SystemLog[] {
    return this.logs.slice(0, limit);
  }

  getCredentialStatus(): CredentialStatus {
    return { ...this.credentialStatus };
  }

  async getCredentialStatusResolved(): Promise<CredentialStatus> {
    if (this.credentialStatus.configured) {
      return this.getCredentialStatus();
    }

    const record = await repository.getCredential('polymarket').catch(() => null);
    if (!record) {
      return this.getCredentialStatus();
    }

    this.credentialCiphertext = record.ciphertext;
    this.credentialKeyId = record.keyId;
    this.credentialStatus = {
      provider: 'polymarket',
      configured: true,
      updatedAt: record.updatedAt,
    };

    return this.getCredentialStatus();
  }

  async getCredentialPayload(): Promise<{ keyId?: string; ciphertext: string } | null> {
    if (this.credentialCiphertext) {
      return {
        keyId: this.credentialKeyId ?? undefined,
        ciphertext: this.credentialCiphertext,
      };
    }

    const record = await repository.getCredential('polymarket').catch(() => null);
    if (!record) {
      return null;
    }

    this.credentialCiphertext = record.ciphertext;
    this.credentialKeyId = record.keyId;
    this.credentialStatus = {
      provider: 'polymarket',
      configured: true,
      updatedAt: record.updatedAt,
    };

    return {
      keyId: record.keyId ?? undefined,
      ciphertext: record.ciphertext,
    };
  }

  async saveCredential(payload: { keyId?: string; ciphertext: string }): Promise<CredentialStatus> {
    const updatedAt = Date.now();
    this.credentialStatus = {
      provider: 'polymarket',
      configured: true,
      updatedAt,
    };
    this.credentialCiphertext = payload.ciphertext;
    this.credentialKeyId = payload.keyId ?? null;

    this.pushLog('INFO', 'SYSTEM', 'Polymarket credentials updated');

    await repository
      .upsertCredential('polymarket', payload.keyId ?? null, payload.ciphertext)
      .catch(() => undefined);

    return this.getCredentialStatus();
  }

  applyLiveMarketSnapshots(snapshots: LiveMarketSnapshot[], latencyMs: number): void {
    if (snapshots.length === 0) {
      this.reportLiveSyncFailure('Gamma API returned zero live markets');
      return;
    }

    const previousById = new Map(this.markets.map((market) => [market.id, market]));
    const nextMarkets = snapshots.map((snapshot) => {
      const previous = previousById.get(snapshot.id);
      const next: Market = {
        id: snapshot.id,
        name: snapshot.name,
        yes: roundPrice(snapshot.yes),
        no: roundPrice(snapshot.no),
        prevYes: previous?.yes ?? roundPrice(snapshot.yes),
        prevNo: previous?.no ?? roundPrice(snapshot.no),
        volume: roundMoney(snapshot.volume),
        liquidity: roundMoney(snapshot.liquidity),
        strategy: this.classifyStrategy(snapshot, previous),
        updatedAt: snapshot.updatedAt,
      };

      this.marketMeta.set(snapshot.id, {
        yesTokenId: snapshot.yesTokenId,
        noTokenId: snapshot.noTokenId,
        yesOutcome: snapshot.yesOutcome,
        noOutcome: snapshot.noOutcome,
        source: 'gamma',
      });

      void repository.saveMarketSnapshot(next).catch(() => undefined);
      return next;
    });

    const firstLiveConnection = !this.liveDataConnected;
    this.markets = nextMarkets;
    this.liveDataConnected = true;
    this.liveFeedSource = 'gamma-api';
    this.lastSyncAt = Date.now();
    this.lastLatencyMs = latencyMs;

    this.maybeReduceRisk();

    if (this.engineState === 'RUNNING') {
      this.runPaperStrategies(nextMarkets);
    }

    this.markToMarketPositions();
    this.captureProfitPoint();
    this.checkRisk();

    this.emitEvent('markets.ticker', { items: this.markets, ts: Date.now() });
    this.emitEvent('portfolio.positions', this.positions);

    if (firstLiveConnection) {
      this.pushLog('INFO', 'SYSTEM', 'Live Polymarket feed connected. Execution stays in paper mode.');
    }
  }

  reportLiveSyncFailure(message: string): void {
    this.liveDataConnected = false;
    const now = Date.now();
    if (now - this.lastLiveFailureAt < 30_000) {
      return;
    }

    this.lastLiveFailureAt = now;
    this.pushLog('WARN', 'SYSTEM', `Live Polymarket sync degraded: ${message}`);
  }

  tick(): void {
    this.tickMetrics();

    if (this.engineState !== 'RUNNING') {
      return;
    }

    const staleFeed = !this.lastSyncAt || Date.now() - this.lastSyncAt > env.liveMarketRefreshMs * 3;
    if (staleFeed) {
      this.tickFallbackMarkets();
      this.maybeReduceRisk();
      this.runPaperStrategies(this.markets);
    }

    this.markToMarketPositions();
    this.captureProfitPoint();
    this.checkRisk();
  }

  private tickFallbackMarkets(): void {
    this.markets = this.markets.map((market) => {
      const volatility = market.strategy === 'Price Dislocation' ? 0.02 : 0.008;
      const yes = roundPrice(clamp(market.yes + (Math.random() - 0.5) * volatility, 0.001, 0.999));
      const no = roundPrice(clamp(1 - yes + (Math.random() - 0.5) * 0.004, 0.001, 0.999));
      const next: Market = {
        ...market,
        prevYes: market.yes,
        prevNo: market.no,
        yes,
        no,
        updatedAt: Date.now(),
      };

      void repository.saveMarketSnapshot(next).catch(() => undefined);
      return next;
    });

    this.emitEvent('markets.ticker', { items: this.markets, ts: Date.now() });
  }

  private classifyStrategy(snapshot: LiveMarketSnapshot, previous?: Market): StrategyTag {
    const parityGap = 1 - (snapshot.yes + snapshot.no);
    const priceMove = Math.abs(snapshot.yes - (previous?.yes ?? snapshot.yes));

    if (parityGap > 0.015) {
      return 'Arbitrage';
    }

    if (priceMove >= 0.02) {
      return 'Price Dislocation';
    }

    return snapshot.liquidity >= 750 ? 'Market Maker' : 'Arbitrage';
  }

  private runPaperStrategies(markets: Market[]): void {
    let fillsThisCycle = 0;

    for (const market of markets) {
      if (fillsThisCycle >= 4) {
        break;
      }

      const strategy = this.strategies.find((item) => item.name === market.strategy);
      if (!strategy?.enabled) {
        continue;
      }

      if (market.strategy === 'Arbitrage') {
        fillsThisCycle += this.tryArbitrageTrade(market, strategy.params);
        continue;
      }

      if (market.strategy === 'Price Dislocation') {
        fillsThisCycle += this.tryDislocationTrade(market, strategy.params);
        continue;
      }

      fillsThisCycle += this.tryMarketMakerTrade(market, strategy.params);
    }
  }

  private tryArbitrageTrade(market: Market, params: Record<string, unknown>): number {
    const edge = 1 - (market.yes + market.no);
    const minEdge = Number(params.minEdge ?? 0.015);
    if (edge < minEdge) {
      return 0;
    }

    const quoteBudget = Math.min(Number(params.maxOrderSize ?? 1200), this.paperCash * 0.16);
    if (quoteBudget < 50) {
      return 0;
    }

    const sideBudget = quoteBudget / 2;
    let fills = 0;
    fills += this.executePaperBuy(market, 'Yes', sideBudget, 'Arbitrage basket buy', 'Arbitrage') ? 1 : 0;
    fills += this.executePaperBuy(market, 'No', sideBudget, 'Arbitrage basket buy', 'Arbitrage') ? 1 : 0;
    return fills;
  }

  private tryDislocationTrade(market: Market, params: Record<string, unknown>): number {
    const triggerBps = Number(params.triggerBps ?? 250);
    const threshold = triggerBps / 10_000;
    const delta = market.yes - market.prevYes;
    if (Math.abs(delta) < threshold) {
      return 0;
    }

    const preferredSide: 'Yes' | 'No' = delta < 0 ? 'Yes' : 'No';
    const budget = Math.min(Number(params.maxOrderSize ?? 900), this.paperCash * 0.12);
    if (budget < 40) {
      return 0;
    }

    return this.executePaperBuy(market, preferredSide, budget, `Mean-reversion entry after ${(delta * 100).toFixed(2)}pt move`, 'Price Dislocation') ? 1 : 0;
  }

  private tryMarketMakerTrade(market: Market, params: Record<string, unknown>): number {
    const spreadBps = Number(params.spreadBps ?? 80) / 10_000;
    const quoteBudget = Math.min(Number(params.quoteBudget ?? 450), this.paperCash * 0.08);
    const parityGap = Math.abs(1 - (market.yes + market.no));
    const side: 'Yes' | 'No' = market.yes < market.no ? 'Yes' : 'No';

    if (quoteBudget < 30 || parityGap > spreadBps * 2 || market.liquidity < 500) {
      return 0;
    }

    return this.executePaperBuy(market, side, quoteBudget, 'Passive paper quote filled on liquid market', 'Market Maker') ? 1 : 0;
  }

  private maybeReduceRisk(): void {
    for (const position of [...this.positions]) {
      const pnlPct = position.entry > 0 ? (position.current - position.entry) / position.entry : 0;
      if (pnlPct >= 0.08 || pnlPct <= -0.06) {
        const market = this.markets.find((item) => item.id === position.marketId);
        if (!market) {
          continue;
        }

        const reason = pnlPct >= 0.08 ? 'Take profit' : 'Stop loss';
        this.executePaperSell(market, position.side, position.size, reason, market.strategy);
      }
    }
  }

  private executePaperBuy(
    market: Market,
    side: 'Yes' | 'No',
    desiredBudget: number,
    reason: string,
    strategyName: StrategyTag,
  ): boolean {
    const price = this.getSidePrice(market, side);
    if (price <= 0) {
      return false;
    }

    const currentExposure = this.getMarketExposure(market.id);
    const maxPositionRule = this.riskRules.find((rule) => rule.name === 'max_position_usdc');
    const remainingCapacity = Math.max(0, (maxPositionRule?.enabled ? maxPositionRule.value : Number.POSITIVE_INFINITY) - currentExposure);
    const budget = Math.min(desiredBudget, this.paperCash, remainingCapacity);

    if (budget < 20) {
      return false;
    }

    const shares = roundSize(budget / price);
    if (shares <= 0) {
      return false;
    }

    const cost = roundMoney(shares * price);
    if (cost <= 0 || cost > this.paperCash) {
      return false;
    }

    const id = positionId(market.id, side);
    const existing = this.positions.find((position) => position.id === id);
    const totalShares = (existing?.size ?? 0) + shares;
    const weightedEntry = existing
      ? ((existing.entry * existing.size) + cost) / Math.max(totalShares, 0.0001)
      : price;
    const nextCurrent = this.getSidePrice(market, side);
    const nextPnl = (nextCurrent - weightedEntry) * totalShares;
    const position: Position = {
      id,
      marketId: market.id,
      market: market.name,
      side,
      size: roundSize(totalShares),
      entry: roundPrice(weightedEntry),
      current: roundPrice(nextCurrent),
      pnl: roundMoney(nextPnl),
      realizedPnl: roundMoney(existing?.realizedPnl ?? 0),
      updatedAt: Date.now(),
    };

    this.paperCash = roundMoney(this.paperCash - cost);
    this.positions = [...this.positions.filter((item) => item.id !== id), position];
    this.recordFill(market, side, shares, price, 'BUY', reason, strategyName);
    void repository.upsertPosition(position).catch(() => undefined);
    this.emitEvent('portfolio.positions', this.positions);
    return true;
  }

  private executePaperSell(
    market: Market,
    side: 'Yes' | 'No',
    desiredShares: number,
    reason: string,
    strategyName: StrategyTag,
  ): boolean {
    const id = positionId(market.id, side);
    const existing = this.positions.find((position) => position.id === id);
    if (!existing) {
      return false;
    }

    const shares = roundSize(Math.min(existing.size, desiredShares));
    if (shares <= 0) {
      return false;
    }

    const price = this.getSidePrice(market, side);
    const proceeds = roundMoney(shares * price);
    const realized = roundMoney((price - existing.entry) * shares);
    const remainingShares = roundSize(existing.size - shares);

    this.paperCash = roundMoney(this.paperCash + proceeds);
    this.realizedPnlTotal = roundMoney(this.realizedPnlTotal + realized);
    this.closedTradeCount += 1;
    if (realized > 0) {
      this.winningTradeCount += 1;
    }

    if (remainingShares <= 0.0001) {
      this.positions = this.positions.filter((position) => position.id !== id);
    } else {
      const nextCurrent = this.getSidePrice(market, side);
      const remainingPosition: Position = {
        ...existing,
        size: remainingShares,
        current: roundPrice(nextCurrent),
        pnl: roundMoney((nextCurrent - existing.entry) * remainingShares),
        realizedPnl: roundMoney(existing.realizedPnl + realized),
        updatedAt: Date.now(),
      };
      this.positions = this.positions.map((position) => (position.id === id ? remainingPosition : position));
      void repository.upsertPosition(remainingPosition).catch(() => undefined);
    }

    this.recordFill(market, side, shares, price, 'SELL', reason, strategyName);
    this.emitEvent('portfolio.positions', this.positions);
    return true;
  }

  private markToMarketPositions(): void {
    this.positions = this.positions.map((position) => {
      const market = this.markets.find((item) => item.id === position.marketId);
      const current = market ? this.getSidePrice(market, position.side) : position.current;
      const next: Position = {
        ...position,
        current: roundPrice(current),
        pnl: roundMoney((current - position.entry) * position.size),
        updatedAt: Date.now(),
      };

      void repository.upsertPosition(next).catch(() => undefined);
      return next;
    });

    this.emitEvent('portfolio.positions', this.positions);
  }

  private checkRisk(): void {
    const maxDrawdownRule = this.riskRules.find((rule) => rule.name === 'global_stop_loss_pct');
    const dailyLossRule = this.riskRules.find((rule) => rule.name === 'daily_loss_limit');

    if (!maxDrawdownRule || !dailyLossRule || !maxDrawdownRule.enabled || !dailyLossRule.enabled) {
      return;
    }

    const openPnl = this.positions.reduce((sum, position) => sum + position.pnl, 0);
    const totalDrawdown = this.getTotalEquity() - env.paperStartingCash;
    if (openPnl > -1 * dailyLossRule.value && totalDrawdown > -1 * (env.paperStartingCash * maxDrawdownRule.value) / 100) {
      return;
    }

    const event: RiskEvent = {
      id: genId('risk'),
      eventType: 'DAILY_LOSS_LIMIT_TRIGGERED',
      severity: 'CRITICAL',
      message: `Paper account risk limit breached: openPnL=${openPnl.toFixed(2)}, equityPnL=${totalDrawdown.toFixed(2)}`,
      context: {
        openPnl,
        totalDrawdown,
        dailyLossLimit: dailyLossRule.value,
        maxDrawdownPct: maxDrawdownRule.value,
      },
      createdAt: Date.now(),
    };

    const existing = this.riskEvents[0];
    if (existing && existing.message === event.message && Date.now() - existing.createdAt < 60_000) {
      return;
    }

    this.riskEvents = [event, ...this.riskEvents].slice(0, 100);
    this.emitEvent('risk.alerts', event);
    this.pushLog('WARN', 'RISK', event.message);
    void repository.saveRiskEvent(event).catch(() => undefined);

    this.engineState = 'DEGRADING';
    this.emitEvent('engine.state', { state: this.engineState, reason: 'risk_limit' });
  }

  private tickMetrics(): void {
    const last = this.metrics[this.metrics.length - 1];
    const cpu = clamp((last?.cpu ?? 38) + (Math.random() - 0.5) * 9, 8, 92);
    const memoryMb = clamp((last?.memoryMb ?? 780) + (Math.random() - 0.5) * 35, 500, 3200);
    const baselineLatency = this.lastLatencyMs ?? last?.latency ?? 0;
    const latency = clamp(baselineLatency + (Math.random() - 0.5) * 6, 0, 250);

    const metric: SystemMetric = {
      ts: Date.now(),
      cpu: roundMoney(cpu),
      memoryMb: roundMoney(memoryMb),
      latency: roundMoney(latency),
    };

    this.metrics = [...this.metrics.slice(-299), metric];
    this.emitEvent('system.metrics', metric);
    void repository.saveMetric(metric).catch(() => undefined);
  }

  private captureProfitPoint(): void {
    const profit = roundMoney(this.getTotalEquity() - env.paperStartingCash);
    const nextPoint: ProfitPoint = {
      day: timeLabel(),
      profit,
    };

    const last = this.profitCurve[this.profitCurve.length - 1];
    if (last && last.day === nextPoint.day) {
      this.profitCurve = [...this.profitCurve.slice(0, -1), nextPoint];
      return;
    }

    this.profitCurve = [...this.profitCurve.slice(-49), nextPoint];
  }

  private getMarketExposure(marketId: string): number {
    return this.positions
      .filter((position) => position.marketId === marketId)
      .reduce((sum, position) => sum + position.size * position.current, 0);
  }

  private getSidePrice(market: Market, side: 'Yes' | 'No'): number {
    return side === 'Yes' ? market.yes : market.no;
  }

  private getTotalEquity(): number {
    const inventoryValue = this.positions.reduce((sum, position) => sum + position.size * position.current, 0);
    return this.paperCash + inventoryValue;
  }

  private recordFill(
    market: Market,
    side: 'Yes' | 'No',
    size: number,
    price: number,
    action: 'BUY' | 'SELL',
    reason: string,
    strategyName: StrategyTag,
  ): void {
    const fill: Fill = {
      id: genId('fill'),
      time: nowTimeString(),
      marketId: market.id,
      market: market.name,
      side,
      price: roundPrice(price),
      size: roundSize(size),
      fee: roundMoney(size * price * 0.001),
      ts: Date.now(),
    };

    this.fills = [fill, ...this.fills].slice(0, 100);
    this.emitEvent('fills.recent', fill);

    const meta = this.marketMeta.get(market.id);
    const outcome = side === 'Yes' ? meta?.yesOutcome ?? positionLabel(side, 'Yes') : meta?.noOutcome ?? positionLabel(side, 'No');
    this.pushLog(
      'INFO',
      'EXECUTE',
      `PAPER ${action}: ${side} (${outcome}) ${fill.size} @ ${fill.price.toFixed(3)} on ${market.name} via ${strategyName}. ${reason}`,
    );

    void repository.saveFill(fill).catch(() => undefined);
  }

  private pushLog(level: SystemLog['level'], category: SystemLog['category'], message: string): void {
    const log: SystemLog = {
      id: genId('log'),
      time: nowTimeString(),
      level,
      category,
      message,
      ts: Date.now(),
    };

    this.logs = [log, ...this.logs].slice(0, 500);
    this.emitEvent('system.logs', log);
    void repository.saveSystemLog(log).catch(() => undefined);
  }

  private emitEvent(channel: string, data: unknown): void {
    this.emit('ws:event', {
      channel,
      ts: Date.now(),
      data,
    });
  }
}

export const appStore = new AppStore();
