import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { buildContentSecurityPolicy } from '@/lib/security/csp'

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildContentSecurityPolicy(nonce)
  const { response, userId } = await updateSession(request, {
    'x-nonce': nonce,
    'Content-Security-Policy': csp,
  })

  const { pathname, search } = request.nextUrl
  const isVault = pathname === '/vault' || pathname.startsWith('/vault/')

  if (isVault && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return carrySession(response, NextResponse.redirect(url))
  }
  if (userId && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/vault'
    url.search = ''
    return carrySession(response, NextResponse.redirect(url))
  }

  response.headers.set('Content-Security-Policy', csp)
  if (isVault) response.headers.set('Cache-Control', 'private, no-store')
  return response
}

// Copy refreshed auth cookies and cache headers onto a different response.
function carrySession(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
  return to
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|pwa/|favicon.ico|icon.svg|apple-icon|opengraph-image|manifest.webmanifest|robots.txt|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|js|css|map)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
