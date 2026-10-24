'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'

type TradeValue = { id: string; brand_text: string; model_text: string; storage_gb: number; base_value: number }
type Config = Record<string, unknown>
type Settings = { name: string; phone: string; whatsapp: string; telegram: string; email: string; address: string; hours: string; sold_badge_days: number; low_stock_default: number }
type LoadedSettings = { settings: Settings; tradeConfig: Config; tradeValues: TradeValue[] }
const price = (value: number) => new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(Number(value))

export function SettingsManager() {
  const [data, setData] = useState<LoadedSettings | null>(null)
  const [configText, setConfigText] = useState('')
  const [newValue, setNewValue] = useState({ brand: '', model: '', storageGb: '128', baseValue: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/settings', { cache: 'no-store' })
    const result = await response.json()
    setLoading(false)
    if (!response.ok) setError(result.error ?? 'Could not load settings.')
    else { setData(result); setConfigText(JSON.stringify(result.tradeConfig, null, 2)); setError('') }
  }, [])
  useEffect(() => { void load() }, [load])

  const updateSetting = (key: keyof Settings, value: string | number) => {
    setData((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current)
  }

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    let tradeConfig: Config
    try { tradeConfig = JSON.parse(configText) as Config } catch { setError('Trade-in configuration must be valid JSON.'); return }
    setSaving(true); setError(''); setNotice('')
    const s = data.settings
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: s.name, phone: s.phone, whatsapp: s.whatsapp, telegram: s.telegram, email: s.email, address: s.address, hours: s.hours, soldBadgeDays: Number(s.sold_badge_days), lowStockDefault: Number(s.low_stock_default), tradeConfig }),
    })
    const result = await response.json()
    setSaving(false)
    if (!response.ok) setError(result.error ?? 'Could not save settings.')
    else setNotice('Shop and trade-in settings saved.')
  }

  const addValue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    const response = await fetch('/api/admin/trade-values', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand: newValue.brand, model: newValue.model, storageGb: Number(newValue.storageGb), baseValue: Number(newValue.baseValue) }) })
    const result = await response.json()
    setSaving(false)
    if (!response.ok) setError(result.error ?? 'Could not save trade-in value.')
    else { setNewValue({ brand: '', model: '', storageGb: '128', baseValue: '' }); setNotice('Trade-in value saved.'); await load() }
  }

  const removeValue = async (row: TradeValue) => {
    if (!window.confirm(`Remove ${row.brand_text} ${row.model_text} ${row.storage_gb}GB from the trade-in list?`)) return
    const response = await fetch('/api/admin/trade-values', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: row.id }) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not remove trade-in value.')
    else { setNotice('Trade-in value removed.'); await load() }
  }

  if (loading) return <div className="admin-empty">Loading owner settings…</div>
  if (!data) return <div className="admin-error" role="alert">{error || 'Settings could not be loaded.'}</div>
  return <section>
    <div className="admin-page-heading"><div><h2>Owner settings</h2><p>Store details, trade-in values, staff access and backup tools.</p></div><a className="button button-outline button-small" href="/api/admin/export"><Download size={14} /> Export everything</a></div>
    <div className="admin-alert"><strong>Backup reminder:</strong> download a fresh export monthly and keep it in a private, encrypted location. Never share the owner export; it contains private customer and inventory records.</div>
    {error && <div className="admin-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
    <form className="admin-card" onSubmit={save}>
      <div className="admin-card-title"><h3>Store details</h3><span>Shown across your storefront</span></div>
      <div className="admin-form-grid">
        <label className="admin-label">Store name<input required value={data.settings.name} onChange={(event) => updateSetting('name', event.target.value)} /></label>
        <label className="admin-label">Public email<input type="email" required value={data.settings.email} onChange={(event) => updateSetting('email', event.target.value)} /></label>
        <label className="admin-label">Phone<input required value={data.settings.phone} onChange={(event) => updateSetting('phone', event.target.value)} /></label>
        <label className="admin-label">WhatsApp number<input required value={data.settings.whatsapp} onChange={(event) => updateSetting('whatsapp', event.target.value)} /></label>
        <label className="admin-label">Telegram link<input value={data.settings.telegram} onChange={(event) => updateSetting('telegram', event.target.value)} /></label>
        <label className="admin-label">Opening hours<input value={data.settings.hours} onChange={(event) => updateSetting('hours', event.target.value)} /></label>
        <label className="admin-label full">Shop address<input value={data.settings.address} onChange={(event) => updateSetting('address', event.target.value)} /></label>
        <label className="admin-label">Sold badge (days)<input type="number" min="0" max="30" value={data.settings.sold_badge_days} onChange={(event) => updateSetting('sold_badge_days', Number(event.target.value))} /></label>
        <label className="admin-label">Low-stock alert threshold<input type="number" min="0" max="100" value={data.settings.low_stock_default} onChange={(event) => updateSetting('low_stock_default', Number(event.target.value))} /></label>
      </div>
      <div className="admin-form-actions"><button className="button button-primary button-small" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save store details and trade-in rules'}</button></div>
      <div className="admin-card-title" style={{ marginTop: 24 }}><h3>Trade-in calculation rules</h3><span>Validated before save</span></div>
      <label className="admin-label">JSON multipliers and value ranges<textarea value={configText} onChange={(event) => setConfigText(event.target.value)} spellCheck={false} /></label>
      <p className="admin-inline-note">Values must follow the existing rule shape. Changes affect future public estimates immediately; test before saving.</p>
    </form>
    <section className="admin-card" style={{ marginTop: 14 }}>
      <div className="admin-card-title"><h3>Trade-in base values</h3><span>{data.tradeValues.length} phone / storage combinations</span></div>
      <form className="admin-toolbar" onSubmit={addValue}>
        <div className="admin-toolbar-left"><input className="admin-input" required placeholder="Brand" value={newValue.brand} onChange={(event) => setNewValue({ ...newValue, brand: event.target.value })} /><input className="admin-input" required placeholder="Model" value={newValue.model} onChange={(event) => setNewValue({ ...newValue, model: event.target.value })} /><input className="admin-input" required type="number" min="1" placeholder="Storage GB" value={newValue.storageGb} onChange={(event) => setNewValue({ ...newValue, storageGb: event.target.value })} /><input className="admin-input" required type="number" min="1" placeholder="Base value (ETB)" value={newValue.baseValue} onChange={(event) => setNewValue({ ...newValue, baseValue: event.target.value })} /></div>
        <button className="button button-primary button-small" type="submit" disabled={saving}><Plus size={13} /> Add / update</button>
      </form>
      {data.tradeValues.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Device</th><th>Storage</th><th>Base value</th><th>Action</th></tr></thead><tbody>{data.tradeValues.map((row) => <tr key={row.id}><td><strong>{row.brand_text} {row.model_text}</strong></td><td>{row.storage_gb} GB</td><td>{price(row.base_value)}</td><td><button className="admin-icon-button danger" title="Remove value" onClick={() => void removeValue(row)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div> : <div className="admin-empty">No database trade-in values exist yet.</div>}
    </section>
    <section className="admin-card" style={{ marginTop: 14 }}>
      <div className="admin-card-title"><h3>Owner access</h3><span>Manage staff with the provisioning script</span></div>
      <p className="admin-inline-note">Create owner and staff accounts from a secure terminal using <code>npm run admin:provision-owner</code> or <code>npm run admin:create-staff</code>. Never create public sign-up routes or expose a Supabase service-role key.</p>
      <a className="button button-outline button-small" href="/admin/activity">Review security activity</a>
    </section>
  </section>
}
