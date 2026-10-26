import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

const uploadSchema = z.object({
  kind: z.enum(['model', 'unit']),
  entityId: z.string().uuid(),
  dataUrl: z.string().max(280_000),
  altText: z.string().trim().max(160).default('Phone photo'),
}).strict()
const deleteSchema = z.object({ kind: z.enum(['model', 'unit']), id: z.string().uuid() }).strict()
const orderSchema = z.object({ kind: z.enum(['model', 'unit']), entityId: z.string().uuid(), photoIds: z.array(z.string().uuid()).max(8) }).strict()

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await requireAdmin()
    const params = new URL(request.url).searchParams
    const modelId = params.get('modelId')
    const unitId = params.get('unitId')
    if ((!modelId && !unitId) || (modelId && unitId)) return NextResponse.json({ error: 'Specify exactly one modelId or unitId.' }, { status: 400 })
    const kind = modelId ? 'model' : 'unit'
    const entityId = modelId ?? unitId
    const table = kind === 'model' ? 'model_photos' : 'used_unit_photos'
    const fk = kind === 'model' ? 'model_id' : 'unit_id'
    const [photos, usage] = await Promise.all([
      supabase.from(table).select('id,path,alt_text,sort_order,is_main').eq(fk, entityId!).order('sort_order'),
      profile.role === 'owner' ? supabase.rpc('storage_usage_bytes') : Promise.resolve({ data: null, error: null }),
    ])
    if (photos.error) return NextResponse.json({ error: photos.error.message }, { status: 500 })
    if (usage.error) return NextResponse.json({ error: `Could not read storage usage: ${usage.error.message}` }, { status: 500 })
    const bucket = supabase.storage.from('phone-photos')
    return NextResponse.json({
      photos: (photos.data ?? []).map((photo) => ({ ...photo, url: bucket.getPublicUrl(photo.path).data.publicUrl })),
      ...(profile.role === 'owner' ? { usageBytes: Number(usage.data ?? 0) } : {}),
    }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load photos.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function POST(request: Request) {
  const parsed = uploadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid photo upload.' }, { status: 400 })
  const match = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.data.dataUrl)
  if (!match?.[1] || !match[2]) return NextResponse.json({ error: 'Photo must be a WebP, JPEG or PNG data URL.' }, { status: 400 })
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 200 * 1024) return NextResponse.json({ error: 'Compressed photos must be no larger than 200 KB.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin()
    const kind = parsed.data.kind
    const table = kind === 'model' ? 'model_photos' : 'used_unit_photos'
    const fk = kind === 'model' ? 'model_id' : 'unit_id'
    const { data: existing, error: listError } = await supabase.from(table).select('id,sort_order,is_main').eq(fk, parsed.data.entityId).order('sort_order')
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
    if ((existing?.length ?? 0) >= 8) return NextResponse.json({ error: 'A listing can have at most 8 photos.' }, { status: 409 })
    const extension = match[1] === 'image/webp' ? 'webp' : match[1] === 'image/jpeg' ? 'jpg' : 'png'
    const path = `${kind}/${parsed.data.entityId}/${crypto.randomUUID()}.${extension}`
    const bucket = supabase.storage.from('phone-photos')
    const { error: uploadError } = await bucket.upload(path, bytes, { contentType: match[1], cacheControl: '31536000', upsert: false })
    if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 400 })
    const { data: photo, error: insertError } = await supabase.from(table).insert({
      [fk]: parsed.data.entityId,
      path,
      sort_order: existing?.length ?? 0,
      is_main: existing?.length === 0,
      alt_text: parsed.data.altText,
    }).select('id,path,alt_text,sort_order,is_main').single()
    if (insertError) {
      const cleanup = await bucket.remove([path])
      const suffix = cleanup.error ? ` Storage cleanup also failed: ${cleanup.error.message}` : ''
      return NextResponse.json({ error: `Photo metadata could not be saved: ${insertError.message}.${suffix}` }, { status: 500 })
    }
    return NextResponse.json({ photo: { ...photo, url: bucket.getPublicUrl(path).data.publicUrl } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not upload photo.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function PATCH(request: Request) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid photo order.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin()
    const table = parsed.data.kind === 'model' ? 'model_photos' : 'used_unit_photos'
    const fk = parsed.data.kind === 'model' ? 'model_id' : 'unit_id'
    const { data: rows, error } = await supabase.from(table).select('id').eq(fk, parsed.data.entityId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (rows.length !== parsed.data.photoIds.length || new Set(parsed.data.photoIds).size !== rows.length || rows.some((row) => !parsed.data.photoIds.includes(row.id))) {
      return NextResponse.json({ error: 'Photo order must include each photo exactly once.' }, { status: 400 })
    }
    for (const [index, id] of parsed.data.photoIds.entries()) {
      const { error: updateError } = await supabase.from(table).update({ sort_order: index, is_main: index === 0 }).eq('id', id).eq(fk, parsed.data.entityId)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reorder photos.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid photo deletion request.' }, { status: 400 })
  try {
    const { supabase } = await requireAdmin()
    const table = parsed.data.kind === 'model' ? 'model_photos' : 'used_unit_photos'
    const { data: photo, error: readError } = await supabase.from(table).select(parsed.data.kind === 'model' ? 'id,path,model_id' : 'id,path,unit_id').eq('id', parsed.data.id).maybeSingle<{ id: string; path: string; model_id?: string; unit_id?: string }>()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
    if (!photo) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
    const { error: deleteRowError } = await supabase.from(table).delete().eq('id', photo.id)
    if (deleteRowError) return NextResponse.json({ error: deleteRowError.message }, { status: 400 })
    const { error: removeError } = await supabase.storage.from('phone-photos').remove([photo.path])
    if (removeError) return NextResponse.json({ error: `Photo record removed but storage cleanup failed: ${removeError.message}` }, { status: 500 })
    const fk = parsed.data.kind === 'model' ? 'model_id' : 'unit_id'
    const entityId = parsed.data.kind === 'model' ? photo.model_id : photo.unit_id
    const { data: remaining, error: listError } = await supabase.from(table).select('id').eq(fk, entityId).order('sort_order').limit(1)
    if (listError) return NextResponse.json({ error: `Photo deleted; could not update the main image: ${listError.message}` }, { status: 500 })
    if (remaining?.[0]) {
      const { error: mainError } = await supabase.from(table).update({ is_main: true }).eq('id', remaining[0].id)
      if (mainError) return NextResponse.json({ error: `Photo deleted; could not update the main image: ${mainError.message}` }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove photo.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
