import type { MetadataRoute } from 'next'

// Chrome uses this when someone adds the shop to their home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SiaabMobile',
    short_name: 'SiaabMobile',
    description: 'Phones, trade-ins and honest advice at Siaab Mobile in Addis Ababa.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#12367f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
