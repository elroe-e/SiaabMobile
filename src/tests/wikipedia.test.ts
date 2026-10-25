import { describe, expect, it } from 'vitest'
import { cleanWikiText, titleMatchesModel } from '../lib/specs/wikipedia-provider'

describe('wikipedia article matching', () => {
  it('accepts only the exact phone article', () => {
    expect(titleMatchesModel('OnePlus', 'OnePlus 13', 'OnePlus 13')).toBe(true)
    expect(titleMatchesModel('Xiaomi', 'Redmi Note 13 Pro', 'Xiaomi Redmi Note 13 Pro')).toBe(true)
    expect(titleMatchesModel('Samsung', 'Galaxy S24 Ultra', 'Samsung Galaxy S24 Ultra')).toBe(true)
  })

  it('rejects other models and multi-model articles', () => {
    expect(titleMatchesModel('OnePlus', 'OnePlus 13', 'OnePlus 7')).toBe(false)
    expect(titleMatchesModel('OnePlus', 'OnePlus 1', 'OnePlus 13')).toBe(false)
    expect(titleMatchesModel('Xiaomi', 'Redmi Note 17 Pro', 'Xiaomi Redmi Note 17 Pro Max')).toBe(false)
    expect(titleMatchesModel('Honor', 'Honor 400', 'Honor 400 series')).toBe(false)
  })
})

describe('wiki markup cleanup', () => {
  it('turns links, bold and line breaks into plain text', () => {
    const cleaned = cleanWikiText("| gpu = [[Adreno#Technical details|Adreno 640]]\n| os = [[OxygenOS]] (based on [[Android Pie]])<br>'''7 Pro''': Android 12")
    expect(cleaned).toContain('gpu = Adreno 640')
    expect(cleaned).toContain('OxygenOS (based on Android Pie), 7 Pro: Android 12')
    expect(cleaned).not.toMatch(/\[\[|'''|<br/)
  })
})

describe('plus naming and AI reply parsing', () => {
  it('treats "Pro+" and "Pro Plus" as the same phone', () => {
    expect(titleMatchesModel('Redmi', 'Redmi Note 14 Pro Plus', 'Redmi Note 14 Pro+')).toBe(true)
    expect(titleMatchesModel('Samsung', 'Galaxy S24+', 'Samsung Galaxy S24 Plus')).toBe(true)
    expect(titleMatchesModel('Samsung', 'Galaxy S24', 'Samsung Galaxy S24+')).toBe(false)
  })

  it('extracts the JSON object from fenced or chatty AI replies', async () => {
    const { extractJson } = await import('../lib/specs/gemini-provider')
    expect(JSON.parse(extractJson('```json\n{"chipset":"A17"}\n```'))).toEqual({ chipset: 'A17' })
    expect(JSON.parse(extractJson('Here you go: {"batteryMah": 5000} Hope that helps'))).toEqual({ batteryMah: 5000 })
  })
})
