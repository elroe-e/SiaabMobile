'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getBrowserSupabase } from '../../../src/lib/supabase/browser'

type Enrollment = { factorId: string; qr: string; secret: string }

export function TwoFactorCard() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error: listError } = await getBrowserSupabase().auth.mfa.listFactors()
    if (listError) setError(listError.message)
    setFactorId(data?.totp?.[0]?.id ?? null)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const start = async () => {
    setBusy(true); setError(''); setNotice('')
    const auth = getBrowserSupabase().auth
    // Remove half-finished attempts first; they would block a new enrolment.
    const { data: existing } = await auth.mfa.listFactors()
    for (const factor of existing?.all ?? []) if (factor.status === 'unverified') await auth.mfa.unenroll({ factorId: factor.id })
    const { data, error: enrollError } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: `Siaab admin ${new Date().toISOString().slice(0, 10)}` })
    setBusy(false)
    if (enrollError || !data) { setError(enrollError?.message ?? 'Could not start two-factor setup.'); return }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!enrollment) return
    setBusy(true); setError('')
    const { error: verifyError } = await getBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() })
    setBusy(false)
    if (verifyError) { setError(verifyError.message); return }
    setEnrollment(null); setCode(''); setNotice('Two-factor sign-in is now on. You will be asked for a code each time you sign in.')
    await load()
  }

  const cancel = async () => {
    if (enrollment) await getBrowserSupabase().auth.mfa.unenroll({ factorId: enrollment.factorId })
    setEnrollment(null); setCode(''); setError('')
  }

  const turnOff = async () => {
    if (!factorId) return
    setBusy(true); setError('')
    const { error: offError } = await getBrowserSupabase().auth.mfa.unenroll({ factorId })
    setBusy(false); setConfirmOff(false)
    if (offError) { setError(offError.message); return }
    setNotice('Two-factor sign-in is off.')
    await load()
  }

  if (loading) return null
  return <section className="admin-card" aria-labelledby="two-factor-title">
    <div className="admin-card-title"><h3 id="two-factor-title"><ShieldCheck size={16} /> Two-factor sign-in</h3><span>{factorId ? 'On' : 'Off'}</span></div>
    <p className="admin-inline-note">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) after your password. Recommended for the owner account.</p>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-success" role="status">{notice}</div>}
    {!factorId && !enrollment && <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void start()}>Turn on two-factor</button>}
    {enrollment && <form onSubmit={(event) => void verify(event)} className="admin-form-grid">
      <div className="admin-label full">
        <span>1. Scan this code with your authenticator app</span>
        <img src={enrollment.qr} alt="Two-factor setup QR code" width={180} height={180} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
        <small className="admin-inline-note">Cannot scan? Enter this key manually: <code>{enrollment.secret}</code></small>
      </div>
      <label className="admin-label full">2. Enter the 6-digit code it shows<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <div className="admin-form-actions full"><button type="button" className="button button-outline button-small" onClick={() => void cancel()}>Cancel</button><button type="submit" className="button button-primary button-small" disabled={busy}>Confirm and turn on</button></div>
    </form>}
    {factorId && !enrollment && (confirmOff
      ? <div className="admin-form-actions"><span className="admin-inline-note">Turn two-factor off for this account?</span><button type="button" className="button button-outline button-small" onClick={() => setConfirmOff(false)}>Keep it on</button><button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void turnOff()}>Yes, turn off</button></div>
      : <button type="button" className="button button-outline button-small" onClick={() => setConfirmOff(true)}>Turn off</button>)}
  </section>
}
