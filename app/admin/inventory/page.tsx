import type { Metadata } from 'next'
import { AdminShell } from '../admin-shell'
import { InventoryManager } from './ui'
import { requireAdminPage } from '../../../src/lib/auth/session'

export const metadata: Metadata = { title: 'Inventory' }
export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const { profile } = await requireAdminPage()
  return <AdminShell name={profile.full_name} role={profile.role}><InventoryManager role={profile.role} /></AdminShell>
}
