import 'reflect-metadata';
import { loadConfig } from '@arcsyn-shift/config';
import { createDatabase } from '@arcsyn-shift/database';
import { createLogger } from '@arcsyn-shift/observability';

async function bootstrap() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const { pool } = createDatabase(config.DATABASE_URL);
  await pool.query('select 1');
  logger.info('Worker active');
  const shutdown = async () => {
    logger.info('Worker shutting down');
    await pool.end();
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
}

void bootstrap();
