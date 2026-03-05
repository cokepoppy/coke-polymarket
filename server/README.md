# OpenClaw Backend

Express + TypeScript backend for the OpenClaw dashboard, with MySQL (Docker) and WebSocket streams.

## 1. Quick Start

```bash
cd server
cp .env.example .env
npm install
docker compose up -d mysql
npm run dev
```

Default API base: `http://localhost:8080/api/v1`  
WS endpoint: `ws://localhost:8080/ws`

## 2. Environment Variables

See `.env.example`.

Key variables:
- `PORT` (default `8080`)
- `API_PREFIX` (default `/api/v1`)
- `MYSQL_ENABLED` (set `false` to run pure in-memory)
- `AUTO_MIGRATE` (run `sql/init.sql` automatically when MySQL is ready)
- `APP_SECRET` (used to encrypt credential payloads)

## 3. Project Structure

```txt
server/
  src/
    app.ts
    server.ts
    modules/...
    ws/hub.ts
    shared/store.ts
    db/{mysql.ts,migrate.ts,repository.ts}
  sql/init.sql
  docker-compose.yml
```

## 4. API Overview

- `GET /healthz`
- `GET /readyz`
- `GET /api/v1/engine/state`
- `POST /api/v1/engine/start`
- `POST /api/v1/engine/stop`
- `POST /api/v1/engine/kill-switch`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/profit-curve?days=50`
- `GET /api/v1/trades/fills?limit=50`
- `GET /api/v1/portfolio/summary`
- `GET /api/v1/portfolio/positions`
- `GET /api/v1/markets?q=&strategy=&page=&pageSize=`
- `GET /api/v1/markets/:marketId/orderbook`
- `GET /api/v1/strategies`
- `PUT /api/v1/strategies/:strategyName/config`
- `GET /api/v1/risk/rules`
- `PUT /api/v1/risk/rules`
- `GET /api/v1/risk/events?limit=100`
- `GET /api/v1/system/metrics?window=5m`
- `GET /api/v1/system/logs?limit=200`
- `GET /api/v1/settings/credentials/polymarket`
- `PUT /api/v1/settings/credentials/polymarket`

## 5. WS Channels

WS message envelope:

```json
{
  "channel": "markets.ticker",
  "ts": 1760000000000,
  "data": {}
}
```

Published channels:
- `engine.state`
- `markets.ticker`
- `fills.recent`
- `portfolio.positions`
- `system.metrics`
- `system.logs`
- `risk.alerts`
- `strategies.updated`

## 6. Validation

```bash
npm run lint
npm run build
```

## 7. Notes

- If MySQL credentials are not ready, service automatically falls back to in-memory mode.
- Port conflict (`EADDRINUSE`) means another process is already using your configured `PORT`.
