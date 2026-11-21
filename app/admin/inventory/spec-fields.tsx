'use client'

type Specs = Record<string, unknown>
type YesNo = '' | 'yes' | 'no'
type CameraRow = { name: string; megapixels: string; details: string }

/** Every specification as text, the way the edit form shows it. Empty text means "Not specified". */
export type SpecForm = {
  sizeInches: string; resWidth: string; resHeight: string; displayType: string; refreshRateHz: string; brightnessNits: string; protection: string
  chipset: string; cpu: string; gpu: string
  rear: CameraRow[]
  frontMp: string; frontDetails: string
  batteryMah: string; chargingWatts: string
  fiveG: YesNo; nfc: YesNo; esim: YesNo
  height: string; width: string; depth: string; weightGrams: string
  waterRating: string; os: string
}

const obj = (value: unknown) => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}) as Record<string, unknown>
const str = (value: unknown) => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
const yesNo = (value: unknown): YesNo => value === true ? 'yes' : value === false ? 'no' : ''
const emptyCamera = (): CameraRow => ({ name: '', megapixels: '', details: '' })

export function specsToForm(specs: Specs): SpecForm {
  const display = obj(specs.display)
  const resolution = obj(display.resolution)
  const front = obj(specs.frontCamera)
  const size = obj(specs.dimensionsMm)
  const rear = Array.isArray(specs.rearCamera) ? specs.rearCamera.map((item) => { const camera = obj(item); return { name: str(camera.name), megapixels: str(camera.megapixels), details: str(camera.details) } }) : []
  return {
    sizeInches: str(display.sizeInches), resWidth: str(resolution.width), resHeight: str(resolution.height), displayType: str(display.type),
    refreshRateHz: str(display.refreshRateHz), brightnessNits: str(display.brightnessNits), protection: str(display.protection),
    chipset: str(specs.chipset), cpu: str(specs.cpu), gpu: str(specs.gpu),
    rear: rear.length ? rear : [emptyCamera()],
    frontMp: str(front.megapixels), frontDetails: str(front.details),
    batteryMah: str(specs.batteryMah), chargingWatts: str(specs.chargingWatts),
    fiveG: yesNo(specs.fiveG), nfc: yesNo(specs.nfc), esim: yesNo(specs.esim),
    height: str(size.height), width: str(size.width), depth: str(size.depth), weightGrams: str(specs.weightGrams),
    waterRating: str(specs.waterRating), os: str(specs.os),
  }
}

class SpecError extends Error {}

const number = (value: string, label: string, whole = false) => {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed <= 0 || (whole && !Number.isInteger(parsed))) throw new SpecError(`${label} must be a ${whole ? 'whole ' : ''}number above 0.`)
  return parsed
}
const words = (value: string) => value.trim() || null
const flag = (value: YesNo) => value === 'yes' ? true : value === 'no' ? false : null

/** Which form boxes feed each stored specification. */
const groups: Record<string, (keyof SpecForm)[]> = {
  display: ['sizeInches', 'resWidth', 'resHeight', 'displayType', 'refreshRateHz', 'brightnessNits', 'protection'],
  chipset: ['chipset'], cpu: ['cpu'], gpu: ['gpu'], rearCamera: ['rear'], frontCamera: ['frontMp', 'frontDetails'],
  batteryMah: ['batteryMah'], chargingWatts: ['chargingWatts'], fiveG: ['fiveG'], nfc: ['nfc'], esim: ['esim'],
  dimensionsMm: ['height', 'width', 'depth'], weightGrams: ['weightGrams'], waterRating: ['waterRating'], os: ['os'],
}

/**
 * Turns the form back into the stored specification object. Only the specifications whose boxes
 * were changed are checked and rewritten; everything else is kept exactly as it was stored.
 */
export function formToSpecs(form: SpecForm, original: Specs): { specs: Specs } | { error: string } {
  const before = specsToForm(original)
  const touched = (key: string) => groups[key]!.some((field) => JSON.stringify(form[field]) !== JSON.stringify(before[field]))
  try {
    const next: Specs = { ...original }
    if (touched('display')) {
      const resWidth = number(form.resWidth, 'Resolution width', true)
      const resHeight = number(form.resHeight, 'Resolution height', true)
      if ((resWidth === null) !== (resHeight === null)) throw new SpecError('Enter both resolution numbers, or leave both empty.')
      const display = {
        sizeInches: number(form.sizeInches, 'Screen size'), resolution: resWidth && resHeight ? { width: resWidth, height: resHeight } : null,
        type: words(form.displayType), refreshRateHz: number(form.refreshRateHz, 'Refresh rate', true), brightnessNits: number(form.brightnessNits, 'Brightness', true), protection: words(form.protection),
      }
      next.display = Object.values(display).some((value) => value !== null) ? { ...obj(original.display), ...display } : null
    }
    if (touched('dimensionsMm')) {
      const dims = [number(form.height, 'Height'), number(form.width, 'Width'), number(form.depth, 'Thickness')]
      if (dims.some((value) => value === null) && dims.some((value) => value !== null)) throw new SpecError('Enter height, width and thickness together, or leave all three empty.')
      next.dimensionsMm = dims[0] !== null ? { height: dims[0], width: dims[1], depth: dims[2] } : null
    }
    if (touched('rearCamera')) {
      const stored = Array.isArray(original.rearCamera) ? original.rearCamera : []
      const rear = form.rear
        .map((camera, index) => ({ camera, extra: obj(stored[index]) }))
        .filter(({ camera }) => camera.name.trim() || camera.megapixels.trim() || camera.details.trim())
        .map(({ camera, extra }, index) => ({ ...extra, name: camera.name.trim() || (index === 0 ? 'Main' : `Camera ${index + 1}`), megapixels: number(camera.megapixels, `Rear camera ${index + 1} megapixels`), details: words(camera.details) }))
      next.rearCamera = rear.length ? rear : null
    }
    if (touched('frontCamera')) {
      const frontMp = number(form.frontMp, 'Front camera megapixels')
      next.frontCamera = frontMp !== null || form.frontDetails.trim() ? { ...obj(original.frontCamera), megapixels: frontMp, details: words(form.frontDetails) } : null
    }
    const simple: [string, () => unknown][] = [
      ['chipset', () => words(form.chipset)], ['cpu', () => words(form.cpu)], ['gpu', () => words(form.gpu)],
      ['batteryMah', () => number(form.batteryMah, 'Battery', true)], ['chargingWatts', () => number(form.chargingWatts, 'Charging')],
      ['fiveG', () => flag(form.fiveG)], ['nfc', () => flag(form.nfc)], ['esim', () => flag(form.esim)],
      ['weightGrams', () => number(form.weightGrams, 'Weight')], ['waterRating', () => words(form.waterRating)], ['os', () => words(form.os)],
    ]
    for (const [key, read] of simple) if (touched(key)) next[key] = read()
    return { specs: next }
  } catch (cause) {
    if (cause instanceof SpecError) return { error: cause.message }
    throw cause
  }
}

