import { z } from 'zod'
import type { NormalizedSpecs, PartialSpecs } from './types'

const resolutionSchema = z.object({ width: z.number().positive(), height: z.number().positive() })
const displaySchema = z.object({
  sizeInches: z.number().nullable(),
  resolution: resolutionSchema.nullable(),
  type: z.string().nullable(),
  refreshRateHz: z.number().nullable(),
  brightnessNits: z.number().nullable(),
  protection: z.string().nullable(),
}).nullable()
const normalizedSchema = z.object({
  display: displaySchema.optional(),
  chipset: z.string().nullable().optional(),
  cpu: z.string().nullable().optional(),
  gpu: z.string().nullable().optional(),
  rearCamera: z.array(z.object({ name: z.string(), megapixels: z.number().nullable(), details: z.string().nullable() })).nullable().optional(),
  frontCamera: z.object({ megapixels: z.number().nullable(), details: z.string().nullable() }).nullable().optional(),
  batteryMah: z.number().nullable().optional(),
  chargingWatts: z.number().nullable().optional(),
  fiveG: z.boolean().nullable().optional(),
  nfc: z.boolean().nullable().optional(),
  esim: z.boolean().nullable().optional(),
  dimensionsMm: z.object({ height: z.number(), width: z.number(), depth: z.number() }).nullable().optional(),
  weightGrams: z.number().nullable().optional(),
  waterRating: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  ramGb: z.number().nullable().optional(),
  storageGb: z.number().nullable().optional(),
})

export type ValidationStatus = 'fetched' | 'missing' | 'flagged'
export interface ValidatedSpecs { specs: PartialSpecs; statuses: Partial<Record<keyof NormalizedSpecs, ValidationStatus>> }

export function normalizeResolution(value: string): { width: number; height: number } | null {
  const match = value.match(/([\d,]+)\s*[×xX]\s*([\d,]+)/)
  if (!match) return null
  const width = Number(match[1]?.replaceAll(',', ''))
  const height = Number(match[2]?.replaceAll(',', ''))
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : null
}

export function parseNumber(value: string, expression: RegExp): number | null {
  const match = expression.exec(value)
  if (!match?.[1]) return null
  const number = Number(match[1].replaceAll(',', ''))
  return Number.isFinite(number) ? number : null
}

export function validateSpecs(input: unknown): ValidatedSpecs {
  const result = normalizedSchema.safeParse(input)
  if (!result.success) throw new Error(`Invalid normalized specs: ${result.error.issues.map((issue) => issue.path.join('.') || 'value').join(', ')}`)
  const specs: PartialSpecs = {}
  const statuses: ValidatedSpecs['statuses'] = {}
  for (const [field, value] of Object.entries(result.data)) {
    if (value === undefined || value === null) {
      ;(specs as Record<string, unknown>)[field] = null
      ;(statuses as Record<string, ValidationStatus>)[field] = 'missing'
      continue
    }
    const flagged =
      field === 'batteryMah' && (Number(value) < 1000 || Number(value) > 10000) ||
      field === 'ramGb' && (Number(value) < 1 || Number(value) > 24) ||
      field === 'storageGb' && (Number(value) < 1 || Number(value) > 2048) ||
      field === 'weightGrams' && (Number(value) < 50 || Number(value) > 1000) ||
      field === 'chargingWatts' && (Number(value) < 1 || Number(value) > 300) ||
      field === 'display' && typeof value === 'object' && value !== null && 'sizeInches' in value && value.sizeInches !== null && (value.sizeInches < 3 || value.sizeInches > 9) ||
      field === 'display' && typeof value === 'object' && value !== null && 'refreshRateHz' in value && value.refreshRateHz !== null && (value.refreshRateHz < 30 || value.refreshRateHz > 240)
    ;(specs as Record<string, unknown>)[field] = flagged ? null : value
    ;(statuses as Record<string, ValidationStatus>)[field] = flagged ? 'flagged' : 'fetched'
  }
  return { specs, statuses }
}

export function mergeSpecs(earlier: PartialSpecs, later: PartialSpecs): PartialSpecs {
  const merged: PartialSpecs = { ...earlier }
  for (const [key, value] of Object.entries(later)) {
    if (value === undefined || value === null) continue
    const field = key as keyof NormalizedSpecs
    if (merged[field] === null || merged[field] === undefined) {
      ;(merged as Record<string, unknown>)[field] = value
    } else if (field === 'display' && value && merged.display) {
      const display = { ...merged.display }
      for (const [displayKey, displayValue] of Object.entries(value)) {
        if (display[displayKey as keyof typeof display] === null || display[displayKey as keyof typeof display] === undefined) {
          ;(display as Record<string, unknown>)[displayKey] = displayValue
        }
      }
      merged.display = display
    }
  }
  return merged
}
