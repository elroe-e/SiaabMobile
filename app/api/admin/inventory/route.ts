import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'
import { colorHex, splitColors } from '../../../../src/lib/colors'

const commonSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tagline: z.string().trim().max(240).default(''),
  status: z.enum(['available', 'upcoming', 'discontinued']).default('available'),
  expectedDate: z.string().max(80).optional(),
  expectedPriceRange: z.string().max(80).optional(),
  specs: z.record(z.string(), z.unknown()).default({}),
  specMeta: z.record(z.string(), z.unknown()).default({}),
  specsReviewed: z.boolean().default(false),
  isPublished: z.boolean().default(false),
})

const variantSchema = z.object({
  ramGb: z.number().int().min(1).max(24),
  storageGb: z.number().int().min(1).max(2048),
  colorName: z.string().trim().min(1).max(50),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#777777'),
  price: z.number().positive(),
  oldPrice: z.preprocess((value) => value === '' || value === null ? undefined : value, z.number().positive().optional()),
  stockCount: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(2),
})

const unitSchema = z.object({
  ramGb: z.number().int().min(1).max(24),
  storageGb: z.number().int().min(1).max(2048),
  colorName: z.string().trim().min(1).max(50),
  grade: z.enum(['A', 'B', 'C']),
  batteryHealthPct: z.number().int().min(1).max(100).optional(),
  accessories: z.string().trim().max(200).default('Phone only'),
  warrantyMonths: z.number().int().min(0).max(120).default(0),
  price: z.number().positive(),
  costPrice: z.number().nonnegative().optional(),
  imei: z.string().regex(/^\d{14,16}$/).optional().or(z.literal('')),
  notesInternal: z.string().max(2000).default(''),
})

