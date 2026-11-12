import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { SettingsManager } from './ui'
import { requireAdminPage } from '../../../src/lib/auth/session'

export const metadata: Metadata = { title: 'Owner settings' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { profile } = await requireAdminPage('owner')
  return <AdminShell name={profile.full_name} role={profile.role}><SettingsManager /></AdminShell>
}
