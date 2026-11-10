import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'

export const metadata: Metadata = {
  title: 'That link didn’t work',
  robots: { index: false, follow: false },
}

export default function AuthErrorPage() {
  return (
    <AuthCard title="That link didn’t work">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-ink-muted">
          <p>It may have expired, or something opened it before you did.</p>
          <p>Confirming a new account? It has probably worked already, so try signing in.</p>
          <p>
            Resetting your password? Send a new email and type the code from it instead of pressing
            the button. Only the newest email counts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary transition-[filter] hover:brightness-110"
          >
            Sign in
          </Link>
          <Link
            href="/forgot-password"
            className="inline-flex h-11 items-center rounded-btn border border-line-strong bg-surface px-4 font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Send a new link
          </Link>
        </div>
      </div>
    </AuthCard>
  )
}
