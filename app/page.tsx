import Link from 'next/link'
import { APP_DESCRIPTION } from '@/lib/config'
import { SiteHeader } from '@/components/landing/site-header'
import { SiteFooter } from '@/components/landing/site-footer'
import { CipherDemo } from '@/components/landing/cipher-demo'
import { SealSteps } from '@/components/landing/seal-steps'
import { FeatureList } from '@/components/landing/feature-list'
import { Faq } from '@/components/landing/faq'

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-overlay"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main">
        <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
            <div>
              <h1 className="plate text-4xl text-ink sm:text-5xl lg:text-6xl">
                A safe for every password you own.
              </h1>
              <p className="prose-measure mt-5 text-lg text-ink-muted">{APP_DESCRIPTION}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center rounded-btn bg-primary px-5 font-semibold text-on-primary transition-[filter] hover:brightness-110"
                >
                  Create your vault
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-btn border border-line bg-surface px-5 font-semibold text-ink transition-colors hover:bg-surface-2"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-5 text-sm text-ink-muted">
                Free, open source, and no tracking of any kind.
              </p>
            </div>

            <CipherDemo />
          </div>
        </section>

        <SealSteps />
        <FeatureList />
        <Faq />

        <section className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <div className="rounded-panel border border-line bg-surface px-5 py-8 sm:px-8">
            <h2 className="plate text-2xl text-ink">Ready when you are</h2>
            <p className="prose-measure mt-2 text-ink-muted">
              Creating a vault takes about a minute: an account, a master password, and a Recovery
              Key you keep somewhere safe.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-12 items-center rounded-btn bg-primary px-5 font-semibold text-on-primary transition-[filter] hover:brightness-110"
            >
              Create your vault
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
