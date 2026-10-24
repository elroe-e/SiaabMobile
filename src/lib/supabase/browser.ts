'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicConfig } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function getBrowserSupabase() {
  if (!browserClient) {
    const { url, key } = getSupabasePublicConfig()
    browserClient = createBrowserClient(url, key)
  }
  return browserClient
}
