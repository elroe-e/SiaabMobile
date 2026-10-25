'use client'

import { useSearchParams } from 'next/navigation'
import { fullPhoneName } from '../../../src/lib/format'
import { preparePhoto } from './photo-tools'
import { CreateInventoryModal } from './create-modal'
import { ArrowLeft, ArrowRight, Camera, CircleDollarSign, PackagePlus, Pencil, RefreshCw, Search, Smartphone, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Role = 'owner' | 'staff'
type RelatedModel = { name: string; slug: string; brands: { name: string } | { name: string }[] | null }
type ModelRow = { id: string; name: string; slug: string; status: string; expected_date: string | null; expected_price_range: string | null; tagline: string; specs: Record<string, unknown>; spec_meta: Record<string, unknown>; specs_reviewed: boolean; brands: { name: string } | { name: string }[] | null }
type VariantRow = { id: string; model_id: string; ram_gb: number; storage_gb: number; color_name: string; price: number; stock_count: number; low_stock_threshold: number; is_published: boolean; phone_models: RelatedModel | RelatedModel[] | null }
type UsedRow = { id: string; model_id: string; ram_gb: number; storage_gb: number; color_name: string; grade: string; battery_health_pct: number | null; accessories: string; warranty_months: number; price: number; cost_price?: number | null; imei?: string | null; notes_internal?: string; status: string; is_published: boolean; reserved_until: string | null; sold_at: string | null; phone_models: RelatedModel | RelatedModel[] | null }
type Data = { models: ModelRow[]; variants: VariantRow[]; used: UsedRow[] }
type Photo = { id: string; path: string; alt_text: string; sort_order: number; is_main: boolean; url: string }
const emptyData: Data = { models: [], variants: [], used: [] }
const money = (value: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(Number(value))
const rel = (row: VariantRow | UsedRow) => Array.isArray(row.phone_models) ? row.phone_models[0] ?? null : row.phone_models
const brandName = (brand: ModelRow['brands'] | RelatedModel['brands']) => Array.isArray(brand) ? brand[0]?.name ?? '' : brand?.name ?? ''

export function InventoryManager({ role }: { role: Role }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<Data>(emptyData)
  const [filter, setFilter] = useState<'all' | 'new' | 'used' | 'upcoming'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<{ type: 'variant' | 'unit' | 'model'; item: VariantRow | UsedRow | ModelRow } | null>(null)
  const [photoTarget, setPhotoTarget] = useState<{ id: string; kind: 'model' | 'unit'; label: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await fetch(`/api/admin/inventory?type=${filter}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) setError(body.error ?? 'Could not load inventory.')
    else setData({ models: body.models ?? [], variants: body.variants ?? [], used: body.used ?? [] })
    setLoading(false)
  }, [filter])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (searchParams.get('add') === '1') setAdding(true) }, [searchParams])

  const visibleVariants = useMemo(() => data.variants.filter((row) => {
    const model = rel(row)
    const text = `${model?.name ?? ''} ${brandName(model?.brands ?? null)} ${row.color_name}`.toLowerCase()
    return !search || text.includes(search.toLowerCase())
  }), [data.variants, search])
  const visibleUsed = useMemo(() => data.used.filter((row) => {
    const model = rel(row)
    const text = `${model?.name ?? ''} ${brandName(model?.brands ?? null)} ${row.color_name} ${row.grade}`.toLowerCase()
    return !search || text.includes(search.toLowerCase())
  }), [data.used, search])
  const visibleModels = useMemo(() => data.models.filter((row) => {
    const text = `${row.name} ${brandName(row.brands)}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && row.status === 'upcoming'
  }), [data.models, search])

  const askSell = async (item: VariantRow | UsedRow, kind: 'new' | 'used') => {
    const price = window.prompt(`Sale price in ETB for ${rel(item)?.name ?? 'this phone'}:`)
    if (!price) return
    const quantity = kind === 'new' ? Number(window.prompt('Quantity sold:', '1')) : 1
    if (!Number.isInteger(quantity) || quantity < 1) return
    await postAction({ action: kind === 'new' ? 'sell_new' : 'sell_used', id: item.id, price: Number(price), ...(kind === 'new' ? { quantity } : {}) })
  }

  const reserve = async (row: UsedRow) => {
    const days = Number(window.prompt('Reserve for how many days? (1–14)', '2'))
    if (!Number.isInteger(days) || days < 1 || days > 14) return
    await postAction({ action: 'reserve', id: row.id, days })
  }

  const postAction = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Action could not be completed.')
    else { setNotice('Inventory updated.'); setError(''); await refresh() }
  }

  const create = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Could not create inventory.')
    return result
  }

  const update = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/admin/inventory', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Could not update inventory.')
    setEditing(null); setNotice('Inventory updated.'); await refresh()
  }

  const deleteItem = async (id: string, type: 'model' | 'variant' | 'unit', label: string) => {
    if (role !== 'owner' || !window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return
    const response = await fetch('/api/admin/inventory', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, type }) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not delete inventory.')
    else { setNotice(`${label} deleted.`); await refresh() }
  }

  return <section>
    <div className="admin-page-heading"><div><h2>Inventory</h2><p>Manage new phones, used units and upcoming models.</p></div><button className="button button-primary" onClick={() => setAdding(true)}><PackagePlus size={14} /> Add inventory</button></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-success" role="status">{notice}</div>}
    <div className="admin-card">
      <div className="admin-toolbar">
        <div className="admin-toolbar-left"><div className="admin-tabs" role="tablist" aria-label="Inventory type">
          {(['all', 'new', 'used', 'upcoming'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All items' : value === 'new' ? 'New phones' : value === 'used' ? 'Used phones' : 'Upcoming'}</button>)}
        </div></div>
        <div className="admin-toolbar-right">
          <label className="input-icon-wrap admin-search-wrap"><Search size={14} /><input className="admin-input admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search phones…" aria-label="Search inventory" /></label>
          <button className="admin-icon-button" type="button" onClick={() => void refresh()} aria-label="Refresh inventory"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loading ? <div className="admin-empty">Loading inventory…</div> : <>
        {(filter === 'all' || filter === 'new') && <InventoryTable title="New phones" count={visibleVariants.length}>
          <thead><tr><th>Model</th><th>Configuration</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead>
          <tbody>{visibleVariants.map((row) => <tr key={row.id}><td><strong>{brandName(rel(row)?.brands ?? null)} {rel(row)?.name}</strong><small>{rel(row)?.slug}</small></td><td>{row.ram_gb}GB / {row.storage_gb}GB · {row.color_name}</td><td>{money(row.price)}</td><td><span className={`admin-badge ${row.stock_count === 0 ? 'red' : row.stock_count <= row.low_stock_threshold ? 'amber' : 'green'}`}>{row.stock_count} in stock</span></td><td><span className={`admin-badge ${row.is_published ? 'green' : 'gray'}`}>{row.is_published ? 'Published' : 'Draft'}</span></td><td><div className="admin-table-actions"><button className="admin-icon-button" title="Edit stock, price or visibility" onClick={() => setEditing({ type: 'variant', item: row })}><Pencil size={14} /></button><button className="admin-icon-button" title="Add model photos" onClick={() => setPhotoTarget({ id: row.model_id, kind: 'model', label: rel(row)?.name ?? 'Model' })}><Camera size={14} /></button><button className="admin-icon-button" title="Record sale" onClick={() => void askSell(row, 'new')}><CircleDollarSign size={14} /></button>{role === 'owner' && <button className="admin-icon-button danger" title="Delete variant" onClick={() => void deleteItem(row.id, 'variant', rel(row)?.name ?? 'variant')}><Trash2 size={14} /></button>}</div></td></tr>)}</tbody>
        </InventoryTable>}
        {(filter === 'all' || filter === 'used') && <InventoryTable title="Used phones" count={visibleUsed.length}>
          <thead><tr><th>Model</th><th>Condition</th><th>Price</th><th>Stock state</th><th>Visibility</th><th>Actions</th></tr></thead>
          <tbody>{visibleUsed.map((row) => <tr key={row.id}><td><strong>{brandName(rel(row)?.brands ?? null)} {rel(row)?.name}</strong><small>{row.ram_gb}GB / {row.storage_gb}GB · {row.color_name}</small></td><td>Grade {row.grade}{row.battery_health_pct ? ` · ${row.battery_health_pct}% battery` : ''}</td><td>{money(row.price)}{role === 'owner' && row.cost_price != null && <small>Cost {money(row.cost_price)}</small>}</td><td><span className={`admin-badge ${row.status === 'sold' ? 'gray' : row.status === 'reserved' ? 'amber' : row.status === 'hidden' ? 'red' : 'green'}`}>{row.status === 'reserved' && row.reserved_until ? `Reserved until ${new Date(row.reserved_until).toLocaleDateString()}` : row.status}</span></td><td><span className={`admin-badge ${row.is_published ? 'green' : 'gray'}`}>{row.is_published ? 'Published' : 'Draft'}</span></td><td><div className="admin-table-actions"><button className="admin-icon-button" title="Edit used-unit details" onClick={() => setEditing({ type: 'unit', item: row })}><Pencil size={14} /></button><button className="admin-icon-button" title="Add unit photos" onClick={() => setPhotoTarget({ id: row.id, kind: 'unit', label: rel(row)?.name ?? 'Used phone' })}><Camera size={14} /></button>{row.status === 'available' || row.status === 'reserved' ? <><button className="admin-icon-button" title="Reserve" onClick={() => void reserve(row)}><Smartphone size={14} /></button><button className="admin-icon-button" title="Record sale" onClick={() => void askSell(row, 'used')}><CircleDollarSign size={14} /></button></> : null}{role === 'owner' && <button className="admin-icon-button danger" title="Delete used unit" onClick={() => void deleteItem(row.id, 'unit', rel(row)?.name ?? 'used unit')}><Trash2 size={14} /></button>}</div></td></tr>)}</tbody>
        </InventoryTable>}
        {(filter === 'all' || filter === 'upcoming') && <InventoryTable title="Upcoming models" count={visibleModels.length}>
          <thead><tr><th>Model</th><th>Expected date / price</th><th>Specifications</th><th>Visibility</th><th>Actions</th></tr></thead>
          <tbody>{visibleModels.map((row) => <tr key={row.id}><td><strong>{fullPhoneName(brandName(row.brands), row.name)}</strong><small>{row.slug}</small></td><td>{row.expected_date ?? 'Not set'}<small>{row.expected_price_range ?? 'Price to be announced'}</small></td><td><span className={`admin-badge ${row.specs_reviewed ? 'green' : 'amber'}`}>{row.specs_reviewed ? 'Reviewed' : 'Needs review'}</span></td><td><span className="admin-badge green">Upcoming</span></td><td><div className="admin-table-actions"><button className="admin-icon-button" title="Edit upcoming details and specifications" onClick={() => setEditing({ type: 'model', item: row })}><Pencil size={14} /></button><button className="admin-icon-button" title="Add model photos" onClick={() => setPhotoTarget({ id: row.id, kind: 'model', label: row.name })}><Camera size={14} /></button>{role === 'owner' && <button className="admin-icon-button danger" title="Delete model" onClick={() => void deleteItem(row.id, 'model', row.name)}><Trash2 size={14} /></button>}</div></td></tr>)}</tbody>
        </InventoryTable>}
      </>}
    </div>
    {adding && <CreateInventoryModal role={role} onClose={() => setAdding(false)} onCreate={create} onFinished={(message) => { setAdding(false); setNotice(message); void refresh() }} />}
    {editing && <UpdateInventoryModal role={role} target={editing} onClose={() => setEditing(null)} onSave={update} />}
    {photoTarget && <PhotoModal target={photoTarget} onClose={() => setPhotoTarget(null)} />}
    <p className="admin-inline-note" style={{ marginTop: 10 }}>For a new sale or reservation, choose the matching action. Every sale is recorded transactionally; undo restores stock.</p>
  </section>
}

function InventoryTable({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="admin-inventory-table-section"><div className="admin-card-title"><h3>{title}</h3><span>{count} records</span></div>{count === 0 ? <div className="admin-empty">No matching inventory yet.</div> : <><div className="admin-table-wrap"><table className="admin-table">{children}</table></div><div className="admin-mobile-card-list">{/* Rows remain available in the scrollable table on larger screens. */}</div></>}</section>
}

function UpdateInventoryModal({ role, target, onClose, onSave }: {
  role: Role
  target: { type: 'variant' | 'unit' | 'model'; item: VariantRow | UsedRow | ModelRow }
  onClose: () => void
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const item = target.item
  const variant = target.type === 'variant' ? item as VariantRow : null
  const unit = target.type === 'unit' ? item as UsedRow : null
  const model = target.type === 'model' ? item as ModelRow : null
  const [stockCount, setStockCount] = useState(String(variant?.stock_count ?? ''))
  const [price, setPrice] = useState(String(variant?.price ?? unit?.price ?? ''))
  const [threshold, setThreshold] = useState(String(variant?.low_stock_threshold ?? ''))
  const [published, setPublished] = useState(variant?.is_published ?? unit?.is_published ?? false)
  const [costPrice, setCostPrice] = useState(String(unit?.cost_price ?? ''))
  const [imei, setImei] = useState(unit?.imei ?? '')
  const [notes, setNotes] = useState(unit?.notes_internal ?? '')
  const [expectedDate, setExpectedDate] = useState(model?.expected_date ?? '')
  const [expectedPriceRange, setExpectedPriceRange] = useState(model?.expected_price_range ?? '')
  const [specs, setSpecs] = useState(JSON.stringify(model?.specs ?? {}, null, 2))
  const [reviewed, setReviewed] = useState(model?.specs_reviewed ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError('')
    let body: Record<string, unknown>
    if (variant) body = { type: 'variant', id: variant.id, stockCount: Number(stockCount), price: Number(price), lowStockThreshold: Number(threshold), isPublished: published }
    else if (unit) body = { type: 'unit', id: unit.id, price: Number(price), isPublished: published, ...(role === 'owner' ? { costPrice: costPrice ? Number(costPrice) : null, imei: imei || null, notesInternal: notes } : {}) }
    else if (model) {
      try { body = { type: 'model', id: model.id, expectedDate, expectedPriceRange, specs: JSON.parse(specs), specMeta: model.spec_meta, specsReviewed: reviewed } }
      catch { setBusy(false); setError('Specifications must be valid JSON.'); return }
    } else { setBusy(false); return }
    try { await onSave(body) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save changes.'); setBusy(false) }
  }

  const name = variant || unit ? `${rel((variant ?? unit)! )?.name ?? 'Phone'} ${variant ? 'variant' : 'used unit'}` : `${model?.name ?? 'Upcoming model'}`
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-inventory-title">
      <header className="admin-modal-header"><div><h2 id="edit-inventory-title">Edit inventory</h2><p>{name}</p></div><button className="admin-icon-button" type="button" onClick={onClose} aria-label="Close">×</button></header>
      <form onSubmit={(event) => void submit(event)}>
        <div className="admin-form-grid">
          {variant && <>
            <label className="admin-label">Quantity in stock<input type="number" min="0" required value={stockCount} onChange={(event) => setStockCount(event.target.value)} /></label>
            <label className="admin-label">Price (ETB)<input type="number" min="1" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label className="admin-label">Low-stock threshold<input type="number" min="0" required value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
            <label className="admin-check"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publish this variant</label>
          </>}
          {unit && <>
            <label className="admin-label">Price (ETB)<input type="number" min="1" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label className="admin-check"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publish this used unit</label>
            {role === 'owner' && <>
              <label className="admin-label">Cost price<input type="number" min="0" step="0.01" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} /></label>
              <label className="admin-label">IMEI<input inputMode="numeric" pattern="[0-9]{14,16}" value={imei} onChange={(event) => setImei(event.target.value)} /></label>
              <label className="admin-label full">Internal notes<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            </>}
          </>}
          {model && <>
            <label className="admin-label">Expected date<input value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></label>
            <label className="admin-label">Expected price range<input value={expectedPriceRange} onChange={(event) => setExpectedPriceRange(event.target.value)} /></label>
            <label className="admin-label full">Specifications<textarea value={specs} onChange={(event) => setSpecs(event.target.value)} spellCheck={false} /></label>
            <label className="admin-check full"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I have reviewed and confirmed this model’s specifications.</label>
          </>}
        </div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <div className="admin-form-actions"><button className="button button-outline button-small" type="button" onClick={onClose}>Cancel</button><button className="button button-primary button-small" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  </div>
}

function PhotoModal({ target, onClose }: { target: { id: string; kind: 'model' | 'unit'; label: string }; onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<number | null>(null)
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/photos?${target.kind}Id=${target.id}`, { cache: 'no-store' })
    const result = await response.json()
    setLoading(false)
    if (!response.ok) setError(result.error ?? 'Could not load photos.')
    else { setPhotos(result.photos ?? []); setUsage(result.usageBytes ?? null) }
  }, [target])
  useEffect(() => { void load() }, [load])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setError('')
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await preparePhoto(file)

        const response = await fetch('/api/admin/photos', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: target.kind, entityId: target.id, dataUrl, altText: target.label }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Photo upload failed.')
      }
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Photo upload failed.') }
    setBusy(false)
  }

  const remove = async (id: string) => {
    if (!window.confirm('Remove this photo?')) return
    const response = await fetch('/api/admin/photos', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, kind: target.kind }) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not remove photo.')
    else await load()
  }

  const move = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= photos.length) return
    const next = [...photos]
    ;[next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!]
    const response = await fetch('/api/admin/photos', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: target.kind, entityId: target.id, photoIds: next.map((photo) => photo.id) }),
    })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not reorder photos.')
    else setPhotos(next.map((photo, sort_order) => ({ ...photo, sort_order, is_main: sort_order === 0 })))
  }

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
      <header className="admin-modal-header"><div><h2 id="photo-modal-title">Photos · {target.label}</h2><p>Images are converted to WebP and resized before upload. Maximum 8 images, 200 KB each.</p></div><button className="admin-icon-button" onClick={onClose} aria-label="Close">×</button></header>
      {usage != null && <><div className="admin-storage-meter"><span style={{ width: `${Math.min(100, usage / (1024 * 1024 * 1024) * 100)}%` }} /></div><p className="admin-inline-note">Storage used: {(usage / 1024 / 1024).toFixed(1)} MB of the 1 GB free allowance. {usage > 800 * 1024 * 1024 ? 'Storage is getting close to the free limit.' : ''}</p></>}
      <label className="admin-photo-drop"><span><strong>{busy ? 'Preparing and uploading…' : 'Choose photos'}</strong><br />Select several images to upload; they will be optimized on this device.<input hidden type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = '' }} /></span></label>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {loading ? <div className="admin-empty">Loading photos…</div> : photos.length ? <div className="admin-photo-list">{photos.map((photo, index) => <div className="admin-photo-item" key={photo.id}><img src={photo.url} alt={photo.alt_text} /><div className="admin-photo-actions">{index > 0 && <button type="button" onClick={() => void move(index, -1)} aria-label="Move photo left"><ArrowLeft size={13} /></button>}{index < photos.length - 1 && <button type="button" onClick={() => void move(index, 1)} aria-label="Move photo right"><ArrowRight size={13} /></button>}<button type="button" onClick={() => void remove(photo.id)} aria-label="Remove photo"><Trash2 size={13} /></button></div>{photo.is_main && <span className="admin-photo-main">Main</span>}</div>)}</div> : <div className="admin-empty">No photos added yet.</div>}
      <div className="admin-form-actions"><button type="button" className="button button-outline button-small" onClick={onClose}>Done</button></div>
    </section>
  </div>
}

