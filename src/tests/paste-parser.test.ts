import { describe, expect, it } from 'vitest'
import { parsePastedSpecs } from '../lib/specs/paste-parser'

const samples = {
  galaxy: `Display: 6.8 inches Dynamic AMOLED 2X
Resolution: 3120 x 1440 pixels
Refresh rate: 120 Hz
Brightness: 2600 nits
Chipset: Snapdragon 8 Gen 3 for Galaxy
Rear camera: 200 MP + 50 MP + 12 MP + 10 MP
Front camera: 12 MP
Battery: 5000 mAh
Charging: 45W wired
Operating system: Android 14, One UI 6.1
Dimensions: 162.3 x 79.0 x 8.6 mm
Weight: 232 g
Water resistance: IP68
5G: Yes
NFC
eSIM`,
  iphone: `Screen size - 6.1 inches Super Retina XDR OLED
Resolution - 2556 × 1179
Refresh rate - 120 Hz
Processor - Apple A17 Pro
Main camera - 48 MP, 12 MP, 12 MP
Selfie camera - 12 MP
Battery capacity - 3274 mAh
OS - iOS 17
Weight - 187 grams
IP rating - IP 68`,
  redmi: `Display size: 6.67" AMOLED
Refresh rate: 120Hz
Chipset: MediaTek Dimensity 7200 Ultra
RAM: 8 GB
Storage: 256 GB
Battery: 5,100 mAh
Charging speed: 67 W
No NFC`,
  pixel: `Display: 6.2 inches OLED LTPO
Refresh rate: 120 Hz
Protection: Gorilla Glass Victus 2
SoC: Google Tensor G3
GPU: Immortalis-G715s MC10
Rear cameras: 50 MP, 12 MP
Front camera: 10.5 MP
Battery: 4575 mAh
Software: Android 14
Dimensions: 150.5 x 70.8 x 8.9 mm`,
  budget: `Screen: 6.5 inch IPS LCD
Resolution: 1600 x 720
Chipset: Unisoc T606
RAM: 4 GB
Storage: 64 GB
Battery: 5000 mAh
5G: Not supported`,
}

describe('paste parser with realistic spec text', () => {
  it('parses a flagship Android spec sheet into typed fields', () => {
    const specs = parsePastedSpecs(samples.galaxy)
    expect(specs.display?.sizeInches).toBe(6.8)
    expect(specs.display?.resolution).toEqual({ width: 3120, height: 1440 })
    expect(specs.display?.refreshRateHz).toBe(120)
    expect(specs.batteryMah).toBe(5000)
    expect(specs.chargingWatts).toBe(45)
    expect(specs.rearCamera?.map((camera) => camera.megapixels)).toEqual([200, 50, 12, 10])
    expect(specs.dimensionsMm).toEqual({ height: 162.3, width: 79, depth: 8.6 })
    expect(specs.weightGrams).toBe(232)
    expect(specs.waterRating).toBe('IP68')
    expect(specs.fiveG).toBe(true)
    expect(specs.nfc).toBe(true)
    expect(specs.esim).toBe(true)
  })

  it('accepts dash separators and alternative labels', () => {
    const specs = parsePastedSpecs(samples.iphone)
    expect(specs.display?.sizeInches).toBe(6.1)
    expect(specs.chipset).toBe('Apple A17 Pro')
    expect(specs.frontCamera?.megapixels).toBe(12)
    expect(specs.batteryMah).toBe(3274)
    expect(specs.waterRating).toBe('IP68')
    expect(specs.weightGrams).toBe(187)
  })

  it('handles thousands separators, inch symbols and explicit "No NFC"', () => {
    const specs = parsePastedSpecs(samples.redmi)
    expect(specs.display?.sizeInches).toBe(6.67)
    expect(specs.batteryMah).toBe(5100)
    expect(specs.chargingWatts).toBe(67)
    expect(specs.ramGb).toBe(8)
    expect(specs.storageGb).toBe(256)
    expect(specs.nfc).toBe(false)
  })

  it('keeps GPU, protection and multiple rear cameras', () => {
    const specs = parsePastedSpecs(samples.pixel)
    expect(specs.chipset).toBe('Google Tensor G3')
    expect(specs.gpu).toBe('Immortalis-G715s MC10')
    expect(specs.display?.protection).toBe('Gorilla Glass Victus 2')
    expect(specs.rearCamera).toHaveLength(2)
    expect(specs.os).toBe('Android 14')
  })

  it('treats "5G: Not supported" as false and leaves absent fields empty', () => {
    const specs = parsePastedSpecs(samples.budget)
    expect(specs.fiveG).toBe(false)
    expect(specs.ramGb).toBe(4)
    expect(specs.nfc).toBeUndefined()
    expect(specs.weightGrams).toBeUndefined()
  })

  it('returns an empty result for empty or unrelated text', () => {
    expect(parsePastedSpecs('')).toEqual({})
    expect(parsePastedSpecs('Great phone, fast delivery, would buy again.')).toEqual({})
  })
})
