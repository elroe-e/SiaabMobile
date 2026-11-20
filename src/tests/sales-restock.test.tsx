import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesManager } from '../../app/admin/sales/ui'

vi.mock('../../app/admin/sales-trend', () => ({ SalesTrend: () => null }))

const model = { name: '13 Ultra', brands: { name: 'Xiaomi' } }
const sales = [
  { id: 'sale-new', kind: 'new', variant_id: 'v1', unit_id: null, quantity: 1, sale_price: 100000, sold_at: new Date().toISOString(), buyer_note: null, undone_at: null, variants: { model_id: 'm1', phone_models: model }, used_units: null },
  { id: 'sale-used', kind: 'used', variant_id: null, unit_id: 'u1', quantity: 1, sale_price: 55000, sold_at: new Date().toISOString(), buyer_note: null, undone_at: '2026-11-13T20:00:00Z', variants: null, used_units: { model_id: 'm1', price: 55000, phone_models: model } },
]
let posts: Record<string, unknown>[]

beforeEach(() => {
  posts = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ result: 'ok' })) }
    return new Response(JSON.stringify(url.includes('inventory') ? { variants: [], used: [] } : { sales, role: 'staff' }))
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('restock from sale history', () => {
  it('asks how many and adds that many of a new phone back to stock', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'prompt').mockReturnValue('3')
    render(<SalesManager role="staff" />)
    const [restockNew] = await screen.findAllByTitle('Restock: add the same phone again')
    await user.click(restockNew!)
    await waitFor(() => expect(posts).toEqual([{ action: 'restock', id: 'sale-new', quantity: 3 }]))
    expect(await screen.findByText('Added 3 Xiaomi 13 Ultra back to stock.')).toBeInTheDocument()
  })

  it('adds one copy of a used phone after a confirmation, even from an undone sale', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SalesManager role="staff" />)
    const buttons = await screen.findAllByTitle('Restock: add the same phone again')
    await user.click(buttons[1]!)
    await waitFor(() => expect(posts).toEqual([{ action: 'restock', id: 'sale-used', quantity: 1 }]))
  })

  it('does nothing when the person cancels or types a wrong amount', async () => {
    const user = userEvent.setup()
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('two')
    render(<SalesManager role="staff" />)
    const [restockNew] = await screen.findAllByTitle('Restock: add the same phone again')
    await user.click(restockNew!)
    await user.click(restockNew!)
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(posts).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 1 to 1000.')
  })
})
