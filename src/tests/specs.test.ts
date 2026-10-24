import { describe, expect, it } from 'vitest'
import { parsePastedSpecs } from '../lib/specs/paste-parser'
import { mergeSpecs, normalizeResolution, validateSpecs } from '../lib/specs/normalize'
import { fetchSpecs } from '../lib/specs/orchestrator'
import type { SpecProvider } from '../lib/specs/types'

describe('specification normalization', () => {
  it.each([
    ['2400 x 1080 pixels', { width: 2400, height: 1080 }],
    ['2,772 × 1,284', { width: 2772, height: 1284 }],
    ['unknown resolution', null],
  ])('normalizes resolution strings', (value, expected) => {
    expect(normalizeResolution(value)).toEqual(expected)
  })

  it('flags invalid measurements rather than presenting them as facts', () => {
    const result = validateSpecs({ batteryMah: 14000, ramGb: 64, weightGrams: 220 })
    expect(result.specs).toMatchObject({ batteryMah: null, ramGb: null, weightGrams: 220 })
    expect(result.statuses).toMatchObject({ batteryMah: 'flagged', ramGb: 'flagged', weightGrams: 'fetched' })
  })

  it.each([
    ['Samsung copy', `Display: 6.7-inch Super AMOLED, 120 Hz\nResolution: 2340 × 1080\nChipset: Exynos 1480\nBattery: 5,000 mAh\nCharging: 25 W\nRAM: 8 GB\nStorage: 256 GB\n5G: Yes`, { chipset: 'Exynos 1480', batteryMah: 5000, ramGb: 8, storageGb: 256, fiveG: true }],
    ['Apple copy', `Screen size: 6.1 inches OLED\nResolution: 2556 x 1179 pixels\nProcessor: Apple A17 Pro\nRear camera: 48 MP + 12 MP + 12 MP\nFront camera: 12 MP\nOperating system: iOS 17\nWeight: 187 g`, { chipset: 'Apple A17 Pro', weightGrams: 187 }],
    ['Xiaomi copy', `Display: 6.67 inches AMOLED\nRefresh rate: 120 Hz\nBrightness: 1,800 nits\nProtection: Gorilla Glass Victus\nBattery capacity: 5,000 mAh\nCharging speed: 67 W\nNFC: Yes`, { batteryMah: 5000, chargingWatts: 67, nfc: true }],
    ['Unknown values', `Display: unknown\nBattery: unknown\nRAM: unknown\nStorage: unknown`, { batteryMah: null }],
    ['Invalid extreme', `Battery: 15,000 mAh\nRAM: 64 GB\nStorage: 9999 GB`, { batteryMah: null, ramGb: null, storageGb: null }],
  ])('parses and validates pasted product copy (%s)', (_name, text, expected) => {
    expect(parsePastedSpecs(text)).toMatchObject(expected)
  })

  it('merges only missing values and preserves known earlier values', () => {
    expect(mergeSpecs({ chipset: 'Known SoC', batteryMah: null }, { chipset: 'Guessed SoC', batteryMah: 5000 })).toMatchObject({
      chipset: 'Known SoC',
      batteryMah: 5000,
    })
  })
})

describe('specification provider orchestration', () => {
  it('respects provider priority, preserves locked fields and records source metadata', async () => {
    const database: SpecProvider = { name: 'database', fetch: async () => ({ specs: { chipset: 'Stored chipset', batteryMah: 5000 }, sourceUrls: ['https://example.com/specs'] }) }
    const wiki: SpecProvider = { name: 'wikipedia', fetch: async () => ({ specs: { chipset: 'Different chipset', os: 'Android' }, sourceUrls: ['https://example.com/wiki'] }) }
    const result = await fetchSpecs(
      { brand: 'Example', model: 'Phone', existing: { chipset: 'Owner-confirmed' }, lockedFields: ['chipset'] },
      { providers: [database, wiki] },
    )
    expect(result.specs).toMatchObject({ chipset: 'Owner-confirmed', batteryMah: 5000, os: 'Android' })
    expect(result.metadata.batteryMah).toMatchObject({ source: 'database', status: 'fetched' })
    expect(result.sourceUrls).toEqual(['https://example.com/specs', 'https://example.com/wiki'])
  })

  it('reports provider errors and continues to later providers', async () => {
    const broken: SpecProvider = { name: 'database', fetch: async () => { throw new Error('offline') } }
    const pasted: SpecProvider = { name: 'pasted', fetch: async () => ({ specs: { batteryMah: 4500 }, sourceUrls: [] }) }
    const result = await fetchSpecs({ brand: 'Example', model: 'Phone', pastedText: 'Battery: 4,500 mAh' }, { providers: [broken, pasted] })
    expect(result.providers).toMatchObject([{ name: 'database', status: 'failed', error: 'offline' }, { name: 'pasted', status: 'found', foundFields: 1 }])
    expect(result.specs.batteryMah).toBe(4500)
  })

  it('continues after timed out sources and clears successful-source timers', async () => {
    const slow: SpecProvider = { name: 'database', fetch: () => new Promise(() => {}) }
    const next: SpecProvider = { name: 'pasted', fetch: async () => ({ specs: { batteryMah: 4100 }, sourceUrls: [] }) }
    const result = await fetchSpecs({ brand: 'Example', model: 'Phone', pastedText: 'known input' }, { providers: [slow, next], timeoutMs: 5 })
    expect(result.providers[0]).toMatchObject({ status: 'failed', error: 'Provider exceeded 0.005s timeout.' })
    expect(result.specs.batteryMah).toBe(4100)
  })
})
