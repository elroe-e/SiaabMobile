import type { Metadata, Viewport } from 'next'
import './globals.css'

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    </head>
    <body>{children}</body>
  </html>
}
