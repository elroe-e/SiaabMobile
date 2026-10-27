import { z } from 'zod'
import { validateSpecs } from './normalize'
import type { SpecProvider } from './types'

const schema = z.object({
  display: z.object({
    sizeInches: z.number().nullable().optional(),
    resolution: z.object({ width: z.number(), height: z.number() }).nullable().optional(),
    type: z.string().nullable().optional(),
    refreshRateHz: z.number().nullable().optional(),
    brightnessNits: z.number().nullable().optional(),
    protection: z.string().nullable().optional(),
  }).nullable().optional(),
  chipset: z.string().nullable().optional(), cpu: z.string().nullable().optional(), gpu: z.string().nullable().optional(),
  rearCamera: z.array(z.object({ name: z.string(), megapixels: z.number().nullable(), details: z.string().nullable() })).nullable().optional(),
  frontCamera: z.object({ megapixels: z.number().nullable(), details: z.string().nullable() }).nullable().optional(),
  batteryMah: z.number().nullable().optional(), chargingWatts: z.number().nullable().optional(),
  fiveG: z.boolean().nullable().optional(), nfc: z.boolean().nullable().optional(), esim: z.boolean().nullable().optional(),
  dimensionsMm: z.object({ height: z.number(), width: z.number(), depth: z.number() }).nullable().optional(),
  weightGrams: z.number().nullable().optional(), waterRating: z.string().nullable().optional(), os: z.string().nullable().optional(),
  ramGb: z.number().nullable().optional(), storageGb: z.number().nullable().optional(),
  sourceUrls: z.array(z.string().url()).default([]),
})

/** Search grounding cannot be combined with JSON mode, so pull the JSON object out of the reply text. */
export function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate
}

const API = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-flash-latest'
let discoveredModel: string | null = null

type ListedModel = { name: string; supportedGenerationMethods?: string[] }

/** Picks the newest stable Flash model the key can use, so a retired model name never breaks the lookup. */
export function pickFlashModel(models: ListedModel[]): string | null {
  const usable = models
    .filter((item) => (item.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((item) => item.name.replace(/^models\//, ''))
  const version = (id: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0)
  const stable = usable.filter((id) => /^gemini-\d+(\.\d+)?-flash$/.test(id)).sort((a, b) => version(b) - version(a))
  if (stable[0]) return stable[0]
  if (usable.includes(DEFAULT_MODEL)) return DEFAULT_MODEL
  return usable.filter((id) => /flash/.test(id) && !/lite|image|tts|audio|live|embed|vision/.test(id)).sort((a, b) => version(b) - version(a))[0] ?? null
}

async function listModels(apiKey: string): Promise<ListedModel[]> {
  const response = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8_000), cache: 'no-store' })
  if (!response.ok) return []
  const data = await response.json() as { models?: ListedModel[] }
  return data.models ?? []
}

export const geminiProvider: SpecProvider = {
  name: 'ai',
  async fetch({ brand, model }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { specs: {}, sourceUrls: [] }
    const override = process.env.GEMINI_MODEL?.trim()
    const request = (modelName: string) => fetch(`${API}/models/${modelName}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(24_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Use Google Search grounding to verify specifications for ${brand} ${model}. Return strict JSON only. Use null for anything you cannot verify. Never guess. Include sourceUrls from authoritative public sources. Match this object shape: {"display":{"sizeInches":number|null,"resolution":{"width":number,"height":number}|null,"type":string|null,"refreshRateHz":number|null,"brightnessNits":number|null,"protection":string|null}|null,"chipset":string|null,"cpu":string|null,"gpu":string|null,"rearCamera":[{"name":string,"megapixels":number|null,"details":string|null}]|null,"frontCamera":{"megapixels":number|null,"details":string|null}|null,"batteryMah":number|null,"chargingWatts":number|null,"fiveG":boolean|null,"nfc":boolean|null,"esim":boolean|null,"dimensionsMm":{"height":number,"width":number,"depth":number}|null,"weightGrams":number|null,"waterRating":string|null,"os":string|null,"ramGb":number|null,"storageGb":number|null,"sourceUrls":[string]}.` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
    })
    let modelName = override || discoveredModel || DEFAULT_MODEL
    let response = await request(modelName)
    // Google retires model names; when ours is gone, ask which models this key can use and retry once.
    if (response.status === 404 && !override) {
      const picked = pickFlashModel(await listModels(apiKey))
      if (picked && picked !== modelName) { discoveredModel = picked; modelName = picked; response = await request(modelName) }
    }
    if (response.status === 404) throw new Error(`Google AI model "${modelName}" was not found. Set GEMINI_MODEL to a current model name.`)
    if (response.status === 400 || response.status === 403) throw new Error('Google rejected the AI key. Check GEMINI_API_KEY in the hosting environment variables.')
    if (response.status === 429) throw new Error('AI lookup is busy, try again or paste specs.')
    if (!response.ok) throw new Error(`Gemini lookup returned HTTP ${response.status}.`)
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    let json: unknown
    try { json = JSON.parse(extractJson(text)) } catch { throw new Error('Gemini returned invalid JSON; try again or paste specs.') }
    const validated = schema.safeParse(json)
    if (!validated.success) throw new Error('Gemini returned fields that did not match the specification schema.')
    const { sourceUrls, ...rawSpecs } = validated.data
    return { specs: validateSpecs(rawSpecs).specs, sourceUrls }
  },
}
