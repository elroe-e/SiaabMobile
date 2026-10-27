// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { geminiProvider, pickFlashModel } from '../lib/specs/gemini-provider'

const listing = { models: [
  { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash-image', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
] }

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Gemini model selection', () => {
  it('prefers the newest stable Flash model and skips lite, image and embedding models', () => {
    expect(pickFlashModel(listing.models)).toBe('gemini-3.0-flash')
    expect(pickFlashModel([{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }])).toBe('gemini-flash-latest')
    expect(pickFlashModel([])).toBeNull()
  })

  it('retries with a model the key can use when the default name is gone', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      if (url.endsWith('/models?pageSize=200')) return new Response(JSON.stringify(listing))
      if (url.includes('gemini-3.0-flash:generateContent')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n{"chipset":"Snapdragon 7 Gen 4","batteryMah":7200,"sourceUrls":[]}\n```' }] } }] }))
      return new Response('{}', { status: 404 })
    }))
    const result = await geminiProvider.fetch({ brand: 'Honor', model: 'Honor 400' })
    expect(result.specs).toMatchObject({ chipset: 'Snapdragon 7 Gen 4', batteryMah: 7200 })
    expect(calls.some((url) => url.includes('gemini-flash-latest:generateContent'))).toBe(true)
    expect(calls.every((url) => !url.includes('test-key'))).toBe(true)
  })

  it('explains a rejected key in plain words', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'bad')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.0-flash')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    await expect(geminiProvider.fetch({ brand: 'Honor', model: 'Honor 400' })).rejects.toThrow(/rejected the AI key/)
  })
})

describe('Gemini quota handling', () => {
  it('falls back to a request without web search when the search quota is exhausted', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.0-flash')
    const bodies: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? '')
      bodies.push(body)
      if (body.includes('google_search')) return new Response(JSON.stringify({ error: { message: 'Quota exceeded for grounding', status: 'RESOURCE_EXHAUSTED' } }), { status: 429 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"batteryMah":5000,"sourceUrls":[]}' }] } }] }))
    }))
    const result = await geminiProvider.fetch({ brand: 'OnePlus', model: 'OnePlus 15' })
    expect(result.specs).toMatchObject({ batteryMah: 5000 })
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).not.toContain('google_search')
  })

  it('reports Google\'s own reason when every attempt is refused', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.0-flash')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Quota exceeded for this service,\n limit: 0' } }), { status: 429 })))
    await expect(geminiProvider.fetch({ brand: 'OnePlus', model: 'OnePlus 15' })).rejects.toThrow('limit reached: Quota exceeded for this service, limit: 0')
  })
})
