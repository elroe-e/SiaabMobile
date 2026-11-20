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
  // Restock from a sale: adds stock back to the same new-phone line, or adds a new used phone copied from the sold one
  // (without IMEI, cost or private notes, which belong to the old phone). The sale itself stays recorded.
  {
    version: '004_restock_from_sale',
    sql: `create function public.restock_from_sale(p_sale_id uuid, p_quantity integer default 1)
      returns uuid language plpgsql security definer set search_path = '' as $fn$
      declare
        sale public.sales%rowtype;
        unit public.used_units%rowtype;
        new_id uuid;
      begin
        if not public.is_staff_or_owner() then raise exception 'Not authorized'; end if;
        if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then raise exception 'Restock quantity must be between 1 and 1000'; end if;
        select * into sale from public.sales where id = p_sale_id;
        if not found then raise exception 'Sale not found'; end if;
        if sale.kind = 'new' then
          update public.variants set stock_count = stock_count + p_quantity where id = sale.variant_id returning id into new_id;
          if new_id is null then raise exception 'This phone is no longer in the inventory'; end if;
          return new_id;
        end if;
        if p_quantity <> 1 then raise exception 'A used phone is restocked one at a time'; end if;
        select * into unit from public.used_units where id = sale.unit_id;
        if not found then raise exception 'This phone is no longer in the inventory'; end if;
        insert into public.used_units(model_id, ram_gb, storage_gb, color_name, grade, battery_health_pct, accessories, warranty_months, price, status, is_published, created_by)
        values (unit.model_id, unit.ram_gb, unit.storage_gb, unit.color_name, unit.grade, unit.battery_health_pct, unit.accessories, unit.warranty_months, unit.price, 'available', unit.is_published, public.current_actor())
        returning id into new_id;
        return new_id;
      end;
      $fn$;`,
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
