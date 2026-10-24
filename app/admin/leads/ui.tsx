'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Phone, Search } from 'lucide-react'

type Lead = { id: string; type: string; name: string; contact: string; payload: Record<string, unknown>; status: 'new' | 'contacted' | 'closed'; created_at: string }
const labelType = (value: string) => value.replaceAll('_', ' ')
const waLink = (contact: string) => `https://wa.me/${contact.replace(/\D/g, '')}`

export function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/leads', { cache: 'no-store' })
    const result = await response.json()
    setLoading(false)
    if (!response.ok) setError(result.error ?? 'Could not load customer requests.')
    else { setLeads(result.leads ?? []); setError('') }
  }, [])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => leads.filter((lead) => {
    const matchesStatus = filter === 'all' || lead.status === filter
    const matchesSearch = `${lead.name} ${lead.contact} ${lead.type} ${JSON.stringify(lead.payload)}`.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  }), [filter, leads, search])

  const update = async (lead: Lead, patch: Record<string, unknown>) => {
    setBusyId(lead.id); setError('')
    const response = await fetch('/api/admin/leads', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: lead.id, ...patch }) })
    const result = await response.json()
    setBusyId('')
    if (!response.ok) setError(result.error ?? 'Could not update this request.')
    else await load()
  }

  return <section>
    <div className="admin-page-heading"><div><h2>Customer requests</h2><p>Trade-in, contact and notify-me requests from the storefront.</p></div><span className="admin-badge">{leads.filter((lead) => lead.status === 'new').length} new</span></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    <div className="admin-card">
      <div className="admin-toolbar"><div className="admin-toolbar-left"><div className="admin-tabs" role="tablist" aria-label="Request status">{['all', 'new', 'contacted', 'closed'].map((status) => <button key={status} role="tab" aria-selected={filter === status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? `All · ${leads.length}` : `${status} · ${leads.filter((lead) => lead.status === status).length}`}</button>)}</div></div><label className="input-icon-wrap admin-search-wrap"><Search size={14} /><input className="admin-input admin-search" placeholder="Search name, contact or details…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {loading ? <div className="admin-empty">Loading requests…</div> : visible.length === 0 ? <div className="admin-empty">No requests match your filters.</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Request</th><th>Details</th><th>Received</th><th>Status</th><th>Contact / action</th></tr></thead>
        <tbody>{visible.map((lead) => <tr key={lead.id}>
          <td><strong>{lead.name}</strong><small>{lead.contact}</small></td><td><span className="admin-badge">{labelType(lead.type)}</span></td>
          <td><small>{Object.entries(lead.payload ?? {}).filter(([key]) => key !== 'internalNote').map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' · ') || '—'}</small>{typeof lead.payload?.internalNote === 'string' && lead.payload.internalNote && <small>Staff note: {lead.payload.internalNote}</small>}</td>
          <td>{new Date(lead.created_at).toLocaleString()}</td>
          <td><select className="admin-select" aria-label={`Status for ${lead.name}`} value={lead.status} disabled={busyId === lead.id} onChange={(event) => void update(lead, { status: event.target.value })}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></td>
          <td><div className="admin-table-actions"><a className="admin-icon-button" href={`tel:${lead.contact}`} title="Call customer"><Phone size={14} /></a><a className="admin-icon-button" href={waLink(lead.contact)} target="_blank" rel="noreferrer" title="WhatsApp customer"><MessageCircle size={14} /></a><button className="admin-icon-button" title="Add an internal note" onClick={() => { const note = window.prompt('Internal staff note:', typeof lead.payload.internalNote === 'string' ? lead.payload.internalNote : ''); if (note !== null) void update(lead, { internalNote: note }) }}>✎</button></div></td>
        </tr>)}</tbody></table></div>}
    </div>
  </section>
}
