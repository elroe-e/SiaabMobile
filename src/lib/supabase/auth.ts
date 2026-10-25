import 'server-only'
import { getServerSupabase } from './server'
import { needsSecondStep } from './mfa'

export async function requireAdmin(role?: 'owner' | 'staff') {
  const supabase = await getServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Authentication required.')
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (needsSecondStep(assurance)) throw new Error('Authentication required.')
  const { data: profile, error } = await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(`Could not verify admin profile: ${error.message}`)
  if (!profile || (role && profile.role !== role)) throw new Error('You do not have permission to perform this action.')
  return { supabase, user, profile }
}
