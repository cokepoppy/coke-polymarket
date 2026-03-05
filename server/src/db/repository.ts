import { mysqlClient } from './mysql.js';
import type { Fill, Market, Position, RiskEvent, SystemLog, SystemMetric } from '../types/domain.js';

class Repository {
  async saveMarketSnapshot(market: Market): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO market_snapshots (market_id, market_name, yes_price, no_price, volume_24h, liquidity, strategy_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [market.id, market.name, market.yes, market.no, market.volume, market.liquidity, market.strategy],
    );
  }

  async saveFill(fill: Fill): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO fills (market_id, market_name, side, price, size, fee, filled_at)
       VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
      [fill.marketId, fill.market, fill.side, fill.price, fill.size, fill.fee, Math.floor(fill.ts / 1000)],
    );
  }

  async upsertPosition(position: Position): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO positions (id, market_id, market_name, side, size, entry_price, current_price, unrealized_pnl, realized_pnl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         market_name=VALUES(market_name),
         side=VALUES(side),
         size=VALUES(size),
         entry_price=VALUES(entry_price),
         current_price=VALUES(current_price),
         unrealized_pnl=VALUES(unrealized_pnl),
         realized_pnl=VALUES(realized_pnl)`,
      [
        position.id,
        position.marketId,
        position.market,
        position.side,
        position.size,
        position.entry,
        position.current,
        position.pnl,
        position.realizedPnl,
      ],
    );
  }

  async saveRiskEvent(event: RiskEvent): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO risk_events (event_type, severity, message, context_json, created_at)
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
      [event.eventType, event.severity, event.message, JSON.stringify(event.context), Math.floor(event.createdAt / 1000)],
    );
  }

  async saveMetric(metric: SystemMetric): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO system_metrics (cpu_pct, mem_mb, api_latency_ms, recorded_at)
       VALUES (?, ?, ?, FROM_UNIXTIME(?))`,
      [metric.cpu, metric.memoryMb, metric.latency, Math.floor(metric.ts / 1000)],
    );
  }

  async saveSystemLog(log: SystemLog): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO system_logs (level, category, message, context_json, created_at)
       VALUES (?, ?, ?, NULL, FROM_UNIXTIME(?))`,
      [log.level, log.category, log.message, Math.floor(log.ts / 1000)],
    );
  }

  async upsertStrategyConfig(name: string, enabled: boolean, params: Record<string, unknown>): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO strategy_configs (strategy_name, enabled, params_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE enabled=VALUES(enabled), params_json=VALUES(params_json)`,
      [name, enabled, JSON.stringify(params)],
    );
  }

  async upsertRiskRule(name: string, value: number, enabled: boolean): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO risk_rules (rule_name, rule_value, enabled)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rule_value=VALUES(rule_value), enabled=VALUES(enabled)`,
      [name, String(value), enabled],
    );
  }

  async upsertCredential(provider: string, keyId: string | null, ciphertext: string): Promise<void> {
    await mysqlClient.execute(
      `INSERT INTO api_credentials (provider, key_id, ciphertext)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE key_id=VALUES(key_id), ciphertext=VALUES(ciphertext)`,
      [provider, keyId, ciphertext],
    );
  }
}

export const repository = new Repository();
