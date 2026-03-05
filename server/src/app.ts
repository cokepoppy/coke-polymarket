import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { engineRouter } from './modules/engine/router.js';
import { dashboardRouter } from './modules/dashboard/router.js';
import { portfolioRouter } from './modules/portfolio/router.js';
import { marketsRouter } from './modules/markets/router.js';
import { strategiesRouter } from './modules/strategies/router.js';
import { riskRouter } from './modules/risk/router.js';
import { systemRouter } from './modules/system/router.js';
import { settingsRouter } from './modules/settings/router.js';
import { tradesRouter } from './modules/trades/router.js';
import { mysqlClient } from './db/mysql.js';

export function createApp() {
  const app = express();

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, 'HTTP request');
    next();
  });

  app.use(
    cors({
      origin: env.frontendOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ success: true, status: 'ok', ts: Date.now() });
  });

  app.get('/readyz', (_req, res) => {
    const mysqlReady = mysqlClient.isReady();
    res.json({
      success: true,
      status: mysqlReady || !env.mysqlEnabled ? 'ready' : 'degraded',
      dependencies: {
        mysql: mysqlReady ? 'up' : env.mysqlEnabled ? 'down' : 'disabled',
      },
      ts: Date.now(),
    });
  });

  const api = express.Router();
  api.use('/engine', engineRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/portfolio', portfolioRouter);
  api.use('/trades', tradesRouter);
  api.use('/markets', marketsRouter);
  api.use('/strategies', strategiesRouter);
  api.use('/risk', riskRouter);
  api.use('/system', systemRouter);
  api.use('/settings', settingsRouter);

  app.use(env.apiPrefix, api);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.path}`,
      },
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err: error }, 'Unhandled error');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  return app;
}
