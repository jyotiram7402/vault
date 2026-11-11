import Link from 'next/link'
import { APP_NAME, REPO_URL } from '@/lib/config'
import { TAP_TARGET, cn } from '@/lib/utils'

const FOOTER_LINK = cn('text-sm text-ink-muted transition-colors hover:text-ink', TAP_TARGET)

export function SiteFooter() {
  return (
    <footer className="safe-bottom mt-20 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-ink-muted">
          {APP_NAME} — sealed on your device before anything leaves it.
        </p>
        {/* The taller row gap on touch screens keeps the tap areas apart when
            the links wrap onto a second line. */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 pointer-coarse:gap-y-6"
        >
          <Link href="/privacy" className={FOOTER_LINK}>
            Privacy
          </Link>
          <Link href="/security" className={FOOTER_LINK}>
            Security
          </Link>
          <Link href="/generator" className={FOOTER_LINK}>
            Password generator
          </Link>
          {REPO_URL ? (
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
              Source code
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  )
}
