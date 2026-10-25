import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { DM_Sans, Manrope, Noto_Sans_Ethiopic } from 'next/font/google'
import { LANGUAGE_COOKIE, parseLanguage } from '../src/i18n/language'
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
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = { themeColor: '#f7f8fa' }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = parseLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value)
  return <html lang={lang} className={`${dmSans.variable} ${manrope.variable} ${ethiopic.variable}`}>
    <body>{children}</body>
  </html>
}
