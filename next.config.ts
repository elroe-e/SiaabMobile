import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only the cPanel package builds a self-contained server; other hosts keep using next start.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: /.*/,
  images: { formats: ['image/avif', 'image/webp'] },
}

export default nextConfig
