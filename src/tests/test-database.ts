import { PGlite, type Transaction } from '@electric-sql/pglite'
import { migrate, type Runner } from '../lib/db/migrate'
import { setDatabaseForTests, valueParsers, type Database } from '../lib/db/pool'


const runnerFor = (db: PGlite | Transaction): Runner => ({
  query: async (text, params) => db.query(text, params as unknown[] | undefined) as Promise<{ rows: Record<string, unknown>[] }>,
  exec: async (sql) => { await db.exec(sql) },
})

/** A fresh in-memory PostgreSQL with the shop schema, wired in as the site's database. */
export async function createTestDatabase() {
  const pg = new PGlite({ parsers: valueParsers })
  await migrate(runnerFor(pg))
  const database: Database = {
    run: (work, actor) => pg.transaction(async (tx) => {
      if (actor) await tx.query("select set_config('app.user_id', $1, true), set_config('app.role', $2, true)", [actor.id, actor.role])
      return work(runnerFor(tx))
    }),
  }
  setDatabaseForTests(database)
  return {
    pg,
    /** Adds an account directly; returns its id. */
    async addProfile(role: 'owner' | 'staff', email = `${role}-${Math.random().toString(36).slice(2)}@shop.et`, passwordHash = 'unused') {
      const { rows } = await pg.query<{ id: string }>('insert into public.profiles(email, full_name, password_hash, role) values ($1, $2, $3, $4) returning id', [email, role, passwordHash, role])
      return rows[0]!.id
    },
    close: async () => { setDatabaseForTests(undefined); await pg.close() },
  }
}
