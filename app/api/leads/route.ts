import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabasePublicConfig, isSupabaseConfigured } from '../../../src/lib/supabase/config'

const leadSchema = z.object({
  type: z.enum(['trade_in', 'notify_me', 'contact', 'reservation']),
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(3).max(240),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict()

export async function POST(request: Request) {
  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a name and valid contact details.' }, { status: 400 })
  if (!isSupabaseConfigured) return NextResponse.json({ error: 'Lead storage is not configured. Your WhatsApp message can still be sent.' }, { status: 503 })
  const { url, key } = getSupabasePublicConfig()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.rpc('submit_public_lead', {
    p_type: parsed.data.type,
    p_name: parsed.data.name,
    p_contact: parsed.data.contact,
    p_payload: parsed.data.payload,
  })
  if (error) {
    const limited = error.message.includes('Too many requests')
    return NextResponse.json({ error: limited ? 'Too many requests. Please wait a few minutes before trying again.' : 'We could not save your request. Please continue in WhatsApp.' }, { status: limited ? 429 : 503 })
  }
  return NextResponse.json({ id: data }, { status: 201, headers: { 'cache-control': 'no-store' } })
}
