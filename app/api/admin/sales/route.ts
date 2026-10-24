import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sell_new'), id: z.string().uuid(), quantity: z.number().int().min(1), price: z.number().positive(), note: z.string().max(1000).optional() }).strict(),
  z.object({ action: z.literal('sell_used'), id: z.string().uuid(), price: z.number().positive(), note: z.string().max(1000).optional() }).strict(),
  z.object({ action: z.literal('undo'), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal('reserve'), id: z.string().uuid(), days: z.number().int().min(1).max(14) }).strict(),
])

export async function GET() {
  try {
    const { supabase, profile } = await requireAdmin()
    const { data, error } = await supabase.from('sales').select('id,kind,variant_id,unit_id,quantity,sale_price,sold_at,sold_by,buyer_note,undone_at,variants(model_id,phone_models(name,brands(name))),used_units(model_id,price,phone_models(name,brands(name)))').order('sold_at', { ascending: false }).limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const costs = profile.role === 'owner'
      ? await supabase.from('admin_used_units').select('id,cost_price').not('cost_price', 'is', null)
      : { data: [], error: null }
    if (costs.error) return NextResponse.json({ error: costs.error.message }, { status: 500 })
    const costMap = new Map((costs.data ?? []).map((unit) => [unit.id, unit.cost_price]))
    const sales = (data ?? []).map((sale) => ({
      ...sale,
      ...(profile.role === 'owner' && sale.unit_id ? { cost_price: costMap.get(sale.unit_id) ?? null } : {}),
    }))
    return NextResponse.json({ sales, role: profile.role }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load sales.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid sale action.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin()
    const input = parsed.data
    const rpc = input.action === 'sell_new'
      ? await supabase.rpc('sell_variant', { p_variant_id: input.id, p_quantity: input.quantity, p_sale_price: input.price, p_buyer_note: input.note ?? null })
      : input.action === 'sell_used'
        ? await supabase.rpc('sell_used_unit', { p_unit_id: input.id, p_sale_price: input.price, p_buyer_note: input.note ?? null })
        : input.action === 'undo'
          ? await supabase.rpc('undo_sale', { p_sale_id: input.id })
          : await supabase.rpc('reserve_used_unit', { p_unit_id: input.id, p_days: input.days })
    if (rpc.error) return NextResponse.json({ error: rpc.error.message }, { status: 400 })
    return NextResponse.json({ result: rpc.data ?? 'ok' }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update sale.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
