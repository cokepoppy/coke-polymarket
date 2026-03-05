import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { mysqlClient } from './db/mysql.js';
import { runMigration } from './db/migrate.js';
import { setupWsHub } from './ws/hub.js';
import { startSimulator, stopSimulator } from './shared/simulator.js';

async function bootstrap() {
  await mysqlClient.init();
  await runMigration();

  const app = createApp();
  const server = http.createServer(app);
  setupWsHub(server);
  startSimulator();

  server.listen(env.port, () => {
    logger.info({ port: env.port, apiPrefix: env.apiPrefix }, 'API server listening');
  });

  const shutdown = async () => {
    logger.info('Graceful shutdown start');
    stopSimulator();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await mysqlClient.close();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Server bootstrap failed');
  process.exit(1);
});
