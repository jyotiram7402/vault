import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env'

export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string>,
) {
  // Rebuild from request.headers each time: request.cookies.set() updates the cookie header.
  const next = () => {
    const headers = new Headers(request.headers)
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value)
    return NextResponse.next({ request: { headers } })
  }

  let response = next()
  if (!isSupabaseConfigured) return { response, userId: null as string | null }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = next()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        if (cacheHeaders) {
          Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value))
        }
      },
    },
  })

  // Run nothing between createServerClient and getClaims.
  let userId: string | null = null
  try {
    const { data } = await supabase.auth.getClaims()
    userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  } catch {
    userId = null
  }
  return { response, userId }
}
