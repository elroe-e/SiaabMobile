import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { DM_Sans, Manrope, Noto_Sans_Ethiopic } from 'next/font/google'
import { LANGUAGE_COOKIE, parseLanguage } from '../src/i18n/language'
import { THEME_COOKIE, parseTheme, themeBootScript } from '../src/lib/theme'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-dm-sans' })
const ethiopic = Noto_Sans_Ethiopic({ subsets: ['ethiopic'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-ethiopic' })
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-manrope' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://siaabmobile.com'),
  title: { default: 'Siaab Mobile — Find your next phone', template: '%s | Siaab Mobile' },
  description: 'Find trusted phones, browse upcoming devices and estimate your trade-in at Siaab Mobile in Addis Ababa.',
  openGraph: {
    title: 'Siaab Mobile — Find your next phone',
    description: 'Thoughtful phone shopping, trusted warranties and easy in-store trade-ins.',
    type: 'website',
    images: ['/og-image.svg'],
  },
  twitter: { card: 'summary_large_image' },
  applicationName: 'SiaabMobile',
  appleWebApp: { capable: true, title: 'SiaabMobile', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f7f8fa' }, { media: '(prefers-color-scheme: dark)', color: '#0d121b' }] }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies()
  const lang = parseLanguage(jar.get(LANGUAGE_COOKIE)?.value)
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value)
  return <html lang={lang} {...(theme ? { 'data-theme': theme } : {})} suppressHydrationWarning className={`${dmSans.variable} ${manrope.variable} ${ethiopic.variable}`}>
    <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
    <body>{children}</body>
  </html>
}
