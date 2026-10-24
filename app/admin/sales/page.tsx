import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { SalesManager } from './ui'
import { requireAdmin } from '../../../src/lib/supabase/auth'

export const metadata: Metadata = { title: 'Sales' }
export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const { profile } = await requireAdmin()
  return <AdminShell name={profile.full_name} role={profile.role}><SalesManager role={profile.role} /></AdminShell>
}
