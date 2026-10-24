import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { LeadsManager } from './ui'
import { requireAdmin } from '../../../src/lib/supabase/auth'

export const metadata: Metadata = { title: 'Customer requests' }
export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const { profile } = await requireAdmin()
  return <AdminShell name={profile.full_name} role={profile.role}><LeadsManager /></AdminShell>
}
