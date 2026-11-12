// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDbClient } from '../lib/db/client'
import { createTestDatabase } from './test-database'

let test: Awaited<ReturnType<typeof createTestDatabase>>
let owner: ReturnType<typeof createDbClient>
let seller: ReturnType<typeof createDbClient>
const publicDb = createDbClient()

beforeAll(async () => {
  test = await createTestDatabase()
  owner = createDbClient({ id: await test.addProfile('owner'), role: 'owner' })
  seller = createDbClient({ id: await test.addProfile('staff'), role: 'staff' })
})
afterAll(async () => { await test.close() })

async function addPhone(db: ReturnType<typeof createDbClient>, kind: 'new' | 'used', slug: string, unit: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc('create_inventory', {
    p_model: { brand: 'Samsung', name: slug, slug, status: 'available', specs: { chipset: 'X' }, specsReviewed: true, published: true },
    p_kind: kind,
    p_variant: kind === 'new' ? { ramGb: 8, storageGb: 256, colorName: 'Black', price: 50000, stockCount: 3 } : null,
    p_unit: kind === 'used' ? { ramGb: 8, storageGb: 128, colorName: 'Blue', grade: 'A', price: 30000, ...unit } : null,
  })
  if (error) throw new Error(error.message)
  return data as { modelId: string; unitId: string | null }
}

describe('database setup', () => {
  it('creates the schema once and fills the trade-in price list', async () => {
    const { count } = await publicDb.from('trade_in_values').select('id', { count: 'exact', head: true })
    expect(count).toBeGreaterThan(100)
    const { data } = await publicDb.from('public_shop_settings').select('name,phone').maybeSingle()
    expect(data).toMatchObject({ name: 'Siaab Mobile' })
  })
})

describe('query builder on real SQL', () => {
  it('embeds related rows, filters, orders and counts like the old client', async () => {
    const { modelId } = await addPhone(owner, 'new', 'galaxy-a')
    const { data, error } = await owner.from('variants').select('id,price,stock_count,phone_models(name,brands(name))').eq('model_id', modelId).order('price', { ascending: false })
    expect(error).toBeNull()
    expect(data).toEqual([expect.objectContaining({ price: 50000, stock_count: 3, phone_models: { name: 'galaxy-a', brands: { name: 'Samsung' } } })])
    const { data: one } = await owner.from('phone_models').select('id,slug').eq('slug', 'galaxy-a').single()
    expect(one).toMatchObject({ id: modelId })
    const { error: none } = await owner.from('phone_models').select('id').eq('slug', 'no-such-phone').single()
    expect(none?.message).toMatch(/no\) rows/)
    expect((await owner.from('phone_models').select('id').eq('slug', 'no-such-phone').maybeSingle()).data).toBeNull()
  })

  it('inserts, upserts, updates and deletes with parameters, never by string building', async () => {
    const values = { brand_text: 'Test', model_text: "O'Brien 1", storage_gb: 64, base_value: 1000 }
    expect((await owner.from('trade_in_values').upsert(values, { onConflict: 'brand_text,model_text,storage_gb' })).error).toBeNull()
    expect((await owner.from('trade_in_values').upsert({ ...values, base_value: 1500 }, { onConflict: 'brand_text,model_text,storage_gb' })).error).toBeNull()
    const { data } = await owner.from('trade_in_values').select('base_value').eq('model_text', "O'Brien 1").single()
    expect(data?.base_value).toBe(1500)
    await owner.from('trade_in_values').update({ is_active: false }).eq('model_text', "O'Brien 1")
    expect((await publicDb.from('public_trade_in_values').select('id').eq('model_text', "O'Brien 1")).data).toEqual([])
    await owner.from('trade_in_values').delete().eq('model_text', "O'Brien 1")
    expect((await owner.from('trade_in_values').select('id').eq('model_text', "O'Brien 1")).data).toEqual([])
  })

  it('refuses unsafe names and updates without a filter', async () => {
    expect((await owner.from('variants').select('id; drop table sales').limit(1)).error?.message).toMatch(/Invalid database name/)
    expect((await owner.from('variants').update({ price: 1 })).error?.message).toMatch(/Refusing to update every row/)
  })
})

