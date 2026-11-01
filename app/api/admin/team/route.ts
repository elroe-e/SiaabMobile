import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'
import { getServiceSupabase } from '../../../../src/lib/supabase/service'

// Seller accounts are the existing "staff" role: they can sell, add phones and work requests, never change settings.
const createSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(240),
  password: z.string().min(12, 'Use a password of at least 12 characters.').max(200),
}).strict()
const removeSchema = z.object({ id: z.string().uuid() }).strict()

const failure = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback
  return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
}

export async function GET() {
  try {
    await requireAdmin('owner')
    const service = getServiceSupabase()
    const [profiles, users] = await Promise.all([
      service.from('profiles').select('id,full_name,created_at').eq('role', 'staff').order('created_at'),
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    const error = profiles.error ?? users.error
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const now = Date.now()
    // Removed sellers are blocked, not deleted, so they drop out of the list but keep their sales history.
    const active = new Map(users.data.users.filter((user) => !user.banned_until || Date.parse(user.banned_until) < now).map((user) => [user.id, user.email ?? '']))
    const sellers = (profiles.data ?? []).filter((profile) => active.has(profile.id)).map((profile) => ({ id: profile.id, fullName: profile.full_name, email: active.get(profile.id) ?? '', createdAt: profile.created_at }))
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
    const service = getServiceSupabase()
    const { fullName, email, password } = parsed.data
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Could not create the account.' }, { status: 400 })
    const { error: profileError } = await service.from('profiles').upsert({ id: data.user.id, full_name: fullName, role: 'staff' }, { onConflict: 'id' })
    if (profileError) {
      // Without a profile the account could sign in to nothing; remove it so the owner can simply try again.
      await service.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: `Could not save the seller profile: ${profileError.message}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return failure(error, 'Could not add the seller.')
  }
}

export async function DELETE(request: Request) {
  const parsed = removeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a seller to remove.' }, { status: 400 })
  try {
    await requireAdmin('owner')
    const service = getServiceSupabase()
    const { data: profile, error } = await service.from('profiles').select('role').eq('id', parsed.data.id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Only seller accounts can be removed here, so an owner can never lock themselves or another owner out.
    if (profile?.role !== 'staff') return NextResponse.json({ error: 'Only seller accounts can be removed here.' }, { status: 400 })
    // Blocking sign-in instead of deleting keeps the sales they recorded linked to them.
    const { error: banError } = await service.auth.admin.updateUserById(parsed.data.id, { ban_duration: '876000h' })
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return failure(error, 'Could not remove the seller.')
  }
}
