import { EventEmitter } from 'node:events';
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
import { clamp, genId, nowTimeString, randomBetween } from './utils.js';
import { repository } from '../db/repository.js';

const STRATEGY_DESCRIPTIONS: Record<StrategyTag, string> = {
  Arbitrage: 'Exploit brief Yes + No < 1.00 opportunities',
  'Price Dislocation': 'Capture short-term pricing dislocation windows',
  'Market Maker': 'Provide two-sided quotes and earn spread',
};

function generateProfitCurve(days = 50): ProfitPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    day: `Day ${i + 1}`,
    profit: Math.floor(9000 + i * randomBetween(1200, 2600)),
  }));
}

function initialMarkets(): Market[] {
  return [
    {
      id: 'mkt-btc-100k-mar',
      name: 'Will BTC hit $100k in March?',
      yes: 0.45,
      no: 0.53,
      prevYes: 0.45,
      prevNo: 0.53,
      volume: 1_200_000,
      liquidity: 450_000,
      strategy: 'Arbitrage',
      updatedAt: Date.now(),
    },
    {
      id: 'mkt-eth-15m-up',
      name: 'ETH 15m Price Up?',
      yes: 0.82,
      no: 0.16,
      prevYes: 0.82,
      prevNo: 0.16,
      volume: 450_000,
      liquidity: 120_000,
      strategy: 'Price Dislocation',
      updatedAt: Date.now(),
    },
    {
      id: 'mkt-fed-cut-jun',
      name: 'Fed Rate Cut in June?',
      yes: 0.31,
      no: 0.68,
      prevYes: 0.31,
      prevNo: 0.68,
      volume: 3_500_000,
      liquidity: 1_100_000,
      strategy: 'Market Maker',
      updatedAt: Date.now(),
    },
    {
      id: 'mkt-sol-200-fri',
      name: 'SOL > $200 by Friday?',
      yes: 0.5,
      no: 0.49,
      prevYes: 0.5,
      prevNo: 0.49,
      volume: 890_000,
      liquidity: 340_000,
      strategy: 'Arbitrage',
      updatedAt: Date.now(),
    },
    {
      id: 'mkt-openai-release',
      name: 'OpenAI launches new flagship model this quarter?',
      yes: 0.72,
      no: 0.27,
      prevYes: 0.72,
      prevNo: 0.27,
      volume: 2_100_000,
      liquidity: 800_000,
      strategy: 'Market Maker',
      updatedAt: Date.now(),
    },
    {
      id: 'mkt-us-election-dem',
      name: 'US Election: Democratic Nominee?',
      yes: 0.51,
      no: 0.48,
      prevYes: 0.51,
      prevNo: 0.48,
      volume: 15_200_000,
      liquidity: 5_500_000,
      strategy: 'Arbitrage',
      updatedAt: Date.now(),
    },
  ];
}

function initialPositions(): Position[] {
  return [
    {
      id: 'pos1',
      marketId: 'mkt-btc-100k-mar',
      market: 'BTC 100k March',
      side: 'Yes',
      size: 5000,
      entry: 0.42,
      current: 0.45,
      pnl: 150,
      realizedPnl: 0,
      updatedAt: Date.now(),
    },
    {
      id: 'pos2',
      marketId: 'mkt-fed-cut-jun',
      market: 'Fed Rate Cut',
      side: 'No',
      size: 12000,
      entry: 0.65,
      current: 0.68,
      pnl: 360,
      realizedPnl: 0,
      updatedAt: Date.now(),
    },
    {
      id: 'pos3',
      marketId: 'mkt-eth-15m-up',
      market: 'ETH 15m Up',
      side: 'Yes',
      size: 2500,
      entry: 0.8,
      current: 0.82,
      pnl: 50,
      realizedPnl: 0,
      updatedAt: Date.now(),
    },
  ];
}

export class AppStore extends EventEmitter {
  private engineState: EngineState = 'RUNNING';
  private profitCurve: ProfitPoint[] = generateProfitCurve(50);
  private markets: Market[] = initialMarkets();
  private fills: Fill[] = [];
  private positions: Position[] = initialPositions();
  private metrics: SystemMetric[] = Array.from({ length: 20 }, (_, i) => ({
    ts: Date.now() - (20 - i) * 1000,
    cpu: 45,
    memoryMb: 2400,
    latency: 12,
  }));
  private logs: SystemLog[] = [
    {
      id: genId('log'),
      time: nowTimeString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Connected to Polymarket API Node (Latency: 12ms)',
      ts: Date.now(),
    },
    {
      id: genId('log'),
      time: nowTimeString(),
      level: 'INFO',
      category: 'STRATEGY',
      message: 'Scanning for Math Parity Arbitrage opportunities...',
      ts: Date.now(),
    },
  ];

