import { NextResponse } from 'next/server'
import { endSession } from '../../../../src/lib/auth/session'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  try {
    response.cookies.set(await endSession())
  } catch (error) {
    console.error('Sign-out could not remove the session row', error)
    response.cookies.set({ name: 'siaab_session', value: '', path: '/', maxAge: 0 })
  }
  return response
}
