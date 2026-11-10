import { createClient } from '@supabase/supabase-js'
import { STORAGE_PREFIX } from '@/lib/config'
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/env'
import { authErrorMessage } from '@/lib/supabase/auth-errors'

/**
 * Check a sign-in password without touching the session this tab is using.
 *
 * Signing in again on the main client would replace that session, and with
 * two-factor on the replacement is only aal1 — Row Level Security then
 * refuses the vault data until a code is entered again. So the check runs on
 * a throwaway client that keeps its session in memory, and that session is
 * ended on the server straight afterwards.
 *
 * Browser only. Use it wherever "someone at a signed-in computer" must not be
 * enough: resetting the vault, changing the sign-in password.
 */

export type SignInCheck =
  | { ok: true }
  | { ok: false; wrongPassword: boolean; message: string }

export async function verifySignInPassword(email: string, password: string): Promise<SignInCheck> {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `${STORAGE_PREFIX}-password-check`,
    },
  })

  try {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (!error) return { ok: true }
    const wrongPassword =
      error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)
    return { ok: false, wrongPassword, message: authErrorMessage(error).message }
  } catch {
    return {
      ok: false,
      wrongPassword: false,
      message: 'Can’t reach the server. Check your connection and try again.',
    }
  } finally {
    // 'local' matters: the default scope would sign the person out of every
    // device, this one included.
    try {
      await client.auth.signOut({ scope: 'local' })
    } catch {
      // No session was created, or the network dropped. Nothing to undo.
    }
  }
}
