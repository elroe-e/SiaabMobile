import { useSpecMode } from '../hooks/useSpecMode'
import { defaultFilters, filterPhones } from '../lib/filters'
import { estimateTradeIn } from '../lib/tradeIn'
import { createWhatsAppUrl } from '../lib/whatsapp'
import { phones } from '../data/phones'
import type { TradeInAnswers } from '../types'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpecSwitcher } from '../components/Storefront'
import { TradeIn } from '../App'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/trade-in',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const perfectAnswers: TradeInAnswers = {
  condition: 'like_new',
  screen: 'perfect',
  body: 'perfect',
  battery: '90_plus',
  powersOn: true,
  issues: [],
  accessories: 'full',
  locked: false,
}

function SpecModeProbe() {
  const [mode, setMode] = useSpecMode()
  return <div><span>{mode}</span><SpecSwitcher mode={mode} onChange={setMode} /></div>
}

describe('trade-in estimate', () => {
  it('returns the full base amount in perfect condition', () => {
    expect(estimateTradeIn(50000, perfectAnswers).estimate).toBe(50000)
  })

  it.each([
    [{ ...perfectAnswers, condition: 'good' as const }, 45000],
    [{ ...perfectAnswers, screen: 'light_scratches' as const }, 46500],
    [{ ...perfectAnswers, screen: 'cracked' as const }, 32500],
    [{ ...perfectAnswers, body: 'scratched' as const }, 46000],
    [{ ...perfectAnswers, body: 'cracked_bent' as const }, 37500],
    [{ ...perfectAnswers, battery: '80_89' as const }, 47000],
    [{ ...perfectAnswers, battery: 'below_80' as const }, 42500],
    [{ ...perfectAnswers, battery: 'unknown' as const }, 46000],
    [{ ...perfectAnswers, accessories: 'phone_only' as const }, 47500],
    [{ ...perfectAnswers, issues: ['Camera'] }, 47500],
  ])('applies the chosen condition multipliers', (answers, expected) => {
    expect(estimateTradeIn(50000, answers).estimate).toBe(expected)
  })

  it('caps functional issue penalties at 40 percent and floors low estimates at 10 percent', () => {
    const worst = { ...perfectAnswers, condition: 'poor' as const, screen: 'cracked' as const, body: 'cracked_bent' as const, battery: 'below_80' as const, accessories: 'phone_only' as const, issues: Array.from({ length: 12 }, (_, i) => `issue-${i}`) }
    const result = estimateTradeIn(50000, worst)
    expect(result.estimate).toBe(5000)
    expect(result.deductions.find((item) => item.label === 'Functional issues')?.amount).toBe(20000)
  })

  it('returns no numeric estimate for locked phones and rejects unsafe base values', () => {
    expect(estimateTradeIn(50000, { ...perfectAnswers, locked: true })).toMatchObject({ eligible: false, estimate: null, min: null, max: null })
    expect(() => estimateTradeIn(Number.NaN, perfectAnswers)).toThrow(/positive finite/)
    expect(() => estimateTradeIn(-1, perfectAnswers)).toThrow(/positive finite/)
  })

  it('rounds both estimate bounds to a sensible ETB unit', () => {
    const result = estimateTradeIn(12345, { ...perfectAnswers, condition: 'good' })
    expect(result.estimate).toBe(11100)
    expect(result.min).toBe(10200)
    expect(result.max).toBe(11700)
  })
})

describe('spec mode preference', () => {
  it('switches and remembers Advanced mode in localStorage', () => {
    localStorage.clear()
    const { unmount } = render(<SpecModeProbe />)
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }))
    expect(screen.getByText('advanced')).toBeInTheDocument()
    expect(localStorage.getItem('siaab-spec-mode-v1')).toBe('advanced')
    unmount()
    render(<SpecModeProbe />)
    expect(screen.getByText('advanced')).toBeInTheDocument()
  })

  it('loads a saved Advanced preference after mounting', async () => {
    localStorage.setItem('siaab-spec-mode-v1', 'advanced')
    render(<SpecModeProbe />)
    expect(await screen.findByText('advanced')).toBeInTheDocument()
  })

  it('supports arrow-key navigation in the accessible spec-mode control', () => {
    localStorage.clear()
    render(<SpecModeProbe />)
    const toggle = screen.getByRole('radiogroup')
    fireEvent.keyDown(toggle, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Advanced' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('catalog and WhatsApp helpers', () => {
  it('filters catalog results by brand, storage and availability', () => {
    const result = filterPhones(phones, { ...defaultFilters, brand: 'Samsung', storage: '256', availability: 'in_stock' })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((phone) => phone.brand === 'Samsung' && phone.stock === 'in_stock' && phone.storageOptions.some((option) => option.gb >= 256))).toBe(true)
  })

  it('encodes structured messages and validates the WhatsApp phone number', () => {
    const url = createWhatsAppUrl('Hello Siaab Mobile\nGalaxy S24 | 256 GB', '+251 923 641 747')
    expect(url).toMatch(/^https:\/\/wa\.me\/251923641747\?text=/)
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toContain('Galaxy S24')
    expect(() => createWhatsAppUrl('Hello', '')).toThrow(/valid WhatsApp/)
  })

  it('blocks the trade-in wizard until the phone is identified', () => {
    render(<TradeIn />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a brand, model and storage')
    expect(screen.getByText('STEP 1 OF 3')).toBeInTheDocument()
  })
})