describe('permissions the database still enforces', () => {
  it('hides cost price, IMEI and private notes from sellers', async () => {
    const { unitId } = await addPhone(owner, 'used', 'pixel-used', { costPrice: 20000, imei: '123456789012345', notesInternal: 'cracked box' })
    const asOwner = await owner.from('admin_used_units').select('cost_price,imei,notes_internal').eq('id', unitId).single()
    expect(asOwner.data).toEqual({ cost_price: 20000, imei: '123456789012345', notes_internal: 'cracked box' })
    const asSeller = await seller.from('admin_used_units').select('cost_price,imei,notes_internal').eq('id', unitId).single()
    expect(asSeller.data).toEqual({ cost_price: null, imei: null, notes_internal: '' })
  })

  it('stops sellers setting private used-phone fields', async () => {
    const { error } = await seller.rpc('create_inventory', {
      p_model: { brand: 'Apple', name: 'iPhone used', slug: 'iphone-used', status: 'available', specsReviewed: true, published: true },
      p_kind: 'used',
      p_unit: { ramGb: 6, storageGb: 128, colorName: 'Black', grade: 'B', price: 40000, costPrice: 1 },
    })
    expect(error?.message).toMatch(/Only an owner can set private used-phone fields/)
  })

  it('records a sale, lowers stock, and lets only the owner undo it after 24 hours', async () => {
    const { modelId } = await addPhone(seller, 'new', 'redmi-note')
    const { data: variant } = await seller.from('variants').select('id').eq('model_id', modelId).single()
    const { data: saleId, error } = await seller.rpc('sell_variant', { p_variant_id: variant!.id, p_quantity: 2, p_sale_price: 50000 })
    expect(error).toBeNull()
    expect((await seller.from('variants').select('stock_count').eq('id', variant!.id).single()).data?.stock_count).toBe(1)
    expect((await seller.rpc('sell_variant', { p_variant_id: variant!.id, p_quantity: 5, p_sale_price: 50000 })).error?.message).toMatch(/Not enough stock/)
    await test.pg.query("update public.sales set sold_at = now() - interval '2 days' where id = $1", [saleId])
    expect((await seller.rpc('undo_sale', { p_sale_id: saleId })).error?.message).toMatch(/Only an owner can undo a sale after 24 hours/)
    expect((await owner.rpc('undo_sale', { p_sale_id: saleId })).error).toBeNull()
    expect((await owner.from('variants').select('stock_count').eq('id', variant!.id).single()).data?.stock_count).toBe(3)
  })

  it('refuses sales from the public site and logs who changed inventory', async () => {
    expect((await publicDb.rpc('sell_variant', { p_variant_id: '00000000-0000-0000-0000-000000000000', p_quantity: 1, p_sale_price: 1 })).error?.message).toMatch(/Not authorized/)
    const { data } = await owner.from('audit_log').select('user_id,table_name').eq('table_name', 'variants').limit(1)
    expect(data?.[0]?.user_id).toBeTruthy()
  })

  it('accepts public requests but slows down floods from one contact', async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await publicDb.rpc('submit_public_lead', { p_type: 'notify_me', p_name: 'Abebe', p_contact: '+251911000000', p_payload: { model: 'Pixel 10' } })).error).toBeNull()
    }
    expect((await publicDb.rpc('submit_public_lead', { p_type: 'notify_me', p_name: 'Abebe', p_contact: '+251911000000', p_payload: {} })).error?.message).toMatch(/Too many requests/)
  })
})

describe('ids', () => {
  it('are standard version-4 UUIDs, so the site’s input checks accept them', async () => {
    const { rows } = await test.pg.query<{ id: string }>('select public.new_uuid()::text as id from generate_series(1, 200)')
    for (const { id } of rows) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(new Set(rows.map((row) => row.id)).size).toBe(200)
  })
})

describe('timestamps', () => {
  it('turns PostgreSQL time text into ISO strings, whatever the offset', async () => {
    const { isoTimestamp } = await import('../lib/db/pool')
    expect(isoTimestamp('2026-11-12 10:51:27.123456+00')).toBe('2026-11-12T10:51:27.123Z')
    expect(isoTimestamp('2026-11-12 13:51:27+03')).toBe('2026-11-12T10:51:27.000Z')
    expect(isoTimestamp('2026-11-12 16:21:27.5+05:30')).toBe('2026-11-12T10:51:27.500Z')
    expect(isoTimestamp('infinity')).toBe('infinity')
  })
})
