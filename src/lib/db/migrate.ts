import { schemaSql } from './schema'
import { tradeInValues } from '../../data/tradeInValues'

/** The two calls the setup and the query builder need, so tests can use an in-memory PostgreSQL instead of pg. */
export type Runner = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  exec: (sql: string) => Promise<void>
}

// Append new entries for later schema changes; never edit an applied one.
const MIGRATIONS = [
  { version: '001_initial', sql: schemaSql },
  // The Add-phone form saves unconfirmed phones as hidden drafts; the public views already hide them,
  // and publishing still requires confirmed specs (create_inventory), so this gate only blocked drafts.
  { version: '002_allow_unconfirmed_drafts', sql: 'drop trigger if exists phone_models_review_gate on public.phone_models' },
  // The owner can paste an exact Google Maps link for the shop, and add a second shop with its own link.
  {
    version: '003_shop_locations',
    sql: `alter table public.shop_settings add column map_url text not null default '', add column address_2 text not null default '', add column map_url_2 text not null default '';
      create or replace view public.public_shop_settings with (security_barrier = true) as
      select name, currency, phone, whatsapp, telegram, email, address, hours, map_url, address_2, map_url_2 from public.shop_settings where id = 1;`,
  },
]
const LOCK_ID = 727_001

/** Creates the tables on first start and fills the trade-in price list. Safe to call from several processes at once. */
export async function migrate(runner: Runner): Promise<void> {
  await runner.query('select pg_advisory_lock($1)', [LOCK_ID])
  try {
    await runner.exec('create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())')
    const { rows } = await runner.query('select version from public.schema_migrations')
    const applied = new Set(rows.map((row) => String(row.version)))
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue
      await runner.exec('begin')
      try {
        await runner.exec(migration.sql)
        await runner.query('insert into public.schema_migrations(version) values ($1)', [migration.version])
        await runner.exec('commit')
      } catch (error) {
        await runner.exec('rollback')
        throw error
      }
    }
    const { rows: [count] } = await runner.query('select count(*)::int as n from public.trade_in_values')
    if (Number(count?.n) === 0 && tradeInValues.length) {
      const params: unknown[] = []
      const values = tradeInValues.map((item, index) => {
        params.push(item.brand, item.model, item.storageGb, item.baseValue)
        const at = index * 4
        return `($${at + 1}, $${at + 2}, $${at + 3}, $${at + 4})`
      })
      await runner.query(`insert into public.trade_in_values(brand_text, model_text, storage_gb, base_value) values ${values.join(', ')} on conflict do nothing`, params)
    }
  } finally {
    await runner.query('select pg_advisory_unlock($1)', [LOCK_ID])
  }
}
