import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { mysqlClient } from './mysql.js';

export async function runMigration(): Promise<void> {
  if (!env.mysqlEnabled || !env.autoMigrate || !mysqlClient.isReady()) {
    return;
  }

  try {
    const filePath = path.resolve(process.cwd(), 'sql/init.sql');
    const sql = await fs.readFile(filePath, 'utf-8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await mysqlClient.execute(statement);
    }

    logger.info({ count: statements.length }, 'MySQL migration executed');
  } catch (error) {
    logger.error({ err: error }, 'MySQL migration failed');
  }
}
