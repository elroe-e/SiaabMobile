'use client'

import { useEffect, useMemo, useState } from 'react'
import { splitColors } from '../../../src/lib/colors'
import { preparePhoto, uploadPhoto } from './photo-tools'

type Role = 'owner' | 'staff'
type Kind = 'new' | 'used' | 'upcoming'
type Specs = Record<string, unknown>
type ProviderInfo = { name: string; status: string; foundFields: number; message?: string }
type CreateResult = { modelId?: string; unitId?: string }

const providerLabel: Record<string, string> = { database: 'Saved library', wikipedia: 'Wikipedia', ai: 'Google AI', pasted: 'Pasted text' }
const MAX_PHOTOS = 8

const text = (value: unknown) => typeof value === 'string' && value ? value : null
const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null

/** Turns the stored specification object into short, readable rows for the owner to check. */
export function specRows(specs: Specs): [string, string][] {
  const rows: [string, string | null][] = []
  const display = (typeof specs.display === 'object' && specs.display ? specs.display : {}) as Record<string, unknown>
  rows.push(['Display', [num(display.sizeInches) ? `${num(display.sizeInches)}″` : null, text(display.type), num(display.refreshRateHz) ? `${num(display.refreshRateHz)} Hz` : null].filter(Boolean).join(' · ') || null])
  rows.push(['Chipset', text(specs.chipset)])
  rows.push(['Rear camera', Array.isArray(specs.rearCamera) ? specs.rearCamera.map((item) => (item && typeof item === 'object' && 'megapixels' in item && item.megapixels ? `${String(item.megapixels)} MP` : '')).filter(Boolean).join(' + ') || null : null])
  const front = (typeof specs.frontCamera === 'object' && specs.frontCamera ? specs.frontCamera : {}) as Record<string, unknown>
  rows.push(['Front camera', num(front.megapixels) ? `${num(front.megapixels)} MP` : null])
  rows.push(['Battery', [num(specs.batteryMah) ? `${num(specs.batteryMah)} mAh` : null, num(specs.chargingWatts) ? `${num(specs.chargingWatts)} W charging` : null].filter(Boolean).join(' · ') || null])
  rows.push(['RAM', num(specs.ramGb) ? `${num(specs.ramGb)} GB` : null])
  rows.push(['Storage', num(specs.storageGb) ? `${num(specs.storageGb)} GB` : null])
  rows.push(['5G', typeof specs.fiveG === 'boolean' ? (specs.fiveG ? 'Yes' : 'No') : null])
  rows.push(['NFC', typeof specs.nfc === 'boolean' ? (specs.nfc ? 'Yes' : 'No') : null])
  rows.push(['Operating system', text(specs.os)])
  rows.push(['Weight', num(specs.weightGrams) ? `${num(specs.weightGrams)} g` : null])
  rows.push(['Water resistance', text(specs.waterRating)])
  return rows.filter((row): row is [string, string] => row[1] !== null)
}

