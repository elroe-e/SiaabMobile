// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDbClient } from '../lib/db/client'
import { setDatabaseForTests } from '../lib/db/pool'
import { loadStorefront } from '../lib/db/public-store'
import { createTestDatabase } from './test-database'

// The shop pages only read the database when DATABASE_URL is set; the test database replaces the real connection.
vi.hoisted(() => { process.env.DATABASE_URL = 'postgres://test-database' })

afterEach(() => setDatabaseForTests(undefined))

describe('what the shop pages load', () => {
  it('shows the phones the owner published', async () => {
    const test = await createTestDatabase()
    const owner = createDbClient({ id: await test.addProfile('owner'), role: 'owner' })
    const { error } = await owner.rpc('create_inventory', {
      p_model: { brand: 'Samsung', name: 'Galaxy A55', slug: 'galaxy-a55', status: 'available', specs: { chipset: 'X' }, specsReviewed: true, published: true },
      p_kind: 'new',
      p_variant: { ramGb: 8, storageGb: 256, colorName: 'Black', price: 50000, stockCount: 3 },
      p_unit: null,
    })
    expect(error).toBeNull()
    const { catalog, storeData, offline } = await loadStorefront()
    expect(offline).toBe(false)
    expect(catalog.map((phone) => [phone.slug, phone.price])).toEqual([['galaxy-a55', 50000]])
    expect(storeData.upcomingPhones).toEqual([])
    // Without a pasted link the address is searched; a pasted link and a second shop show as saved.
    expect(storeData.shop.mapUrl).toContain('maps.google.com/?q=')
    expect(storeData.shop.second).toBeNull()
    await test.pg.query("update public.shop_settings set map_url = 'https://maps.app.goo.gl/one', address_2 = 'Bole, Addis Ababa', map_url_2 = 'https://maps.app.goo.gl/two'")
    const { shop } = (await loadStorefront()).storeData
    expect(shop.mapUrl).toBe('https://maps.app.goo.gl/one')
    expect(shop.second).toEqual({ address: 'Bole, Addis Ababa', mapUrl: 'https://maps.app.goo.gl/two' })
    await test.close()
  })

  it('opens without phones, never with the demo catalogue, when the database is down', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setDatabaseForTests({ run: async () => { throw new Error('connection refused') } })
    const { catalog, storeData, offline } = await loadStorefront()
    expect(offline).toBe(true)
    expect(catalog).toEqual([])
    expect(storeData.upcomingPhones).toEqual([])
    // Customers can still reach the shop and use the trade-in estimator.
    expect(storeData.shop.phones[0]).toMatch(/^\+251/)
    expect(storeData.tradeInValues.length).toBeGreaterThan(100)
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})
