import type { MetadataRoute } from 'next'
import { shop } from '../src/data/shop'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? shop.siteUrl).replace(/\/$/, '')
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }], sitemap: `${baseUrl}/sitemap.xml` }
}