export function CreateInventoryModal({ role, onClose, onCreate, onFinished }: {
  role: Role
  onClose: () => void
  onCreate: (body: Record<string, unknown>) => Promise<CreateResult>
  onFinished: (message: string) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [kind, setKind] = useState<Kind>('new')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [colors, setColors] = useState('')
  const [ramGb, setRamGb] = useState('8')
  const [storageGb, setStorageGb] = useState('128')
  const [price, setPrice] = useState('')
  const [stockCount, setStockCount] = useState('1')
  const [expectedDate, setExpectedDate] = useState('')
  const [expectedPriceRange, setExpectedPriceRange] = useState('')
  const [used, setUsed] = useState({ grade: 'A', batteryHealthPct: '90', accessories: 'Phone only', warrantyMonths: '0', costPrice: '', imei: '', notesInternal: '' })
  const [files, setFiles] = useState<File[]>([])
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  const [specs, setSpecs] = useState<Specs>({})
  const [specMeta, setSpecMeta] = useState<Record<string, unknown>>({})
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [jsonText, setJsonText] = useState('{}')
  const [reviewed, setReviewed] = useState(false)
  const [publish, setPublish] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const slug = useMemo(() => `${brand}-${model}`.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), [brand, model])
  const needsColor = kind !== 'upcoming'

  const withEntered = (base: Specs): Specs => ({
    ...base,
    ...(kind !== 'upcoming' && num(base.ramGb) === null && Number(ramGb) ? { ramGb: Number(ramGb) } : {}),
    ...(kind !== 'upcoming' && num(base.storageGb) === null && Number(storageGb) ? { storageGb: Number(storageGb) } : {}),
  })

  const lookup = async (withPasted = false) => {
    setLookupBusy(true); setLookupError('')
    try {
      const response = await fetch('/api/admin/specs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand: brand.trim(), model: model.trim(), ...(withPasted && pastedText.trim() ? { pastedText } : {}) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Specification lookup failed.')
      const merged = withEntered((result.specs ?? {}) as Specs)
      setSpecs(merged); setJsonText(JSON.stringify(merged, null, 2))
      setSpecMeta((result.metadata ?? {}) as Record<string, unknown>)
      setProviders((result.providers ?? []) as ProviderInfo[])
    } catch (cause) {
      const merged = withEntered(specs)
      setSpecs(merged); setJsonText(JSON.stringify(merged, null, 2))
      setLookupError(cause instanceof Error ? cause.message : 'Specification lookup failed.')
    }
    setLookupBusy(false)
  }

  const goNext = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (needsColor && splitColors(colors).length === 0) { setError('Enter the colour (use commas for several, for example: Black, Blue).'); return }
    if (!slug) { setError('Enter the brand and model.'); return }
    setStep(2)
    await lookup()
  }

  const applyJson = () => {
    try { const parsed = JSON.parse(jsonText) as Specs; setSpecs(parsed); setError('') } catch { setError('The specification text is not valid JSON.') }
  }

  const save = async () => {
    setBusy(true); setError('')
    let finalSpecs: Specs
    try { finalSpecs = JSON.parse(jsonText) as Specs } catch { setBusy(false); setError('The specification text is not valid JSON.'); return }
    const body: Record<string, unknown> = {
      kind, brand: brand.trim(), model: model.trim(), slug,
      status: kind === 'upcoming' ? 'upcoming' : 'available',
      ...(kind === 'upcoming' ? { expectedDate, expectedPriceRange } : {}),
      specs: finalSpecs, specMeta, specsReviewed: reviewed, isPublished: reviewed && publish,
      ...(kind === 'new' ? { variant: { ramGb: Number(ramGb), storageGb: Number(storageGb), colorName: colors.trim(), price: Number(price), stockCount: Number(stockCount), lowStockThreshold: 2 } } : {}),
      ...(kind === 'used' ? { unit: { ramGb: Number(ramGb), storageGb: Number(storageGb), colorName: colors.trim(), grade: used.grade, batteryHealthPct: Number(used.batteryHealthPct), accessories: used.accessories, warrantyMonths: Number(used.warrantyMonths), price: Number(price), ...(used.costPrice ? { costPrice: Number(used.costPrice) } : {}), ...(used.imei ? { imei: used.imei } : {}), notesInternal: used.notesInternal } } : {}),
    }
    let created: CreateResult
    try { created = await onCreate(body) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create inventory.'); setBusy(false); return }
    const failures: string[] = []
    const targetId = kind === 'used' ? created.unitId : created.modelId
    if (targetId) {
      for (const file of files) {
        try { await uploadPhoto(kind === 'used' ? 'unit' : 'model', targetId, await preparePhoto(file), `${brand.trim()} ${model.trim()}`.trim()) }
        catch (cause) { failures.push(cause instanceof Error ? cause.message : `${file.name} failed to upload.`) }
      }
    }
    setBusy(false)
    if (failures.length) { setError(`The phone was saved, but some photos did not upload: ${failures.join(' ')} Open "Add model photos" on the phone to retry.`); return }
    onFinished(reviewed && publish ? 'Phone saved and published.' : 'Phone saved as a draft.')
  }

  const rows = specRows(specs)
  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((current) => [...current, ...Array.from(list).filter((file) => file.type.startsWith('image/'))].slice(0, MAX_PHOTOS))
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="create-inventory-title">
      <header className="admin-modal-header"><div><h2 id="create-inventory-title">Add phone</h2><p>{step === 1 ? 'Enter the basics and add photos. We find the other specifications for you.' : 'Check the specifications we found, then save.'}</p></div><button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close" disabled={busy}>×</button></header>
      <div className="admin-step-row">{['1 · Phone details', '2 · Specifications'].map((label, index) => <span key={label} className={`admin-step-chip ${index + 1 === step ? 'active' : ''}`}>{label}</span>)}</div>

      {step === 1 && <form onSubmit={(event) => void goNext(event)}>
        <div className="admin-form-grid">
          <label className="admin-label full">Type<select value={kind} onChange={(event) => setKind(event.target.value as Kind)}><option value="new">New phone</option><option value="used">Used phone (one unit)</option><option value="upcoming">Upcoming model</option></select></label>
          <label className="admin-label">Brand<input required maxLength={80} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Samsung" autoComplete="off" /></label>
          <label className="admin-label">Model<input required maxLength={120} value={model} onChange={(event) => setModel(event.target.value)} placeholder="Galaxy S25 Ultra" autoComplete="off" /></label>
          {needsColor && <label className="admin-label full">Colour<input required maxLength={120} value={colors} onChange={(event) => setColors(event.target.value)} placeholder="Black, Blue" /><small className="admin-inline-note">Customers see these colours but cannot pick one. Separate several with commas; each gets the same quantity.</small></label>}
          {kind !== 'upcoming' && <>
            <label className="admin-label">RAM (GB)<input type="number" min="1" max="24" required value={ramGb} onChange={(event) => setRamGb(event.target.value)} /></label>
            <label className="admin-label">Storage (GB)<input type="number" min="1" max="2048" required value={storageGb} onChange={(event) => setStorageGb(event.target.value)} /><small className="admin-inline-note">For 1 TB, enter 1024.</small></label>
            <label className="admin-label">Price (ETB)<input type="number" min="1" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            {kind === 'new' && <label className="admin-label">Quantity in stock<input type="number" min="0" required value={stockCount} onChange={(event) => setStockCount(event.target.value)} /></label>}
          </>}
          {kind === 'upcoming' && <>
            <label className="admin-label">Expected date<input required value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} placeholder="Expected Q4 2026" /></label>
            <label className="admin-label">Expected price range<input value={expectedPriceRange} onChange={(event) => setExpectedPriceRange(event.target.value)} placeholder="ETB 90,000 – 110,000" /></label>
          </>}
          {kind === 'used' && <>
            <label className="admin-label">Condition grade<select value={used.grade} onChange={(event) => setUsed({ ...used, grade: event.target.value })}><option value="A">A · excellent</option><option value="B">B · good</option><option value="C">C · fair</option></select></label>
            <label className="admin-label">Battery health (%)<input type="number" min="1" max="100" value={used.batteryHealthPct} onChange={(event) => setUsed({ ...used, batteryHealthPct: event.target.value })} /></label>
            <label className="admin-label">Accessories<input value={used.accessories} onChange={(event) => setUsed({ ...used, accessories: event.target.value })} /></label>
            <label className="admin-label">Warranty (months)<input type="number" min="0" max="120" value={used.warrantyMonths} onChange={(event) => setUsed({ ...used, warrantyMonths: event.target.value })} /></label>
            {role === 'owner' && <>
              <label className="admin-label">Cost price<input type="number" min="0" step="0.01" value={used.costPrice} onChange={(event) => setUsed({ ...used, costPrice: event.target.value })} /></label>
              <label className="admin-label">IMEI<input inputMode="numeric" pattern="[0-9]{14,16}" value={used.imei} onChange={(event) => setUsed({ ...used, imei: event.target.value })} /></label>
              <label className="admin-label full">Internal notes<input value={used.notesInternal} onChange={(event) => setUsed({ ...used, notesInternal: event.target.value })} /></label>
            </>}
          </>}
          <div className="admin-label full">
            <span>Photos ({files.length}/{MAX_PHOTOS})</span>
            <input type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} aria-label="Add photos" />
            <small className="admin-inline-note">The first photo is the main one. Photos are shrunk automatically before upload.</small>
            {files.length > 0 && <div className="admin-photo-previews">{previews.map((url, index) => <figure key={url}><img src={url} alt={`Photo ${index + 1}`} /><button type="button" onClick={() => setFiles(files.filter((_, position) => position !== index))} aria-label={`Remove photo ${index + 1}`}>×</button></figure>)}</div>}
          </div>
        </div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <div className="admin-form-actions"><button className="button button-outline button-small" type="button" onClick={onClose}>Cancel</button><button className="button button-primary button-small" type="submit">Next: find specifications</button></div>
      </form>}

      {step === 2 && <div>
        <div className="admin-form-grid">
          <div className="admin-label full">
            <span>{brand} {model}</span>
            {lookupBusy && <p className="admin-inline-note" role="status">Looking up specifications online…</p>}
            {!lookupBusy && rows.length > 0 && <dl className="admin-spec-list">{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
            {!lookupBusy && rows.length === 0 && <p className="admin-inline-note">No specifications were found online for this phone yet. You can paste them below, or save and customers will see "Not specified".</p>}
            {providers.length > 0 && <p className="admin-inline-note">{providers.map((provider) => `${providerLabel[provider.name] ?? provider.name}: ${provider.status === 'ok' || provider.foundFields > 0 ? `${provider.foundFields} found` : provider.status}`).join(' · ')}</p>}
            {lookupError && <p className="admin-inline-note" role="alert">{lookupError}</p>}
            <div className="admin-toolbar-left"><button type="button" className="button button-outline button-small" disabled={lookupBusy} onClick={() => void lookup()}>Search again</button></div>
          </div>
          <details className="admin-label full"><summary>Paste specifications from a website</summary>
            <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} rows={6} placeholder={'Display: 6.7 inches AMOLED\nChipset: Snapdragon 8 Gen 3\nBattery: 5000 mAh'} />
            <button type="button" className="button button-outline button-small" disabled={lookupBusy || !pastedText.trim()} onClick={() => void lookup(true)}>Use pasted text</button>
          </details>
          <details className="admin-label full"><summary>Advanced: edit specifications directly</summary>
            <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} spellCheck={false} rows={10} />
            <button type="button" className="button button-outline button-small" onClick={applyJson}>Apply changes</button>
          </details>
          <label className="admin-check full"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> These specifications look right.</label>
          <label className="admin-check full"><input type="checkbox" checked={publish} disabled={!reviewed} onChange={(event) => setPublish(event.target.checked)} /> Show this phone on the shop now.</label>
          {!reviewed && <p className="admin-inline-note full">Without confirming the specifications, the phone is saved as a draft and stays hidden from customers.</p>}
        </div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <div className="admin-form-actions"><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => setStep(1)}>Back</button><button className="button button-primary button-small" type="button" disabled={busy || lookupBusy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save phone'}</button></div>
      </div>}
    </section>
  </div>
}
