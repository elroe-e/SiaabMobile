// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { sameSite } from '../../middleware'

const request = (headers: Record<string, string>) => new Request('https://siaabmobile.com/api/auth/login', { method: 'POST', headers })

describe('cross-site protection', () => {
  it('accepts the site itself, with or without ports, proxies or www', () => {
    expect(sameSite(request({ origin: 'https://siaabmobile.com', host: 'siaabmobile.com' }))).toBe(true)
    expect(sameSite(request({ origin: 'https://siaabmobile.com', host: '127.0.0.1:3000', 'x-forwarded-host': 'siaabmobile.com:443' }))).toBe(true)
    expect(sameSite(request({ origin: 'https://SiaabMobile.com', host: 'localhost:3000' }))).toBe(process.env.NEXT_PUBLIC_SITE_URL ? true : false)
    expect(sameSite(request({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true)
  })

  it('refuses other sites, missing origins and the "null" origin', () => {
    expect(sameSite(request({ origin: 'https://evil.example', host: 'siaabmobile.com' }))).toBe(false)
    expect(sameSite(request({ host: 'siaabmobile.com' }))).toBe(false)
    expect(sameSite(request({ origin: 'null', host: 'siaabmobile.com' }))).toBe(false)
    expect(sameSite(request({ origin: 'https://siaabmobile.com.evil.example', host: 'siaabmobile.com' }))).toBe(false)
  })
})
