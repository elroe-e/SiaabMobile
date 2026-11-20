import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { editedMeta, formToSpecs, specsChanged, specsToForm } from '../../app/admin/inventory/spec-fields'
import { InventoryManager } from '../../app/admin/inventory/ui'
import library from '../data/spec-library.json'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
vi.mock('../../app/admin/inventory/photo-tools', () => ({ isPhotoFile: () => true, preparePhoto: vi.fn(), uploadPhoto: vi.fn() }))

const storedSpecs = {
  display: { type: 'AMOLED', sizeInches: 6.7, refreshRateHz: 120 },
  chipset: 'Snapdragon 8 Elite',
  rearCamera: [{ name: 'Main', megapixels: 200, details: null }, { name: 'Ultra-wide', megapixels: 50, details: null }],
  batteryMah: 5000,
  fiveG: true,
  ramGb: 12,
}

describe('specification form', () => {
  it('saves exactly what was stored when nothing is changed', () => {
    const result = formToSpecs(specsToForm(storedSpecs), storedSpecs)
    if ('error' in result) throw new Error(result.error)
    expect(specsChanged(storedSpecs, result.specs)).toBe(false)
    expect(result.specs.ramGb).toBe(12)
  })

  it('leaves every saved-library phone untouched when nothing is changed', () => {
    for (const entry of library as { model: string; specs: Record<string, unknown> }[]) {
      const result = formToSpecs(specsToForm(entry.specs), entry.specs)
      expect(result, entry.model).toEqual({ specs: entry.specs })
    }
  })

  it('never blocks or rewrites odd stored values the person did not touch', () => {
    const odd = {
      display: { sizeInches: 6.1, type: 'OLED', extra: 'kept' },
      rearCamera: [{ megapixels: '50 MP', details: '' }, { name: 'Zoom', megapixels: 0, details: 'f/2.4', ois: true }],
      batteryMah: 4999.5, frontCamera: { megapixels: 12, details: '' }, unknownKey: 'kept',
    }
    const untouched = formToSpecs(specsToForm(odd), odd)
    expect(untouched).toEqual({ specs: odd })

    const batteryOnly = formToSpecs({ ...specsToForm(odd), batteryMah: '5000' }, odd)
    expect(batteryOnly).toEqual({ specs: { ...odd, batteryMah: 5000 } })

    const display = formToSpecs({ ...specsToForm(odd), refreshRateHz: '120' }, odd)
    expect(display).toMatchObject({ specs: { display: { sizeInches: 6.1, type: 'OLED', refreshRateHz: 120, extra: 'kept' } } })
  })

  it('turns typed text into numbers, yes/no and empty values', () => {
    const form = { ...specsToForm({}), batteryMah: '5100', chargingWatts: '45', nfc: 'no' as const, height: '160', width: '75', depth: '8.1', frontMp: '12' }
    const result = formToSpecs(form, {})
    if ('error' in result) throw new Error(result.error)
    expect(result.specs).toEqual({ batteryMah: 5100, chargingWatts: 45, nfc: false, dimensionsMm: { height: 160, width: 75, depth: 8.1 }, frontCamera: { megapixels: 12, details: null } })
  })

  it('explains values it cannot save', () => {
    expect(formToSpecs({ ...specsToForm({}), batteryMah: 'five thousand' }, {})).toEqual({ error: 'Battery must be a whole number above 0.' })
    expect(formToSpecs({ ...specsToForm({}), height: '160' }, {})).toMatchObject({ error: expect.stringMatching(/height, width and thickness/) })
    expect(formToSpecs({ ...specsToForm({}), resWidth: '1440' }, {})).toMatchObject({ error: expect.stringMatching(/both resolution/) })
  })

  it('marks only the changed specifications as hand-edited', () => {
    const meta = editedMeta(storedSpecs, { ...storedSpecs, batteryMah: 5100 }, { chipset: { source: 'wikipedia' } })
    expect(Object.keys(meta).sort()).toEqual(['batteryMah', 'chipset'])
    expect(meta.batteryMah).toMatchObject({ source: 'manual', status: 'edited', locked: true })
  })
})

describe('editing a phone already in the system', () => {
  const model = { id: 'model-1', name: '13 Ultra', slug: 'xiaomi-13-ultra', status: 'available', expected_date: null, expected_price_range: null, tagline: '', specs: storedSpecs, spec_meta: {}, specs_reviewed: false, brands: { name: 'Xiaomi' } }
  const variant = { id: 'variant-1', model_id: 'model-1', ram_gb: 16, storage_gb: 512, color_name: 'White', price: 100000, stock_count: 1, low_stock_threshold: 2, is_published: false, phone_models: { name: '13 Ultra', slug: 'xiaomi-13-ultra', specs_reviewed: false, brands: { name: 'Xiaomi' } } }
  let patches: Record<string, unknown>[]

  beforeEach(() => {
    patches = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') { patches.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true })) }
      return new Response(JSON.stringify({ models: [model], variants: [variant], used: [] }))
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lets a seller change the model name and specifications from the pencil button, then publish', async () => {
    const user = userEvent.setup()
    render(<InventoryManager role="staff" />)
    const [pencil] = await screen.findAllByTitle('Edit phone details and specifications')
    await user.click(pencil!)
    const dialog = screen.getByRole('dialog')
    const name = within(dialog).getByLabelText(/^Model name/)
    await user.clear(name); await user.type(name, '13 Ultra Pro')
    const battery = within(dialog).getByLabelText('Battery (mAh)')
    expect(battery).toHaveValue('5000')
    await user.clear(battery); await user.type(battery, '5100')
    await user.click(within(dialog).getByLabelText('Publish this variant'))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/These specifications look right/)
    expect(patches).toEqual([])

    await user.click(within(dialog).getByLabelText('These specifications look right.'))
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(patches).toHaveLength(2))
    expect(patches[0]).toMatchObject({ type: 'model', id: 'model-1', name: '13 Ultra Pro', specsReviewed: true, specs: { ...storedSpecs, batteryMah: 5100 }, specMeta: { batteryMah: { source: 'manual' } } })
    expect(patches[1]).toMatchObject({ type: 'variant', id: 'variant-1', ramGb: 16, storageGb: 512, isPublished: true })
    expect(await screen.findByText('Inventory updated.')).toBeInTheDocument()
  })
})
