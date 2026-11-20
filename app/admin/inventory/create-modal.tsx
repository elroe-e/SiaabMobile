'use client'

import { useEffect, useMemo, useState } from 'react'
import { splitColors } from '../../../src/lib/colors'
import { modelSlug } from '../../../src/lib/format'
import { parsePastedSpecs } from '../../../src/lib/specs/paste-parser'
import { BrandPicker, canonicalBrand, ModelPicker } from './brand-picker'
import { isPhotoFile, preparePhoto, uploadPhoto } from './photo-tools'
import { editedMeta, formToSpecs, SpecFields, specsToForm, type SpecForm } from './spec-fields'

type Role = 'owner' | 'staff'
type Kind = 'new' | 'used' | 'upcoming'
type Specs = Record<string, unknown>
type ProviderInfo = { name: string; status: string; foundFields: number; error?: string }
type CreateResult = { modelId?: string; unitId?: string }

const providerLabel: Record<string, string> = { database: 'Saved library', wikipedia: 'Wikipedia', ai: 'Google AI', pasted: 'Pasted text' }
const MAX_PHOTOS = 8

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
  const [batteryMah, setBatteryMah] = useState('')
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
  const [form, setForm] = useState<SpecForm>(() => specsToForm({}))
  const [reviewed, setReviewed] = useState(false)
  const [publish, setPublish] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const slug = useMemo(() => modelSlug(brand, model), [brand, model])
  const needsColor = kind !== 'upcoming'

  /** What the person typed in step 1. The online lookup (Gemini, Wikipedia…) never replaces these. */
  const entered = (): Specs => ({
    ...(kind !== 'upcoming' && Number(ramGb) > 0 ? { ramGb: Number(ramGb) } : {}),
    ...(kind !== 'upcoming' && Number(storageGb) > 0 ? { storageGb: Number(storageGb) } : {}),
    ...(Number(batteryMah) > 0 ? { batteryMah: Number(batteryMah) } : {}),
  })
  const withEntered = (base: Specs): Specs => ({ ...base, ...entered() })
  /** Marks the typed values as set by hand, so a later lookup for this phone leaves them alone too. */
  const lockEntered = (meta: Record<string, unknown>) => {
    const updatedAt = new Date().toISOString()
    return { ...meta, ...Object.fromEntries(Object.keys(entered()).map((key) => [key, { source: 'manual', status: 'edited', locked: true, updatedAt }])) }
  }

  /** Shows these specifications in the boxes; they also become the starting point for spotting hand edits. */
  const showSpecs = (next: Specs) => { setSpecs(next); setForm(specsToForm(next)) }

  /** What the person typed or pasted in step 2. A new search (Search again, or Back then Next) keeps it and only fills the rest. */
  const ownValues = () => {
    const typed = formToSpecs(form, specs)
    const current = 'error' in typed ? specs : typed.specs
    const handEdited = 'error' in typed ? {} : editedMeta(specs, typed.specs, {})
    const fromStep1 = ['ramGb', 'storageGb', 'batteryMah']
    const earlier = Object.keys(specMeta).filter((key) => !fromStep1.includes(key) && ['manual', 'pasted'].includes(String((specMeta[key] as { source?: unknown } | null)?.source)))
    const keys = [...new Set([...Object.keys(handEdited), ...earlier])].filter((key) => current[key] !== undefined)
    return { specs: Object.fromEntries(keys.map((key) => [key, current[key]])), meta: Object.fromEntries(keys.map((key) => [key, handEdited[key] ?? specMeta[key]])), current }
  }

  const lookup = async () => {
    const own = ownValues()
    setLookupBusy(true); setLookupError('')
    try {
      const response = await fetch('/api/admin/specs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand: canonicalBrand(brand), model: model.trim() }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Specification lookup failed.')
      showSpecs(withEntered({ ...((result.specs ?? {}) as Specs), ...own.specs }))
      setSpecMeta(lockEntered({ ...((result.metadata ?? {}) as Record<string, unknown>), ...own.meta }))
      setProviders((result.providers ?? []) as ProviderInfo[])
    } catch (cause) {
      showSpecs(withEntered(own.current))
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

  /** Fills the boxes with what the pasted text contains. Values typed in step 1 still win. */
  const applyPaste = () => {
    const current = formToSpecs(form, specs)
    if ('error' in current) { setError(current.error); return }
    const found = Object.entries(parsePastedSpecs(pastedText) as Specs).filter(([, value]) => value !== null && value !== undefined)
    if (!found.length) { setError('Nothing was recognised in the pasted text. Lines like "Battery: 5000 mAh" or "Chipset: Snapdragon 8 Gen 3" work best.'); return }
    const next: Specs = { ...current.specs }
    for (const [key, value] of found) {
      next[key] = key === 'display' && value && typeof value === 'object'
        ? { ...(next.display && typeof next.display === 'object' ? next.display : {}), ...Object.fromEntries(Object.entries(value).filter(([, part]) => part !== null && part !== undefined)) }
        : value
    }
    const updatedAt = new Date().toISOString()
    setSpecMeta(lockEntered({ ...editedMeta(specs, current.specs, specMeta), ...Object.fromEntries(found.map(([key]) => [key, { source: 'pasted', status: 'fetched', locked: false, updatedAt }])) }))
    showSpecs(withEntered(next)); setError('')
  }

  const save = async () => {
    setBusy(true); setError('')
    const typed = formToSpecs(form, specs)
    if ('error' in typed) { setBusy(false); setError(typed.error); return }
    const finalSpecs = withEntered(typed.specs)
    const body: Record<string, unknown> = {
      kind, brand: canonicalBrand(brand), model: model.trim(), slug,
      status: kind === 'upcoming' ? 'upcoming' : 'available',
      ...(kind === 'upcoming' ? { expectedDate, expectedPriceRange } : {}),
      specs: finalSpecs, specMeta: lockEntered(editedMeta(specs, typed.specs, specMeta)), specsReviewed: reviewed, isPublished: reviewed && publish,
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
    const photoNote = files.length ? ` with ${files.length} photo${files.length === 1 ? '' : 's'}` : ' without photos'
    onFinished(reviewed && publish ? `Phone saved and published${photoNote}.` : `Phone saved as a draft${photoNote}.`)
  }

  const foundOnline = providers.some((provider) => provider.foundFields > 0)
  const keptFromStep1 = [needsColor ? colors.trim() : '', kind !== 'upcoming' ? `${ramGb} GB RAM` : '', kind !== 'upcoming' ? `${storageGb} GB storage` : '', Number(batteryMah) > 0 ? `${batteryMah} mAh battery` : ''].filter(Boolean).join(' · ')
  const addFiles = (list: FileList | null) => {
    if (!list) return
    const picked = Array.from(list)
    const images = picked.filter(isPhotoFile)
    const room = MAX_PHOTOS - files.length
    const problems = [
      ...(images.length < picked.length ? [`${picked.length - images.length} file${picked.length - images.length === 1 ? ' is' : 's are'} not a photo and ${picked.length - images.length === 1 ? 'was' : 'were'} skipped.`] : []),
      ...(images.length > room ? [`Only ${MAX_PHOTOS} photos fit; ${images.length - Math.max(room, 0)} ${images.length - Math.max(room, 0) === 1 ? 'was' : 'were'} not added.`] : []),
    ]
    setError(problems.join(' '))
    setFiles((current) => [...current, ...images].slice(0, MAX_PHOTOS))
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="create-inventory-title">
      <header className="admin-modal-header"><div><h2 id="create-inventory-title">Add phone</h2><p>{step === 1 ? 'Enter the basics and add photos. We find the other specifications for you.' : 'Check the specifications we found, then save.'}</p></div><button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close" disabled={busy}>×</button></header>
      <div className="admin-step-row">{['1 · Phone details', '2 · Specifications'].map((label, index) => <span key={label} className={`admin-step-chip ${index + 1 === step ? 'active' : ''}`}>{label}</span>)}</div>

      {step === 1 && <form onSubmit={(event) => void goNext(event)}>
        <div className="admin-form-grid">
          <label className="admin-label full">Type<select value={kind} onChange={(event) => setKind(event.target.value as Kind)}><option value="new">New phone</option><option value="used">Used phone (one unit)</option><option value="upcoming">Upcoming model</option></select></label>
          <BrandPicker value={brand} onChange={setBrand} />
          <ModelPicker brand={brand} value={model} onChange={setModel} />
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
          <label className="admin-label">Battery (mAh)<input type="number" min="500" max="30000" value={batteryMah} onChange={(event) => setBatteryMah(event.target.value)} placeholder="5000" /><small className="admin-inline-note">Leave empty to let the lookup suggest it.</small></label>
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
            {keptFromStep1 && <p className="admin-inline-note">Kept from step 1: {keptFromStep1}. The online search never changes these. Use Back to change them.</p>}
            {!lookupBusy && <p className="admin-inline-note">{foundOnline ? 'Check the boxes below and correct anything that is wrong.' : 'Nothing was found online for this phone. Fill in what you know below, or paste specifications from a website. Empty boxes show as "Not specified" to customers.'}</p>}
            {providers.length > 0 && <p className="admin-inline-note">{providers.map((provider) => `${providerLabel[provider.name] ?? provider.name}: ${provider.status === 'ok' || provider.foundFields > 0 ? `${provider.foundFields} found` : provider.status}`).join(' · ')}</p>}
            {providers.filter((provider) => provider.status === 'failed' && provider.error).map((provider) => <p key={provider.name} className="admin-inline-note">{providerLabel[provider.name] ?? provider.name}: {provider.error}</p>)}
            {lookupError && <p className="admin-inline-note" role="alert">{lookupError}</p>}
            <div className="admin-toolbar-left"><button type="button" className="button button-outline button-small" disabled={lookupBusy} onClick={() => void lookup()}>Search again</button></div>
          </div>
          <details className="admin-label full"><summary>Paste specifications from a website</summary>
            <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} rows={6} placeholder={'Display: 6.7 inches AMOLED\nChipset: Snapdragon 8 Gen 3\nBattery: 5000 mAh'} />
            <button type="button" className="button button-outline button-small" disabled={lookupBusy || !pastedText.trim()} onClick={applyPaste}>Fill the boxes from pasted text</button>
          </details>
          {!lookupBusy && <SpecFields value={form} onChange={(next) => { if (Number(batteryMah) > 0 && next.batteryMah !== form.batteryMah) setBatteryMah(next.batteryMah); setForm(next) }} />}
          <label className="admin-check full"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> These specifications look right.</label>
          <label className="admin-check full"><input type="checkbox" checked={publish} disabled={!reviewed} onChange={(event) => setPublish(event.target.checked)} /> Show this phone on the shop now.</label>
          {!reviewed && <p className="admin-inline-note full">Without confirming the specifications, the phone is saved as a draft and stays hidden from customers.</p>}
        </div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <div className="admin-form-actions"><button className="button button-outline button-small" type="button" disabled={busy} onClick={() => setStep(1)}>Back</button><button className="button button-primary button-small" type="button" disabled={busy || lookupBusy} onClick={() => void save()}>{busy ? 'Saving…' : lookupBusy ? 'Finding specifications…' : 'Save phone'}</button></div>
        {lookupBusy && <p className="admin-inline-note" role="status">Saving opens up as soon as the search finishes, usually within a minute.</p>}
      </div>}
    </section>
  </div>
}
