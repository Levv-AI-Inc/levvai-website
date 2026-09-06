import { NextRequest, NextResponse } from 'next/server'

import { isTenantHost, normalizeHost } from './lib/tenant'

const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/approvals',
  '/cw',
  '/home',
  '/my-items',
  '/payments',
  '/requests',
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
    '/approvals/:path*',
    '/cw/:path*',
    '/home/:path*',
    '/my-items/:path*',
    '/payments/:path*',
    '/requests/:path*',
    '/services/:path*',
    '/suppliers/:path*',
    '/workers/:path*',
  ],
}
