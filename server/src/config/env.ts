import dotenv from 'dotenv';

dotenv.config();

function toBool(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function toNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 8080),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',

  mysqlEnabled: toBool(process.env.MYSQL_ENABLED, true),
  mysqlHost: process.env.MYSQL_HOST ?? '127.0.0.1',
  mysqlPort: toNumber(process.env.MYSQL_PORT, 3306),
  mysqlUser: process.env.MYSQL_USER ?? 'app',
  mysqlPassword: process.env.MYSQL_PASSWORD ?? 'app123',
  mysqlDatabase: process.env.MYSQL_DATABASE ?? 'openclaw',
  mysqlPoolLimit: toNumber(process.env.MYSQL_POOL_LIMIT, 10),
  autoMigrate: toBool(process.env.AUTO_MIGRATE, true),

  appSecret: process.env.APP_SECRET ?? 'insecure-dev-secret',
  tickIntervalMs: toNumber(process.env.TICK_INTERVAL_MS, 1000),

  polyClobHost: process.env.POLY_CLOB_HOST ?? 'https://clob.polymarket.com',
  polyChainId: toNumber(process.env.POLY_CHAIN_ID, 137),
  polySignatureType: toNumber(process.env.POLY_SIGNATURE_TYPE, 1),
  polyPrivateKey: process.env.POLY_PRIVATE_KEY ?? '',
  polyFunderAddress: process.env.POLY_FUNDER_ADDRESS ?? '',
};

export type Env = typeof env;