const requestSchema = commonSchema.extend({
  kind: z.enum(['new', 'used', 'upcoming']),
  variant: variantSchema.optional(),
  unit: unitSchema.optional(),
}).strict()

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await requireAdmin()
    const url = new URL(request.url)
    const type = url.searchParams.get('type') ?? 'all'
    const [models, variants, used, ownerUnits] = await Promise.all([
      supabase.from('phone_models').select('id,brand_id,name,slug,status,expected_date,expected_price_range,tagline,specs,spec_meta,specs_reviewed,created_at,brands(name)').order('updated_at', { ascending: false }),
      type === 'used' ? Promise.resolve({ data: [], error: null }) : supabase.from('variants').select('*,phone_models(name,slug,specs_reviewed,brands(name))').order('created_at', { ascending: false }),
      type === 'new' ? Promise.resolve({ data: [], error: null }) : supabase.from('used_units').select('id,model_id,ram_gb,storage_gb,color_name,grade,battery_health_pct,accessories,warranty_months,price,status,is_published,reserved_until,sold_at,created_at,phone_models(name,slug,specs_reviewed,brands(name))').order('created_at', { ascending: false }),
      type === 'new' || profile.role !== 'owner' ? Promise.resolve({ data: [], error: null }) : supabase.from('admin_used_units').select('id,cost_price,imei,notes_internal'),
    ])
    const error = models.error ?? variants.error ?? used.error ?? ownerUnits.error
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const privateFields = new Map((ownerUnits.data ?? []).map((unit) => [unit.id, unit]))
    const usedRows = (used.data ?? []).map((unit) => ({ ...unit, ...(privateFields.get(unit.id) ?? {}) }))
    return NextResponse.json({ models: models.data ?? [], variants: variants.data ?? [], used: usedRows }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load inventory.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid inventory details.' }, { status: 400 })
  const input = parsed.data
  if (input.kind === 'new' && !input.variant) return NextResponse.json({ error: 'Enter a new-phone variant.' }, { status: 400 })
  if (input.kind === 'used' && !input.unit) return NextResponse.json({ error: 'Enter used-unit details.' }, { status: 400 })
  if (input.status === 'upcoming' && !input.expectedDate) return NextResponse.json({ error: 'Add an expected date for an upcoming model.' }, { status: 400 })
  const colors = input.kind === 'new' && input.variant ? splitColors(input.variant.colorName) : []
  if (input.kind === 'new' && colors.length === 0) return NextResponse.json({ error: 'Enter at least one colour.' }, { status: 400 })
  try {
    const { supabase, profile } = await requireAdmin()
    if (input.kind === 'used' && profile.role !== 'owner' && (input.unit?.costPrice !== undefined || input.unit?.imei || input.unit?.notesInternal)) {
      return NextResponse.json({ error: 'Only the owner can set cost price, IMEI or internal notes.' }, { status: 403 })
    }
    const variantRows = (modelId: string, names: string[], published: boolean) => names.map((name) => ({
      model_id: modelId, ram_gb: input.variant!.ramGb, storage_gb: input.variant!.storageGb, color_name: name, color_hex: colorHex(name),
      price: input.variant!.price, old_price: input.variant!.oldPrice ?? null, stock_count: input.variant!.stockCount,
      low_stock_threshold: input.variant!.lowStockThreshold, is_published: published,
    }))

    // Adding another colour or storage to a phone that already exists only needs new variants.
    if (input.kind === 'new') {
      const { data: existing, error: lookupError } = await supabase.from('phone_models').select('id,specs_reviewed').eq('slug', input.slug).maybeSingle()
      if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
      if (existing) {
        if (input.isPublished && !existing.specs_reviewed) return NextResponse.json({ error: 'Confirm model specifications before publishing.' }, { status: 400 })
        const { error: insertError } = await supabase.from('variants').insert(variantRows(existing.id, colors, input.isPublished))
        if (insertError) return NextResponse.json({ error: insertError.message.includes('duplicate') ? 'That colour, RAM and storage combination already exists for this phone.' : insertError.message }, { status: 400 })
        return NextResponse.json({ modelId: existing.id, existingModel: true }, { status: 201 })
      }
    }
    if (input.isPublished && !input.specsReviewed) return NextResponse.json({ error: 'Confirm model specifications before publishing.' }, { status: 400 })

    const { data: id, error } = await supabase.rpc('create_inventory', {
      p_model: {
        brand: input.brand, name: input.model, slug: input.slug, tagline: '',
        status: input.status, expectedDate: input.expectedDate ?? null, expectedPriceRange: input.expectedPriceRange ?? null,
        specs: input.specs, specMeta: input.specMeta, specsReviewed: input.specsReviewed,
        published: input.isPublished,
      },
      p_kind: input.kind,
      p_variant: input.variant ? {
        ...input.variant, colorName: colors[0] ?? input.variant.colorName, colorHex: colorHex(colors[0] ?? input.variant.colorName), oldPrice: input.variant.oldPrice ?? null,
      } : null,
      p_unit: input.unit ? {
        ...input.unit, batteryHealthPct: input.unit.batteryHealthPct ?? null,
        costPrice: input.unit.costPrice ?? null, imei: input.unit.imei ?? null,
      } : null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const created = (typeof id === 'object' && id !== null ? id : { modelId: id }) as { modelId?: string }
    if (input.kind === 'new' && colors.length > 1 && created.modelId) {
      const { error: extraError } = await supabase.from('variants').insert(variantRows(created.modelId, colors.slice(1), input.isPublished))
      if (extraError) return NextResponse.json({ error: `The phone was created, but the extra colours could not be added: ${extraError.message}` }, { status: 500 })
    }
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save inventory.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

const updateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('variant'), id: z.string().uuid(), colorName: z.string().trim().min(1).max(50).optional(), confirmSpecs: z.boolean().optional(), stockCount: z.number().int().min(0).optional(), price: z.number().positive().optional(), lowStockThreshold: z.number().int().min(0).optional(), isPublished: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('unit'), id: z.string().uuid(), confirmSpecs: z.boolean().optional(), price: z.number().positive().optional(), isPublished: z.boolean().optional(), accessories: z.string().max(200).optional(), warrantyMonths: z.number().int().min(0).max(120).optional(), costPrice: z.number().nonnegative().nullable().optional(), imei: z.string().regex(/^\d{14,16}$/).nullable().optional(), notesInternal: z.string().max(2000).optional() }).strict(),
  z.object({ type: z.literal('model'), id: z.string().uuid(), tagline: z.string().max(240).optional(), expectedDate: z.string().max(80).optional(), expectedPriceRange: z.string().max(80).optional(), specs: z.record(z.string(), z.unknown()).optional(), specMeta: z.record(z.string(), z.unknown()).optional(), specsReviewed: z.boolean().optional() }).strict(),
])

const deleteSchema = z.object({ type: z.enum(['model', 'variant', 'unit']), id: z.string().uuid() }).strict()

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

