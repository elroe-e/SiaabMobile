import { describe, expect, it } from 'vitest'
import { brandLogo, brandSummary } from '../lib/brandLogos'

describe('brands page helpers', () => {
  it('counts phones per brand, most first, then by name', () => {
    expect(brandSummary([{ brand: 'Honor' }, { brand: 'Apple' }, { brand: 'Honor' }, { brand: 'Redmi' }])).toEqual([
      { brand: 'Honor', count: 2 }, { brand: 'Apple', count: 1 }, { brand: 'Redmi', count: 1 },
    ])
  })

  it('finds logos regardless of spacing or case and falls back to a letter tile', () => {
    expect(brandLogo('OnePlus')?.color).toBe('#F5010C')
    expect(brandLogo('one plus')).not.toBeNull()
    expect(brandLogo('Apple')?.color).toBe('var(--ink)')
    expect(brandLogo('Redmi')).toBeNull()
  })
})
