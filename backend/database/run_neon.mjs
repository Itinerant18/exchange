import pg from 'pg';
import { runMigrations } from './migrate.js';

const { Pool } = pg;

const pool = new Pool({
  host: 'ep-green-breeze-bb8f7rsw.c-15.us-east-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_nPdGmhIuTg92',
  ssl: { rejectUnauthorized: false },
  application_name: 'exchnage-neon-migration',
});

console.log('Connecting to Neon PostgreSQL and applying migrations...');

try {
  const result = await runMigrations(pool);
  console.log(`SUCCESS! Migrations applied: ${result.applied.length}, skipped: ${result.skipped}`);
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

