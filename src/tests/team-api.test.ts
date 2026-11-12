// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDatabase } from './test-database'
import { hashPassword } from '../lib/auth/password'
import { totpCode } from '../lib/auth/totp'

// Routes check DATABASE_URL at import; the test database replaces the real connection.
vi.hoisted(() => { process.env.DATABASE_URL = 'postgres://test-database' })

// The browser cookie jar for these requests.
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { name, value: jar.get(name) } : undefined }) }))

const login = (await import('../../app/api/auth/login/route')).POST
const verify = (await import('../../app/api/auth/verify/route')).POST
const team = await import('../../app/api/admin/team/route')
const { requireAdmin } = await import('../lib/auth/session')

let test: Awaited<ReturnType<typeof createTestDatabase>>
const json = (url: string, method: string, body: unknown) => new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** Signs in and keeps the session cookie, like a browser would. */
async function signIn(email: string, password: string) {
  const response = await login(json('/api/auth/login', 'POST', { email, password }))
  const cookie = response.headers.get('set-cookie')?.match(/siaab_session=([^;]+)/)?.[1]
  if (cookie) jar.set('siaab_session', cookie)
  return { status: response.status, body: await response.json() as { mfa?: boolean; error?: string } }
}

beforeAll(async () => {
  test = await createTestDatabase()
  await test.addProfile('owner', 'owner@shop.et', await hashPassword('owner password 1'))
})
afterAll(async () => { await test.close() })
beforeEach(() => { jar.clear() })

describe('signing in', () => {
  it('starts a session for the right password and refuses a wrong one with the same message as an unknown email', async () => {
    expect((await signIn('owner@shop.et', 'wrong password')).body.error).toBe('Email or password is incorrect.')
    expect((await signIn('nobody@shop.et', 'owner password 1')).body.error).toBe('Email or password is incorrect.')
    expect(jar.size).toBe(0)
    expect((await signIn('OWNER@shop.et', 'owner password 1')).status).toBe(200)
    expect((await requireAdmin('owner')).profile.email).toBe('owner@shop.et')
  })

  it('blocks an email after repeated wrong passwords', async () => {
    await test.addProfile('staff', 'slow@shop.et', await hashPassword('seller password 1'))
    for (let index = 0; index < 8; index += 1) await signIn('slow@shop.et', 'guess')
    expect((await signIn('slow@shop.et', 'seller password 1')).status).toBe(429)
  })

  it('holds a two-factor account at the code step until the right code is given', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    await test.addProfile('owner', 'twofa@shop.et', await hashPassword('owner password 2'))
    await test.pg.query('update public.profiles set totp_secret = $1 where email = $2', [secret, 'twofa@shop.et'])
    expect((await signIn('twofa@shop.et', 'owner password 2')).body.mfa).toBe(true)
    await expect(requireAdmin()).rejects.toThrow('Authentication required.')
    expect((await verify(json('/api/auth/verify', 'POST', { code: '000000' }))).status).toBe(401)
    expect((await verify(json('/api/auth/verify', 'POST', { code: totpCode(secret) }))).status).toBe(200)
    expect((await requireAdmin()).profile.email).toBe('twofa@shop.et')
  })
})

describe('seller accounts', () => {
  it('lets only the owner add sellers, and a seller cannot open owner tools', async () => {
    await signIn('owner@shop.et', 'owner password 1')
    expect((await team.POST(json('/api/admin/team', 'POST', { fullName: 'Abebe', email: 'abebe@shop.et', password: 'short' }))).status).toBe(400)
    expect((await team.POST(json('/api/admin/team', 'POST', { fullName: 'Abebe', email: 'abebe@shop.et', password: 'seller password 9' }))).status).toBe(201)
    expect((await team.POST(json('/api/admin/team', 'POST', { fullName: 'Again', email: 'abebe@shop.et', password: 'seller password 9' }))).status).toBe(409)
    const { sellers } = await (await team.GET()).json() as { sellers: { id: string; email: string }[] }
    expect(sellers.map((seller) => seller.email)).toContain('abebe@shop.et')

    jar.clear()
    await signIn('abebe@shop.et', 'seller password 9')
    expect((await team.GET()).status).toBe(403)
  })

  it('removing a seller signs them out at once, keeps the account for sales history, and never touches an owner', async () => {
    jar.clear()
    await signIn('abebe@shop.et', 'seller password 9')
    const sellerCookie = jar.get('siaab_session')!
    jar.clear()
    await signIn('owner@shop.et', 'owner password 1')
    const { sellers } = await (await team.GET()).json() as { sellers: { id: string; email: string }[] }
    const abebe = sellers.find((seller) => seller.email === 'abebe@shop.et')!
    const { rows: [ownerRow] } = await test.pg.query<{ id: string }>("select id from public.profiles where email = 'owner@shop.et'")
    expect((await team.DELETE(json('/api/admin/team', 'DELETE', { id: ownerRow!.id }))).status).toBe(400)
    expect((await team.DELETE(json('/api/admin/team', 'DELETE', { id: abebe.id }))).status).toBe(200)

    jar.set('siaab_session', sellerCookie)
    await expect(requireAdmin()).rejects.toThrow('Authentication required.')
    expect((await signIn('abebe@shop.et', 'seller password 9')).status).toBe(401)
    const { rows } = await test.pg.query('select disabled_at from public.profiles where id = $1', [abebe.id])
    expect(rows).toHaveLength(1)
  })

  it('a reset password works and the old one stops working', async () => {
    jar.clear()
    await signIn('owner@shop.et', 'owner password 1')
    await team.POST(json('/api/admin/team', 'POST', { fullName: 'Sara', email: 'sara@shop.et', password: 'first password 1' }))
    const { sellers } = await (await team.GET()).json() as { sellers: { id: string; email: string }[] }
    const sara = sellers.find((seller) => seller.email === 'sara@shop.et')!
    expect((await team.PATCH(json('/api/admin/team', 'PATCH', { id: sara.id, password: 'second password 2' }))).status).toBe(200)
    jar.clear()
    expect((await signIn('sara@shop.et', 'first password 1')).status).toBe(401)
    expect((await signIn('sara@shop.et', 'second password 2')).status).toBe(200)
  })
})
