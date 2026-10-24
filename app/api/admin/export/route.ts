import { NextResponse } from 'next/server'
import { Zip, ZipPassThrough } from 'fflate'
import { requireAdmin } from '../../../../src/lib/supabase/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function loadAll(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], table: string, select = '*') {
  const rows: unknown[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + 999)
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return rows
  }
}

async function listFiles(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], folder = ''): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await supabase.storage.from('phone-photos').list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw new Error(`Could not list stored photos: ${error.message}`)
  for (const item of data ?? []) {
    const path = folder ? `${folder}/${item.name}` : item.name
    if (item.id === null) paths.push(...await listFiles(supabase, path))
    else paths.push(path)
  }
  return paths
}

export async function GET() {
  try {
    const { supabase, user } = await requireAdmin('owner')
    const tables = [
      ['brands', '*'],
      ['phone_models', '*'],
      ['variants', '*'],
      ['used_units', 'id,model_id,ram_gb,storage_gb,color_name,grade,battery_health_pct,accessories,warranty_months,price,status,is_published,reserved_until,sold_at,created_by,created_at'],
      ['admin_used_units', '*'],
      ['model_photos', '*'],
      ['used_unit_photos', '*'],
      ['sales', '*'],
      ['trade_in_values', '*'],
      ['trade_in_config', '*'],
      ['shop_settings', '*'],
      ['leads', '*'],
      ['profiles', 'id,full_name,role,created_at'],
      ['audit_log', '*'],
    ] as const
    const data: Record<string, unknown[]> = {}
    for (const [table, columns] of tables) data[table] = await loadAll(supabase, table, columns)

    const storagePaths = await listFiles(supabase)
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const zip = new Zip((error, chunk, final) => {
          if (error) { controller.error(error); return }
          if (chunk.length) controller.enqueue(chunk)
          if (final) controller.close()
        })
        const addFile = (name: string, bytes: Uint8Array) => {
          const entry = new ZipPassThrough(name)
          zip.add(entry)
          entry.push(bytes, true)
        }
        const addJson = (name: string, value: unknown) => addFile(name, encoder.encode(`${JSON.stringify(value, null, 2)}\n`))
        void (async () => {
          try {
            addJson('database/records.json', data)
            addJson('database/manifest.json', {
              exportedAt: new Date().toISOString(),
              exportedBy: user.id,
              photoCount: storagePaths.length,
              tables: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length])),
            })
            for (const path of storagePaths) {
              const { data: file, error } = await supabase.storage.from('phone-photos').download(path)
              if (error) throw new Error(`Could not export photo ${path}: ${error.message}`)
              addFile(`phone-photos/${path}`, new Uint8Array(await file.arrayBuffer()))
            }
            zip.end()
          } catch (error) {
            controller.error(error)
          }
        })()
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="siaab-mobile-backup-${new Date().toISOString().slice(0, 10)}.zip"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not export the shop data.'
    return NextResponse.json({ error: message }, { status: message.includes('Authentication') || message.includes('permission') ? 403 : 500 })
  }
}
