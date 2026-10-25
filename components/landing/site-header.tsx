import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Public header. Signed-in visitors get "Open vault" instead of the sign-up
 * call to action, decided on the server with getClaims().
 */
export async function SiteHeader() {
  let signedIn = false
  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getClaims()
      signedIn = typeof data?.claims?.sub === 'string'
    } catch {
      signedIn = false
    }
  }

  return (
    <header className="safe-top border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-btn" aria-label="Tijori, home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href="/#how-it-works"
            className="hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            How it works
          </Link>
          <Link
            href="/generator"
            className="hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Password generator
          </Link>

          {signedIn ? (
            <Link
              href="/vault"
              className="inline-flex h-11 items-center rounded-btn bg-primary px-4 text-sm font-semibold text-on-primary transition-[filter] hover:brightness-110"
            >
              Open vault
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-btn px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-btn bg-primary px-4 text-sm font-semibold text-on-primary transition-[filter] hover:brightness-110"
              >
                Create your vault
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
