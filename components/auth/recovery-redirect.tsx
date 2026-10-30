'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Catches an auth link that landed on the wrong page.
 *
 * Supabase builds a reset or confirmation link from whatever `redirect_to`
 * the original request supplied. A reset sent from the Supabase dashboard
 * supplies none, and one whose `redirect_to` is not on the allow-list is
 * discarded; both fall back to the project's Site URL. The session then
 * arrives in the URL fragment (`#access_token=…&type=recovery`), which no
 * server ever sees — so the landing page ignores it, and under /vault the
 * proxy bounces to /login with the fragment still attached and nobody to
 * read it.
 *
 * This moves such a fragment to the page that expects it. It reads the hash
 * only and never imports the Supabase client, so the landing page's bundle
 * stays as small as it was. A full navigation (not the router) is deliberate:
 * the destination gets a fresh client that reads the fragment on first load.
 */
export function RecoveryRedirect() {
  const pathname = usePathname()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.slice(1))

    // An expired or already-used link comes back as an error fragment.
    if (params.get('error') && pathname !== '/auth/error') {
      window.location.replace('/auth/error')
      return
    }

    if (params.get('type') === 'recovery' && params.get('access_token')) {
      if (pathname !== '/reset-password') window.location.replace(`/reset-password${hash}`)
    }
  }, [pathname])

  return null
}
