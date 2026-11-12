import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const scryptAsync = (password: string, salt: Buffer, length: number, options: ScryptOptions) =>
  new Promise<Buffer>((done, fail) => scrypt(password, salt, length, options, (error, key) => error ? fail(error) : done(key)))

const N = 16384, R = 8, P = 1, LENGTH = 64

export const MIN_PASSWORD_LENGTH = 12

/** Stores a password as "scrypt$N$r$p$salt$hash"; the settings travel with it so they can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 })
  return key.length === expected.length && timingSafeEqual(key, expected)
}
