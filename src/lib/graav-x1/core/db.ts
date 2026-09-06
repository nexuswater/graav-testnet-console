import { Pool } from 'pg';
import type { Database, Sql } from './types';

export function postgresDatabase(pool: Pool): Database {
  return {
    async query<T>(text: string, values: unknown[] = []) { const r = await pool.query(text, values); return { rows: r.rows as T[] }; },
    async transaction<T>(work: (sql: Sql) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ async query<R>(text: string, values: unknown[] = []) { const r = await client.query(text, values); return { rows: r.rows as R[] }; } });
        await client.query('COMMIT'); return result;
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    },
  };
}
/** Sorted lock rows cover initially absent bindings; unique constraints are a second guard. */
export async function lock(sql: Sql, keys: string[]) {
  for (const key of [...new Set(keys)].sort()) {
    await sql.query('INSERT INTO graav_x1.locks (key) VALUES ($1) ON CONFLICT DO NOTHING', [key]);
    await sql.query('SELECT key FROM graav_x1.locks WHERE key=$1 FOR UPDATE', [key]);
  }
}
