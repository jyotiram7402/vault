'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { Button } from '@/components/ui/button'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Only the digest, never the message: an error message could contain
    // fragments of whatever the failing code was holding.
    if (error.digest) console.error(`${APP_NAME} error digest:`, error.digest)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <TriangleAlert aria-hidden="true" className="size-9 text-warn" />
      <h1 className="plate mt-6 text-3xl text-ink">Something went wrong</h1>
      <p className="prose-measure mt-2 text-ink-muted">
        Your vault is unaffected: nothing is decrypted on this screen. Try again, or reload the page
        to lock and start fresh.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-4 font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          Go home
        </Link>
      </div>
      {error.digest ? (
        <p className="tabular mt-6 text-xs text-ink-muted">Reference: {error.digest}</p>
      ) : null}
    </main>
  )
}
