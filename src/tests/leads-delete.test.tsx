import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = { role: 'owner' as 'owner' | 'staff', found: true as boolean, deleted: [] as string[] }

vi.mock('../lib/auth/session', () => ({
  requireAdmin: async (need?: 'owner' | 'staff') => {
    if (need && state.role !== need) throw new Error('You do not have permission to perform this action.')
    return {
      profile: { role: state.role },
      db: {
        from: () => ({
          select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: state.found ? { id } : null, error: null }) }) }),
          delete: () => ({ eq: async (_column: string, id: string) => { state.deleted.push(id); return { error: null } } }),
        }),
      },
    }
  },
}))

const { DELETE } = await import('../../app/api/admin/leads/route')
const { LeadsManager } = await import('../../app/admin/leads/ui')
const id = '0b6f9a2e-4c1d-4e7a-9a51-3f2b8c7d6e10'
const remove = (body: unknown) => DELETE(new Request('http://localhost/api/admin/leads', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(() => { state.role = 'owner'; state.found = true; state.deleted = [] })

describe('deleting a customer request (API)', () => {
  it('lets the owner delete a request', async () => {
    const response = await remove({ id })
    expect(response.status).toBe(200)
    expect(state.deleted).toEqual([id])
  })

  it('refuses sellers, unknown requests and bad input', async () => {
    state.role = 'staff'
    expect((await remove({ id })).status).toBe(403)
    state.role = 'owner'; state.found = false
    expect((await remove({ id })).status).toBe(404)
    expect((await remove({ id: 'not-an-id' })).status).toBe(400)
    expect(state.deleted).toEqual([])
  })
})

describe('deleting a customer request (screen)', () => {
  const lead = { id, type: 'contact', name: 'Abebe', contact: '+251911000000', payload: {}, status: 'closed', created_at: '2026-11-20T10:00:00Z' }
  let deletes: unknown[]
  beforeEach(() => {
    deletes = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') { deletes.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true })) }
      return new Response(JSON.stringify({ leads: [lead] }))
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('asks first, then removes the request from the list', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<LeadsManager role="owner" />)
    const button = await screen.findByRole('button', { name: 'Delete the request from Abebe' })
    await user.click(button)
    expect(deletes).toEqual([])
    await user.click(button)
    await waitFor(() => expect(deletes).toEqual([{ id }]))
    expect(confirm).toHaveBeenCalledWith('Delete the request from Abebe? This cannot be undone.')
    expect(await screen.findByText('Deleted the request from Abebe.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete the request from Abebe' })).toBeNull()
  })

  it('shows no delete button to sellers', async () => {
    render(<LeadsManager role="staff" />)
    await screen.findByText('Abebe')
    expect(screen.queryByRole('button', { name: /Delete the request/ })).toBeNull()
  })
})
