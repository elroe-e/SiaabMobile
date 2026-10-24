export interface NormalizedSpecs {
  display: {
    sizeInches: number | null
    resolution: { width: number; height: number } | null
    type: string | null
    refreshRateHz: number | null
    brightnessNits: number | null
    protection: string | null
  } | null
  chipset: string | null
  cpu: string | null
  gpu: string | null
  rearCamera: { name: string; megapixels: number | null; details: string | null }[] | null
  frontCamera: { megapixels: number | null; details: string | null } | null
  batteryMah: number | null
  chargingWatts: number | null
  fiveG: boolean | null
  nfc: boolean | null
  esim: boolean | null
  dimensionsMm: { height: number; width: number; depth: number } | null
  weightGrams: number | null
  waterRating: string | null
  os: string | null
  ramGb: number | null
  storageGb: number | null
}

export type SpecFieldStatus = 'fetched' | 'edited' | 'missing' | 'flagged'
export type SpecSource = 'database' | 'wikipedia' | 'ai' | 'pasted' | 'manual'
export interface SpecMeta { source: SpecSource; status: SpecFieldStatus; locked: boolean; updatedAt: string }
export type SpecMetadata = Partial<Record<keyof NormalizedSpecs, SpecMeta>>
export type PartialSpecs = Partial<NormalizedSpecs>

export interface SpecProviderInput {
  brand: string
  model: string
  pastedText?: string
  existing?: PartialSpecs
  lockedFields?: (keyof NormalizedSpecs)[]
}

export interface ProviderOutput {
  specs: PartialSpecs
  sourceUrls: string[]
}

export interface SpecProvider {
  name: SpecSource
  fetch(input: SpecProviderInput): Promise<ProviderOutput>
}

export interface ProviderStatus {
  name: SpecSource
  status: 'running' | 'found' | 'empty' | 'failed' | 'skipped'
  foundFields: number
  error?: string
}

export interface FetchSpecsResult {
  specs: PartialSpecs
  metadata: SpecMetadata
  sourceUrls: string[]
  providers: ProviderStatus[]
}
