export type EngineState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'DEGRADING' | 'STOPPING';

export type StrategyTag = 'Arbitrage' | 'Price Dislocation' | 'Market Maker';

export type Side = 'Yes' | 'No';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Market {
  id: string;
  name: string;
  yes: number;
  no: number;
  prevYes: number;
  prevNo: number;
  volume: number;
  liquidity: number;
  strategy: StrategyTag;
  updatedAt: number;
}

export interface Fill {
  id: string;
  time: string;
  marketId: string;
  market: string;
  side: Side;
  price: number;
  size: number;
  fee: number;
  ts: number;
}

export interface Position {
  id: string;
  marketId: string;
  market: string;
  side: Side;
  size: number;
  entry: number;
  current: number;
  pnl: number;
  realizedPnl: number;
  updatedAt: number;
}

export interface StrategyConfig {
  name: StrategyTag;
  enabled: boolean;
  description: string;
  params: Record<string, unknown>;
  updatedAt: number;
}

export interface RiskRule {
  name: 'max_position_usdc' | 'global_stop_loss_pct' | 'max_orders_per_min' | 'daily_loss_limit';
  value: number;
  enabled: boolean;
  updatedAt: number;
}

export interface RiskEvent {
  id: string;
  eventType: string;
  severity: Severity;
  message: string;
  context: Record<string, unknown>;
  createdAt: number;
}

export interface SystemMetric {
  ts: number;
  cpu: number;
  memoryMb: number;
  latency: number;
}

export interface SystemLog {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: 'SYSTEM' | 'STRATEGY' | 'EXECUTE' | 'RISK';
  message: string;
  ts: number;
}

export interface ProfitPoint {
  day: string;
  profit: number;
}

export interface PortfolioAllocation {
  name: string;
  value: number;
}

export interface CredentialStatus {
  provider: 'polymarket';
  configured: boolean;
  updatedAt?: number;
}

export interface WsEnvelope<T = unknown> {
  channel: string;
  ts: number;
  data: T;
}
