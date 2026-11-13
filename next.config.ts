import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only the cPanel package builds a self-contained server; other hosts keep using next start.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: /.*/,
  images: { formats: ['image/avif', 'image/webp'] },
  // Sent with every response: keep visitors on HTTPS, stop other sites framing the sign-in pages, and stop browsers guessing file types.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=15552000' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    }]
  },
}

export default nextConfig
