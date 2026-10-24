import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

const tradeConfigSchema = z.object({
  condition: z.object({ like_new: z.number().min(0).max(2), good: z.number().min(0).max(2), fair: z.number().min(0).max(2), poor: z.number().min(0).max(2) }),
  screen: z.object({ perfect: z.number().min(0).max(2), light_scratches: z.number().min(0).max(2), cracked: z.number().min(0).max(2) }),
  body: z.object({ perfect: z.number().min(0).max(2), scratched: z.number().min(0).max(2), cracked_bent: z.number().min(0).max(2) }),
  battery: z.object({ '90_plus': z.number().min(0).max(2), '80_89': z.number().min(0).max(2), below_80: z.number().min(0).max(2), unknown: z.number().min(0).max(2) }),
  accessories: z.object({ full: z.number().min(0).max(2), phone_only: z.number().min(0).max(2) }),
  issuePenalty: z.number().min(0).max(.5),
  maxIssuePenalty: z.number().min(0).max(.8),
  minimumValue: z.number().min(0).max(1),
  range: z.object({ min: z.number().min(0).max(2), max: z.number().min(0).max(2) }),
}).strict()

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  whatsapp: z.string().trim().min(3).max(40).optional(),
  telegram: z.string().trim().max(240).optional(),
  email: z.string().trim().email().max(240).optional(),
  address: z.string().trim().max(400).optional(),
  hours: z.string().trim().max(300).optional(),
  soldBadgeDays: z.number().int().min(0).max(30).optional(),
  lowStockDefault: z.number().int().min(0).max(100).optional(),
  tradeConfig: tradeConfigSchema.optional(),
}).strict()

export async function GET() {
  try {
    const { supabase } = await requireAdmin('owner')
    const [settings, config, values] = await Promise.all([
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
      supabase.from('trade_in_config').select('config,updated_at').eq('id', 1).single(),
      supabase.from('trade_in_values').select('id,brand_text,model_text,storage_gb,base_value,is_active').order('brand_text').order('model_text'),
    ])
    const error = settings.error ?? config.error ?? values.error
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!settings.data || !config.data) return NextResponse.json({ error: 'Shop settings or trade-in configuration are missing. Apply the database seed first.' }, { status: 500 })
    return NextResponse.json({ settings: settings.data, tradeConfig: config.data.config, configUpdatedAt: config.data.updated_at, tradeValues: values.data }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load settings.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function PATCH(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin('owner')
    const { tradeConfig, soldBadgeDays, lowStockDefault, ...basic } = parsed.data
    const settings = {
      ...basic,
      ...(soldBadgeDays !== undefined ? { sold_badge_days: soldBadgeDays } : {}),
      ...(lowStockDefault !== undefined ? { low_stock_default: lowStockDefault } : {}),
      updated_at: new Date().toISOString(),
    }
    if (Object.keys(settings).length > 1) {
      const { error } = await supabase.from('shop_settings').update(settings).eq('id', 1)
      if (error) return NextResponse.json({ error: `Shop settings were not saved: ${error.message}` }, { status: 400 })
    }
    if (tradeConfig) {
      const { error } = await supabase.from('trade_in_config').upsert({ id: 1, config: tradeConfig, updated_at: new Date().toISOString() })
      if (error) return NextResponse.json({ error: `Shop details saved, but trade-in settings were not: ${error.message}` }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save settings.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
