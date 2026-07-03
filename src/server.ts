import { createServer } from 'node:http';
import { pool } from './config/database.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV
    },
    'API detector personas listening'
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown started');

  server.close(async (serverError) => {
    if (serverError !== undefined) {
      logger.error({ error: serverError }, 'Error closing HTTP server');
      process.exitCode = 1;
    }

    try {
      await pool.end();
      logger.info('PostgreSQL pool closed');
    } catch (poolError) {
      logger.error({ error: poolError }, 'Error closing PostgreSQL pool');
      process.exitCode = 1;
    } finally {
      process.exit();
    }
  });
}

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});

process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});
