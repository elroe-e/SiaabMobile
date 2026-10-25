import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight, BatteryCharging, Camera, Check, ChevronDown, Cpu, HardDrive, Menu, MessageCircle, Share2,
  Monitor, PhoneCall, ShieldCheck, Smartphone, X,
} from 'lucide-react'
import { useStoreData } from '../context/StoreDataContext'
import { formatPrice, formatStorage, fullPhoneName } from '../lib/format'
import { createWhatsAppUrl, phoneOrderMessage } from '../lib/whatsapp'
import type { Phone, SpecMode } from '../types'

const navLinks = [
  { label: 'Phones', to: '/phones' },
  { label: 'Upcoming', to: '/upcoming' },
  { label: 'Trade-in', to: '/trade-in' },
  { label: 'Our story', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onResize = () => {
      if (window.innerWidth > 800) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = navRef.current?.querySelectorAll<HTMLElement>('a,button')
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !navRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !navRef.current?.contains(document.activeElement))) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    navRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      document.body.style.overflow = previousOverflow
      if (window.innerWidth <= 800) menuButtonRef.current?.focus()
    }
  }, [open])
  const { shop } = useStoreData()
  const whatsapp = createWhatsAppUrl(`Hello ${shop.name}, I have a question about your phones.`, shop.whatsapp[0])

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand-lockup" aria-label="siaabmobile home">
          <span className="brand-mark"><Smartphone size={19} strokeWidth={2.4} /></span>
          <span className="brand-name">siaab<span>mobile</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navLinks.map((item) => <Link key={item.to} href={item.to} className={pathname === item.to || pathname.startsWith(`${item.to}/`) ? 'nav-link active' : 'nav-link'}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link href="/trade-in" className="button button-primary button-small">Trade in <ArrowUpRight size={15} /></Link>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="whatsapp-icon" aria-label="Chat with Siaab Mobile on WhatsApp"><MessageCircle size={19} /></a>
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav-dialog" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && createPortal(
        <>
          <div className="mobile-menu-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={navRef} id="mobile-nav-dialog" className="mobile-nav" role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <div className="mobile-nav-head"><span>Explore</span><button type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)}><X /></button></div>
            <nav aria-label="Mobile navigation links">
              {navLinks.map((item, index) => <Link key={item.to} href={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={pathname === item.to || pathname.startsWith(`${item.to}/`) ? 'active' : ''} style={{ animationDelay: `${index * 45}ms` }}>{item.label}<ArrowUpRight size={18} /></Link>)}
            </nav>
            <div className="mobile-nav-bottom"><span>Visit our store</span><strong>{shop.address}</strong></div>
          </div>
        </>,
        document.body,
      )}
    </header>
  )
}

export function FloatingWhatsApp() {
  const pathname = usePathname()
  const { shop } = useStoreData()
  const onProductPage = pathname.startsWith('/phones/')
  const number = shop.whatsapp[0]
  if (!number) return null
  return <a className={`floating-wa ${onProductPage ? 'floating-wa-product' : ''}`} href={createWhatsAppUrl(`Hello ${shop.name}, I have a question about a phone.`, number)} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp"><MessageCircle size={24} /></a>
}

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `${title} at Siaab Mobile`
  const share = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }) } catch { /* the person closed the share sheet */ }
      return
    }
    setOpen((current) => !current)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setCopied(false) }
  }
  return <div className="share-wrap">
    <button type="button" className="button button-outline button-large" onClick={() => void share()} aria-expanded={open}><Share2 size={17} />Share</button>
    {open && <div className="share-menu" role="group" aria-label="Share this phone">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text}
${url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Telegram</a>
      <button type="button" onClick={() => void copy()}>{copied ? 'Link copied' : 'Copy link'}</button>
    </div>}
  </div>
}

export function Footer() {
  const { shop } = useStoreData()
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <Link href="/" className="brand-lockup"><span className="brand-mark"><Smartphone size={18} /></span><span className="brand-name">siaab<span>mobile</span></span></Link>
          <p>A better way to find your next phone. Good advice, trusted devices, right here in Addis.</p>
        </div>
        <div className="footer-column"><h3>Explore</h3><Link href="/phones">Shop phones</Link><Link href="/upcoming">Coming soon</Link><Link href="/trade-in">Trade-in estimate</Link></div>
        <div className="footer-column"><h3>Say hello</h3><a href={`tel:${shop.phones[0]}`}>{shop.phones[0]}</a><a href={shop.telegram} target="_blank" rel="noreferrer">Telegram</a><Link href="/contact">Visit our store</Link></div>
        <div className="footer-address"><span className="eyebrow">FIND US IN ADDIS</span><p>{shop.address}</p><p>{shop.hours}</p><a href={shop.mapUrl} target="_blank" rel="noreferrer" className="text-link">Get directions <ArrowUpRight size={15} /></a></div>
      </div>
      <div className="container footer-bottom"><span>© {new Date().getFullYear()} {shop.name}. All rights reserved.</span><span>Prices and availability may change. Confirm with our team before visiting.</span></div>
    </footer>
  )
}

export function SectionHeading({ eyebrow, title, text, link, to }: { eyebrow: string; title: string; text?: string; link?: string; to?: string }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>{link && to && <Link href={to} className="text-link">{link}<ArrowUpRight size={16} /></Link>}</div>
}

const statusLabel = { in_stock: 'In stock', low_stock: 'Only a few left', out_of_stock: 'Sold out' }
export function StockBadge({ stock, count }: { stock: Phone['stock']; count?: number }) {
  const label = stock === 'out_of_stock' ? statusLabel.out_of_stock : count === undefined ? statusLabel[stock] : count < 10 ? `${count} in stock` : statusLabel.in_stock
  return <span className={`stock-badge stock-${stock}`}><span />{label}</span>
}

