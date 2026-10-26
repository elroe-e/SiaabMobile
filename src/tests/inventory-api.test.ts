// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = { existing: null as { id: string; specs_reviewed: boolean } | null, inserted: [] as Record<string, unknown>[][], rpcCalls: [] as Record<string, unknown>[], updates: [] as [string, Record<string, unknown>][], updateError: null as { message: string } | null }

vi.mock('../lib/supabase/auth', () => ({
  requireAdmin: async () => ({
    profile: { role: 'owner' },
    supabase: {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'variants' ? { model_id: 'model-9' } : state.existing, error: null }) }) }),
        insert: async (rows: Record<string, unknown>[]) => { state.inserted.push(rows); return { error: null } },
        update: (values: Record<string, unknown>) => ({ eq: async () => { state.updates.push([table, values]); return { error: state.updateError } } }),
      }),
      rpc: async (_name: string, args: Record<string, unknown>) => { state.rpcCalls.push(args); return { data: { modelId: 'new-model' }, error: null } },
    },
  }),
}))

const { POST, PATCH } = await import('../../app/api/admin/inventory/route')
const patchRequest = (body: Record<string, unknown>) => new Request('http://localhost/api/admin/inventory', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const request = (body: Record<string, unknown>) => new Request('http://localhost/api/admin/inventory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const base = {
  kind: 'new', brand: 'Samsung', model: 'Galaxy S25', slug: 'samsung-galaxy-s25', specs: { chipset: 'X' }, specsReviewed: true, isPublished: true,
  variant: { ramGb: 12, storageGb: 256, colorName: 'Black, Blue', price: 99000, stockCount: 2 },
}

beforeEach(() => { state.existing = null; state.inserted = []; state.rpcCalls = []; state.updates = []; state.updateError = null })

describe('create inventory API', () => {
  it('creates the model with the first colour and adds the other colours as extra variants', async () => {
    const response = await POST(request(base))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ modelId: 'new-model' })
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0]).toMatchObject({ p_variant: { colorName: 'Black', colorHex: '#1f2430' }, p_model: { tagline: '', published: true } })
    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0]).toMatchObject([{ model_id: 'new-model', color_name: 'Blue', stock_count: 2, is_published: true }])
  })

  it('adds variants to a phone that already exists instead of failing on the unique slug', async () => {
    state.existing = { id: 'old-model', specs_reviewed: true }
    const response = await POST(request(base))
    expect(response.status).toBe(201)
    expect(state.rpcCalls).toHaveLength(0)
    expect(state.inserted[0]).toHaveLength(2)
    expect(state.inserted[0]!.map((row) => row.color_name)).toEqual(['Black', 'Blue'])
  })

  it('refuses to publish variants of an existing phone whose specs are unconfirmed', async () => {
    state.existing = { id: 'old-model', specs_reviewed: false }
    const response = await POST(request(base))
    expect(response.status).toBe(400)
    expect(state.inserted).toHaveLength(0)
  })

  it('requires at least one colour and confirmed specs for a new published phone', async () => {
    expect((await POST(request({ ...base, variant: { ...base.variant, colorName: ' , ' } }))).status).toBe(400)
    expect((await POST(request({ ...base, specsReviewed: false }))).status).toBe(400)
    expect(state.rpcCalls).toHaveLength(0)
  })
})

describe('update inventory API', () => {
  const variantId = '11111111-1111-4111-8111-111111111111'

  it('confirms the model specs before publishing an existing draft variant', async () => {
    const response = await PATCH(patchRequest({ type: 'variant', id: variantId, isPublished: true, confirmSpecs: true }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['phone_models', { specs_reviewed: true }], ['variants', { is_published: true }]])
  })

  it('lets the owner set a colour on an existing variant and derives the swatch', async () => {
    const response = await PATCH(patchRequest({ type: 'variant', id: variantId, colorName: 'Midnight Black' }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['variants', { color_name: 'Midnight Black', color_hex: '#1f2430' }]])
  })

  it('explains a duplicate colour in plain words', async () => {
    state.updateError = { message: 'duplicate key value violates unique constraint' }
    const response = await PATCH(patchRequest({ type: 'variant', id: variantId, colorName: 'Blue' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/already has that colour/)
  })

  it('rejects an empty update', async () => {
    expect((await PATCH(patchRequest({ type: 'variant', id: variantId }))).status).toBe(400)
  })
})

describe('stale add-phone forms', () => {
  it('accepts a blank previous price instead of failing with "expected number"', async () => {
    const response = await POST(request({ ...base, variant: { ...base.variant, colorName: 'Black', oldPrice: '' } }))
    expect(response.status).toBe(201)
    expect(state.rpcCalls[0]).toMatchObject({ p_variant: { oldPrice: null } })
  })
})
