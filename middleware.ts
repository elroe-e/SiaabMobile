import { NextResponse, type NextRequest } from 'next/server'

// Runs before admin pages and APIs. Full session checks happen in requireAdmin on the server;
// here we only send signed-out visitors to the sign-in page and refuse changes sent from other websites.
const SESSION_COOKIE = 'siaab_session'

const hostName = (value: string | null | undefined) => value?.split(',')[0]?.trim().toLowerCase().replace(/:\d+$/, '') || null

/** True when the browser says the request came from this site. Ports are ignored, since proxies often drop them. */
export function sameSite(request: Request): boolean {
  let origin: string
  try { origin = new URL(request.headers.get('origin') ?? '').hostname.toLowerCase() } catch { return false }
  let configured: string | null = null
  try { configured = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').hostname.toLowerCase() } catch { /* not set */ }
  const allowed = [hostName(request.headers.get('x-forwarded-host')), hostName(request.headers.get('host')), configured, configured ? `www.${configured}` : null]
  return Boolean(origin) && allowed.includes(origin)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return NextResponse.next()
    return sameSite(request) ? NextResponse.next() : NextResponse.json({ error: 'Request blocked.' }, { status: 403 })
  }
  if (pathname === '/admin/login' || request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next()
  const login = request.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*', '/api/auth/:path*'] }
