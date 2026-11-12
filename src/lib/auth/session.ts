import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDatabase } from '../db/pool'
import { createDbClient } from '../db/client'

export const SESSION_COOKIE = 'siaab_session'
const SESSION_DAYS = 7

export type Profile = { id: string; email: string; full_name: string; role: 'owner' | 'staff'; totp_secret: string | null }
type SessionRow = Profile & { session_id: string; mfa_passed: boolean }

// Only a fingerprint of the cookie is stored, so a database copy cannot be used to sign in.
const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')

export const sessionCookie = (token: string, maxAgeSeconds: number) => ({
  name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: 'lax' as const, path: '/',
  secure: process.env.NODE_ENV === 'production', maxAge: maxAgeSeconds,
})

/** Starts a session; accounts with two-factor stay "waiting for code" until verified. */
export async function createSession(profileId: string, mfaPassed: boolean) {
  const token = randomBytes(32).toString('base64url')
  await getDatabase().run((db) => db.query(
    `insert into public.sessions(id, profile_id, mfa_passed, expires_at) values ($1, $2, $3, now() + interval '${SESSION_DAYS} days')`,
    [fingerprint(token), profileId, mfaPassed],
  ))
  return sessionCookie(token, SESSION_DAYS * 86400)
}

async function readToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}

/** The signed-in session and person, or null. Removed sellers and expired sessions count as signed out. */
export async function readSession(): Promise<SessionRow | null> {
  const token = await readToken()
  if (!token) return null
  const { rows } = await getDatabase().run((db) => db.query(
    `select s.id as session_id, s.mfa_passed, p.id, p.email, p.full_name, p.role, p.totp_secret
     from public.sessions s join public.profiles p on p.id = s.profile_id
     where s.id = $1 and s.expires_at > now() and p.disabled_at is null`,
    [fingerprint(token)],
  ))
  return (rows[0] as SessionRow | undefined) ?? null
}

export async function markSessionVerified(sessionId: string) {
  await getDatabase().run((db) => db.query('update public.sessions set mfa_passed = true where id = $1', [sessionId]))
}

export async function endSession() {
  const token = await readToken()
  if (token) await getDatabase().run((db) => db.query('delete from public.sessions where id = $1', [fingerprint(token)]))
  return sessionCookie('', 0)
}

/** Ends every session of one person, e.g. when a seller is removed or a password is reset. */
export async function endAllSessions(profileId: string) {
  await getDatabase().run((db) => db.query('delete from public.sessions where profile_id = $1', [profileId]))
}

/**
 * Signed-in owner or seller, past the two-factor step. Throws "Authentication required." otherwise,
 * and "You do not have permission…" when an owner-only action is asked by a seller.
 */
export async function requireAdmin(role?: 'owner' | 'staff') {
  const session = await readSession()
  if (!session || (session.totp_secret && !session.mfa_passed)) throw new Error('Authentication required.')
  if (role && session.role !== role) throw new Error('You do not have permission to perform this action.')
  const profile = { id: session.id, email: session.email, full_name: session.full_name, role: session.role }
  return { db: createDbClient({ id: profile.id, role: profile.role }), user: { id: profile.id, email: profile.email }, profile }
}

/** For admin pages: sends signed-out visitors to sign-in (or the code step) and sellers away from owner pages. */
export async function requireAdminPage(role?: 'owner' | 'staff') {
  const session = await readSession()
  if (!session) redirect('/admin/login')
  if (session.totp_secret && !session.mfa_passed) redirect('/admin/login?mfa=1')
  if (role && session.role !== role) redirect('/admin')
  return requireAdmin(role)
}
