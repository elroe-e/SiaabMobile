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
let groundingUnavailable = false
// Google's free tier is sometimes slow or overloaded, so the lookup gets one overall time budget.
const TOTAL_BUDGET_MS = 60_000
const SEARCH_TIMEOUT_MS = 25_000
const PLAIN_TIMEOUT_MS = 30_000

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

/** Google's own explanation for a failed request, shortened; it never contains the key. */
async function googleReason(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: string; status?: string } } | null
  const message = body?.error?.message ?? body?.error?.status ?? `HTTP ${response.status}`
  return message.replace(/\s+/g, ' ').slice(0, 220)
}

type Attempt = { model: string; search: boolean; result: string; ms: number }

/** One line per attempt, e.g. "gemini-flash-latest + web search: HTTP 429 quota (0.4 s)". */
export const describeAttempts = (attempts: Attempt[]) =>
  attempts.map((item) => `${item.model}${item.search ? ' + web search' : ''}: ${item.result} (${(item.ms / 1000).toFixed(1)} s)`).join('; ')

const isKeyProblem = (response: Response | null) => response !== null && [400, 401, 403].includes(response.status)

/** Resets remembered model choices; used by tests. */
export function resetGeminiState() { discoveredModel = null; groundingUnavailable = false }

export const geminiProvider: SpecProvider = {
  name: 'ai',
  async fetch({ brand, model }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { specs: {}, sourceUrls: [] }
    const override = process.env.GEMINI_MODEL?.trim()
    const started = Date.now()
    const remaining = () => TOTAL_BUDGET_MS - (Date.now() - started)
    const attempts: Attempt[] = []

    const call = async (modelName: string, search: boolean, thinking: boolean): Promise<Response | 'timeout'> => {
      try {
        return await fetch(`${API}/models/${modelName}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(Math.max(1_000, Math.min(search ? SEARCH_TIMEOUT_MS : PLAIN_TIMEOUT_MS, remaining()))),
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${search ? 'Use Google Search grounding to verify' : 'From what you reliably know, give'} specifications for ${brand} ${model}. Return strict JSON only. Use null for anything you cannot verify. Never guess. Include sourceUrls from authoritative public sources. Match this object shape: {"display":{"sizeInches":number|null,"resolution":{"width":number,"height":number}|null,"type":string|null,"refreshRateHz":number|null,"brightnessNits":number|null,"protection":string|null}|null,"chipset":string|null,"cpu":string|null,"gpu":string|null,"rearCamera":[{"name":string,"megapixels":number|null,"details":string|null}]|null,"frontCamera":{"megapixels":number|null,"details":string|null}|null,"batteryMah":number|null,"chargingWatts":number|null,"fiveG":boolean|null,"nfc":boolean|null,"esim":boolean|null,"dimensionsMm":{"height":number,"width":number,"depth":number}|null,"weightGrams":number|null,"waterRating":string|null,"os":string|null,"ramGb":number|null,"storageGb":number|null,"sourceUrls":[string]}.` }] }],
            ...(search ? { tools: [{ google_search: {} }] } : {}),
            // Thinking makes newer models take 20+ seconds; a spec sheet does not need it.
            generationConfig: { temperature: 0, maxOutputTokens: 2048, ...(thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }) },
          }),
        })
      } catch (error) {
        if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout'
        throw error
      }
    }

    const attempt = async (modelName: string, search: boolean): Promise<Response | null> => {
      const begun = Date.now()
      let response = await call(modelName, search, false)
      // Some models refuse to switch thinking off; ask again with thinking allowed.
      if (response !== 'timeout' && response.status === 400 && /thinking/i.test(await googleReason(response.clone()))) response = await call(modelName, search, true)
      const ms = Date.now() - begun
      if (response === 'timeout') { attempts.push({ model: modelName, search, result: 'no answer in time', ms }); return null }
      attempts.push({ model: modelName, search, result: response.ok ? 'answered' : `HTTP ${response.status} ${(await googleReason(response.clone())).slice(0, 80)}`, ms })
      return response
    }

    let modelName = override || discoveredModel || DEFAULT_MODEL
    let alternative: string | null | undefined
    const otherModel = async () => {
      if (override) return null
      if (alternative === undefined) alternative = pickFlashModel(await listModels(apiKey))
      return alternative && alternative !== modelName ? alternative : null
    }
    const keepGoing = (response: Response | null) => !response?.ok && !isKeyProblem(response) && remaining() > 5_000

    let response: Response | null = null
    if (!groundingUnavailable) {
      response = await attempt(modelName, true)
      // Google retires model names; when ours is gone, switch to a current one.
      if (response?.status === 404) { const next = await otherModel(); if (next) { discoveredModel = modelName = next; response = await attempt(modelName, true) } }
      // The free tier may not include web search; remember that and use plain requests from now on.
      if (response?.status === 429) groundingUnavailable = true
    }
    if (keepGoing(response)) {
      response = await attempt(modelName, false)
      if (response?.status === 404) { const next = await otherModel(); if (next) { discoveredModel = modelName = next; response = await attempt(modelName, false) } }
    }
    if (keepGoing(response)) {
      const next = await otherModel()
      if (next) { response = await attempt(next, false); if (response?.ok) discoveredModel = next }
    }

    const tried = ` Attempts: ${describeAttempts(attempts)}.`
    if (!response) throw new Error(`Google AI did not answer in time. Try again, or paste the specifications.${tried}`)
    if (isKeyProblem(response)) throw new Error(`Google rejected the AI key (${await googleReason(response)}). Check GEMINI_API_KEY in the hosting environment variables.${tried}`)
    if (response.status === 404) throw new Error(`Google AI model "${modelName}" was not found. Set GEMINI_MODEL to a current model name.${tried}`)
    if (response.status === 429) throw new Error(`Google AI limit reached: ${await googleReason(response)} Try again later or paste specs.${tried}`)
    if (response.status === 503) throw new Error(`Google AI is overloaded right now. Try again in a few minutes, or paste the specifications.${tried}`)
    if (!response.ok) throw new Error(`Gemini lookup returned HTTP ${response.status}: ${await googleReason(response)}${tried}`)
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
