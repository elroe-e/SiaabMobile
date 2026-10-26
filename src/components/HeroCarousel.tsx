'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { formatPrice, fullPhoneName } from '../lib/format'
import type { Phone } from '../types'

const AUTOPLAY_MS = 6000

/** Newest phones first; the catalog stores ISO dates, anything unparsable sorts last. */
export function newestPhones(items: Phone[], limit = 6): Phone[] {
  const time = (phone: Phone) => { const value = Date.parse(phone.createdAt); return Number.isNaN(value) ? 0 : value }
  return [...items].filter((phone) => phone.condition === 'new' && phone.stock !== 'out_of_stock').sort((a, b) => time(b) - time(a)).slice(0, limit)
}

/** Swipeable, Steam-style showcase of the newest phones. Native scroll-snap does the swiping on touch screens. */
export function HeroCarousel({ phones }: { phones: Phone[] }) {
  const t = useT()
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((index: number) => {
    const element = track.current
    if (!element || phones.length === 0) return
    const target = (index + phones.length) % phones.length
    const slide = element.children[target] as HTMLElement | undefined
    if (!slide) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollTo({ left: slide.offsetLeft - element.offsetLeft, behavior: reduce ? 'auto' : 'smooth' })
  }, [phones.length])

  const onScroll = () => {
    const element = track.current
    const first = element?.children[0] as HTMLElement | undefined
    if (!element || !first) return
    const step = first.offsetWidth + parseFloat(getComputedStyle(element).columnGap || '0')
    setActive(Math.min(phones.length - 1, Math.max(0, Math.round(element.scrollLeft / step))))
  }

  // Gentle autoplay; stops for good once the visitor touches it, and never runs with reduced motion.
  useEffect(() => {
    if (paused || phones.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => { if (!document.hidden) goTo(active + 1) }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [active, paused, goTo, phones.length])

  if (phones.length === 0) return null
  return <section className="hero-carousel" aria-roledescription="carousel" aria-label={t("New phones")}
    onPointerDown={() => setPaused(true)} onMouseEnter={() => setPaused(true)} onFocus={() => setPaused(true)}>
    <div className="hero-track" ref={track} onScroll={onScroll}>
      {phones.map((phone, index) => <Link key={phone.id} href={`/phones/${phone.slug}`} className="hero-slide" aria-roledescription="slide" aria-label={`${index + 1} / ${phones.length}: ${fullPhoneName(phone.brand, phone.model)}`}>
        <img src={phone.images[0]} alt={fullPhoneName(phone.brand, phone.model)} loading={index === 0 ? 'eager' : 'lazy'} draggable={false} />
        <span className="hero-slide-info">
          <small>{t("NEW ARRIVAL")} · {phone.brand.toUpperCase()}</small>
          <strong>{fullPhoneName(phone.brand, phone.model)}</strong>
          <span>{formatPrice(phone.price)}</span>
        </span>
      </Link>)}
    </div>
    {phones.length > 1 && <>
      <button type="button" className="hero-arrow hero-arrow-prev" onClick={() => { setPaused(true); goTo(active - 1) }} aria-label={t("Previous phone")}><ArrowLeft size={20} /></button>
      <button type="button" className="hero-arrow hero-arrow-next" onClick={() => { setPaused(true); goTo(active + 1) }} aria-label={t("Next phone")}><ArrowRight size={20} /></button>
      <div className="hero-dots" role="group" aria-label={t("Choose a phone")}>{phones.map((phone, index) => <button key={phone.id} type="button" className={index === active ? 'active' : ''} aria-label={fullPhoneName(phone.brand, phone.model)} aria-current={index === active} onClick={() => { setPaused(true); goTo(index) }} />)}</div>
    </>}
  </section>
}
