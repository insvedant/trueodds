import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const isUSDomain = hostname.includes('trueodds.us')

  // On US domain — rewrite root to US homepage
  if (isUSDomain && pathname === '/') {
    return NextResponse.rewrite(new URL('/us-home', request.url))
  }

  // On CA domain — detect US visitors and add header so page can show banner
  if (!isUSDomain && pathname === '/') {
    const country = request.headers.get('x-vercel-ip-country') || ''
    if (country === 'US') {
      const res = NextResponse.next()
      res.headers.set('x-visitor-country', 'US')
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/((?!_next|api|favicon|_static).*)'],
}
