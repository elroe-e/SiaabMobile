import 'server-only'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'

// Outside the deployed app folder, so a new deploy never deletes uploaded photos.
export const photosRoot = () => resolve(process.env.PHOTOS_DIR || join(homedir(), 'siaab-photos'))

/** Public address of a stored photo. */
export const photoUrl = (path: string) => `/photos/${path.split('/').map(encodeURIComponent).join('/')}`

/** Resolves a stored photo path, refusing anything that would leave the photos folder. */
export function photoFile(path: string): string {
  const root = photosRoot()
  const file = resolve(root, path)
  if (!path || path.includes('\0') || !file.startsWith(root + sep)) throw new Error('Invalid photo path')
  return file
}

type StorageResult<T> = Promise<{ data: T; error: null } | { data: null; error: { message: string } }>
const fail = (error: unknown) => ({ message: error instanceof Error ? error.message : 'Photo storage failed.' })

/** Same calls the site made on its old storage bucket, backed by the server's disk. */
export const photoBucket = {
  async upload(path: string, bytes: Uint8Array | ArrayBuffer, options?: { upsert?: boolean; contentType?: string; cacheControl?: string }): StorageResult<{ path: string }> {
    try {
      const file = photoFile(path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes, { flag: options?.upsert ? 'w' : 'wx' })
      return { data: { path }, error: null }
    } catch (error) { return { data: null, error: fail(error) } }
  },
  async remove(paths: string[]): StorageResult<null> {
    try {
      for (const path of paths) await rm(photoFile(path), { force: true })
      return { data: null, error: null }
    } catch (error) { return { data: null, error: fail(error) } }
  },
  /** Lists one folder; sub-folders come back with id null, like the old storage API. */
  async list(folder = '', _options?: unknown): StorageResult<{ name: string; id: string | null }[]> {
    try {
      const dir = folder ? photoFile(folder) : photosRoot()
      const entries = await readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error })
      return { data: entries.map((entry) => ({ name: entry.name, id: entry.isDirectory() ? null : entry.name })).sort((a, b) => a.name.localeCompare(b.name)), error: null }
    } catch (error) { return { data: null, error: fail(error) } }
  },
  async download(path: string): StorageResult<Blob> {
    try { return { data: new Blob([await readFile(photoFile(path))]), error: null } } catch (error) { return { data: null, error: fail(error) } }
  },
  getPublicUrl: (path: string) => ({ data: { publicUrl: photoUrl(path) } }),
}

/** Total bytes of stored photos, for the owner's storage meter. */
export async function photoStorageBytes(): Promise<number> {
  const walk = async (dir: string): Promise<number> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    let total = 0
    for (const entry of entries) {
      const full = join(dir, entry.name)
      total += entry.isDirectory() ? await walk(full) : (await stat(full)).size
    }
    return total
  }
  return walk(photosRoot())
}
