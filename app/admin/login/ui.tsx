'use client'

import { BrandMark } from '../../../src/components/BrandMark'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({})) as { error?: string; mfa?: boolean }
  return { ok: response.ok, ...result }
}

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [askCode, setAskCode] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Arriving from a page that needs the code step (signed in, code not entered yet).
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mfa') === '1') setAskCode(true) }, [])

  const finish = () => { router.replace('/admin'); router.refresh() }

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await post('/api/auth/verify', { code: mfaCode.trim() })
    if (!result.ok) { setError(result.error ?? 'That code did not work.'); setBusy(false); return }
    finish()
  }

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError('')
    const result = await post('/api/auth/login', { email: email.trim(), password })
    if (!result.ok) { setError(result.error ?? 'Could not sign in.'); setBusy(false); return }
    if (result.mfa) { setAskCode(true); setBusy(false); return }
    finish()
  }

  const forgotPassword = () => {
    setError('')
    setNotice('Ask the shop owner to set a new password for you in Settings. The owner can reset their own password from the server.')
  }

  return <main className="admin-login-page">
    <aside className="admin-login-aside">
      <Link href="/" className="admin-brand">
        <BrandMark />
        <span><span className="brand-name">siaab<span className="brand-accent">.</span></span><span className="admin-brand-sub">Store management</span></span>
      </Link>
      <div className="admin-login-copy">
        <span className="admin-badge"><LockKeyhole size={11} /> PRIVATE WORKSPACE</span>
        <h1>Good phones.<br />Good business.</h1>
        <p>Manage your Siaab Mobile inventory, sales and customer requests in one secure place.</p>
      </div>
      <div className="admin-login-foot">Siaab Mobile · Addis Ababa</div>
    </aside>
    <section className="admin-login-main">
      <div className="admin-login-card">
        <h2>{askCode ? 'Enter your code' : 'Welcome back'}</h2>
        <p>{askCode ? 'Open your authenticator app and type the 6-digit code for Siaab Mobile.' : 'Sign in with your shop account to continue.'}</p>
        {askCode ? <form className="admin-login-form" onSubmit={verifyCode}>
          <label className="admin-label">6-digit code
            <span className="input-icon-wrap"><LockKeyhole size={14} /><input className="admin-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></span>
          </label>
          {error && <div className="admin-error" role="alert">{error}</div>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Verify and continue'}</button>
        </form> : <form className="admin-login-form" onSubmit={signIn}>
          <label className="admin-label">Email address
            <span className="input-icon-wrap"><Mail size={14} /><input className="admin-input" autoComplete="username" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourshop.com" /></span>
          </label>
          <label className="admin-label">Password
            <span className="input-icon-wrap"><LockKeyhole size={14} /><input className="admin-input" autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></span>
          </label>
          {error && <div className="admin-error" role="alert">{error}</div>}
          {notice && <div className="admin-success" role="status">{notice}</div>}
          <button className="button button-primary" type="submit" disabled={busy || !configured}>{busy ? 'Please wait…' : 'Sign in securely'}</button>
        </form>}
        <div className="admin-login-help"><Link href="/">Back to storefront</Link>{!askCode && <button type="button" disabled={busy} onClick={forgotPassword}>Forgot password?</button>}</div>
        {!configured && <div className="admin-login-config"><strong>Admin is not configured yet.</strong><br />Add DATABASE_URL to the Node.js app environment variables, restart the app, then create the first owner from the cPanel Terminal.</div>}
        <p className="admin-inline-note" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 20 }}><Smartphone size={12} /> Need access? Ask the shop owner to create your seller account.</p>
      </div>
    </section>
  </main>
}
