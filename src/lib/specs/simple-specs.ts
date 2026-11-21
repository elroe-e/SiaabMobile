/**
 * Which specifications count as "simple" (always shown on the shop) and which as "advanced"
 * (shown behind the Advanced button, only when the shop filled in at least one of them).
 * Simple: screen size, refresh rate, chipset, battery, charging speed and the rear camera megapixels.
 * RAM and storage come from the variant and are always shown, so they are neither.
 */
type Specs = Record<string, unknown>

const obj = (value: unknown) => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}) as Record<string, unknown>
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const txt = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const filled = (value: unknown): boolean => value !== null && value !== undefined && value !== '' && (typeof value !== 'object' || (Array.isArray(value) ? value.some(filled) : Object.values(value).some(filled)))
const cameras = (specs: Specs) => (Array.isArray(specs.rearCamera) ? specs.rearCamera.map(obj) : [])

const SIMPLE_KEYS = ['chipset', 'batteryMah', 'chargingWatts', 'ramGb', 'storageGb']
const SIMPLE_DISPLAY_KEYS = ['sizeInches', 'refreshRateHz']

/** True when any specification beyond the simple ones is filled in. */
export function hasAdvancedSpecs(specs: Specs): boolean {
  return Object.entries(specs).some(([key, value]) => {
    if (SIMPLE_KEYS.includes(key)) return false
    if (key === 'display') return Object.entries(obj(value)).some(([part, field]) => !SIMPLE_DISPLAY_KEYS.includes(part) && filled(field))
    if (key === 'rearCamera') return cameras(specs).some((camera) => filled(camera.details))
    return filled(value)
  })
}

/** The short specification lines on phone cards and the Simple view. Empty text means not known. */
export function simpleSpecLines(specs: Specs) {
  const display = obj(specs.display)
  const size = num(display.sizeInches)
  const refresh = num(display.refreshRateHz)
  const battery = num(specs.batteryMah)
  const charging = num(specs.chargingWatts)
  return {
    display: [size ? `${size}″` : null, refresh ? `${refresh} Hz` : null].filter(Boolean).join(' · '),
    camera: cameras(specs).map((camera) => num(camera.megapixels)).filter(Boolean).map((megapixels) => `${megapixels} MP`).join(' + '),
    battery: [battery ? `${battery} mAh` : null, charging ? `${charging} W charging` : null].filter(Boolean).join(' · '),
    chipset: txt(specs.chipset) ?? '',
  }
}

const yesNo = (value: unknown) => (value === true ? 'Yes' : value === false ? 'No' : null)

/** Every filled-in specification with plain labels, grouped like the admin boxes. Empty when there are no advanced specs. */
export function advancedSpecGroups(specs: Specs): Record<string, Record<string, string>> {
  if (!hasAdvancedSpecs(specs)) return {}
  const display = obj(specs.display)
  const resolution = obj(display.resolution)
  const front = obj(specs.frontCamera)
  const body = obj(specs.dimensionsMm)
  const line = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null
  const groups: Record<string, Record<string, string | null>> = {
    Screen: {
      Size: num(display.sizeInches) ? `${num(display.sizeInches)}″` : null,
      Type: txt(display.type),
      Resolution: num(resolution.width) && num(resolution.height) ? `${num(resolution.width)} × ${num(resolution.height)} pixels` : null,
      'Refresh rate': num(display.refreshRateHz) ? `${num(display.refreshRateHz)} Hz` : null,
      Brightness: num(display.brightnessNits) ? `${num(display.brightnessNits)} nits` : null,
      'Glass protection': txt(display.protection),
    },
    Performance: { Chipset: txt(specs.chipset), CPU: txt(specs.cpu), GPU: txt(specs.gpu), 'Operating system': txt(specs.os) },
    Cameras: {
      ...Object.fromEntries(cameras(specs).map((camera, index) => [txt(camera.name) ?? `Rear camera ${index + 1}`, line(num(camera.megapixels) ? `${num(camera.megapixels)} MP` : null, txt(camera.details))])),
      'Front camera': line(num(front.megapixels) ? `${num(front.megapixels)} MP` : null, txt(front.details)),
    },
    Battery: { Capacity: num(specs.batteryMah) ? `${num(specs.batteryMah)} mAh` : null, Charging: num(specs.chargingWatts) ? `${num(specs.chargingWatts)} W` : null },
    Connections: { '5G': yesNo(specs.fiveG), NFC: yesNo(specs.nfc), eSIM: yesNo(specs.esim) },
    Body: {
      Size: num(body.height) && num(body.width) && num(body.depth) ? `${num(body.height)} × ${num(body.width)} × ${num(body.depth)} mm` : null,
      Weight: num(specs.weightGrams) ? `${num(specs.weightGrams)} g` : null,
      'Water resistance': txt(specs.waterRating),
    },
  }
  return Object.fromEntries(Object.entries(groups)
    .map(([group, rows]) => [group, Object.fromEntries(Object.entries(rows).filter((row): row is [string, string] => row[1] !== null))] as const)
    .filter(([, rows]) => Object.keys(rows).length > 0))
}
