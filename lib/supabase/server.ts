import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Server Supabase client for route handlers and Server Components.
 *
 * On the server, decide who the user is only with `supabase.auth.getClaims()`.
 * Never trust `getSession()` in server code.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components can't set cookies. The proxy refreshes sessions,
          // so this is safe to ignore.
        }
      },
    },
  })
}
