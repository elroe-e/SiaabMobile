'use client'

import { BrandMark } from '../../../src/components/BrandMark'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AuthChangeEvent } from '@supabase/supabase-js'
import { getBrowserSupabase } from '../../../src/lib/supabase/browser'
import { getSupabasePublicConfig } from '../../../src/lib/supabase/config'
import { needsSecondStep } from '../../../src/lib/supabase/mfa'

export function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [setPasswordMode, setSetPasswordMode] = useState(false)

  const [busy, setBusy] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  let configured = true
  try { getSupabasePublicConfig() } catch { configured = false }

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const params = new URLSearchParams(window.location.search)
    const authLinkType = hash.get('type')
    const isPasswordLink = params.get('mode') === 'set-password' || authLinkType === 'invite' || authLinkType === 'recovery'
    if (isPasswordLink) setSetPasswordMode(true)
    if (hash.has('error_code')) {
      const errorCode = hash.get('error_code')
      setError(errorCode === 'otp_expired'
        ? 'This invitation or password link has expired or was already used. Request a new link and open it promptly.'
        : hash.get('error_description')?.replace(/\+/g, ' ') || 'The authentication link could not be verified. Request a new link.')
    }

    if (!configured) return
    const supabase = getBrowserSupabase()
    if (params.get('mfa') === '1') void askForCodeIfNeeded()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && isPasswordLink)) {
        setSetPasswordMode(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [configured])

  const askForCodeIfNeeded = async () => {
    const supabase = getBrowserSupabase()
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!needsSecondStep(level)) return false
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factorId = factors?.totp?.[0]?.id
    if (!factorId) return false
    setMfaFactorId(factorId)
    return true
  }

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mfaFactorId) return
    setBusy(true)
    setError('')
    const { error: verifyError } = await getBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode.trim() })
    if (verifyError) {
      setError(verifyError.message)
      setBusy(false)
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: loginError } = await getBrowserSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (loginError) {
      setError(loginError.message)
      setBusy(false)
      return
    }
    if (await askForCodeIfNeeded()) {
      setBusy(false)
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: updateError } = await getBrowserSupabase().auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setBusy(false)
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  const resetPassword = async () => {
    if (!email.includes('@')) {
      setError('Enter your account email first, then choose forgot password.')
      return
    }
    setBusy(true)
    setError('')
    const { error: resetError } = await getBrowserSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/login?mode=set-password`,
    })
    setBusy(false)
    if (resetError) setError(resetError.message)
    else setNotice('If an account exists for this email, a password reset link is on its way.')
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
        <h2>{mfaFactorId ? 'Enter your code' : setPasswordMode ? 'Set your password' : 'Welcome back'}</h2>
        <p>{mfaFactorId ? 'Open your authenticator app and type the 6-digit code for Siaab Mobile.' : setPasswordMode ? 'Choose a new password to finish setting up your shop account.' : 'Sign in with your shop account to continue.'}</p>
        {mfaFactorId ? <form className="admin-login-form" onSubmit={verifyCode}>
          <label className="admin-label">6-digit code
            <span className="input-icon-wrap"><LockKeyhole size={14} /><input className="admin-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></span>
          </label>
          {error && <div className="admin-error" role="alert">{error}</div>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Verify and continue'}</button>
        </form> : setPasswordMode ? <form className="admin-login-form" onSubmit={updatePassword}>
          <label className="admin-label">New password
            <span className="input-icon-wrap"><LockKeyhole size={14} /><input className="admin-input" autoComplete="new-password" type="password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 12 characters" /></span>
          </label>
          {error && <div className="admin-error" role="alert">{error}</div>}
          {notice && <div className="admin-success" role="status">{notice}</div>}
          <button className="button button-primary" type="submit" disabled={busy || !configured}>{busy ? 'Please wait…' : 'Save password'}</button>
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
        <div className="admin-login-help"><Link href="/">Back to storefront</Link>{!setPasswordMode && <button type="button" disabled={busy || !configured} onClick={resetPassword}>Forgot password?</button>}</div>
        {!configured && <div className="admin-login-config"><strong>Admin is not configured yet.</strong><br />Add the Supabase URL and public anon key to the deployment environment, then apply the database migration and provision the first owner.</div>}
        <p className="admin-inline-note" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 20 }}><Smartphone size={12} /> Need access? Ask the shop owner to create your staff account.</p>
      </div>
    </section>
  </main>
}
