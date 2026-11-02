import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { Button } from '@/components/ui/button'
import { confirmEmailLink } from './actions'

export const metadata: Metadata = {
  title: 'Continue',
  robots: { index: false, follow: false },
}

/**
 * Where every email link lands.
 *
 * Opening this page changes nothing. The token is only used when the person
 * presses the button, which is a POST to a server action. That matters
 * because the token works once: some mail clients and corporate scanners
 * fetch every link in an email before anyone reads it, and a GET route that
 * verified on open would be spent before the person ever saw it.
 *
 * Replaces the earlier GET route handler at this same path. Next.js forbids
 * page.tsx and route.ts in one folder, so route.ts must not come back.
 */

function copyFor(type: string): { title: string; body: string; button: string } {
  switch (type) {
    case 'recovery':
      return {
        title: 'Reset your sign-in password',
        body: 'Press the button to continue to the page where you choose a new one. This changes your sign-in password only; your master password stays the same.',
        button: 'Choose a new password',
      }
    case 'email_change':
      return {
        title: 'Confirm your new email',
        body: 'Press the button to finish changing the address on your account.',
        button: 'Confirm new email',
      }
    default:
      return {
        title: 'Confirm your email',
        body: 'Press the button to confirm this address and go to your vault.',
        button: 'Confirm my email',
      }
  }
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = typeof params.type === 'string' ? params.type : ''
  const next = typeof params.next === 'string' ? params.next : ''

  if (!tokenHash || !type) {
    return (
      <AuthCard title="This link doesn’t work">
        <div className="flex flex-col gap-5">
          <p className="text-ink-muted">It’s missing the part that identifies you. Ask for a new email.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary transition-[filter] hover:brightness-110"
            >
              Sign in
            </Link>
            <Link
              href="/forgot-password"
              className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-4 font-semibold text-ink transition-colors hover:bg-surface-2"
            >
              Send a new link
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  const copy = copyFor(type)

  return (
    <AuthCard title={copy.title} subtitle={copy.body}>
      <form action={confirmEmailLink} className="flex flex-col gap-4">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {copy.button}
        </Button>
      </form>
    </AuthCard>
  )
}
