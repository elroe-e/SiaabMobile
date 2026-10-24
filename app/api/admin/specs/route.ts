import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'
import { fetchSpecs } from '../../../../src/lib/specs/orchestrator'
import type { NormalizedSpecs, SpecMeta } from '../../../../src/lib/specs/types'

const bodySchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  pastedText: z.string().max(20000).optional(),
  modelId: z.string().uuid().optional(),
}).strict()

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Provide a brand and model name.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin()
    let existing: Record<string, unknown> = {}
    let metadata: Record<string, SpecMeta> = {}
    if (parsed.data.modelId) {
      const { data, error } = await supabase.from('phone_models').select('specs,spec_meta').eq('id', parsed.data.modelId).maybeSingle()
      if (error) return NextResponse.json({ error: `Could not read saved specs: ${error.message}` }, { status: 500 })
      existing = (data?.specs ?? {}) as Record<string, unknown>
      metadata = (data?.spec_meta ?? {}) as Record<string, SpecMeta>
    }
    const lockedFields = Object.entries(metadata).filter(([, value]) => value.locked).map(([field]) => field as keyof NormalizedSpecs)
    const { data: modelData, error: lookupError } = await supabase
      .from('phone_models')
      .select('specs')
      .ilike('name', parsed.data.model)
      .limit(1)
      .maybeSingle()
    if (lookupError) return NextResponse.json({ error: `Database provider failed: ${lookupError.message}` }, { status: 500 })
    const existingModel = (modelData?.specs ?? existing) as Partial<NormalizedSpecs>
    const result = await fetchSpecs(
      { brand: parsed.data.brand, model: parsed.data.model, ...(parsed.data.pastedText !== undefined ? { pastedText: parsed.data.pastedText } : {}), existing: existingModel, lockedFields },
      { existingMetadata: metadata },
    )
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not run specification lookup.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
