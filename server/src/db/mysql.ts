import mysql, { Pool } from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

class MysqlClient {
  private pool: Pool | null = null;

  async init(): Promise<void> {
    if (!env.mysqlEnabled) {
      logger.warn('MySQL disabled by env, using in-memory mode only');
      return;
    }

    try {
      this.pool = mysql.createPool({
        host: env.mysqlHost,
        port: env.mysqlPort,
        user: env.mysqlUser,
        password: env.mysqlPassword,
        database: env.mysqlDatabase,
        waitForConnections: true,
        connectionLimit: env.mysqlPoolLimit,
      });

      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();
      logger.info('MySQL connected');
    } catch (error) {
      this.pool = null;
      logger.error({ err: error }, 'MySQL connection failed, fallback to in-memory mode');
    }
  }

  isReady(): boolean {
    return this.pool !== null;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) return [];
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(sql, params as never[]);
  }

  async close(): Promise<void> {
    if (!this.pool) return;
    await this.pool.end();
  }
}

export const mysqlClient = new MysqlClient();
