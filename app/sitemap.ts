import type { MetadataRoute } from 'next'
import { phones } from '../src/data/phones'
import { shop } from '../src/data/shop'
import { getPublicCatalog } from '../src/lib/supabase/public-catalog'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/phones', '/brands', '/upcoming', '/trade-in', '/about', '/contact']
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? shop.siteUrl).replace(/\/$/, '')
  let catalog = phones
  try { catalog = await getPublicCatalog() } catch (error) { console.error('Could not load dynamic sitemap catalog.', error) }
  return [
    ...pages.map((page) => ({ url: `${baseUrl}${page}`, lastModified: new Date() })),
    ...catalog.map((phone) => ({ url: `${baseUrl}/phones/${phone.slug}`, lastModified: Number.isNaN(Date.parse(phone.createdAt)) ? new Date() : new Date(phone.createdAt) })),
  ]
}
