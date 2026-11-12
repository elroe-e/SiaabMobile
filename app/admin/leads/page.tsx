import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { LeadsManager } from './ui'
import { requireAdminPage } from '../../../src/lib/auth/session'

export const metadata: Metadata = { title: 'Customer requests' }
export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const { profile } = await requireAdminPage()
  return <AdminShell name={profile.full_name} role={profile.role}><LeadsManager /></AdminShell>
}