  private strategies: StrategyConfig[] = [
    {
      name: 'Arbitrage',
      enabled: true,
      description: STRATEGY_DESCRIPTIONS.Arbitrage,
      params: { minSpread: 0.003, maxOrderSize: 1200 },
      updatedAt: Date.now(),
    },
    {
      name: 'Price Dislocation',
      enabled: true,
      description: STRATEGY_DESCRIPTIONS['Price Dislocation'],
      params: { lookbackSeconds: 30, triggerBps: 35 },
      updatedAt: Date.now(),
    },
    {
      name: 'Market Maker',
      enabled: false,
      description: STRATEGY_DESCRIPTIONS['Market Maker'],
      params: { spreadBps: 25, quoteRefreshMs: 500 },
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

  getEngineState(): EngineState {
    return this.engineState;
  }

  startEngine(): EngineState {
    if (this.engineState === 'RUNNING' || this.engineState === 'STARTING') {
      return this.engineState;
    }

    this.engineState = 'STARTING';
    this.emitEvent('engine.state', { state: this.engineState });
    this.pushLog('INFO', 'SYSTEM', 'Engine starting');

    setTimeout(() => {
      this.engineState = 'RUNNING';
      this.emitEvent('engine.state', { state: this.engineState });
      this.pushLog('INFO', 'SYSTEM', 'Engine is now running');
    }, 500);

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
    }, 400);

    return this.engineState;
  }

  killSwitch(): EngineState {
    this.engineState = 'STOPPING';
    this.emitEvent('engine.state', { state: this.engineState });
    this.pushLog('WARN', 'RISK', 'Kill switch activated, canceling all active strategies');

    setTimeout(() => {
      this.engineState = 'STOPPED';
      this.emitEvent('engine.state', { state: this.engineState });
      this.pushLog('INFO', 'SYSTEM', 'All strategies halted by kill switch');
    }, 100);

    return this.engineState;
  }

  getDashboardSummary() {
    const totalProfit = this.profitCurve[this.profitCurve.length - 1]?.profit ?? 0;
    const weeklySlice = this.profitCurve.slice(-7);
    let weeklyProfit = 0;
    for (let i = 1; i < weeklySlice.length; i += 1) {
      const prev = weeklySlice[i - 1];
      const current = weeklySlice[i];
      if (!prev || !current) continue;
      weeklyProfit += current.profit - prev.profit;
    }

    const totalTrades = this.fills.length + 142;
    const openPnl = this.positions.reduce((sum, p) => sum + p.pnl, 0);

    return {
      totalProfit,
      weeklyProfit,
      winRate: 68.4,
      sharpeRatio: 3.2,
      openPnl,
      tradesToday: totalTrades,
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
    const exposure = this.positions.reduce((sum, p) => sum + p.size, 0);
    const activeArbitrage = this.positions
      .filter((p) => p.market.toLowerCase().includes('btc') || p.market.toLowerCase().includes('fed'))
      .reduce((sum, p) => sum + p.size * 0.35, 0);
    const marketMaking = this.positions.reduce((sum, p) => sum + p.size * 0.18, 0);
    const idle = Math.max(0, 15000 - exposure * 0.2);
    const totalEquity = idle + activeArbitrage + marketMaking;

    return {
      totalEquity,
      exposure,
      allocation: [
        { name: 'USDC (Idle)', value: Number(idle.toFixed(2)) },
        { name: 'Active Arbitrage', value: Number(activeArbitrage.toFixed(2)) },
        { name: 'Market Making', value: Number(marketMaking.toFixed(2)) },
      ],
    };
  }

  getPositions(): Position[] {
    return [...this.positions];
  }

  getMarkets(query?: { q?: string; strategy?: string; page?: number; pageSize?: number }) {
    let rows = [...this.markets];

    if (query?.q) {
      const keyword = query.q.toLowerCase();
      rows = rows.filter((m) => m.name.toLowerCase().includes(keyword));
    }

    if (query?.strategy && query.strategy !== 'All') {
      rows = rows.filter((m) => m.strategy === query.strategy);
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
    const market = this.markets.find((m) => m.id === marketId);
    if (!market) {
      return null;
    }

    const bidBase = market.yes;
    const askBase = market.no;

    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: Number(clamp(bidBase - i * 0.003, 0.001, 0.999).toFixed(4)),
      size: Math.floor(randomBetween(100, 1200)),
    }));

    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: Number(clamp(askBase + i * 0.003, 0.001, 0.999).toFixed(4)),
      size: Math.floor(randomBetween(100, 1200)),
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
    const found = this.strategies.find((s) => s.name === name);
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
    const found = this.riskRules.find((r) => r.name === name);
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

  async saveCredential(payload: { keyId?: string; apiKey: string }): Promise<CredentialStatus> {
    const updatedAt = Date.now();
    this.credentialStatus = {
      provider: 'polymarket',
      configured: true,
      updatedAt,
    };

    this.pushLog('INFO', 'SYSTEM', 'Polymarket credentials updated');

    await repository
      .upsertCredential('polymarket', payload.keyId ?? null, payload.apiKey)
      .catch(() => undefined);

    return this.getCredentialStatus();
  }

  tick(): void {
    if (this.engineState !== 'RUNNING') {
      return;
    }

    this.tickMarkets();
    this.tickFillsAndLogs();
    this.tickMetrics();
    this.tickPositions();
    this.checkRisk();
  }

