import { describe, expect, it } from 'vitest'
import { findLibraryEntry } from '../lib/specs/database-provider'
import { brandAndModel, parseWikiPhonePage } from '../lib/specs/wiki-infobox'

// A shortened copy of the real "Samsung Galaxy S24" phone box on Wikipedia.
const s24 = `Intro text {{Short description|Phones}}
{{Infobox mobile phone
| name = Samsung Galaxy S24 series
| brand = [[Samsung]]
| networks = [[2G]] / [[3G]] / [[4G]] / [[5G]]
| released = '''S24, S24+ and S24 Ultra''': {{Start date and age|2024|01|31}}<br>'''S24 FE''': {{Start date and age|2024|10|03}}
| dimensions = '''S24''': {{convert|147*70.6*7.6|mm|in|abbr=on}}<br>'''S24 Ultra''': {{convert|162.3*79*8.6|mm|in|abbr=on}}
| weight = '''S24''': {{convert|168|g|oz|abbr=on}}<br>'''S24 Ultra''': {{convert|233|g|oz|abbr=on}}
| os = '''Original (S24 and S24 Ultra):'''<br>[[Android 14]] with [[One UI|One UI 6.1]]<br>'''Current:'''<br>[[Android 17]]
| soc = '''S24 and S24+ North America''': [[Qualcomm Snapdragon 8 Gen 3|Snapdragon 8 Gen 3]]<br>'''S24 Ultra Worldwide''': Snapdragon 8 Gen 3 for Galaxy<br>'''S24 FE''': [[Samsung Exynos]] 2400e
| battery = '''S24''': [[Li-ion]] 4000 [[mAh]]<br>'''S24+''': 4900 mAh<br>'''S24 Ultra''': 5000 mAh<br>'''S24 FE''': 4700 mAh
| charging = Wired charging at 25W (S24) or 45W (S24 Ultra)
| display = Dynamic [[AMOLED]] 2X, peak brightness 2600 nits, 120&nbsp;Hz<br>'''S24''': {{convert|6.2|in|mm|abbr=on}} {{resx|2340|1080}}<br>'''S24 Ultra''': {{convert|6.8|in|mm|abbr=on}} {{resx|3120|1440}}
| rear_camera = '''S24''': 50 MP, {{f/|1.8}} (wide), OIS<br>12 MP (ultrawide)<br>'''S24 Ultra''': 200 MP (wide), OIS<br>50 MP (periscope telephoto)
| front_camera = 12 MP, {{f/|2.2}}
}}
More text.`

describe('reading a Wikipedia phone box', () => {
  const phones = parseWikiPhonePage('Samsung Galaxy S24', s24)
  const phone = (model: string) => phones.find((entry) => entry.model === model)

  it('makes one phone for each model on a series page', () => {
    expect(phones.map((entry) => entry.model).sort()).toEqual(['Galaxy S24', 'Galaxy S24 FE', 'Galaxy S24 Ultra', 'Galaxy S24+'])
    expect(phones.every((entry) => entry.brand === 'Samsung')).toBe(true)
  })

  it('gives each model its own values and never another model’s', () => {
    expect(phone('Galaxy S24')?.specs).toMatchObject({ batteryMah: 4000, weightGrams: 168, dimensionsMm: { height: 147, width: 70.6, depth: 7.6 }, display: { sizeInches: 6.2, resolution: { width: 1080, height: 2340 }, type: 'Dynamic AMOLED 2X', refreshRateHz: 120, brightnessNits: 2600 }, chipset: 'Snapdragon 8 Gen 3', os: 'Android 14 with One UI 6.1', fiveG: true })
    expect(phone('Galaxy S24 Ultra')?.specs).toMatchObject({ batteryMah: 5000, weightGrams: 233, chipset: 'Snapdragon 8 Gen 3 for Galaxy', display: { sizeInches: 6.8 } })
    expect(phone('Galaxy S24 Ultra')?.specs.rearCamera).toEqual([{ name: 'Main', megapixels: 200, details: '(wide), OIS' }, { name: 'Periscope telephoto', megapixels: 50, details: '(periscope telephoto)' }])
    expect(phone('Galaxy S24')?.specs.rearCamera?.[0]).toEqual({ name: 'Main', megapixels: 50, details: 'f/1.8 (wide), OIS' })
    expect(phone('Galaxy S24 FE')?.specs).toMatchObject({ batteryMah: 4700, chipset: 'Samsung Exynos 2400e' })
    expect(phone('Galaxy S24 FE')?.specs.weightGrams).toBeUndefined()
    expect(phone('Galaxy S24 FE')?.specs.display?.sizeInches).toBeNull()
  })

  it('reads the release year of each model', () => {
    expect(phone('Galaxy S24')?.released).toBe(2024)
    expect(phone('Galaxy S24 FE')?.released).toBe(2024)
  })

  it('files sub-brands under the shop brand', () => {
    expect(brandAndModel('IPhone 16 Pro')).toEqual({ brand: 'Apple', model: 'iPhone 16 Pro' })
    expect(brandAndModel('Xiaomi Redmi Note 13')).toEqual({ brand: 'Xiaomi', model: 'Redmi Note 13' })
    expect(brandAndModel('POCO X6 Pro')).toEqual({ brand: 'Xiaomi', model: 'Poco X6 Pro' })
    expect(brandAndModel('Huawei Honor 20')).toEqual({ brand: 'Honor', model: '20' })
    expect(brandAndModel('Vivo iQOO 12')).toEqual({ brand: 'vivo', model: 'iQOO 12' })
    expect(brandAndModel('IPhone SE (3rd generation)')).toEqual({ brand: 'Apple', model: 'iPhone SE (3rd generation)' })
    expect(brandAndModel('Samsung Galaxy A7 (2018)')).toEqual({ brand: 'Samsung', model: 'Galaxy A7 (2018)' })
    expect(brandAndModel('Oppo Find X (smartphone)')).toEqual({ brand: 'OPPO', model: 'Find X' })
    expect(brandAndModel('Google Pixel 9')).toBeNull()
    expect(parseWikiPhonePage('Samsung Galaxy Tab S9', s24)).toEqual([])
  })
})

describe('finding a phone in the saved library', () => {
  it('ignores capitals and spaces', () => {
    expect(findLibraryEntry('samsung', 'galaxy s24 ultra')?.model).toBe('Galaxy S24 Ultra')
    expect(findLibraryEntry('Apple', 'iphone16')?.model).toBe('iPhone 16')
  })

  it('keeps a phone and its 5G version apart', () => {
    expect(findLibraryEntry('Xiaomi', 'Redmi Note 13')?.specs.chipset).toMatch(/Snapdragon 685/)
    expect(findLibraryEntry('Xiaomi', 'Redmi Note 13 5G')?.specs.chipset).toMatch(/Dimensity 6080/)
  })

  it('accepts a missing "5G" only when one phone fits', () => {
    expect(findLibraryEntry('OnePlus', 'Nord CE 3')?.model).toBe('Nord CE 3 5G')
    expect(findLibraryEntry('OnePlus', '15')).toBeUndefined()
  })
})
