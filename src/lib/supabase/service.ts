import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from './config'

export function getServiceSupabase() {
  const { url } = getSupabasePublicConfig()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY on the server for owner provisioning and backups.')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
