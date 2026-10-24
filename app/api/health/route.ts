import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig, isSupabaseConfigured } from '../../../src/lib/supabase/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ status: 'ok', supabase: 'not_configured' }, { headers: { 'cache-control': 'no-store' } })
  }
  const { url, key } = getSupabasePublicConfig()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await supabase.from('public_shop_settings').select('name').limit(1)
  if (error) return NextResponse.json({ status: 'error', supabase: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  return NextResponse.json({ status: 'ok', supabase: 'connected' }, { headers: { 'cache-control': 'no-store' } })
}
