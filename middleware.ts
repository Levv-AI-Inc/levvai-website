import { NextRequest, NextResponse } from 'next/server'

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get('sessionid')?.value)
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isHomePath = pathname === '/home' || pathname.startsWith('/home/')

  if (!isHomePath) {
    return NextResponse.next()
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/auth/login'
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/home/:path*'],
}
