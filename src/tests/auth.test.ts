// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../lib/auth/password'
import { base32Decode, base32Encode, totpCode, verifyTotp } from '../lib/auth/totp'
import { hashPassword as scriptHash } from '../../scripts/set-owner.mjs'

// RFC 6238 test secret "12345678901234567890" in base32.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))

describe('two-factor codes', () => {
  it('matches the RFC 6238 test vectors', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(totpCode(RFC_SECRET, 59, 8)).toBe('94287082')
    expect(totpCode(RFC_SECRET, 1111111109, 8)).toBe('07081804')
    expect(totpCode(RFC_SECRET, 1234567890, 8)).toBe('89005924')
    expect(base32Decode(RFC_SECRET).toString()).toBe('12345678901234567890')
  })

  it('accepts the current code and one step either side, and nothing else', () => {
    const now = 1_800_000_000
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now), now)).toBe(true)
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30), now)).toBe(true)
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 90), now)).toBe(false)
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBe(false)
    expect(verifyTotp(RFC_SECRET, 'abcdef', now)).toBe(false)
  })
})

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true)
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false)
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
  })

  it('the owner set-up script stores passwords the site can check', async () => {
    expect(await verifyPassword('owner password 1', await scriptHash('owner password 1'))).toBe(true)
  })
})
