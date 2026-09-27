import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { config } from './config.js';

// Conexão pelas variáveis padrão do Postgres: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
export const pool = new pg.Pool({ max: 10 });

const MIGRATION_LOCK = 727274; // qualquer número fixo: só uma réplica migra por vez

// ~110 s: um pouco menos que a startupProbe do Kubernetes (120 s), para o banco ter tempo de subir
export async function waitForDatabase(attempts = 55): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`Banco indisponível (tentativa ${i}/${attempts}), aguardando...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Aplica migrations/*.sql em ordem, uma única vez cada, mesmo com várias réplicas subindo juntas. */
export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query<{ nome: string }>('SELECT nome FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.nome));
    const files = (await readdir(config.migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(config.migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migração aplicada: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migração ${file}: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
}
