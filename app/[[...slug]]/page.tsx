import { Suspense } from 'react'
import type { Metadata } from 'next'
import App from '../../src/App'
import { phones } from '../../src/data/phones'
import { getPublicCatalog } from '../../src/lib/supabase/public-catalog'
import { getPublicStoreData } from '../../src/lib/supabase/public-store'
import type { StoreData } from '../../src/context/StoreDataContext'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug = [] } = await params
  if (slug[0] === 'phones' && slug[1]) {
    let catalog = phones
    try { catalog = await getPublicCatalog() } catch (error) { console.error('Could not load dynamic metadata from Supabase.', error) }
    const phone = catalog.find((item) => item.slug === slug[1])
    if (phone) return {
      title: `${phone.brand} ${phone.model}`,
      description: `${phone.tagline} Check stock, ETB price, colors, storage, warranty and specifications at Siaab Mobile.`,
      openGraph: { title: `${phone.brand} ${phone.model} | Siaab Mobile`, description: phone.tagline, images: [phone.images[0] ?? '/og-image.svg'] },
    }
  }
  const titles: Record<string, string> = {
    '': 'Find your next phone',
    phones: 'Shop phones',
    upcoming: 'Upcoming phones',
    'trade-in': 'Trade in your phone',
    about: 'Our story',
    contact: 'Visit or contact us',
  }
  return { title: titles[slug.join('/')] ?? 'Page not found' }
}

function LoadingStorefront() {
  return <main className="container page-container" aria-busy="true"><p>Loading Siaab Mobile…</p></main>
}

export default async function StorefrontPage() {
  let catalog = phones
  let storeData: StoreData | null = null
  try {
    [catalog, storeData] = await Promise.all([getPublicCatalog(), getPublicStoreData()])
  } catch (error) {
    console.error('Supabase public data unavailable; rendering editable sample data.', error)
  }
  return <Suspense fallback={<LoadingStorefront />}><App initialPhones={catalog} {...(storeData ? { initialStoreData: storeData } : {})} /></Suspense>
}
