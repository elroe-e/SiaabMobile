// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDbClient } from '../lib/db/client'
import { createTestDatabase } from './test-database'

let test: Awaited<ReturnType<typeof createTestDatabase>>
let owner: ReturnType<typeof createDbClient>
const publicDb = createDbClient()

vi.mock('../lib/auth/session', () => ({ requireAdmin: async () => ({ db: owner, profile: { id: 'owner', role: 'owner' } }) }))
const { DELETE, GET, POST } = await import('../../app/api/admin/inventory/route')

beforeAll(async () => {
  test = await createTestDatabase()
  owner = createDbClient({ id: await test.addProfile('owner'), role: 'owner' })
})
afterAll(async () => { await test.close() })

const call = (handler: (request: Request) => Promise<Response>, method: string, body?: unknown) =>
  handler(new Request('http://localhost/api/admin/inventory', { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }))

async function addPhone(kind: 'new' | 'used', slug: string) {
  const { data, error } = await owner.rpc('create_inventory', {
    p_model: { brand: 'Samsung', name: slug, slug, status: 'available', specs: { chipset: 'X' }, specsReviewed: true, published: true },
    p_kind: kind,
    p_variant: kind === 'new' ? { ramGb: 8, storageGb: 256, colorName: 'Black', price: 50000, stockCount: 3 } : null,
    p_unit: kind === 'used' ? { ramGb: 8, storageGb: 128, colorName: 'Blue', grade: 'A', price: 30000 } : null,
  })
  if (error) throw new Error(error.message)
  const { modelId, unitId } = data as { modelId: string; unitId: string | null }
  const { data: variant } = await owner.from('variants').select('id').eq('model_id', modelId).maybeSingle()
  return { modelId, variantId: variant?.id as string | undefined, unitId }
}
const sellNew = async (variantId: string) => (await owner.rpc('sell_variant', { p_variant_id: variantId, p_quantity: 1, p_sale_price: 50000, p_buyer_note: null })).data as string
const inventoryIds = async () => { const body = await (await call(GET, 'GET')).json(); return [...body.variants, ...body.used].map((row: { id: string }) => row.id) }

describe('deleting a phone that has been sold', () => {
  it('hides it from Inventory and the shop, keeping its sale', async () => {
    const { variantId } = await addPhone('new', 'hide-sold')
    const saleId = await sellNew(variantId!)
    const response = await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, hidden: true })
    expect(await inventoryIds()).not.toContain(variantId)
    const { data: shop } = await publicDb.from('public_variants').select('id').eq('id', variantId!).maybeSingle()
    expect(shop).toBeNull()
    const { data: sale } = await owner.from('sales').select('variant_id,variants(phone_models(name))').eq('id', saleId).maybeSingle()
    expect(sale).toMatchObject({ variant_id: variantId, variants: { phone_models: { name: 'hide-sold' } } })
  })

  it('still deletes a phone that was never sold', async () => {
    const { variantId } = await addPhone('new', 'delete-unsold')
    const response = await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    expect(await response.json()).toMatchObject({ ok: true })
    const { data } = await owner.from('variants').select('id').eq('id', variantId!).maybeSingle()
    expect(data).toBeNull()
  })

  it('hides a sold used phone too', async () => {
    const { unitId } = await addPhone('used', 'hide-used')
    expect((await owner.rpc('sell_used_unit', { p_unit_id: unitId, p_sale_price: 30000, p_buyer_note: null })).error).toBeNull()
    expect(await (await call(DELETE, 'DELETE', { type: 'unit', id: unitId })).json()).toMatchObject({ hidden: true })
    expect(await inventoryIds()).not.toContain(unitId)
  })

  it('brings a hidden phone back with Restock or Undo', async () => {
    const { variantId } = await addPhone('new', 'hide-restock')
    const first = await sellNew(variantId!)
    const second = await sellNew(variantId!)
    await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    expect((await owner.rpc('restock_from_sale', { p_sale_id: first, p_quantity: 2 })).error).toBeNull()
    expect(await inventoryIds()).toContain(variantId)
    await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    expect((await owner.rpc('undo_sale', { p_sale_id: second })).error).toBeNull()
    expect(await inventoryIds()).toContain(variantId)
  })

  it('brings it back when the same colour, RAM and storage is added again', async () => {
    const { modelId, variantId } = await addPhone('new', 'hide-readd')
    await sellNew(variantId!)
    await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    const response = await call(POST, 'POST', {
      kind: 'new', brand: 'Samsung', model: 'hide-readd', slug: 'hide-readd', specs: { chipset: 'X' }, specsReviewed: true, isPublished: true,
      variant: { ramGb: 8, storageGb: 256, colorName: 'Black, White', price: 60000, stockCount: 5 },
    })
    expect(response.status).toBe(201)
    const { data: rows } = await owner.from('variants').select('id,color_name,price,stock_count,hidden_at').eq('model_id', modelId)
    expect(rows).toHaveLength(2)
    expect(rows!.find((row) => row.id === variantId)).toMatchObject({ price: 60000, stock_count: 5, hidden_at: null })
  })

  it('keeps a model whose only phones are hidden', async () => {
    const { modelId, variantId } = await addPhone('new', 'hide-model')
    await sellNew(variantId!)
    await call(DELETE, 'DELETE', { type: 'variant', id: variantId })
    const response = await call(DELETE, 'DELETE', { type: 'model', id: modelId })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/sales history/)
  })
})
