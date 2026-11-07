import { NextRequest, NextResponse } from 'next/server'

import { isTenantHost, normalizeHost } from './lib/tenant'

const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/approvals',
  '/compliance',
  '/cw',
  '/flow-studio',
  '/home',
  '/inbox',
  '/my-items',
  '/payments',
  '/requests',
  '/runs',
  '/services',
  '/suppliers',
  '/workers',
]

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get('sessionid')?.value)
}

function getRequestHost(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]
  return normalizeHost(
    forwardedHost || request.headers.get('host') || request.nextUrl.hostname,
  )
}

function isInternalPath(pathname: string): boolean {
  return INTERNAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function loginRedirect(request: NextRequest, nextPath: string) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/auth/login'
  loginUrl.search = `?next=${encodeURIComponent(nextPath)}`
  return NextResponse.redirect(loginUrl)
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const nextPath = pathname + search

  if (pathname === '/api/session') {
    // Flow Studio's Playwright run answers the session without Django. Only exists with LEVV_E2E=1.
    if (process.env.LEVV_E2E === '1') {
      return NextResponse.rewrite(new URL('/api/test/session', request.url))
    }
    return NextResponse.next()
  }

  if (pathname === '/' && isTenantHost(getRequestHost(request))) {
    if (!hasSessionCookie(request)) {
      return loginRedirect(request, '/home')
    }

    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/home'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  if (!isInternalPath(pathname) || hasSessionCookie(request)) {
    return NextResponse.next()
  }

  return loginRedirect(request, nextPath)
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/api/session',
    '/approvals/:path*',
    '/compliance/:path*',
    '/cw/:path*',
    '/flow-studio/:path*',
    '/home/:path*',
    '/inbox/:path*',
    '/my-items/:path*',
    '/payments/:path*',
    '/requests/:path*',
    '/runs/:path*',
    '/services/:path*',
    '/suppliers/:path*',
    '/workers/:path*',
  ],
}