/** Marks the phone model behind a variant or used unit as having reviewed specifications. Returns an error message or null. */
async function confirmModelSpecs(supabase: AdminClient, table: 'variants' | 'used_units', id: string): Promise<string | null> {
  const { data: row, error: lookupError } = await supabase.from(table).select('model_id').eq('id', id).maybeSingle()
  if (lookupError || !row) return lookupError?.message ?? 'That item no longer exists.'
  const { error } = await supabase.from('phone_models').update({ specs_reviewed: true }).eq('id', row.model_id)
  return error?.message ?? null
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid inventory update.' }, { status: 400 })
  try {
    const { supabase, profile } = await requireAdmin()
    const input = parsed.data
    if (input.type === 'unit' && profile.role !== 'owner' && (input.costPrice !== undefined || input.imei !== undefined || input.notesInternal !== undefined)) {
      return NextResponse.json({ error: 'Only the owner can change private used-phone fields.' }, { status: 403 })
    }
    let error: { message: string } | null
    if (input.type === 'variant') {
      const values = { ...(input.stockCount !== undefined ? { stock_count: input.stockCount } : {}), ...(input.price !== undefined ? { price: input.price } : {}), ...(input.lowStockThreshold !== undefined ? { low_stock_threshold: input.lowStockThreshold } : {}), ...(input.isPublished !== undefined ? { is_published: input.isPublished } : {}), ...(input.colorName !== undefined ? { color_name: input.colorName, color_hex: colorHex(input.colorName) } : {}) }
      if (!Object.keys(values).length && !input.confirmSpecs) return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
      if (input.confirmSpecs) {
        const confirmed = await confirmModelSpecs(supabase, 'variants', input.id)
        if (confirmed) return NextResponse.json({ error: confirmed }, { status: 400 })
      }
      if (Object.keys(values).length) ({ error } = await supabase.from('variants').update(values).eq('id', input.id))
      else error = null
      if (error?.message.includes('duplicate')) error = { message: 'Another variant of this phone already has that colour, RAM and storage.' }
    } else if (input.type === 'unit') {
      const values = { ...(input.price !== undefined ? { price: input.price } : {}), ...(input.isPublished !== undefined ? { is_published: input.isPublished } : {}), ...(input.accessories !== undefined ? { accessories: input.accessories } : {}), ...(input.warrantyMonths !== undefined ? { warranty_months: input.warrantyMonths } : {}), ...(input.costPrice !== undefined ? { cost_price: input.costPrice } : {}), ...(input.imei !== undefined ? { imei: input.imei } : {}), ...(input.notesInternal !== undefined ? { notes_internal: input.notesInternal } : {}) }
      if (!Object.keys(values).length && !input.confirmSpecs) return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
      if (input.confirmSpecs) {
        const confirmed = await confirmModelSpecs(supabase, 'used_units', input.id)
        if (confirmed) return NextResponse.json({ error: confirmed }, { status: 400 })
      }
      if (Object.keys(values).length) ({ error } = await supabase.from('used_units').update(values).eq('id', input.id))
      else error = null
    } else {
      const values = { ...(input.tagline !== undefined ? { tagline: input.tagline } : {}), ...(input.expectedDate !== undefined ? { expected_date: input.expectedDate } : {}), ...(input.expectedPriceRange !== undefined ? { expected_price_range: input.expectedPriceRange } : {}), ...(input.specs !== undefined ? { specs: input.specs } : {}), ...(input.specMeta !== undefined ? { spec_meta: input.specMeta } : {}), ...(input.specsReviewed !== undefined ? { specs_reviewed: input.specsReviewed } : {}) }
      if (!Object.keys(values).length) return NextResponse.json({ error: 'No changes provided.' }, { status: 400 })
      ;({ error } = await supabase.from('phone_models').update(values).eq('id', input.id))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update inventory.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid deletion request.' }, { status: 400 })
  try {
    const { supabase, profile } = await requireAdmin('owner')
    const { type, id } = parsed.data
    if (type === 'model') {
      const [variants, units] = await Promise.all([
        supabase.from('variants').select('id', { count: 'exact', head: true }).eq('model_id', id),
        supabase.from('used_units').select('id', { count: 'exact', head: true }).eq('model_id', id),
      ])
      if (variants.error || units.error) return NextResponse.json({ error: variants.error?.message ?? units.error?.message }, { status: 500 })
      if ((variants.count ?? 0) > 0 || (units.count ?? 0) > 0) return NextResponse.json({ error: 'This model has stock records; delete those records first.' }, { status: 409 })
    }
    const table = type === 'model' ? 'phone_models' : type === 'variant' ? 'variants' : 'used_units'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, actor: profile.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete inventory.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
