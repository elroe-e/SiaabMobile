import { NextResponse } from 'next/server'
import { z } from 'zod'
import { markSessionVerified, readSession } from '../../../../src/lib/auth/session'
import { verifyTotp } from '../../../../src/lib/auth/totp'
import { clearFailures, isThrottled, recordFailure } from '../../../../src/lib/auth/throttle'

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.') }).strict()

/** Second sign-in step for accounts with two-factor turned on. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })
  try {
    const session = await readSession()
    if (!session || !session.totp_secret) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
    if (session.mfa_passed) return NextResponse.json({ ok: true })
    if (await isThrottled([['code', session.id]])) return NextResponse.json({ error: 'Too many wrong codes. Wait 15 minutes and try again.' }, { status: 429 })
    if (!verifyTotp(session.totp_secret, parsed.data.code)) {
      await recordFailure([['code', session.id]])
      return NextResponse.json({ error: 'That code is not right. Check the time on your phone and try the newest code.' }, { status: 401 })
    }
    await clearFailures('code', session.id)
    await markSessionVerified(session.session_id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Code check failed', error)
    return NextResponse.json({ error: 'Could not check the code right now.' }, { status: 503 })
  }
}
