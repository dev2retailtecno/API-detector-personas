import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from '../src/config/database.js';
import { logger } from '../src/utils/logger.js';

async function migrate(): Promise<void> {
  const migrationPath = join(process.cwd(), 'migrations', '001_create_people_count.sql');
  const migrationSql = await readFile(migrationPath, 'utf8');

  await pool.query(migrationSql);
  logger.info({ migrationPath }, 'Migraciones ejecutadas correctamente');
}

migrate()
  .catch((error: unknown) => {
    logger.error({ error }, 'Error ejecutando migraciones');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
