import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDatabase } from '../../../../src/lib/db/pool'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../../../../src/lib/auth/password'
import { endAllSessions, requireAdmin } from '../../../../src/lib/auth/session'

// Seller accounts are the "staff" role: they can sell, add phones and work requests, never change settings.
const password = z.string().min(MIN_PASSWORD_LENGTH, `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`).max(200)
const createSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(240),
  password,
}).strict()
const idSchema = z.object({ id: z.string().uuid() }).strict()
const resetSchema = z.object({ id: z.string().uuid(), password }).strict()

const failure = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
}

const run = (sql: string, params: unknown[]) => getDatabase().run((db) => db.query(sql, params))

/** Only active seller accounts; owners and removed sellers are never changed here. */
async function findSeller(id: string) {
  const { rows } = await run("select id from public.profiles where id = $1 and role = 'staff' and disabled_at is null", [id])
  return rows[0] ?? null
}

export async function GET() {
  try {
    await requireAdmin('owner')
    const { rows } = await run("select id, full_name, email, created_at from public.profiles where role = 'staff' and disabled_at is null order by created_at", [])
    const sellers = rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, createdAt: row.created_at }))
    return NextResponse.json({ sellers }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return failure(error, 'Could not load sellers.')
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid seller details.' }, { status: 400 })
  try {
    await requireAdmin('owner')
    const { fullName, email } = parsed.data
    const { rows } = await run('select role, disabled_at from public.profiles where email = $1', [email])
    const existing = rows[0] as { role: string; disabled_at: string | null } | undefined
    if (existing && (existing.role !== 'staff' || !existing.disabled_at)) return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
    const hash = await hashPassword(parsed.data.password)
    // A removed seller can be added back with the same email; their old sales stay linked to them.
    if (existing) await run("update public.profiles set full_name = $2, password_hash = $3, disabled_at = null, totp_secret = null, totp_pending = null where email = $1 and role = 'staff'", [email, fullName, hash])
    else await run("insert into public.profiles(email, full_name, password_hash, role) values ($1, $2, $3, 'staff')", [email, fullName, hash])
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return failure(error, 'Could not add the seller.')
  }
}

/** Sets a new password for a seller who forgot theirs, and signs them out everywhere. */
export async function PATCH(request: Request) {
  const parsed = resetSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Choose a seller and a new password.' }, { status: 400 })
  try {
    await requireAdmin('owner')
    if (!(await findSeller(parsed.data.id))) return NextResponse.json({ error: 'Only seller accounts can be changed here.' }, { status: 400 })
    await run('update public.profiles set password_hash = $2 where id = $1', [parsed.data.id, await hashPassword(parsed.data.password)])
    await endAllSessions(parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return failure(error, 'Could not reset the password.')
  }
}

export async function DELETE(request: Request) {
  const parsed = idSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a seller to remove.' }, { status: 400 })
  try {
    await requireAdmin('owner')
    // Only sellers can be removed here, so an owner can never lock themselves or another owner out.
    if (!(await findSeller(parsed.data.id))) return NextResponse.json({ error: 'Only seller accounts can be removed here.' }, { status: 400 })
    // Disabling instead of deleting keeps the sales they recorded linked to them; ending sessions locks them out now.
    await run('update public.profiles set disabled_at = now() where id = $1', [parsed.data.id])
    await endAllSessions(parsed.data.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return failure(error, 'Could not remove the seller.')
  }
}
