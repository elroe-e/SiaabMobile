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

export const geminiProvider: SpecProvider = {
  name: 'ai',
  async fetch({ brand, model }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { specs: {}, sourceUrls: [] }
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Use Google Search grounding to verify specifications for ${brand} ${model}. Return strict JSON only. Use null for anything you cannot verify. Never guess. Include sourceUrls from authoritative public sources. Match this object shape: {"display":{"sizeInches":number|null,"resolution":{"width":number,"height":number}|null,"type":string|null,"refreshRateHz":number|null,"brightnessNits":number|null,"protection":string|null}|null,"chipset":string|null,"cpu":string|null,"gpu":string|null,"rearCamera":[{"name":string,"megapixels":number|null,"details":string|null}]|null,"frontCamera":{"megapixels":number|null,"details":string|null}|null,"batteryMah":number|null,"chargingWatts":number|null,"fiveG":boolean|null,"nfc":boolean|null,"esim":boolean|null,"dimensionsMm":{"height":number,"width":number,"depth":number}|null,"weightGrams":number|null,"waterRating":string|null,"os":string|null,"ramGb":number|null,"storageGb":number|null,"sourceUrls":[string]}.` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })
    if (response.status === 429) throw new Error('AI lookup is busy, try again or paste specs.')
    if (!response.ok) throw new Error(`Gemini lookup returned HTTP ${response.status}.`)
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    let json: unknown
    try { json = JSON.parse(text) } catch { throw new Error('Gemini returned invalid JSON; try again or paste specs.') }
    const validated = schema.safeParse(json)
    if (!validated.success) throw new Error('Gemini returned fields that did not match the specification schema.')
    const { sourceUrls, ...rawSpecs } = validated.data
    return { specs: validateSpecs(rawSpecs).specs, sourceUrls }
  },
}
