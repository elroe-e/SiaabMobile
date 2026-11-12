import { NextResponse, type NextRequest } from 'next/server'

// Runs before admin pages and APIs. Full session checks happen in requireAdmin on the server;
// here we only send signed-out visitors to the sign-in page and refuse changes sent from other websites.
const SESSION_COOKIE = 'siaab_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return NextResponse.next()
    const origin = request.headers.get('origin')
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    if (!origin || !host || new URL(origin).host !== host) return NextResponse.json({ error: 'Request blocked.' }, { status: 403 })
    return NextResponse.next()
  }
  if (pathname === '/admin/login' || request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next()
  const login = request.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*', '/api/auth/:path*'] }
