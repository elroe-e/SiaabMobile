import type { Metadata } from 'next'
import './admin.css'

export const metadata: Metadata = {
  title: { default: 'Admin | Siaab Mobile', template: '%s | Siaab Mobile Admin' },
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="admin-root">{children}</div>
}
