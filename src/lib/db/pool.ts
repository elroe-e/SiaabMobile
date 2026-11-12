import 'server-only'
import { Pool, types } from 'pg'
import { migrate, type Runner } from './migrate'

// Match what the site expects from the old database client: numbers as numbers, times as ISO strings.
/** "2026-11-12 10:51:27.123456+00" (PostgreSQL) to "2026-11-12T10:51:27.123Z"; anything unusual comes back unchanged. */
export function isoTimestamp(value: string): string {
  const date = new Date(value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'))
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

// Not pg's own date parser: the type table is shared, and a second load of this module would wrap our wrapper.
export const valueParsers = {
  1700: (value: string) => Number(value),
  20: (value: string) => Number(value),
  1184: isoTimestamp,
}
for (const [oid, parse] of Object.entries(valueParsers)) types.setTypeParser(Number(oid), parse)

export type Actor = { id: string; role: 'owner' | 'staff' }

/** Runs work inside one transaction; signed-in work tells the database who is acting so its own checks apply. */
export type Database = { run<T>(work: (runner: Runner) => Promise<T>, actor?: Actor): Promise<T> }

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)

type Cache = { pool?: Pool | undefined; ready?: Promise<void> | undefined; override?: Database | undefined }
const cache = globalThis as typeof globalThis & { siaabDb?: Cache }
const state = (cache.siaabDb ??= {})

/** Tests swap in an in-memory PostgreSQL. */
export function setDatabaseForTests(database: Database | undefined) { state.override = database }

function pgDatabase(): Database {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to connect the shop database.')
  // Shared hosting limits connections, so a handful is plenty for one shop.
  state.pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 })
  const pool = state.pool
  return {
    async run(work, actor) {
      const client = await pool.connect()
      const runner: Runner = { query: (text, params) => client.query(text, params), exec: async (sql) => { await client.query(sql) } }
      try {
        state.ready ??= migrate(runner).catch((error: unknown) => { state.ready = undefined; throw error })
        await state.ready
        await client.query('begin')
        if (actor) await client.query("select set_config('app.user_id', $1, true), set_config('app.role', $2, true)", [actor.id, actor.role])
        const result = await work(runner)
        await client.query('commit')
        return result
      } catch (error) {
        await client.query('rollback').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },
  }
}

export function getDatabase(): Database {
  return state.override ?? pgDatabase()
}
