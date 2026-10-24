import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'closed']).optional(),
  internalNote: z.string().max(1000).optional(),
}).strict()

export async function GET() {
  try {
    const { supabase } = await requireAdmin()
    const { data, error } = await supabase.from('leads').select('id,type,name,contact,payload,status,created_at').order('created_at', { ascending: false }).limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data ?? [] }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load requests.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || (!parsed.data.status && parsed.data.internalNote === undefined)) {
    return NextResponse.json({ error: parsed.success ? 'No request changes provided.' : parsed.error.issues[0]?.message }, { status: 400 })
  }
  try {
    const { supabase } = await requireAdmin()
    const { data: lead, error: readError } = await supabase.from('leads').select('payload').eq('id', parsed.data.id).maybeSingle()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
    if (!lead) return NextResponse.json({ error: 'Customer request not found.' }, { status: 404 })
    const { id, status, internalNote } = parsed.data
    const patch = {
      ...(status ? { status } : {}),
      ...(internalNote !== undefined ? { payload: { ...lead.payload, internalNote } } : {}),
    }
    const { error } = await supabase.from('leads').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update the request.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
