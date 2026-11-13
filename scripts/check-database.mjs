// Checks that selling works on this database without leaving anything behind: it adds a throwaway new phone and
// a throwaway used phone, sells them, undoes the sales and reserves the used one, all inside one transaction that
// is always cancelled at the end. Run it on the server, in the app folder:
//   node check-database.mjs
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { error as logError, log } from 'node:console'

const draft = (slug) => JSON.stringify({ brand: 'Database check', name: slug, slug, status: 'available', specs: {}, specsReviewed: false, published: false })

/**
 * Runs every selling step through `query` and returns what happened to each. `query(text, params)` must give back
 * the rows and must already be inside a transaction that acts as an owner; the caller cancels that transaction.
 */
export async function checkSelling(query) {
  const results = []
  const one = async (text, params) => (await query(text, params))[0]
  // Each step sits in a savepoint, so one failure does not stop the steps that do not depend on it.
  const step = async (name, ready, work) => {
    if (!ready) { results.push({ name, ok: false, problem: 'not run, because an earlier step failed' }); return undefined }
    await query('savepoint step')
    try {
      const value = await work()
      await query('release savepoint step')
      results.push({ name, ok: true })
      return value
    } catch (error) {
      await query('rollback to savepoint step')
      results.push({ name, ok: false, problem: error instanceof Error ? error.message : String(error) })
      return undefined
    }
  }
  const expect = (found, wanted, what) => { if (String(found) !== String(wanted)) throw new Error(`${what} should be ${wanted}, found ${found}`) }
  const stock = async (id) => (await one('select stock_count from public.variants where id = $1::uuid', [id])).stock_count
  const status = async (id) => (await one('select status from public.used_units where id = $1::uuid', [id])).status
  const tag = `database-check-${Date.now()}`

  const variant = await step('Add a new phone', true, async () => {
    const { result } = await one('select public.create_inventory($1::jsonb, $2::text, $3::jsonb, null::jsonb) as result',
      [draft(`${tag}-new`), 'new', JSON.stringify({ ramGb: 8, storageGb: 128, colorName: 'Black', price: 1000, stockCount: 2 })])
    return (await one('select id from public.variants where model_id = $1::uuid', [result.modelId])).id
  })
  const sale = await step('Sell one of it', Boolean(variant), async () => {
    const { id } = await one('select public.sell_variant($1::uuid, 1, 1000, $2::text) as id', [variant, 'database check'])
    expect(await stock(variant), 1, 'stock after the sale')
    return id
  })
  await step('Undo that sale', Boolean(sale), async () => {
    await query('select public.undo_sale($1::uuid)', [sale])
    expect(await stock(variant), 2, 'stock after the undo')
  })

  const unit = await step('Add a used phone', true, async () => {
    const { result } = await one('select public.create_inventory($1::jsonb, $2::text, null::jsonb, $3::jsonb) as result',
      [draft(`${tag}-used`), 'used', JSON.stringify({ ramGb: 8, storageGb: 128, colorName: 'Black', grade: 'A', price: 1000 })])
    return result.unitId
  })
  await step('Reserve the used phone', Boolean(unit), async () => {
    await query('select public.reserve_used_unit($1::uuid, 1)', [unit])
    expect(await status(unit), 'reserved', 'status after reserving')
  })
  const usedSale = await step('Sell the used phone', Boolean(unit), async () => {
    const { id } = await one('select public.sell_used_unit($1::uuid, 1000, $2::text) as id', [unit, 'database check'])
    expect(await status(unit), 'sold', 'status after the sale')
    return id
  })
  await step('Undo the used-phone sale', Boolean(usedSale), async () => {
    await query('select public.undo_sale($1::uuid)', [usedSale])
    expect(await status(unit), 'available', 'status after the undo')
  })
  return results
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. On cPanel run this first: source ~/nodevenv/siaabmobile/20/bin/activate')
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  let results
  try {
    await client.query('begin')
    await client.query("set local statement_timeout = '20s'")
    const { rows: [owner] } = await client.query("select id from public.profiles where role = 'owner' and disabled_at is null limit 1")
    if (!owner) throw new Error('There is no owner account yet. Create one with: node set-owner.mjs')
    await client.query("select set_config('app.user_id', $1, true), set_config('app.role', 'owner', true)", [owner.id])
    results = await checkSelling(async (text, params) => (await client.query(text, params)).rows)
  } finally {
    // Always cancel, so the check can never leave a phone or a sale in the shop.
    await client.query('rollback').catch(() => undefined)
    await client.end()
  }
  for (const { name, ok, problem } of results) log(`${ok ? 'ok  ' : 'FAIL'} ${name}${problem ? `: ${problem}` : ''}`)
  const broken = results.some((item) => !item.ok)
  log(broken ? 'Selling does not fully work on this database. Nothing was saved.' : 'Selling works on this database. Nothing was saved.')
  if (broken) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    // A database error can name the database user, and build logs are public, so outside a terminal only its code is shown.
    logError(error?.code && !process.stdout.isTTY ? `The check could not run (database error ${error.code}). Run it in the cPanel Terminal to see the full message.` : message)
    process.exit(1)
  })
}
