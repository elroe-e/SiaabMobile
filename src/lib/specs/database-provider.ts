import library from '../../../supabase/spec-library.json'
import { validateSpecs } from './normalize'
import type { NormalizedSpecs, SpecProvider } from './types'

export interface SpecLibraryEntry {
  brand: string
  model: string
  needsReview: true
  sourceUrls: string[]
  specs: Partial<NormalizedSpecs>
}

const entries = library as SpecLibraryEntry[]

export function createDatabaseProvider(findExisting?: (brand: string, model: string) => Promise<Partial<NormalizedSpecs> | null>): SpecProvider {
  return {
    name: 'database',
    async fetch({ brand, model }) {
      const existing = await findExisting?.(brand, model)
      const match = entries.find((entry) => entry.brand.toLowerCase() === brand.toLowerCase() && entry.model.toLowerCase() === model.toLowerCase())
      const specs = existing ?? match?.specs ?? {}
      return {
        specs: validateSpecs(specs).specs,
        sourceUrls: match?.sourceUrls ?? [],
      }
    },
  }
}
