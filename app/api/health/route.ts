import { NextResponse } from 'next/server'
import { createDbClient } from '../../../src/lib/db/client'
import { isDatabaseConfigured } from '../../../src/lib/db/pool'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isDatabaseConfigured) {
    return NextResponse.json({ status: 'ok', database: 'not_configured' }, { headers: { 'cache-control': 'no-store' } })
  }
  const { error } = await createDbClient().from('public_shop_settings').select('name').limit(1)
  if (error) {
    console.error('Health check could not reach the database', error.message)
    return NextResponse.json({ status: 'error', database: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  return NextResponse.json({ status: 'ok', database: 'connected' }, { headers: { 'cache-control': 'no-store' } })
}
