'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, UserMinus } from 'lucide-react'

type Seller = { id: string; fullName: string; email: string; createdAt: string }
const empty = { fullName: '', email: '', password: '' }

/** Owner-only card for adding sellers and removing their access. Sellers sign in at /admin/login. */
export function SellersCard() {
  const [sellers, setSellers] = useState<Seller[] | null>(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/team', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not load sellers.')
    else setSellers(result.sellers ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const response = await fetch('/api/admin/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    const result = await response.json()
    setBusy(false)
    if (!response.ok) { setError(result.error ?? 'Could not add the seller.'); return }
    setNotice(`${form.fullName} can now sign in at /admin/login with ${form.email} and the password you chose.`)
    setForm(empty)
    await load()
  }

  const remove = async (seller: Seller) => {
    if (!window.confirm(`Remove ${seller.fullName || seller.email}? They will no longer be able to sign in, and if they are signed in now they are locked out within about an hour. Sales they recorded stay in the history.`)) return
    setError(''); setNotice('')
    const response = await fetch('/api/admin/team', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: seller.id }) })
    const result = await response.json()
    if (!response.ok) setError(result.error ?? 'Could not remove the seller.')
    else { setNotice(`${seller.fullName || seller.email} can no longer sign in. If they are signed in right now, access ends within about an hour.`); await load() }
  }

  return <section className="admin-card" style={{ marginTop: 14 }}>
    <div className="admin-card-title"><h3>Sellers</h3><span>They can record sales, add phones and answer customer requests. They cannot change settings or see cost prices.</span></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-success" role="status">{notice}</div>}
    <form className="admin-toolbar" onSubmit={add}>
      <div className="admin-toolbar-left">
        <input className="admin-input" required placeholder="Full name" aria-label="Seller full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <input className="admin-input" required type="email" placeholder="Email" aria-label="Seller email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input className="admin-input" required type="password" minLength={12} placeholder="Password (12+ characters)" aria-label="Seller password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      </div>
      <button className="button button-primary button-small" type="submit" disabled={busy}><Plus size={13} /> {busy ? 'Adding…' : 'Add seller'}</button>
    </form>
    {sellers === null ? (!error && <div className="admin-empty">Loading sellers…</div>) : sellers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Seller</th><th>Email</th><th>Added</th><th>Action</th></tr></thead><tbody>{sellers.map((seller) => <tr key={seller.id}>
      <td><strong>{seller.fullName || '—'}</strong></td><td>{seller.email}</td><td>{new Date(seller.createdAt).toLocaleDateString()}</td>
      <td><button type="button" className="admin-icon-button danger" title="Remove seller" aria-label={`Remove ${seller.fullName || seller.email}`} onClick={() => void remove(seller)}><UserMinus size={14} /></button></td>
    </tr>)}</tbody></table></div> : <div className="admin-empty">No sellers yet. Add one above.</div>}
    <a className="button button-outline button-small" href="/admin/activity" style={{ marginTop: 12 }}>Review security activity</a>
  </section>
}
