import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDatabase, isDatabaseConfigured } from '../../../../src/lib/db/pool'
import { verifyPassword } from '../../../../src/lib/auth/password'
import { createSession } from '../../../../src/lib/auth/session'
import { clearFailures, clientIp, isThrottled, recordFailure } from '../../../../src/lib/auth/throttle'

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(240), password: z.string().min(1).max(200) }).strict()

// Same answer for an unknown email and a wrong password, so the form cannot be used to find accounts.
const WRONG = 'Email or password is incorrect.'

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: WRONG }, { status: 400 })
  if (!isDatabaseConfigured) return NextResponse.json({ error: 'The shop database is not set up yet.' }, { status: 503 })
  const { email, password } = parsed.data
  const ip = clientIp(request)
  try {
    if (await isThrottled([['email', email], ['ip', ip]])) return NextResponse.json({ error: 'Too many attempts. Wait 15 minutes and try again.' }, { status: 429 })
    const { rows } = await getDatabase().run((db) => db.query('select id, password_hash, totp_secret from public.profiles where email = $1 and disabled_at is null', [email]))
    const profile = rows[0] as { id: string; password_hash: string; totp_secret: string | null } | undefined
    if (!profile || !(await verifyPassword(password, profile.password_hash))) {
      await recordFailure([['email', email], ['ip', ip]])
      return NextResponse.json({ error: WRONG }, { status: 401 })
    }
    await clearFailures('email', email)
    const response = NextResponse.json({ mfa: Boolean(profile.totp_secret) })
    response.cookies.set(await createSession(profile.id, !profile.totp_secret))
    return response
  } catch (error) {
    console.error('Sign-in failed', error)
    return NextResponse.json({ error: 'Sign-in is unavailable right now. Try again shortly.' }, { status: 503 })
  }
}
