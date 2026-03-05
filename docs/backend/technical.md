# 后端技术方案（Express + TypeScript + MySQL + Docker）

## 1. 技术选型

- Runtime: `Node.js 20 LTS`
- Web Framework: `Express 4.x`
- Language: `TypeScript 5.x`
- DB: `MySQL 8.0`（Docker）
- ORM: `Prisma`（推荐）或 `Drizzle`（可选）
- Validation: `zod`
- Real-time: `ws` 或 `socket.io`（建议 `ws`，协议更轻）
- Scheduler: `node-cron`（MVP）
- Logging: `pino`
- Metrics: `prom-client` + `/metrics`

## 2. 推荐目录结构

```txt
server/
  src/
    app.ts
    server.ts
    config/
      env.ts
      logger.ts
    modules/
      market/
        market.controller.ts
        market.service.ts
        market.repo.ts
        market.ws.ts
      strategy/
      execution/
      portfolio/
      risk/
      system/
      settings/
    connectors/
      polymarket/
        gamma.client.ts
        data.client.ts
        clob.client.ts
        signer.ts
    infra/
      db/
        prisma.ts
      queue/
      cache/
    shared/
      errors/
      types/
      utils/
  prisma/
    schema.prisma
  docker-compose.yml
  Dockerfile
```

## 3. MySQL 数据模型（核心表）

### 3.1 交易与仓位

- `orders`
  - `id`, `client_order_id`, `market_id`, `side`, `price`, `size`, `status`, `created_at`, `updated_at`
- `fills`
  - `id`, `order_id`, `market_id`, `fill_price`, `fill_size`, `fee`, `filled_at`
- `positions`
  - `id`, `market_id`, `side`, `avg_entry_price`, `size`, `unrealized_pnl`, `realized_pnl`, `updated_at`

### 3.2 行情与分析

- `market_snapshots`
  - `id`, `market_id`, `yes_price`, `no_price`, `volume_24h`, `liquidity`, `snapshot_at`
- `portfolio_snapshots`
  - `id`, `equity`, `available_cash`, `exposure`, `snapshot_at`
- `pnl_daily`
  - `id`, `date`, `realized_pnl`, `unrealized_pnl`, `total_pnl`

### 3.3 策略与风控

- `strategy_configs`
  - `id`, `strategy_name`, `enabled`, `params_json`, `updated_at`
- `strategy_signals`
  - `id`, `strategy_name`, `market_id`, `signal_type`, `confidence`, `payload_json`, `created_at`
- `risk_rules`
  - `id`, `rule_name`, `rule_value`, `enabled`, `updated_at`
- `risk_events`
  - `id`, `event_type`, `severity`, `message`, `context_json`, `created_at`

### 3.4 系统与审计

- `system_metrics`
  - `id`, `cpu_pct`, `mem_mb`, `api_latency_ms`, `recorded_at`
- `system_logs`
  - `id`, `level`, `category`, `message`, `context_json`, `created_at`
- `api_credentials`
  - `id`, `provider`, `key_id`, `ciphertext`, `created_at`

## 4. API 设计（v1）

Base: `/api/v1`

### 4.1 Engine

- `GET /engine/state`
- `POST /engine/start`
- `POST /engine/stop`
- `POST /engine/kill-switch`

### 4.2 Dashboard / Portfolio

- `GET /dashboard/summary`
- `GET /dashboard/profit-curve?days=50`
- `GET /trades/fills?limit=50`
- `GET /portfolio/summary`
- `GET /portfolio/positions`

### 4.3 Markets / Strategies / Risk

- `GET /markets?q=&strategy=&page=&pageSize=`
- `GET /markets/:marketId/orderbook`
- `GET /strategies`
- `PUT /strategies/:strategyName/config`
- `GET /risk/rules`
- `PUT /risk/rules`
- `GET /risk/events?limit=100`

### 4.4 System / Settings

- `GET /system/metrics?window=5m`
- `GET /system/logs?level=&limit=`
- `PUT /settings/credentials/polymarket`
- `GET /healthz`
- `GET /readyz`

## 5. WebSocket 事件契约

WS Endpoint: `/ws`

事件封装：

```json
{
  "channel": "markets.ticker",
  "ts": 1760000000000,
  "data": {}
}
```

频道建议：

- `markets.ticker`：市场价格、套利差值
- `fills.recent`：最近成交
- `portfolio.positions`：仓位变更
- `system.metrics`：CPU/延迟
- `system.logs`：日志尾流
- `engine.state`：引擎状态
- `risk.alerts`：风控告警

## 6. Docker Compose（MVP）

```yaml
version: "3.9"
services:
  mysql:
    image: mysql:8.0
    container_name: openclaw-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: openclaw
      MYSQL_USER: app
      MYSQL_PASSWORD: app123
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: ["--default-authentication-plugin=mysql_native_password"]

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: openclaw-api
    depends_on:
      - mysql
    environment:
      NODE_ENV: production
      PORT: 8080
      DATABASE_URL: mysql://app:app123@mysql:3306/openclaw
    ports:
      - "8080:8080"

volumes:
  mysql_data:
```

## 7. 与前端联调契约

- 前端首次加载使用 REST 拉取初始快照。
- 加载完成后建立 WS，增量更新 UI。
- 当 WS 断开时回退到轮询（5~10 秒）。
- 所有金额字段统一使用字符串或 Decimal（避免浮点误差）。

## 8. 安全与稳定性

- API Key/私钥只在后端处理，不落前端。
- `api_credentials.ciphertext` 必须加密存储（KMS 或应用层 AES-GCM）。
- 所有下单接口要求幂等键（`X-Idempotency-Key`）。
- 对外接口限流（IP + user 维度）。
- 引擎控制接口（start/stop/kill）必须带鉴权与审计。

## 9. 实施顺序

1. 建库与迁移（Prisma schema + migration）
2. 搭建 Express 模块骨架 + `healthz/readyz`
3. 打通 `markets`、`dashboard`、`portfolio` 只读链路
4. 接入 WS 推送
5. 加入策略配置与风险规则
6. 最后接入真实执行路径（先小额、先白名单市场）

## 10. 调研参考

- Polymarket Docs: https://docs.polymarket.com/
- Polymarket CLOB API: https://docs.polymarket.com/developers/CLOB/introduction
- Polymarket WebSocket WSS: https://docs.polymarket.com/developers/CLOB/websocket/wss-overview
- Polymarket Data API: https://docs.polymarket.com/developers/data-api/introduction