/** Compares two stored values, ignoring key order and treating a missing value as empty. */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((key) => (value as Specs)[key] != null).map((key) => `${JSON.stringify(key)}:${stable((value as Specs)[key])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}
const changedKeys = (before: Specs, after: Specs) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => stable(before[key]) !== stable(after[key]))
export const specsChanged = (before: Specs, after: Specs) => changedKeys(before, after).length > 0

/** Marks every specification the person changed as hand-edited, so later automatic lookups leave it alone. */
export function editedMeta(before: Specs, after: Specs, meta: Specs): Specs {
  const updatedAt = new Date().toISOString()
  const next = { ...meta }
  for (const key of changedKeys(before, after)) next[key] = { source: 'manual', status: 'edited', locked: true, updatedAt }
  return next
}

export function SpecFields({ value, onChange }: { value: SpecForm; onChange: (next: SpecForm) => void }) {
  const set = (key: keyof SpecForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [key]: event.target.value })
  // No example text inside the boxes: grey examples were mistaken for found specifications.
  const field = (label: string, key: keyof SpecForm, numeric = false) =>
    <label className="admin-label">{label}<input value={value[key] as string} onChange={set(key)} inputMode={numeric ? 'decimal' : undefined} maxLength={120} /></label>
  const choice = (label: string, key: 'fiveG' | 'nfc' | 'esim') =>
    <label className="admin-label">{label}<select value={value[key]} onChange={set(key)}><option value="">Not known</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  const setCamera = (index: number, key: keyof CameraRow, text: string) => onChange({ ...value, rear: value.rear.map((camera, at) => at === index ? { ...camera, [key]: text } : camera) })

  return <>
    <h3 className="admin-form-heading full">Screen</h3>
    {field('Size (inches)', 'sizeInches', true)}
    {field('Type', 'displayType')}
    {field('Resolution width (pixels)', 'resWidth', true)}
    {field('Resolution height (pixels)', 'resHeight', true)}
    {field('Refresh rate (Hz)', 'refreshRateHz', true)}
    {field('Brightness (nits)', 'brightnessNits', true)}
    <div className="full">{field('Glass protection', 'protection')}</div>

    <h3 className="admin-form-heading full">Performance</h3>
    {field('Chipset', 'chipset')}
    {field('Operating system', 'os')}
    {field('CPU', 'cpu')}
    {field('GPU', 'gpu')}

    <h3 className="admin-form-heading full">Cameras</h3>
    {value.rear.map((camera, index) => <div key={index} className="admin-camera-row full">
      <label className="admin-label">Rear camera {index + 1}<input value={camera.name} onChange={(event) => setCamera(index, 'name', event.target.value)} maxLength={60} /></label>
      <label className="admin-label">Megapixels<input value={camera.megapixels} onChange={(event) => setCamera(index, 'megapixels', event.target.value)} inputMode="decimal" /></label>
      <label className="admin-label">Details<input value={camera.details} onChange={(event) => setCamera(index, 'details', event.target.value)} maxLength={120} /></label>
      {value.rear.length > 1 && <button type="button" className="admin-icon-button danger" aria-label={`Remove rear camera ${index + 1}`} title="Remove this camera" onClick={() => onChange({ ...value, rear: value.rear.filter((_, at) => at !== index) })}>×</button>}
    </div>)}
    {value.rear.length < 6 && <button type="button" className="button button-outline button-small full admin-add-camera" onClick={() => onChange({ ...value, rear: [...value.rear, emptyCamera()] })}>Add a rear camera</button>}
    {field('Front camera megapixels', 'frontMp', true)}
    {field('Front camera details', 'frontDetails')}

    <h3 className="admin-form-heading full">Battery</h3>
    {field('Battery (mAh)', 'batteryMah', true)}
    {field('Charging (watts)', 'chargingWatts', true)}

    <h3 className="admin-form-heading full">Connections</h3>
    {choice('5G', 'fiveG')}
    {choice('NFC', 'nfc')}
    {choice('eSIM', 'esim')}

    <h3 className="admin-form-heading full">Body</h3>
    {field('Height (mm)', 'height', true)}
    {field('Width (mm)', 'width', true)}
    {field('Thickness (mm)', 'depth', true)}
    {field('Weight (grams)', 'weightGrams', true)}
    <div className="full">{field('Water resistance', 'waterRating')}</div>
    <p className="admin-inline-note full">Leave a box empty if you don’t know it. Customers then see “Not specified”.</p>
  </>
}
