import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amharic } from '../i18n/am'
import { translate } from '../i18n'
import { parseLanguage } from '../i18n/language'

// Text that is intentionally shown as-is in every language (names, symbols, toggle labels).
const keepAsIs = new Set(['siaabmobile home', 'siaab', 'mobile', 'EN', 'Switch to English', 'ወደ አማርኛ ቀይር (Switch to Amharic)', '+251 … / @username / email', '@Siaabmobiles', 'Close', 'Menu'])

describe('Amharic translations', () => {
  it('translates known text, keeps English otherwise, and leaves English mode alone', () => {
    expect(translate('am', 'Continue')).toBe('ቀጥል')
    expect(translate('am', 'Some brand new sentence')).toBe('Some brand new sentence')
    expect(translate('en', 'Continue')).toBe('Continue')
  })

  it('only switches to Amharic for the exact cookie value', () => {
    expect(parseLanguage('am')).toBe('am')
    expect(parseLanguage('en')).toBe('en')
    expect(parseLanguage(undefined)).toBe('en')
    expect(parseLanguage('fr')).toBe('en')
  })

  it('has an Amharic entry for every text the storefront wraps in t()', () => {
    const missing = new Set<string>()
    for (const file of ['src/App.tsx', 'src/components/Storefront.tsx']) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)) {
        const text = JSON.parse(`"${match[1]}"`) as string
        if (text && !keepAsIs.has(text) && !(text in amharic)) missing.add(text)
      }
    }
    expect([...missing]).toEqual([])
  })
})
