import type { MetadataRoute } from 'next'
import { shop } from '../src/data/shop'
import { getPublicCatalog } from '../src/lib/db/public-catalog'
import type { Phone } from '../src/types'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/phones', '/brands', '/upcoming', '/trade-in', '/about', '/contact']
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? shop.siteUrl).replace(/\/$/, '')
  // If the database is down, list the fixed pages only rather than demo phones.
  let catalog: Phone[] = []
  try { catalog = await getPublicCatalog() } catch (error) { console.error('Could not load dynamic sitemap catalog.', error) }
  return [
    ...pages.map((page) => ({ url: `${baseUrl}${page}`, lastModified: new Date() })),
    ...catalog.map((phone) => ({ url: `${baseUrl}/phones/${phone.slug}`, lastModified: Number.isNaN(Date.parse(phone.createdAt)) ? new Date() : new Date(phone.createdAt) })),
  ]
}
