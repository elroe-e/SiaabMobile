import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { LANGUAGE_COOKIE, parseLanguage } from '../src/i18n/language'
import type { Metadata } from 'next'
import App from '../src/App'
import { phones } from '../src/data/phones'
import { getPublicCatalog } from '../src/lib/supabase/public-catalog'
import { getPublicStoreData } from '../src/lib/supabase/public-store'
import type { StoreData } from '../src/context/StoreDataContext'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

export default async function NotFound() {
  const initialLang = parseLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value)
  let catalog = phones
  let storeData: StoreData | null = null
  try {
    [catalog, storeData] = await Promise.all([getPublicCatalog(), getPublicStoreData()])
  } catch (error) {
    console.error('Supabase public data unavailable; rendering editable sample data.', error)
  }
  return <Suspense fallback={<main className="container page-container" aria-busy="true"><p>Loading Siaab Mobile…</p></main>}><App initialPhones={catalog} initialLang={initialLang} {...(storeData ? { initialStoreData: storeData } : {})} /></Suspense>
}
