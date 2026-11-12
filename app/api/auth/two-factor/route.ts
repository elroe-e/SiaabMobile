import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { z } from 'zod'
import { getDatabase } from '../../../../src/lib/db/pool'
import { requireAdmin } from '../../../../src/lib/auth/session'
import { newTotpSecret, otpauthUrl, verifyTotp } from '../../../../src/lib/auth/totp'

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).strict(),
  z.object({ action: z.literal('confirm'), code: z.string().trim().regex(/^\d{6}$/) }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
  z.object({ action: z.literal('off'), code: z.string().trim().regex(/^\d{6}$/) }).strict(),
])

const failure = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status: message.includes('Authentication') ? 401 : 500 })
}

async function secrets(id: string) {
  const { rows } = await getDatabase().run((db) => db.query('select totp_secret, totp_pending from public.profiles where id = $1', [id]))
  return rows[0] as { totp_secret: string | null; totp_pending: string | null }
}

export async function GET() {
  try {
    const { profile } = await requireAdmin()
    return NextResponse.json({ enabled: Boolean((await secrets(profile.id)).totp_secret) }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return failure(error, 'Could not read two-factor status.')
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter the 6-digit code from your app.' }, { status: 400 })
  try {
    const { profile } = await requireAdmin()
    const current = await secrets(profile.id)
    const save = (sql: string, params: unknown[]) => getDatabase().run((db) => db.query(sql, params))
    const input = parsed.data
    if (input.action === 'start') {
      if (current.totp_secret) return NextResponse.json({ error: 'Two-factor is already on.' }, { status: 409 })
      const secret = newTotpSecret()
      await save('update public.profiles set totp_pending = $2 where id = $1', [profile.id, secret])
      const qr = await QRCode.toDataURL(otpauthUrl(secret, profile.email), { margin: 1, width: 220 })
      return NextResponse.json({ secret, qr })
    }
    if (input.action === 'cancel') {
      await save('update public.profiles set totp_pending = null where id = $1', [profile.id])
      return NextResponse.json({ ok: true })
    }
    if (input.action === 'confirm') {
      if (!current.totp_pending || !verifyTotp(current.totp_pending, input.code)) return NextResponse.json({ error: 'That code is not right. Try the newest code in your app.' }, { status: 400 })
      await save('update public.profiles set totp_secret = totp_pending, totp_pending = null where id = $1', [profile.id])
      return NextResponse.json({ ok: true })
    }
    // Turning it off needs a current code, so a borrowed signed-in phone cannot remove it.
    if (!current.totp_secret || !verifyTotp(current.totp_secret, input.code)) return NextResponse.json({ error: 'That code is not right.' }, { status: 400 })
    await save('update public.profiles set totp_secret = null, totp_pending = null where id = $1', [profile.id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return failure(error, 'Could not change two-factor sign-in.')
  }
}
