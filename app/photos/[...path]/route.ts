import { readFile } from 'node:fs/promises'
import { photoFile } from '../../../src/lib/db/photos'

export const runtime = 'nodejs'

const TYPES: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }

/** Serves uploaded phone photos from the server's photos folder. Names are random, so they can be cached for a year. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const relativePath = path.join('/')
  const type = TYPES[relativePath.split('.').pop()?.toLowerCase() ?? '']
  if (!type) return new Response('Not found', { status: 404 })
  try {
    const bytes = await readFile(photoFile(relativePath))
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
