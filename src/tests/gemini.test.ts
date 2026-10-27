// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { geminiProvider, pickFlashModel, resetGeminiState } from '../lib/specs/gemini-provider'

const listing = { models: [
  { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.0-flash-image', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
] }

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetGeminiState() })

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

describe('Gemini speed settings', () => {
  it('asks with thinking switched off, and retries with it on if the model refuses', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-9.0-flash')
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { generationConfig: Record<string, unknown> }
      bodies.push(body.generationConfig)
      if (body.generationConfig.thinkingConfig) return new Response(JSON.stringify({ error: { message: 'Thinking budget cannot be 0 for this model.' } }), { status: 400 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"batteryMah":4000,"sourceUrls":[]}' }] } }] }))
    }))
    const result = await geminiProvider.fetch({ brand: 'Test', model: 'Phone' })
    expect(result.specs).toMatchObject({ batteryMah: 4000 })
    expect(bodies[0]).toMatchObject({ thinkingConfig: { thinkingBudget: 0 } })
    expect(bodies[1]).not.toHaveProperty('thinkingConfig')
  })

  it('turns a slow answer into a plain-words message', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-9.0-flash')
    vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }) }))
    await expect(geminiProvider.fetch({ brand: 'Test', model: 'Phone' })).rejects.toThrow(/did not answer in time.*no answer in time/)
  })
})

describe('Gemini attempt plan', () => {
  it('moves from an overloaded model to another current model and reports every attempt on failure', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const seen: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models?pageSize=200')) return new Response(JSON.stringify(listing))
      const search = String(init?.body).includes('google_search')
      seen.push(`${url.split('/models/')[1]?.split(':')[0]}${search ? '+search' : ''}`)
      if (url.includes('gemini-3.0-flash') && !search) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"chipset":"X","sourceUrls":[]}' }] } }] }))
      return new Response(JSON.stringify({ error: { message: 'This model is currently experiencing high demand.' } }), { status: 503 })
    }))
    const result = await geminiProvider.fetch({ brand: 'Honor', model: 'Honor 400' })
    expect(result.specs).toMatchObject({ chipset: 'X' })
    expect(seen).toEqual(['gemini-flash-latest+search', 'gemini-flash-latest', 'gemini-3.0-flash'])
  })

  it('lists each attempt with its result and time when everything fails', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.0-flash')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })))
    await expect(geminiProvider.fetch({ brand: 'Honor', model: 'Honor 400' })).rejects.toThrow(/overloaded right now.*Attempts: gemini-3\.0-flash \+ web search: HTTP 503 high demand \(\d+\.\d s\); gemini-3\.0-flash: HTTP 503/)
  })
})
