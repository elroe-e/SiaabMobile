'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, RotateCcw } from 'lucide-react'
import { SalesTrend } from '../sales-trend'

type Role = 'owner' | 'staff'
type Model = { name: string; brands: { name: string } | { name: string }[] | null }
type Variant = { id: string; model_id: string; ram_gb: number; storage_gb: number; color_name: string; price: number; stock_count: number; phone_models: Model | Model[] | null }
type Unit = { id: string; model_id: string; ram_gb: number; storage_gb: number; color_name: string; grade: string; price: number; status: string; phone_models: Model | Model[] | null }
type Sale = { id: string; kind: 'new' | 'used'; variant_id: string | null; unit_id: string | null; quantity: number; sale_price: number; sold_at: string; buyer_note: string | null; undone_at: string | null; cost_price?: number | null; variants: { model_id: string; phone_models: Model | Model[] | null } | null; used_units: { model_id: string; price: number; phone_models: Model | Model[] | null } | null }
type Inventory = { variants: Variant[]; used: Unit[] }
const money = (value: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(Number(value))
const modelName = (model: Model | Model[] | null) => {
  const item = Array.isArray(model) ? model[0] : model
  const brands = item?.brands
  const brand = Array.isArray(brands) ? brands[0]?.name ?? '' : brands?.name ?? ''
  return `${brand} ${item?.name ?? ''}`.trim() || 'Phone'
}

export function SalesManager({ role }: { role: Role }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [inventory, setInventory] = useState<Inventory>({ variants: [], used: [] })
  const [itemId, setItemId] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<'all' | 'new' | 'used'>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [salesResponse, inventoryResponse] = await Promise.all([
      fetch('/api/admin/sales', { cache: 'no-store' }),
      fetch('/api/admin/inventory?type=all', { cache: 'no-store' }),
    ])
    const [salesBody, inventoryBody] = await Promise.all([salesResponse.json(), inventoryResponse.json()])
    if (!salesResponse.ok || !inventoryResponse.ok) setError(salesBody.error ?? inventoryBody.error ?? 'Could not load sales.')
    else {
      setSales(salesBody.sales ?? [])
      setInventory({ variants: inventoryBody.variants ?? [], used: inventoryBody.used ?? [] })
      setError('')
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const chosen = itemId.startsWith('new:') ? inventory.variants.find((item) => item.id === itemId.slice(4)) : inventory.used.find((item) => item.id === itemId.slice(5))
  const filteredSales = useMemo(() => sales.filter((sale) => filter === 'all' || sale.kind === filter), [filter, sales])
  const trend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return { day: date.toLocaleDateString('en', { weekday: 'short' }), amount: sales.filter((sale) => !sale.undone_at && sale.sold_at.slice(0, 10) === key).reduce((sum, sale) => sum + Number(sale.sale_price), 0) }
  }), [sales])

  const submitSale = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!chosen) { setError('Select an available inventory item.'); return }
    setSaving(true); setError(''); setNotice('')
    const isNew = itemId.startsWith('new:')
    const response = await fetch('/api/admin/sales', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: isNew ? 'sell_new' : 'sell_used', id: chosen.id, price: Number(salePrice), ...(isNew ? { quantity: Number(quantity) } : {}), ...(note.trim() ? { note: note.trim() } : {}) }),
    })
    const result = await response.json()
    setSaving(false)
    if (!response.ok) setError(result.error ?? 'Could not record sale.')
    else {
      setNotice('Sale recorded and stock updated.')
      setItemId(''); setSalePrice(''); setQuantity('1'); setNote('')
      await load()
    }
  }

  const undo = async (sale: Sale) => {
    if (!window.confirm('Undo this sale? Stock will be restored.')) return
    const response = await fetch('/api/admin/sales', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'undo', id: sale.id }) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not undo sale.')
    else { setNotice('Sale undone and inventory restored.'); await load() }
  }

  const weekTotal = sales.filter((sale) => !sale.undone_at && Date.now() - Date.parse(sale.sold_at) <= 7 * 86400000).reduce((sum, sale) => sum + Number(sale.sale_price), 0)
  const monthTotal = sales.filter((sale) => !sale.undone_at && Date.now() - Date.parse(sale.sold_at) <= 30 * 86400000).reduce((sum, sale) => sum + Number(sale.sale_price), 0)

  return <section>
    <div className="admin-page-heading"><div><h2>Sales</h2><p>Record phone sales and track stock movements.</p></div><span className="admin-badge green"><BadgeDollarSign size={11} /> Transactional stock control</span></div>
    {error && <div className="admin-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
    <div className="admin-stat-grid"><article className="admin-stat"><div className="admin-stat-head"><span>Last 7 days</span><BadgeDollarSign size={15} /></div><strong className="admin-stat-value">{money(weekTotal)}</strong><span className="admin-stat-note">Gross recorded sales</span></article><article className="admin-stat"><div className="admin-stat-head"><span>Last 30 days</span><BadgeDollarSign size={15} /></div><strong className="admin-stat-value">{money(monthTotal)}</strong><span className="admin-stat-note">Gross recorded sales</span></article><article className="admin-stat"><div className="admin-stat-head"><span>Transactions</span><BadgeDollarSign size={15} /></div><strong className="admin-stat-value">{sales.filter((sale) => !sale.undone_at).length}</strong><span className="admin-stat-note">Active sale records</span></article>{role === 'owner' && <article className="admin-stat"><div className="admin-stat-head"><span>Private margin</span><BadgeDollarSign size={15} /></div><strong className="admin-stat-value">{money(sales.filter((sale) => !sale.undone_at && sale.cost_price != null).reduce((sum, sale) => sum + Number(sale.sale_price) - Number(sale.cost_price), 0))}</strong><span className="admin-stat-note">Only for units with saved cost</span></article>}</div>
    <div className="admin-dashboard-grid">
      <article className="admin-card"><div className="admin-card-title"><h3>Sales trend</h3><span>Gross sales by day</span></div><SalesTrend data={trend} /></article>
      <form className="admin-card" onSubmit={submitSale}><div className="admin-card-title"><h3>Record a sale</h3><span>Stock changes immediately</span></div>
        <div className="admin-form-grid"><label className="admin-label full">Available inventory<select required value={itemId} onChange={(event) => { setItemId(event.target.value); const value = event.target.value.startsWith('new:') ? inventory.variants.find((row) => row.id === event.target.value.slice(4))?.price : inventory.used.find((row) => row.id === event.target.value.slice(5))?.price; setSalePrice(value ? String(value) : '') }}><option value="">Choose a phone</option><optgroup label="New stock">{inventory.variants.filter((row) => row.stock_count > 0).map((row) => <option key={row.id} value={`new:${row.id}`}>{modelName(row.phone_models)} · {row.ram_gb}/{row.storage_gb} GB · {row.color_name} · {row.stock_count} left</option>)}</optgroup><optgroup label="Used units">{inventory.used.filter((row) => row.status === 'available' || row.status === 'reserved').map((row) => <option key={row.id} value={`used:${row.id}`}>{modelName(row.phone_models)} · grade {row.grade} · {row.color_name}{row.status === 'reserved' ? ' · reserved' : ''}</option>)}</optgroup></select></label><label className="admin-label">Sale price (ETB)<input required type="number" min="1" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></label>{itemId.startsWith('new:') && <label className="admin-label">Quantity<input required type="number" min="1" max={chosen && 'stock_count' in chosen ? chosen.stock_count : 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>}<label className="admin-label full">Buyer note (optional)<input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reference or note" /></label></div>
        <button className="button button-primary button-small" type="submit" disabled={saving || !chosen}>{saving ? 'Recording…' : 'Record sale'}</button>
      </form>
    </div>
    <article className="admin-card" style={{ marginTop: 14 }}>
      <div className="admin-toolbar"><div className="admin-card-title" style={{ marginBottom: 0 }}><h3>Sale history</h3><span>{filteredSales.length} records · up to 500 most recent</span></div><div className="admin-tabs">{(['all', 'new', 'used'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'new' ? 'New phones' : 'Used phones'}</button>)}</div></div>
      {loading ? <div className="admin-empty">Loading sales…</div> : !filteredSales.length ? <div className="admin-empty">No sales recorded yet.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Phone</th><th>Type</th><th>Quantity</th><th>Sale price</th>{role === 'owner' && <th>Cost / margin</th>}<th>Sold at</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredSales.map((sale) => {
        const model = sale.kind === 'new' ? sale.variants?.phone_models ?? null : sale.used_units?.phone_models ?? null
        const canUndo = role === 'owner' || Date.now() - Date.parse(sale.sold_at) < 24 * 60 * 60 * 1000
        return <tr key={sale.id}><td><strong>{modelName(model)}</strong>{sale.buyer_note && <small>{sale.buyer_note}</small>}</td><td><span className={`admin-badge ${sale.kind === 'new' ? 'green' : 'amber'}`}>{sale.kind}</span></td><td>{sale.quantity}</td><td>{money(sale.sale_price)}</td>{role === 'owner' && <td>{sale.cost_price == null ? '—' : <><strong>{money(sale.cost_price)}</strong><small>Margin {money(Number(sale.sale_price) - Number(sale.cost_price))}</small></>}</td>}<td>{new Date(sale.sold_at).toLocaleString()}</td><td><span className={`admin-badge ${sale.undone_at ? 'gray' : 'green'}`}>{sale.undone_at ? 'Undone' : 'Complete'}</span></td><td>{!sale.undone_at && canUndo && <button className="admin-icon-button" title="Undo sale" onClick={() => void undo(sale)}><RotateCcw size={14} /></button>}</td></tr>
      })}</tbody></table></div>}
    </article>
  </section>
}
