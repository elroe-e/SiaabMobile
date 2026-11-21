import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateInventoryModal } from '../../app/admin/inventory/create-modal'
import { colorHex, splitColors, visibleColors } from '../lib/colors'

vi.mock('../../app/admin/inventory/photo-tools', async (importOriginal) => ({
  isPhotoFile: (await importOriginal<typeof import('../../app/admin/inventory/photo-tools')>()).isPhotoFile,
  preparePhoto: vi.fn(async (file: File) => `data:image/webp;base64,${file.name}`),
  uploadPhoto: vi.fn(async () => undefined),
}))

const lookupResult = {
  specs: { chipset: 'Snapdragon 8 Elite', batteryMah: 5000, display: { sizeInches: 6.7, type: 'AMOLED', refreshRateHz: 120 } },
  metadata: {},
  providers: [{ name: 'ai', status: 'ok', foundFields: 3 }],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(lookupResult), { status: 200 })))
})
afterEach(() => vi.unstubAllGlobals())

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Brand'), 'Samsung')
  await user.type(screen.getByLabelText('Model'), 'Galaxy S25')
  await user.type(screen.getByLabelText(/^Colour/), 'Black, Blue')
  await user.clear(screen.getByLabelText('RAM (GB)')); await user.type(screen.getByLabelText('RAM (GB)'), '12')
  await user.clear(screen.getByLabelText(/^Storage/)); await user.type(screen.getByLabelText(/^Storage/), '256')
  await user.type(screen.getByLabelText(/^Price/), '99000')
}

const specsShown = async (chipset = 'Snapdragon 8 Elite') => expect(await screen.findByLabelText(/^Chipset/)).toHaveValue(chipset)

describe('Add phone form', () => {
  it('asks only for the basics, then looks up specifications automatically', async () => {
    const user = userEvent.setup()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({ modelId: 'm1' })} onFinished={() => undefined} />)
    expect(screen.queryByLabelText(/short description/i)).toBeNull()
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    expect(screen.getByLabelText('Battery (mAh)')).toHaveValue('5000')
    expect(screen.getByLabelText('Size (inches)')).toHaveValue('6.7')
    const call = vi.mocked(fetch).mock.calls[0]!
    expect(call[0]).toBe('/api/admin/specs')
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({ brand: 'Samsung', model: 'Galaxy S25' })
  })

  it('saves as a draft until the specifications are confirmed', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    const onFinished = vi.fn()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={onFinished} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0]
    expect(body).toMatchObject({ kind: 'new', slug: 'samsung-galaxy-s25', specsReviewed: false, isPublished: false })
    expect(body.variant).toMatchObject({ colorName: 'Black, Blue', ramGb: 12, storageGb: 256, price: 99000 })
    expect(body).not.toHaveProperty('tagline')
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('Phone saved as a draft without photos.'))
  })

  it('publishes once confirmed and uploads the chosen photos to the new phone', async () => {
    const user = userEvent.setup()
    const { uploadPhoto } = await import('../../app/admin/inventory/photo-tools')
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'model-123' }))
    const onFinished = vi.fn()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={onFinished} />)
    await fillBasics(user)
    fireEvent.change(screen.getByLabelText('Add photos'), { target: { files: [new File(['a'], 'front.jpg', { type: 'image/jpeg' }), new File(['b'], 'back.jpg', { type: 'image/jpeg' })] } })
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.click(screen.getByLabelText(/specifications look right/i))
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('Phone saved and published with 2 photos.'))
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ specsReviewed: true, isPublished: true })
    expect(vi.mocked(uploadPhoto)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(uploadPhoto).mock.calls[0]).toEqual(['model', 'model-123', 'data:image/webp;base64,front.jpg', 'Samsung Galaxy S25'])
  })

  it('keeps camera photos that arrive without a file type, and says which files were skipped', async () => {
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({ modelId: 'm1' })} onFinished={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Add photos'), { target: { files: [new File(['a'], 'IMG_2041.JPG', { type: '' }), new File(['b'], 'notes.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByText('Photos (1/8)')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/1 file is not a photo and was skipped/)
  })

  it('tells the owner Save is waiting for the search instead of looking broken', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({ modelId: 'm1' })} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    const save = await screen.findByRole('button', { name: 'Finding specifications…' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
  })

  it('merges the entered RAM and storage into the specifications and shows lookup failures without blocking', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'AI lookup is busy' }), { status: 500 })))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({})} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    expect(await screen.findByText('AI lookup is busy')).toBeTruthy()
    expect(screen.getByText(/Kept from step 1: Black, Blue · 12 GB RAM · 256 GB storage\./)).toBeTruthy()
    expect(screen.getByText(/Nothing was found online/)).toBeTruthy()
    expect(screen.getByLabelText(/^Chipset/)).toHaveValue('')
  })
})

