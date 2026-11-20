import generated from '../../data/spec-library.generated.json'
import library from '../../data/spec-library.json'
import { validateSpecs } from './normalize'
import type { NormalizedSpecs, SpecProvider } from './types'

export interface SpecLibraryEntry {
  brand: string
  model: string
  needsReview: true
  /** Year the phone first went on sale, for phones taken from Wikipedia. */
  released?: number | null
  sourceUrls: string[]
  specs: Partial<NormalizedSpecs>
}

/** Hand-checked phones first, then the phones built from Wikipedia by `npm run specs:library`. */
const entries = [...library, ...generated] as SpecLibraryEntry[]

const squash = (value: string) => value.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '')

/**
 * Finds a library phone, ignoring capitals and spaces ("Reno12" = "Reno 12").
 * "Redmi Note 13" and "Redmi Note 13 5G" are different phones, so a missing or extra "5G" is only
 * accepted when it leaves exactly one possible phone.
 */
export function findLibraryEntry(brand: string, model: string): SpecLibraryEntry | undefined {
  const sameBrand = entries.filter((entry) => squash(entry.brand) === squash(brand))
  const exact = sameBrand.find((entry) => squash(entry.model) === squash(model))
  if (exact) return exact
  const loose = (value: string) => squash(value).replace(/5g$/, '')
  const close = sameBrand.filter((entry) => loose(entry.model) === loose(model))
  return close.length === 1 ? close[0] : undefined
}

export function createDatabaseProvider(findExisting?: (brand: string, model: string) => Promise<Partial<NormalizedSpecs> | null>): SpecProvider {
  return {
    name: 'database',
    async fetch({ brand, model }) {
      const existing = await findExisting?.(brand, model)
      const match = findLibraryEntry(brand, model)
      const specs = existing ?? match?.specs ?? {}
      return {
        specs: validateSpecs(specs).specs,
        sourceUrls: match?.sourceUrls ?? [],
      }
    },
  }
}
