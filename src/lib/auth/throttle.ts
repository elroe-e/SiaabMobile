import 'server-only'
import { getDatabase } from '../db/pool'

// Kept in the database, not memory, because the host may run several copies of the site.
const WINDOW_MINUTES = 15
const LIMITS = { email: 8, ip: 30, code: 8 } as const
export type AttemptKind = keyof typeof LIMITS

const key = (kind: AttemptKind, value: string) => `${kind}:${value.toLowerCase()}`

export const clientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

/** True when any of the given keys has hit its limit of failed attempts in the last 15 minutes. */
export async function isThrottled(items: [AttemptKind, string][]): Promise<boolean> {
  const { rows } = await getDatabase().run((db) => db.query(
    `select key, count(*)::int as n from public.login_attempts where key = any($1::text[]) and attempted_at > now() - interval '${WINDOW_MINUTES} minutes' group by key`,
    [items.map(([kind, value]) => key(kind, value))],
  ))
  return items.some(([kind, value]) => Number(rows.find((row) => row.key === key(kind, value))?.n ?? 0) >= LIMITS[kind])
}

export async function recordFailure(items: [AttemptKind, string][]) {
  await getDatabase().run(async (db) => {
    for (const [kind, value] of items) await db.query('insert into public.login_attempts(key) values ($1)', [key(kind, value)])
    await db.query("delete from public.login_attempts where attempted_at < now() - interval '1 day'")
  })
}

export async function clearFailures(kind: AttemptKind, value: string) {
  await getDatabase().run((db) => db.query('delete from public.login_attempts where key = $1', [key(kind, value)]))
}
