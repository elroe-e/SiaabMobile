'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { useT } from '../i18n'
import { formatPrice, fullPhoneName } from '../lib/format'
import type { Phone } from '../types'

const AUTOPLAY_MS = 5000
const THROW_MS = 320
// A drag this far (px) sends the top card to the back; shorter drags spring back.
const SWIPE_PX = 70
const VISIBLE_BEHIND = 2

/** Newest phones first; the catalog stores ISO dates, anything unparsable sorts last. */
export function newestPhones(items: Phone[], limit = 6): Phone[] {
  const time = (phone: Phone) => { const value = Date.parse(phone.createdAt); return Number.isNaN(value) ? 0 : value }
  return [...items].filter((phone) => phone.condition === 'new' && phone.stock !== 'out_of_stock').sort((a, b) => time(b) - time(a)).slice(0, limit)
}

/** Position in the deck for card `index` when `active` is on top: 0 is the top card, 1 the one behind it, and so on. */
export const deckDepth = (index: number, active: number, count: number) => (index - active + count) % count

/** The newest phones as a hand-held deck: swipe the top card away and it tucks in at the back. */
export function HeroCarousel({ phones }: { phones: Phone[] }) {
  const t = useT()
  const count = phones.length
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [thrown, setThrown] = useState<-1 | 1 | 0>(0)
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null)
  // Set after a swipe so the release does not also open the phone's page.
  const dragged = useRef(false)

  const next = useCallback((direction: -1 | 1 = -1) => {
    if (count < 2 || thrown) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setActive((value) => (value + 1) % count); return }
    setThrown(direction)
    window.setTimeout(() => { setActive((value) => (value + 1) % count); setThrown(0); setDragX(0) }, THROW_MS)
  }, [count, thrown])
  const previous = () => { if (!thrown) setActive((value) => (value - 1 + count) % count) }

  // Deals the next card every few seconds; waits while a mouse rests on it or a finger holds it, never runs with reduced motion.
  // Any change of card restarts the count, so a manual swipe gets its full five seconds.
  useEffect(() => {
    if (paused || count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => { if (!document.hidden) next() }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [paused, next, count, active])

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    dragged.current = false
    if (count < 2 || thrown || event.button !== 0) return
    setPaused(true)
    drag.current = { x: event.clientX, id: event.pointerId, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    const dx = event.clientX - current.x
    if (!current.moved && Math.abs(dx) > 6) { current.moved = true; event.currentTarget.setPointerCapture(event.pointerId) }
    if (current.moved) setDragX(dx)
  }
  const onPointerUp = () => {
    const current = drag.current
    drag.current = null
    setPaused(false)
    if (!current?.moved) return
    if (Math.abs(dragX) > SWIPE_PX) next(dragX < 0 ? -1 : 1)
    else setDragX(0)
    dragged.current = true
  }

  if (count === 0) return null
  return <section className="hero-carousel" aria-roledescription="carousel" aria-label={t("New phones")}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setPaused(true) }} onPointerLeave={(event) => { if (event.pointerType === 'mouse') setPaused(false) }}
    onKeyDown={(event) => { if (event.key === 'ArrowRight') next(); if (event.key === 'ArrowLeft') previous() }}>
    <div className="hero-deck">
      {phones.map((phone, index) => {
        const depth = deckDepth(index, active, count)
        const top = depth === 0
        const style = {
          // Hidden cards wait just behind the last visible one instead of fanning past the screen edge.
          '--depth': Math.min(depth, VISIBLE_BEHIND + 1),
          zIndex: count - depth,
          ...(top && (thrown || dragX) ? { transform: thrown ? `translateX(${thrown * 115}%) rotate(${thrown * 14}deg)` : `translateX(${dragX}px) rotate(${dragX / 18}deg)` } : {}),
        } as CSSProperties
        return <Link key={phone.id} href={`/phones/${phone.slug}`} draggable={false}
          className={`hero-slide${top ? ' is-top' : ''}${top && dragX && !thrown ? ' is-dragging' : ''}${depth > VISIBLE_BEHIND ? ' is-hidden' : ''}`}
          style={style} tabIndex={top ? 0 : -1} aria-hidden={!top}
          aria-roledescription="slide" aria-label={`${index + 1} / ${count}: ${fullPhoneName(phone.brand, phone.model)}`}
          onPointerDown={top ? onPointerDown : undefined} onPointerMove={top ? onPointerMove : undefined}
          onPointerUp={top ? onPointerUp : undefined} onPointerCancel={top ? onPointerUp : undefined}
          onClick={(event) => { if (dragged.current || !top) event.preventDefault(); dragged.current = false }}>
          <img src={phone.images[0]} alt={fullPhoneName(phone.brand, phone.model)} loading={depth <= VISIBLE_BEHIND ? 'eager' : 'lazy'} draggable={false} />
          <span className="hero-slide-info">
            <small>{t("New arrival")} · {phone.brand}</small>
            <strong>{fullPhoneName(phone.brand, phone.model)}</strong>
            <span>{formatPrice(phone.price)}</span>
          </span>
        </Link>
      })}
    </div>
    {count > 1 && <>
      <button type="button" className="hero-arrow hero-arrow-prev" onClick={previous} aria-label={t("Previous phone")}><ArrowLeft size={20} /></button>
      <button type="button" className="hero-arrow hero-arrow-next" onClick={() => next()} aria-label={t("Next phone")}><ArrowRight size={20} /></button>
      <div className="hero-dots" role="group" aria-label={t("Choose a phone")}>{phones.map((phone, index) => <button key={phone.id} type="button" className={index === active ? 'active' : ''} aria-label={fullPhoneName(phone.brand, phone.model)} aria-current={index === active} onClick={() => { if (!thrown) setActive(index) }} />)}</div>
    </>}
  </section>
}