describe('values typed by the shop', () => {
  it('keeps the typed RAM, storage, battery and colours even when the online lookup says otherwise', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ specs: { chipset: 'Snapdragon 8 Elite', ramGb: 8, storageGb: 128, batteryMah: 4000 }, metadata: { ramGb: { source: 'ai', locked: false }, batteryMah: { source: 'ai', locked: false } }, providers: [{ name: 'ai', status: 'found', foundFields: 4 }] }))))
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.type(screen.getByLabelText(/^Battery \(mAh\)/), '5500')
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    expect(screen.getByText(/Kept from step 1: Black, Blue · 12 GB RAM · 256 GB storage · 5500 mAh battery\./)).toBeTruthy()
    expect(screen.getByLabelText('Battery (mAh)')).toHaveValue('5500')

    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0] as { specs: Record<string, unknown>; specMeta: Record<string, { source: string; locked: boolean }>; variant: Record<string, unknown> }
    expect(body.specs).toMatchObject({ ramGb: 12, storageGb: 256, batteryMah: 5500, chipset: 'Snapdragon 8 Elite' })
    expect(body.variant).toMatchObject({ colorName: 'Black, Blue', ramGb: 12, storageGb: 256 })
    for (const key of ['ramGb', 'storageGb', 'batteryMah']) expect(body.specMeta[key]).toMatchObject({ source: 'manual', locked: true })
  })

  it('still lets the lookup suggest a battery when none was typed', async () => {
    const user = userEvent.setup()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({ modelId: 'm1' })} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    expect(screen.getByLabelText('Battery (mAh)')).toHaveValue('5000')
  })
})

describe('step 2 fill-in list', () => {
  it('saves what the person types in the boxes and marks it as their own', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.type(screen.getByLabelText('Charging (watts)'), '45')
    await user.clear(screen.getByLabelText('Refresh rate (Hz)')); await user.type(screen.getByLabelText('Refresh rate (Hz)'), '144')
    await user.selectOptions(screen.getByLabelText('NFC'), 'yes')
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0] as { specs: Record<string, unknown>; specMeta: Record<string, { source: string }> }
    expect(body.specs).toMatchObject({ chipset: 'Snapdragon 8 Elite', batteryMah: 5000, chargingWatts: 45, nfc: true, ramGb: 12, storageGb: 256, display: { sizeInches: 6.7, type: 'AMOLED', refreshRateHz: 144 } })
    for (const key of ['chargingWatts', 'nfc', 'display']) expect(body.specMeta[key]).toMatchObject({ source: 'manual' })
    expect(body.specMeta.chipset).toBeUndefined()
  })

  it('fills the boxes from pasted text, keeping the step 1 values and anything typed', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.type(screen.getByLabelText(/^Battery \(mAh\)/), '5500')
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.type(screen.getByLabelText('Water resistance'), 'IP68')
    await user.click(screen.getByText('Paste specifications from a website'))
    fireEvent.change(screen.getByPlaceholderText(/Display: 6.7 inches/), { target: { value: 'Chipset: Dimensity 9400\nBattery: 6000 mAh\nRAM: 16 GB\nCharging: 90W' } })
    await user.click(screen.getByRole('button', { name: 'Fill the boxes from pasted text' }))
    expect(screen.getByLabelText(/^Chipset/)).toHaveValue('Dimensity 9400')
    expect(screen.getByLabelText('Charging (watts)')).toHaveValue('90')
    expect(screen.getByLabelText('Battery (mAh)')).toHaveValue('5500')
    expect(screen.getByLabelText('Water resistance')).toHaveValue('IP68')
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0] as { specs: Record<string, unknown>; specMeta: Record<string, { source: string }> }
    expect(body.specs).toMatchObject({ chipset: 'Dimensity 9400', chargingWatts: 90, batteryMah: 5500, ramGb: 12, waterRating: 'IP68' })
    expect(body.specMeta.chipset).toMatchObject({ source: 'pasted' })
    expect(body.specMeta.waterRating).toMatchObject({ source: 'manual' })
    expect(body.specMeta.batteryMah).toMatchObject({ source: 'manual' })
  })

  it('keeps what was typed or pasted when going Back and searching again', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.type(screen.getByLabelText('Charging (watts)'), '45')
    await user.click(screen.getByText('Paste specifications from a website'))
    fireEvent.change(screen.getByPlaceholderText(/Display: 6.7 inches/), { target: { value: 'Operating system: Android 15' } })
    await user.click(screen.getByRole('button', { name: 'Fill the boxes from pasted text' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    expect(screen.getByLabelText('Charging (watts)')).toHaveValue('45')
    expect(screen.getByLabelText('Operating system')).toHaveValue('Android 15')
    await user.click(screen.getByRole('button', { name: 'Search again' }))
    await specsShown()
    expect(screen.getByLabelText('Charging (watts)')).toHaveValue('45')
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0] as { specs: Record<string, unknown>; specMeta: Record<string, { source: string }> }
    expect(body.specs).toMatchObject({ chargingWatts: 45, os: 'Android 15', chipset: 'Snapdragon 8 Elite' })
    expect(body.specMeta.chargingWatts).toMatchObject({ source: 'manual' })
    expect(body.specMeta.os).toMatchObject({ source: 'pasted' })
  })

  it('explains a value it cannot save instead of saving it', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async (_body: Record<string, unknown>) => ({ modelId: 'm1' }))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await specsShown()
    await user.type(screen.getByLabelText('Charging (watts)'), 'fast')
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Charging/)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('colour and spec helpers', () => {
  it('splits several colours typed by the owner', () => {
    expect(splitColors('Black, Blue')).toEqual(['Black', 'Blue'])
    expect(splitColors('Black / Titanium Gray and Blue')).toEqual(['Black', 'Titanium Gray', 'Blue'])
    expect(splitColors('  ')).toEqual([])
  })
  it('derives a swatch colour from the name and hides placeholders from customers', () => {
    expect(colorHex('Midnight Black')).toBe('#1f2430')
    expect(colorHex('Mystery Shade')).toBe('#8a94a6')
    expect(visibleColors([{ name: 'Unspecified', hex: '#777' }, { name: 'Blue', hex: '#00f' }])).toEqual([{ name: 'Blue', hex: '#00f' }])
  })
})
