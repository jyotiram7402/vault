import Link from 'next/link'
import { APP_NAME, REPO_URL } from '@/lib/config'

export function SiteFooter() {
  return (
    <footer className="safe-bottom mt-20 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-muted">
          {APP_NAME} — your vault is sealed before it leaves your device.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/privacy" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Privacy
          </Link>
          <Link href="/security" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Security
          </Link>
          <Link href="/generator" className="text-sm text-ink-muted transition-colors hover:text-ink">
            Password generator
          </Link>
          {REPO_URL ? (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              Source code
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  )
}
