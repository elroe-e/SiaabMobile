'use client'

import { BrandMark } from '../../src/components/BrandMark'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, BadgeDollarSign, Boxes, ClipboardList, LayoutDashboard, LogOut, Settings2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

type ProfileRole = 'owner' | 'staff'

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/sales', label: 'Sales', icon: BadgeDollarSign },
  { href: '/admin/leads', label: 'Requests', icon: ClipboardList },
  { href: '/admin/settings', label: 'Settings', icon: Settings2, ownerOnly: true },
  { href: '/admin/activity', label: 'Activity', icon: ShieldCheck, ownerOnly: true },
]

export function AdminShell({ children, name, role }: { children: ReactNode; name: string; role: ProfileRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const visibleLinks = links.filter((link) => !link.ownerOnly || role === 'owner')
  const signOut = async () => {
    setSigningOut(true)
    const response = await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    if (!response?.ok) {
      setSigningOut(false)
      window.alert('Could not sign out. Check your connection and try again.')
      return
    }
    router.replace('/admin/login')
    router.refresh()
  }
  const isActive = (href: string) => href === '/admin' ? pathname === href : pathname.startsWith(href)
  const nav = (className: string) => <nav className={className} aria-label="Admin navigation">
    {visibleLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? 'active' : ''}>
      <Icon size={16} />{label}
    </Link>)}
  </nav>

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        <BrandMark />
        <span><span className="brand-name">siaab<span>mobile</span></span><span className="admin-brand-sub">Shop panel</span></span>
      </Link>
      {nav('admin-nav')}
      <div className="admin-sidebar-foot">
        <Link href="/"><ArrowUpRight size={16} /> View storefront</Link>
        <button type="button" disabled={signingOut} onClick={signOut}><LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </aside>
    <main className="admin-workspace">
      <header className="admin-topbar">
        <h1>Siaab Mobile</h1>
        <div className="admin-top-actions"><span className="admin-profile"><span className="admin-avatar">{(name || 'S').slice(0, 1).toUpperCase()}</span><span>{name || 'Shop team'} · {role === 'staff' ? 'seller' : role}</span></span></div>
      </header>
      <div className="admin-content">{children}</div>
    </main>
    {nav('admin-bottom-nav')}
  </div>
}
