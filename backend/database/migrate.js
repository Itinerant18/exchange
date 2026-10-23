// Migration runner — idempotent, transactional, advisory-locked.
//
// Usage:
//   npm run db:migrate                (local development database)
//   node database/migrate.js          (same thing; no credentials in this file)
//
// Programmatic use (tests): import { runMigrations } and pass a pg pool.
//
// Guarantees:
// - History table `schema_migrations` records every applied migration.
// - Pending files are applied in numeric order, each inside its own transaction
//   together with its history row (all-or-nothing).
// - pg advisory locking prevents two migration processes from racing.
// - Re-running is safe: applied files are skipped; edits to an applied file are
//   detected via checksum and abort the run instead of being silently ignored.
// - A failed migration rolls back completely and reports the file and error.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const FILE_PATTERN = /^(\d+)_(.+)\.sql$/;

// Arbitrary but fixed key so concurrent runners serialize.
const ADVISORY_LOCK_KEY = 730825100;

export class MigrationChecksumError extends Error {}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);

  const files = [];
  for (const entry of entries) {
    const match = FILE_PATTERN.exec(entry);
    if (!match) continue;

    const version = Number.parseInt(match[1], 10);
    const name = match[2];
    const absolutePath = join(MIGRATIONS_DIR, entry);
    const sql = await readFile(absolutePath, 'utf8');

    files.push({
      version,
      name,
      fileName: entry,
      sql,
      checksum: sha256(sql),
    });
  }

  files.sort((a, b) => a.version - b.version || a.name.localeCompare(b.name));

  const seen = new Set();
  for (const file of files) {
    if (seen.has(file.version)) {
      throw new Error(`Duplicate migration version ${file.version} in ${MIGRATIONS_DIR}`);
    }
    seen.add(file.version);
  }

  return files;
}

function log(logger, message) {
  if (logger !== null) logger.log(message);
}

export async function runMigrations(pool, { logger = console } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            version    INTEGER     PRIMARY KEY,
            name       TEXT        NOT NULL,
            checksum   TEXT        NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      const files = await listMigrationFiles();
      const { rows } = await client.query(
        'SELECT version, checksum, name FROM public.schema_migrations',
      );
      const appliedById = new Map(rows.map((row) => [row.version, row]));

      // Applied file changed on disk: fail loudly instead of guessing.
      for (const row of appliedById.values()) {
        const file = files.find((candidate) => candidate.version === row.version);
        if (!file) {
          log(logger, `[migrations] warning: applied migration ${row.version} (${row.name}) no longer exists on disk`);
          continue;
        }
        if (file.checksum !== row.checksum) {
          throw new MigrationChecksumError(
            `Applied migration ${file.fileName} has been edited since it was applied. ` +
            'Create a new migration file instead of modifying an applied one.',
          );
        }
      }

      const pending = files.filter((file) => !appliedById.has(file.version));

      if (pending.length === 0) {
        log(logger, '[migrations] already up to date');
        return { applied: [], skipped: files.length };
      }

      for (const file of pending) {
        await client.query('BEGIN');
        try {
          await client.query(file.sql);
          await client.query(
            'INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
            [file.version, file.name, file.checksum],
          );
          await client.query('COMMIT');
          log(logger, `[migrations] applied ${file.fileName}`);
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw new Error(
            `Migration ${file.fileName} failed: ${error.message}`,
            { cause: error },
          );
        }
      }

      log(logger, `[migrations] done (${pending.length} applied)`);
      return { applied: pending.map((file) => file.fileName), skipped: files.length - pending.length };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(process.argv[1]));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  // Deliberately dynamic: importing env.js here keeps this module side-effect
  // free when imported by tests, and credentials stay in the environment.
  const [{ Pool }, { env }] = await Promise.all([
    import('pg'),
    import('../src/config/env.js'),
  ]);

  const pool = new Pool({
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    password: env.db.password,
    application_name: 'exchnage-migrations',
  });

  try {
    const result = await runMigrations(pool);
    console.log(`[migrations] migrations applied: ${result.applied.length}, already applied: ${result.skipped}`);
  } catch (error) {
    console.error('[migrations] FAILED:', error.message);
    console.error(error.cause ? String(error.cause) : '');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
