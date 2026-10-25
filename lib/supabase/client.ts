import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'

/**
 * Browser Supabase client. `createBrowserClient` already returns a singleton,
 * so calling this repeatedly is cheap. Import it only from client components.
 *
 * The vault talks to Supabase directly from the browser with the user's own
 * session; Row Level Security limits every request to that user's rows. No
 * server code ever handles vault data.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>
