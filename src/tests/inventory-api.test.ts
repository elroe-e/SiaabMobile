// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = { role: 'owner' as 'owner' | 'staff', existing: null as Record<string, unknown> | null, knownBrand: null as { name: string } | null, brandQueries: [] as string[], inserted: [] as Record<string, unknown>[][], rpcCalls: [] as Record<string, unknown>[], updates: [] as [string, Record<string, unknown>][], updateError: null as { message: string } | null }

vi.mock('../lib/auth/session', () => ({
  requireAdmin: async () => ({
    profile: { role: state.role },
    db: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: table === 'variants' ? { model_id: 'model-9' } : state.existing, error: null }) }),
          ilike: (_column: string, pattern: string) => { state.brandQueries.push(pattern); return { limit: () => ({ maybeSingle: async () => ({ data: state.knownBrand, error: null }) }) } },
        }),
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

beforeEach(() => { state.role = 'owner'; state.knownBrand = null; state.brandQueries = []; state.existing = null; state.inserted = []; state.rpcCalls = []; state.updates = []; state.updateError = null })

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

describe('brand names', () => {
  it('reuses the saved spelling of a brand typed in different capitals', async () => {
    state.knownBrand = { name: 'Xiaomi' }
    const response = await POST(request({ ...base, brand: 'XIAOMI', model: '13 Ultra', slug: 'xiaomi-13-ultra' }))
    expect(response.status).toBe(201)
    expect(state.rpcCalls[0]).toMatchObject({ p_model: { brand: 'Xiaomi' } })
  })

  it('keeps a brand that is not saved yet exactly as typed, and treats % and _ as plain letters', async () => {
    const response = await POST(request({ ...base, brand: 'Nothing_%', model: 'Phone 3', slug: 'nothing-phone-3' }))
    expect(response.status).toBe(201)
    expect(state.rpcCalls[0]).toMatchObject({ p_model: { brand: 'Nothing_%' } })
    expect(state.brandQueries).toEqual(['Nothing\\_\\%'])
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
  const modelId = '22222222-2222-4222-8222-222222222222'

  it('lets a seller change the specifications of a phone that is already in the system', async () => {
    state.role = 'staff'
    const specs = { batteryMah: 5100, display: { sizeInches: 6.8 } }
    const response = await PATCH(patchRequest({ type: 'model', id: modelId, specs, specMeta: { batteryMah: { source: 'manual' } }, specsReviewed: true }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['phone_models', { specs, spec_meta: { batteryMah: { source: 'manual' } }, specs_reviewed: true }]])
  })

  it('renames a model and moves its page address with it', async () => {
    state.role = 'staff'
    state.existing = { name: 'Galaxy S25', brands: { name: 'Samsung' } }
    const response = await PATCH(patchRequest({ type: 'model', id: modelId, name: 'Galaxy S25 FE' }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['phone_models', { name: 'Galaxy S25 FE', slug: 'samsung-galaxy-s25-fe' }]])
  })

  it('accepts an unchanged name without writing anything, so a retried save works', async () => {
    state.existing = { name: 'Galaxy S25', brands: { name: 'Samsung' } }
    expect((await PATCH(patchRequest({ type: 'model', id: modelId, name: 'Galaxy S25' }))).status).toBe(200)
    expect(state.updates).toEqual([])
  })

  it('refuses a model name with no English letters or numbers', async () => {
    const response = await PATCH(patchRequest({ type: 'model', id: modelId, name: 'ስልክ' }))
    expect(response.status).toBe(400)
    expect(state.updates).toEqual([])
  })

  it('explains a name another phone already uses', async () => {
    state.existing = { name: 'Galaxy S25', brands: { name: 'Samsung' } }
    state.updateError = { message: 'duplicate key value violates unique constraint "phone_models_slug_key"' }
    const response = await PATCH(patchRequest({ type: 'model', id: modelId, name: 'Galaxy S24' }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Another phone already has that name.')
  })

  it('never takes back confirmed specifications, because that would hide the phone from the shop', async () => {
    state.existing = { specs_reviewed: true }
    const response = await PATCH(patchRequest({ type: 'model', id: modelId, specsReviewed: false }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/untick Publish instead/)
    expect(state.updates).toEqual([])
  })

  it('changes RAM and storage on a new-phone stock line', async () => {
    const response = await PATCH(patchRequest({ type: 'variant', id: variantId, ramGb: 16, storageGb: 512 }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['variants', { ram_gb: 16, storage_gb: 512 }]])
  })

  it('lets a seller change a used phone’s colour, size, grade and battery', async () => {
    state.role = 'staff'
    const response = await PATCH(patchRequest({ type: 'unit', id: variantId, colorName: 'White', ramGb: 8, storageGb: 256, grade: 'B', batteryHealthPct: 88 }))
    expect(response.status).toBe(200)
    expect(state.updates).toEqual([['used_units', { ram_gb: 8, storage_gb: 256, color_name: 'White', grade: 'B', battery_health_pct: 88 }]])
  })
})

describe('stale add-phone forms', () => {
  it('accepts a blank previous price instead of failing with "expected number"', async () => {
    const response = await POST(request({ ...base, variant: { ...base.variant, colorName: 'Black', oldPrice: '' } }))
    expect(response.status).toBe(201)
    expect(state.rpcCalls[0]).toMatchObject({ p_variant: { oldPrice: null } })
  })
})
