import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createDbClient } from '../../../src/lib/db/client'
import { isDatabaseConfigured } from '../../../src/lib/db/pool'

const leadSchema = z.object({
  type: z.enum(['trade_in', 'notify_me', 'contact', 'reservation']),
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(3).max(240),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict()

export async function POST(request: Request) {
  const parsed = leadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a name and valid contact details.' }, { status: 400 })
  if (!isDatabaseConfigured) return NextResponse.json({ error: 'Requests cannot be saved because no database is set up.' }, { status: 503 })
  const { data, error } = await createDbClient().rpc('submit_public_lead', {
    p_type: parsed.data.type,
    p_name: parsed.data.name,
    p_contact: parsed.data.contact,
    p_payload: parsed.data.payload,
  })
  if (error) {
    const limited = error.message.includes('Too many requests')
    // The saved request is the shop's only copy, so a failed save has to be findable in the server log.
    if (!limited) console.error('Could not save a customer request.', error.message)
    return NextResponse.json({ error: limited ? 'Too many requests. Please wait a few minutes before trying again.' : 'We could not save your request.' }, { status: limited ? 429 : 503 })
  }
  return NextResponse.json({ id: data }, { status: 201, headers: { 'cache-control': 'no-store' } })
}
