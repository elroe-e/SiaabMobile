'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, BadgeDollarSign, Boxes, ClipboardList, LayoutDashboard, LogOut, Settings2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { getBrowserSupabase } from '../../src/lib/supabase/browser'

type ProfileRole = 'owner' | 'staff'

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/sales', label: 'Sales', icon: BadgeDollarSign },
  { href: '/admin/leads', label: 'Leads & requests', icon: ClipboardList },
  { href: '/admin/settings', label: 'Settings', icon: Settings2, ownerOnly: true },
  { href: '/admin/activity', label: 'Activity log', icon: ShieldCheck, ownerOnly: true },
]

export function AdminShell({ children, name, role }: { children: ReactNode; name: string; role: ProfileRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const visibleLinks = links.filter((link) => !link.ownerOnly || role === 'owner')
  const signOut = async () => {
    setSigningOut(true)
    const { error } = await getBrowserSupabase().auth.signOut()
    if (error) {
      setSigningOut(false)
      window.alert(`Could not sign out: ${error.message}`)
      return
    }
    router.replace('/admin/login')
    router.refresh()
  }
  const isActive = (href: string) => href === '/admin' ? pathname === href : pathname.startsWith(href)
  const nav = (className: string) => <nav className={className} aria-label="Admin navigation">
    {visibleLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={isActive(href) ? 'active' : ''}>
      <Icon size={16} strokeWidth={1.8} />{label}
    </Link>)}
  </nav>

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand">
        <span className="brand-mark">S</span>
        <span><span className="brand-name">siaab<span className="brand-accent">.</span></span><span className="admin-brand-sub">Store management</span></span>
      </Link>
      {nav('admin-nav')}
      <div className="admin-sidebar-foot">
        <Link href="/"><ArrowUpRight size={15} /> View storefront</Link>
        <button type="button" disabled={signingOut} onClick={signOut}><LogOut size={15} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </aside>
    <main className="admin-workspace">
      <header className="admin-topbar">
        <div><h1>Store management</h1><p>Keep your shop running smoothly.</p></div>
        <div className="admin-top-actions"><span className="admin-profile"><span className="admin-avatar">{(name || 'S').slice(0, 1).toUpperCase()}</span><span>{name || 'Shop team'} · {role}</span></span></div>
      </header>
      <div className="admin-content">{children}</div>
    </main>
    {nav('admin-bottom-nav')}
  </div>
}
