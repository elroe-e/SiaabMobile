import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateInventoryModal, specRows } from '../../app/admin/inventory/create-modal'
import { colorHex, splitColors, visibleColors } from '../lib/colors'

vi.mock('../../app/admin/inventory/photo-tools', () => ({
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

describe('Add phone form', () => {
  it('asks only for the basics, then looks up specifications automatically', async () => {
    const user = userEvent.setup()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({ modelId: 'm1' })} onFinished={() => undefined} />)
    expect(screen.queryByLabelText(/short description/i)).toBeNull()
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    expect(await screen.findByText('Snapdragon 8 Elite')).toBeTruthy()
    expect(screen.getByText('5000 mAh')).toBeTruthy()
    const call = vi.mocked(fetch).mock.calls[0]!
    expect(call[0]).toBe('/api/admin/specs')
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({ brand: 'Samsung', model: 'Galaxy S25' })
  })

  it('saves as a draft until the specifications are confirmed', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn(async () => ({ modelId: 'm1' }))
    const onFinished = vi.fn()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={onFinished} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await screen.findByText('Snapdragon 8 Elite')
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    const body = onCreate.mock.calls[0]![0] as Record<string, unknown>
    expect(body).toMatchObject({ kind: 'new', slug: 'samsung-galaxy-s25', specsReviewed: false, isPublished: false })
    expect(body.variant).toMatchObject({ colorName: 'Black, Blue', ramGb: 12, storageGb: 256, price: 99000 })
    expect(body).not.toHaveProperty('tagline')
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('Phone saved as a draft.'))
  })

  it('publishes once confirmed and uploads the chosen photos to the new phone', async () => {
    const user = userEvent.setup()
    const { uploadPhoto } = await import('../../app/admin/inventory/photo-tools')
    const onCreate = vi.fn(async () => ({ modelId: 'model-123' }))
    const onFinished = vi.fn()
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={onCreate} onFinished={onFinished} />)
    await fillBasics(user)
    fireEvent.change(screen.getByLabelText('Add photos'), { target: { files: [new File(['a'], 'front.jpg', { type: 'image/jpeg' }), new File(['b'], 'back.jpg', { type: 'image/jpeg' })] } })
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    await screen.findByText('Snapdragon 8 Elite')
    await user.click(screen.getByLabelText(/specifications look right/i))
    await user.click(screen.getByRole('button', { name: 'Save phone' }))
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('Phone saved and published.'))
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ specsReviewed: true, isPublished: true })
    expect(vi.mocked(uploadPhoto)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(uploadPhoto).mock.calls[0]).toEqual(['model', 'model-123', 'data:image/webp;base64,front.jpg', 'Samsung Galaxy S25'])
  })

  it('merges the entered RAM and storage into the specifications and shows lookup failures without blocking', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'AI lookup is busy' }), { status: 500 })))
    render(<CreateInventoryModal role="owner" onClose={() => undefined} onCreate={async () => ({})} onFinished={() => undefined} />)
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: /find specifications/i }))
    expect(await screen.findByText('AI lookup is busy')).toBeTruthy()
    expect(screen.getByText('12 GB')).toBeTruthy()
    expect(screen.getByText('256 GB')).toBeTruthy()
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
  it('turns specs into readable rows and skips empty values', () => {
    const rows = specRows({ chipset: 'A17 Pro', batteryMah: 3274, fiveG: true, os: null })
    expect(rows).toEqual([['Chipset', 'A17 Pro'], ['Battery', '3274 mAh'], ['5G', 'Yes']])
  })
})
