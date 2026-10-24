import { createClient } from '@supabase/supabase-js'
import process from 'node:process'
import { error as logError, log } from 'node:console'

const role = process.argv[2]
if (role !== 'owner' && role !== 'staff') {
  logError('Usage: npm run admin:provision-owner OR npm run admin:create-staff')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const fullName = process.env.ADMIN_FULL_NAME?.trim() ?? ''
if (!url || !serviceKey || !email || !password) {
  logError('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD in .env.local.')
  process.exit(1)
}
if (password.length < 12) {
  logError('ADMIN_PASSWORD must be at least 12 characters long.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) {
  logError(`Could not look up the auth account: ${listError.message}`)
  process.exit(1)
}
let user = users.users.find((candidate) => candidate.email?.toLowerCase() === email)
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) {
    logError(`Could not create the admin auth account: ${error?.message ?? 'No user returned.'}`)
    process.exit(1)
  }
  user = data.user
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: user.id,
  full_name: fullName || String(user.user_metadata.full_name ?? ''),
  role,
}, { onConflict: 'id' })
if (profileError) {
  logError(`The auth account exists, but the ${role} profile could not be saved: ${profileError.message}`)
  process.exit(1)
}
log(`Provisioned ${role} access for ${email}.`)
