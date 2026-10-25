import Link from 'next/link'
import { LogoMark } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-10 text-safe" />
      <h1 className="plate mt-6 text-3xl text-ink">That page isn’t here</h1>
      <p className="prose-measure mt-2 text-ink-muted">
        The address may be wrong, or the page may have moved.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary transition-[filter] hover:brightness-110"
        >
          Go home
        </Link>
        <Link
          href="/vault"
          className="inline-flex h-11 items-center rounded-btn border border-line bg-surface px-4 font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          Open vault
        </Link>
      </div>
    </main>
  )
}
