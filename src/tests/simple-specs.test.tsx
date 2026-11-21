import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SpecFields, specsToForm } from '../../app/admin/inventory/spec-fields'
import { KeySpecs } from '../components/Storefront'
import { phones } from '../data/phones'
import { advancedSpecGroups, hasAdvancedSpecs, simpleSpecLines } from '../lib/specs/simple-specs'

const simpleOnly = { display: { sizeInches: 6.7, refreshRateHz: 120 }, chipset: 'Snapdragon 8 Gen 3', batteryMah: 5000, chargingWatts: 45, rearCamera: [{ name: 'Main', megapixels: 50, details: null }], ramGb: 12, storageGb: 256 }

describe('simple and advanced specifications', () => {
  it('counts only the simple specs as simple', () => {
    expect(hasAdvancedSpecs(simpleOnly)).toBe(false)
    expect(hasAdvancedSpecs({ ...simpleOnly, os: 'Android 15' })).toBe(true)
    expect(hasAdvancedSpecs({ ...simpleOnly, display: { ...simpleOnly.display, type: 'AMOLED' } })).toBe(true)
    expect(hasAdvancedSpecs({ ...simpleOnly, rearCamera: [{ name: 'Main', megapixels: 50, details: 'f/1.8, OIS' }] })).toBe(true)
    expect(hasAdvancedSpecs({ ...simpleOnly, nfc: null, os: '' })).toBe(false)
  })

  it('writes short lines for the cards', () => {
    expect(simpleSpecLines(simpleOnly)).toEqual({ display: '6.7″ · 120 Hz', camera: '50 MP', battery: '5000 mAh · 45 W charging', chipset: 'Snapdragon 8 Gen 3' })
  })

  it('has no advanced list unless an advanced spec is filled in, and then uses plain labels', () => {
    expect(advancedSpecGroups(simpleOnly)).toEqual({})
    const groups = advancedSpecGroups({ ...simpleOnly, os: 'Android 15', nfc: true, display: { ...simpleOnly.display, resolution: { width: 1440, height: 3120 } } })
    expect(groups.Screen).toEqual({ Size: '6.7″', Resolution: '1440 × 3120 pixels', 'Refresh rate': '120 Hz' })
    expect(groups.Performance).toEqual({ Chipset: 'Snapdragon 8 Gen 3', 'Operating system': 'Android 15' })
    expect(groups.Cameras).toEqual({ Main: '50 MP' })
    expect(groups.Battery).toEqual({ Capacity: '5000 mAh', Charging: '45 W' })
    expect(groups.Connections).toEqual({ NFC: 'Yes' })
    expect(groups.Body).toBeUndefined()
  })

  it('shows a phone without advanced specs as simple even when Advanced is chosen', () => {
    const phone = { ...phones[0]!, advancedSpecs: {} }
    render(<KeySpecs phone={phone} mode="advanced" />)
    expect(screen.getByText(phone.simpleSpecs.chipset)).toBeInTheDocument()
  })
})

function Harness({ specs }: { specs: Record<string, unknown> }) {
  const [form, setForm] = useState(() => specsToForm(specs))
  return <form><SpecFields value={form} onChange={setForm} /><output data-testid="camera">{form.rear[0]?.megapixels}</output></form>
}

describe('admin spec boxes', () => {
  it('opens on Simple with six boxes and shows every box on Advanced', async () => {
    const user = userEvent.setup()
    render(<Harness specs={{ batteryMah: 5000 }} />)
    const group = screen.getByRole('radiogroup', { name: 'How many specifications to show' })
    expect(within(group).getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true')
    for (const label of ['Screen size (inches)', 'Refresh rate (Hz)', 'Chipset (processor)', 'Main camera (megapixels)', 'Battery (mAh)', 'Charging (watts)']) expect(screen.getByLabelText(label)).toBeInTheDocument()
    expect(screen.queryByLabelText('GPU')).toBeNull()
    await user.type(screen.getByLabelText('Main camera (megapixels)'), '50')
    expect(screen.getByTestId('camera')).toHaveTextContent('50')
    await user.click(within(group).getByRole('radio', { name: /Advanced/ }))
    expect(screen.getByLabelText('GPU')).toBeInTheDocument()
    expect(screen.getByLabelText('Megapixels')).toHaveValue('50')
  })

  it('opens on Advanced when advanced specs are already filled in', () => {
    render(<Harness specs={{ batteryMah: 5000, os: 'Android 15' }} />)
    expect(screen.getByRole('radio', { name: /Advanced/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Operating system')).toHaveValue('Android 15')
  })
})
