'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

type Enrollment = { qr: string; secret: string }

async function call(method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch('/api/auth/two-factor', { method, cache: 'no-store', ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const result = await response.json().catch(() => ({})) as { error?: string; enabled?: boolean; qr?: string; secret?: string }
  return { ok: response.ok, ...result }
}

export function TwoFactorCard() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const result = await call('GET')
    if (!result.ok) setError(result.error ?? 'Could not read two-factor status.')
    setEnabled(Boolean(result.enabled))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const start = async () => {
    setBusy(true); setError(''); setNotice('')
    const result = await call('POST', { action: 'start' })
    setBusy(false)
    if (!result.ok || !result.qr || !result.secret) { setError(result.error ?? 'Could not start two-factor setup.'); return }
    setEnrollment({ qr: result.qr, secret: result.secret })
  }

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await call('POST', { action: 'confirm', code: code.trim() })
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'That code did not work.'); return }
    setEnrollment(null); setCode(''); setNotice('Two-factor sign-in is now on. You will be asked for a code each time you sign in.')
    await load()
  }

  const cancel = async () => {
    await call('POST', { action: 'cancel' })
    setEnrollment(null); setCode(''); setError('')
  }

  const turnOff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await call('POST', { action: 'off', code: code.trim() })
    setBusy(false)
    if (!result.ok) { setError(result.error ?? 'Could not turn two-factor off.'); return }
    setConfirmOff(false); setCode(''); setNotice('Two-factor sign-in is off.')
    await load()
  }

  if (loading) return null
  return <section className="admin-card" aria-labelledby="two-factor-title">
    <div className="admin-card-title"><h3 id="two-factor-title"><ShieldCheck size={16} /> Two-factor sign-in</h3><span>{enabled ? 'On' : 'Off'}</span></div>
    <p className="admin-inline-note">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) after your password. Recommended for the owner account.</p>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-success" role="status">{notice}</div>}
    {!enabled && !enrollment && <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void start()}>Turn on two-factor</button>}
    {enrollment && <form onSubmit={(event) => void verify(event)} className="admin-form-grid">
      <div className="admin-label full">
        <span>1. Scan this code with your authenticator app</span>
        <img src={enrollment.qr} alt="Two-factor setup QR code" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
        <small className="admin-inline-note">Cannot scan? Enter this key manually: <code>{enrollment.secret}</code></small>
      </div>
      <label className="admin-label full">2. Enter the 6-digit code it shows<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <div className="admin-form-actions full"><button type="button" className="button button-outline button-small" onClick={() => void cancel()}>Cancel</button><button type="submit" className="button button-primary button-small" disabled={busy}>Confirm and turn on</button></div>
    </form>}
    {enabled && !enrollment && (confirmOff
      ? <form className="admin-form-actions" onSubmit={(event) => void turnOff(event)}>
        <label className="admin-label">Current 6-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <button type="button" className="button button-outline button-small" onClick={() => { setConfirmOff(false); setCode('') }}>Keep it on</button>
        <button type="submit" className="button button-primary button-small" disabled={busy}>Turn off</button>
      </form>
      : <button type="button" className="button button-outline button-small" onClick={() => setConfirmOff(true)}>Turn off</button>)}
  </section>
}
