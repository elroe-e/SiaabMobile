// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = { selected: [] as string[], removed: [] as string[][], deleted: [] as string[] }

vi.mock('../lib/supabase/auth', () => ({
  requireAdmin: async () => ({
    supabase: {
      from: (table: string) => ({
        select: (columns: string) => {
          state.selected.push(`${table}:${columns}`)
          return {
            eq: (column: string) => ({
              maybeSingle: async () => ({ data: { id: 'p1', path: 'model/m1/a.webp', model_id: 'm1' }, error: null }),
              order: () => ({ limit: async () => ({ data: column === 'model_id' ? [{ id: 'p2' }] : [], error: null }) }),
            }),
          }
        },
        delete: () => ({ eq: async (_c: string, id: string) => { state.deleted.push(id); return { error: null } } }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
      storage: { from: () => ({ remove: async (paths: string[]) => { state.removed.push(paths); return { error: null } } }) },
    },
  }),
}))

const { DELETE } = await import('../../app/api/admin/photos/route')
const del = (body: Record<string, unknown>) => new Request('http://localhost/api/admin/photos', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => { state.selected = []; state.removed = []; state.deleted = [] })

describe('delete photo API', () => {
  it('never asks the model photo table for a unit column', async () => {
    const response = await DELETE(del({ kind: 'model', id: '11111111-1111-4111-8111-111111111111' }))
    expect(response.status).toBe(200)
    expect(state.selected[0]).toBe('model_photos:id,path,model_id')
    expect(state.deleted).toEqual(['p1'])
    expect(state.removed).toEqual([['model/m1/a.webp']])
  })
})
