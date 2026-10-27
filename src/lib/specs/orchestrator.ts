import { mergeSpecs, validateSpecs } from './normalize'
import { pasteProvider } from './paste-provider'
import { wikipediaProvider } from './wikipedia-provider'
import { geminiProvider } from './gemini-provider'
import { createDatabaseProvider } from './database-provider'
import type { FetchSpecsResult, NormalizedSpecs, PartialSpecs, SpecMeta, SpecProvider, SpecProviderInput, SpecSource, ProviderStatus } from './types'

const coreFields: (keyof NormalizedSpecs)[] = ['display', 'chipset', 'batteryMah', 'rearCamera', 'os']
const meaningful = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value !== 'object') return value !== ''
  if (Array.isArray(value)) return value.length > 0
  return Object.values(value).some(meaningful)
}

export interface FetchSpecsOptions {
  providers?: SpecProvider[]
  existingMetadata?: Partial<Record<keyof NormalizedSpecs, SpecMeta>>
  timeoutMs?: number
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Provider exceeded ${timeoutMs / 1000}s timeout.`)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timeout); resolve(value) },
      (error: unknown) => { clearTimeout(timeout); reject(error) },
    )
  })
}

export async function fetchSpecs(input: SpecProviderInput, options: FetchSpecsOptions = {}): Promise<FetchSpecsResult> {
  const providers = options.providers ?? [
    createDatabaseProvider(),
    wikipediaProvider,
    ...(process.env.GEMINI_API_KEY ? [geminiProvider] : []),
    pasteProvider,
  ]
  const lockedFields = new Set(input.lockedFields ?? [])
  const metadata: FetchSpecsResult['metadata'] = { ...(options.existingMetadata ?? {}) }
  let specs: PartialSpecs = { ...(input.existing ?? {}) }
  const sourceUrls = new Set<string>()
  const statuses: ProviderStatus[] = []

  for (const provider of providers) {
    if (coreFields.every((field) => meaningful(specs[field]))) break
    const canContributePaste = provider.name !== 'pasted' || Boolean(input.pastedText?.trim())
    if (!canContributePaste) {
      statuses.push({ name: provider.name, status: 'skipped', foundFields: 0 })
      continue
    }
    statuses.push({ name: provider.name, status: 'running', foundFields: 0 })
    try {
      const output = await withTimeout(provider.fetch(input), options.timeoutMs ?? (provider.name === 'ai' ? 70_000 : 10_000))
      const safeOutput: PartialSpecs = {}
      const flagged = new Set<keyof NormalizedSpecs>()
      for (const [key, value] of Object.entries(output.specs)) {
        const field = key as keyof NormalizedSpecs
        if (lockedFields.has(field) || meaningful(specs[field]) || value === undefined) continue
        const validation = validateSpecs({ [field]: value })
        if (validation.statuses[field] === 'flagged') flagged.add(field)
        ;(safeOutput as Record<string, unknown>)[field] = validation.specs[field]
      }
      specs = mergeSpecs(specs, safeOutput)
      for (const [key, value] of Object.entries(safeOutput)) {
        const field = key as keyof NormalizedSpecs
        if (value !== null && value !== undefined) {
          metadata[field] = { source: provider.name, status: flagged.has(field) ? 'flagged' : 'fetched', locked: false, updatedAt: new Date().toISOString() }
        }
      }
      output.sourceUrls.forEach((url) => sourceUrls.add(url))
      const foundFields = Object.values(safeOutput).filter(meaningful).length
      statuses[statuses.length - 1] = { name: provider.name, status: foundFields ? 'found' : 'empty', foundFields }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider failed with an unknown error.'
      statuses[statuses.length - 1] = { name: provider.name, status: 'failed', foundFields: 0, error: message }
    }
  }

  for (const field of Object.keys(specs) as (keyof NormalizedSpecs)[]) {
    if (lockedFields.has(field)) continue
    if (!meaningful(specs[field]) && !metadata[field]) {
      metadata[field] = { source: 'manual', status: 'missing', locked: false, updatedAt: new Date().toISOString() }
    }
  }
  return { specs, metadata, sourceUrls: [...sourceUrls], providers: statuses }
}

export function mergeProviderSpecs(current: PartialSpecs, incoming: PartialSpecs, source: SpecSource, lockedFields: (keyof NormalizedSpecs)[] = [], existingMetadata: FetchSpecsResult['metadata'] = {}) {
  const locked = new Set(lockedFields)
  const candidate: PartialSpecs = {}
  const metadata: FetchSpecsResult['metadata'] = { ...existingMetadata }
  for (const [key, value] of Object.entries(incoming)) {
    const field = key as keyof NormalizedSpecs
    if (locked.has(field) || value === undefined) continue
    ;(candidate as Record<string, unknown>)[field] = value
    metadata[field] = { source, status: 'edited', locked: true, updatedAt: new Date().toISOString() }
  }
  return { specs: mergeSpecs(current, candidate), metadata }
}