export function SpecSwitcher({ mode, onChange }: { mode: SpecMode; onChange: (mode: SpecMode) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = mode === 'simple' ? 'advanced' : 'simple'
    onChange(next)
    ref.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus()
  }
  return <div ref={ref} className="spec-switcher" role="radiogroup" aria-label="Specification detail level" onKeyDown={onKeyDown}>
    {(['simple', 'advanced'] as const).map((value) => <button key={value} data-mode={value} type="button" role="radio" aria-checked={mode === value} tabIndex={mode === value ? 0 : -1} onClick={() => onChange(value)}>{value === 'simple' ? 'Simple' : 'Advanced'}</button>)}
  </div>
}

const specIcons = { display: Monitor, camera: Camera, battery: BatteryCharging, storage: HardDrive, ram: Cpu, chipset: Smartphone } as const
export function KeySpecs({ phone, mode }: { phone: Phone; mode: SpecMode }) {
  if (mode === 'simple') {
    return <div className="key-spec-grid">{Object.entries(phone.simpleSpecs).map(([key, value]) => {
      const Icon = specIcons[key as keyof typeof specIcons]
      return <div className="key-spec" key={key}><Icon size={16} /><span>{key}</span><strong>{value}</strong></div>
    })}</div>
  }
  return <div className="card-advanced-specs">{Object.entries(phone.advancedSpecs).slice(0, 3).map(([group, specs]) => <div key={group}><span>{group}</span><strong>{Object.entries(specs).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(' · ')}</strong></div>)}</div>
}

export function PhoneCard({ phone, mode = 'simple', compact = false }: { phone: Phone; mode?: SpecMode; compact?: boolean }) {
  const { shop } = useStoreData()
  const orderMessage = phone.stock === 'out_of_stock'
    ? `Hello ${shop.name}, please let me know when ${fullPhoneName(phone.brand, phone.model)} is back in stock.`
    : phoneOrderMessage(`${fullPhoneName(phone.brand, phone.model)}`, formatStorage(phone.storageOptions[0]?.gb ?? 128), formatPrice(phone.price), `${shop.siteUrl}/phones/${phone.slug}`, shop.name)
  const order = createWhatsAppUrl(orderMessage, shop.whatsapp[0])
  return (
    <article className={`phone-card ${compact ? 'phone-card-compact' : ''}`}>
      <Link href={`/phones/${phone.slug}`} className="product-art-link">
        <img className="product-art" src={phone.images[0]} alt={`${fullPhoneName(phone.brand, phone.model)} phone`} loading="lazy" />
        <div className="product-card-badges">{phone.badges.slice(0, 1).map((badge) => <span className="pill" key={badge}>{badge}</span>)}</div>
        <span className="product-arrow"><ArrowUpRight size={17} /></span>
      </Link>
      <div className="phone-card-content">
        <div className="phone-card-title"><div><span className="phone-brand">{phone.brand}</span><h3><Link href={`/phones/${phone.slug}`}>{phone.model}</Link></h3></div><StockBadge stock={phone.stock} count={phone.stockCount} /></div>
        <KeySpecs phone={phone} mode={mode} />
        <div className="phone-card-footer"><div><span className="price-label">From</span><strong>{formatPrice(phone.price)}</strong>{phone.oldPrice && <del>{formatPrice(phone.oldPrice)}</del>}</div><div className="phone-card-actions"><Link href={`/phones/${phone.slug}`} className="button button-light button-small">Details</Link><a href={order} target="_blank" rel="noreferrer" className={`button button-whatsapp button-small ${phone.stock === 'out_of_stock' ? 'button-disabled' : ''}`} aria-label={phone.stock === 'out_of_stock' ? `Ask when ${phone.model} will be available` : `Ask about ${phone.model} on WhatsApp`}><MessageCircle size={15} />{phone.stock === 'out_of_stock' ? 'Notify' : 'WhatsApp'}</a></div></div>
      </div>
    </article>
  )
}

export function AdvancedSpecs({ phone }: { phone: Phone }) {
  const groups = Object.entries(phone.advancedSpecs)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string[]>(groups.map(([group]) => group))
  const visible = groups.map(([group, specs]) => [group, Object.entries(specs).filter(([key, value]) => `${group} ${key} ${value}`.toLowerCase().includes(query.toLowerCase()))] as const).filter(([, specs]) => specs.length)
  const allOpen = visible.length > 0 && visible.every(([group]) => expanded.includes(group))
  return <div className="advanced-spec-panel">
    <div className="advanced-spec-toolbar"><label><span className="sr-only">Search specifications</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specifications" /></label><button className="text-button" type="button" onClick={() => setExpanded(allOpen ? [] : visible.map(([group]) => group))}>{allOpen ? 'Collapse all' : 'Expand all'}</button></div>
    <div className="advanced-spec-grid">{visible.map(([group, specs]) => <section className="spec-group" key={group}>
      <button type="button" className="spec-group-toggle" aria-expanded={expanded.includes(group)} onClick={() => setExpanded((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])}><span>{group}</span><ChevronDown size={17} /></button>
      {expanded.includes(group) && <dl>{specs.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
    </section>)}</div>
  </div>
}

export function TrustStrip() {
  return <div className="trust-strip"><div><ShieldCheck /><span><strong>Genuine devices</strong><small>Carefully sourced, always</small></span></div><div><Check /><span><strong>Warranty included</strong><small>Shop with confidence</small></span></div><div><Smartphone /><span><strong>Trade-ins welcome</strong><small>Make your next move</small></span></div><div><PhoneCall /><span><strong>Real local support</strong><small>We’re here to help</small></span></div></div>
}

export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return ref
}
