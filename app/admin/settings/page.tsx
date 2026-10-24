import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { SettingsManager } from './ui'
import { requireAdmin } from '../../../src/lib/supabase/auth'

export const metadata: Metadata = { title: 'Owner settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { profile } = await requireAdmin('owner')
  return <AdminShell name={profile.full_name} role={profile.role}><SettingsManager /></AdminShell>
}