  private tickMarkets(): void {
    const updated = this.markets.map((market) => {
      if (Math.random() > 0.7) {
        return market;
      }

      const volatility = market.strategy === 'Price Dislocation' ? 0.04 : 0.015;
      let newYes = clamp(market.yes + (Math.random() - 0.5) * volatility, 0.001, 0.999);
      let newNo = clamp(market.no + (Math.random() - 0.5) * volatility, 0.001, 0.999);

      if (Math.random() > 0.85 && market.strategy === 'Arbitrage') {
        newYes = clamp(newYes - 0.012, 0.001, 0.999);
        newNo = clamp(newNo - 0.012, 0.001, 0.999);
      } else if (market.strategy !== 'Arbitrage') {
        const sum = newYes + newNo;
        newYes /= sum;
        newNo /= sum;
      }

      const next: Market = {
        ...market,
        prevYes: market.yes,
        prevNo: market.no,
        yes: Number(newYes.toFixed(4)),
        no: Number(newNo.toFixed(4)),
        updatedAt: Date.now(),
      };

      void repository.saveMarketSnapshot(next).catch(() => undefined);
      return next;
    });

    this.markets = updated;
    this.emitEvent('markets.ticker', {
      items: updated,
      ts: Date.now(),
    });
  }

  private tickFillsAndLogs(): void {
    if (Math.random() > 0.6) {
      const randomMarket = this.markets[Math.floor(Math.random() * this.markets.length)];
      if (!randomMarket) {
        return;
      }

      const side: 'Yes' | 'No' = Math.random() > 0.5 ? 'Yes' : 'No';
      const price = side === 'Yes' ? randomMarket.yes : randomMarket.no;
      const size = Math.floor(Math.random() * 500) * 10 + 100;
      const fill: Fill = {
        id: genId('fill'),
        time: nowTimeString(),
        marketId: randomMarket.id,
        market: randomMarket.name,
        side,
        price,
        size,
        fee: Number((size * price * 0.001).toFixed(2)),
        ts: Date.now(),
      };

      this.fills = [fill, ...this.fills].slice(0, 100);
      this.emitEvent('fills.recent', fill);
      this.pushLog(
        'INFO',
        'EXECUTE',
        `FILLED: Buy ${size} ${side} @ $${price.toFixed(3)} on ${randomMarket.name}`,
      );

      void repository.saveFill(fill).catch(() => undefined);
      return;
    }

    const market = this.markets[Math.floor(Math.random() * Math.min(3, this.markets.length))];
    if (!market) {
      return;
    }

    this.pushLog('INFO', 'STRATEGY', `Analyzing orderbook depth for ${market.name}...`);
  }

  private tickMetrics(): void {
    const last = this.metrics[this.metrics.length - 1];
    const cpu = clamp((last?.cpu ?? 45) + (Math.random() - 0.5) * 15, 10, 95);
    const latency = clamp((last?.latency ?? 12) + (Math.random() - 0.5) * 8, 5, 150);
    const memoryMb = clamp((last?.memoryMb ?? 2400) + (Math.random() - 0.5) * 60, 1800, 7900);

    const metric: SystemMetric = {
      ts: Date.now(),
      cpu: Number(cpu.toFixed(2)),
      latency: Number(latency.toFixed(2)),
      memoryMb: Number(memoryMb.toFixed(2)),
    };

    this.metrics = [...this.metrics.slice(-299), metric];
    this.emitEvent('system.metrics', metric);
    void repository.saveMetric(metric).catch(() => undefined);
  }

  private tickPositions(): void {
    this.positions = this.positions.map((position) => {
      const current = clamp(position.current + (Math.random() - 0.5) * 0.01, 0.001, 0.999);
      const pnl = position.pnl + (Math.random() - 0.5) * 20;
      const next: Position = {
        ...position,
        current: Number(current.toFixed(4)),
        pnl: Number(pnl.toFixed(2)),
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

    const openPnl = this.positions.reduce((sum, p) => sum + p.pnl, 0);
    if (openPnl >= -1 * dailyLossRule.value) {
      return;
    }

    const event: RiskEvent = {
      id: genId('risk'),
      eventType: 'DAILY_LOSS_LIMIT_TRIGGERED',
      severity: 'CRITICAL',
      message: `Daily loss limit breached: openPnL=${openPnl.toFixed(2)} <= -${dailyLossRule.value}`,
      context: {
        openPnl,
        dailyLossLimit: dailyLossRule.value,
        maxDrawdownPct: maxDrawdownRule.value,
      },
      createdAt: Date.now(),
    };

    this.riskEvents = [event, ...this.riskEvents].slice(0, 100);
    this.emitEvent('risk.alerts', event);
    this.pushLog('WARN', 'RISK', event.message);
    void repository.saveRiskEvent(event).catch(() => undefined);

    this.engineState = 'DEGRADING';
    this.emitEvent('engine.state', { state: this.engineState, reason: 'risk_limit' });
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
