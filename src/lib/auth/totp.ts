import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Time-based one-time codes (RFC 6238), as used by Google Authenticator, Microsoft Authenticator and Authy.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=]/g, '').toUpperCase()
  let bits = 0, value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error('Invalid setup key')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(bytes)
}

export const newTotpSecret = () => base32Encode(randomBytes(20))

/** The 6-digit code for a moment in time (seconds since 1970). */
export function totpCode(secret: string, atSeconds = Date.now() / 1000, digits = 6, step = 30, algorithm = 'sha1'): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(atSeconds / step)))
  const hmac = createHmac(algorithm, base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1]! & 15
  const number = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(number).padStart(digits, '0')
}

/** Accepts the current code and its neighbours, so a phone clock 30 seconds off still works. */
export function verifyTotp(secret: string, code: string, atSeconds = Date.now() / 1000): boolean {
  const given = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(given)) return false
  return [-1, 0, 1].some((drift) => {
    const expected = Buffer.from(totpCode(secret, atSeconds + drift * 30))
    return timingSafeEqual(expected, Buffer.from(given))
  })
}

export const otpauthUrl = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`Siaab Mobile:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('Siaab Mobile')}&algorithm=SHA1&digits=6&period=30`
