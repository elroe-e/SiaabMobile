import type { Metadata } from 'next'
import { AdminLogin } from './ui'

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } }

export default function AdminLoginPage() {
  return <AdminLogin />
}
