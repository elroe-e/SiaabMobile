// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = {
  roleAsked: [] as (string | undefined)[],
  profileRole: 'staff' as string | null,
  profileError: null as { message: string } | null,
  calls: [] as string[],
}

vi.mock('../lib/supabase/auth', () => ({
  requireAdmin: async (role?: string) => { state.roleAsked.push(role); return { profile: { role: 'owner' } } },
}))
vi.mock('../lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [{ id: 'a', full_name: 'Abebe', created_at: '2026-11-01' }, { id: 'b', full_name: 'Gone', created_at: '2026-10-01' }], error: null }),
          maybeSingle: async () => ({ data: state.profileRole ? { role: state.profileRole } : null, error: null }),
        }),
      }),
      upsert: async () => { state.calls.push('upsert'); return { error: state.profileError } },
    }),
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [{ id: 'a', email: 'abebe@shop.et', banned_until: null }, { id: 'b', email: 'gone@shop.et', banned_until: '2126-01-01T00:00:00Z' }] }, error: null }),
        createUser: async () => { state.calls.push('create'); return { data: { user: { id: 'new' } }, error: null } },
        deleteUser: async () => { state.calls.push('delete'); return { error: null } },
        updateUserById: async (_id: string, attrs: Record<string, unknown>) => { state.calls.push(`ban:${String(attrs.ban_duration)}`); return { error: null } },
      },
    },
  }),
}))

const { GET, POST, DELETE } = await import('../../app/api/admin/team/route')
const json = (method: string, body: unknown) => new Request('http://localhost/api/admin/team', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const id = '7c0b6f1e-2d1b-4e6a-9c3f-1a2b3c4d5e6f'

beforeEach(() => { state.roleAsked = []; state.profileRole = 'staff'; state.profileError = null; state.calls = [] })

describe('seller accounts API', () => {
  it('is owner-only and lists active sellers with their email, hiding removed ones', async () => {
    const result = await (await GET()).json()
    expect(state.roleAsked).toEqual(['owner'])
    expect(result.sellers).toEqual([{ id: 'a', fullName: 'Abebe', email: 'abebe@shop.et', createdAt: '2026-11-01' }])
  })

  it('rejects short passwords and removes the account again if the profile cannot be saved', async () => {
    expect((await POST(json('POST', { fullName: 'Abebe', email: 'a@shop.et', password: 'short' }))).status).toBe(400)
    expect(state.calls).toEqual([])
    state.profileError = { message: 'boom' }
    expect((await POST(json('POST', { fullName: 'Abebe', email: 'a@shop.et', password: 'long enough pass' }))).status).toBe(500)
    expect(state.calls).toEqual(['create', 'upsert', 'delete'])
  })

  it('blocks a seller instead of deleting them, and never touches an owner account', async () => {
    expect((await DELETE(json('DELETE', { id }))).status).toBe(200)
    expect(state.calls).toEqual(['ban:876000h'])
    state.calls = []; state.profileRole = 'owner'
    expect((await DELETE(json('DELETE', { id }))).status).toBe(400)
    expect(state.calls).toEqual([])
  })
})
