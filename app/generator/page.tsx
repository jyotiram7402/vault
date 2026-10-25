import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/landing/site-header'
import { SiteFooter } from '@/components/landing/site-footer'
import { PasswordGenerator } from '@/components/generator/password-generator'

export const metadata: Metadata = {
  title: 'Password generator',
  description:
    'Generate strong random passwords and readable passphrases in your browser. Nothing is sent anywhere.',
}

export default function PublicGeneratorPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="plate text-3xl text-ink sm:text-4xl">Password generator</h1>
        <p className="prose-measure mt-3 text-ink-muted">
          Generated in your browser with the operating system&rsquo;s random number generator.
          Nothing is sent anywhere, and nothing is kept once you close this page.
        </p>

        <div className="mt-8">
          <PasswordGenerator />
        </div>

        <p className="mt-10 border-t border-line pt-6 text-ink-muted">
          A strong password only helps if you can keep hundreds of them.{' '}
          <Link href="/signup" className="font-medium text-safe underline underline-offset-2">
            Keep your passwords in a vault
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </>
  )
}
