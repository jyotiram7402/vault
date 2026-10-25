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
        <p className="text-ink-muted">It may have expired or already been used.</p>
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
