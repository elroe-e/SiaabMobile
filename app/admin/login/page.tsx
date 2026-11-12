import type { Metadata } from 'next'
import { AdminLogin } from './ui'
import { isDatabaseConfigured } from '../../../src/lib/db/pool'

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return <AdminLogin configured={isDatabaseConfigured} />
}
