import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from './config'

export async function getServerSupabase() {
  const { url, key } = getSupabasePublicConfig()
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          try { cookieStore.set(name, value, options) } catch { /* Server components cannot mutate cookies. */ }
        }
      },
    },
  })
}
