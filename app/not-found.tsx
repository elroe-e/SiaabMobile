import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { LANGUAGE_COOKIE, parseLanguage } from '../src/i18n/language'
import type { Metadata } from 'next'
import App from '../src/App'
import { loadStorefront } from '../src/lib/db/public-store'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Page not found', robots: { index: false } }

export default async function NotFound() {
  const initialLang = parseLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value)
  const { catalog, storeData, offline } = await loadStorefront()
  return <Suspense fallback={<main className="container page-container" aria-busy="true"><p>Loading Siaab Mobile…</p></main>}><App initialPhones={catalog} initialLang={initialLang} initialStoreData={storeData} offline={offline} /></Suspense>
}
