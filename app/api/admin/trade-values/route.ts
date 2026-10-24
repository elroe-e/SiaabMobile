import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

const valueSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  storageGb: z.number().int().min(1).max(4096),
  baseValue: z.number().positive(),
}).strict()
const deleteSchema = z.object({ id: z.string().uuid() }).strict()

export async function POST(request: Request) {
  const parsed = valueSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid trade-in value.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin('owner')
    const value = parsed.data
    const { error } = await supabase.from('trade_in_values').upsert({
      brand_text: value.brand,
      model_text: value.model,
      storage_gb: value.storageGb,
      base_value: value.baseValue,
      is_active: true,
    }, { onConflict: 'brand_text,model_text,storage_gb' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save trade-in value.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid trade-in value id.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin('owner')
    const { error } = await supabase.from('trade_in_values').delete().eq('id', parsed.data.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete trade-in value.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
