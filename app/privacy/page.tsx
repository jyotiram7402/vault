import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_NAME } from '@/lib/config'
import { SiteHeader } from '@/components/landing/site-header'
import { SiteFooter } from '@/components/landing/site-footer'

export const metadata: Metadata = {
  title: 'Privacy',
  description: `What ${APP_NAME} stores, what it cannot store, why there is no tracking, and how to delete your account.`,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="plate text-2xl text-ink">{title}</h2>
      <div className="prose-measure mt-3 flex flex-col gap-3 text-ink-muted">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="plate text-3xl text-ink sm:text-4xl">Privacy</h1>
        <p className="prose-measure mt-3 text-lg text-ink-muted">
          {APP_NAME} is built so that there is very little to be private about: almost everything is
          unreadable to the server by design.
        </p>

        <Section title="What is stored">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email address, so you can sign in and receive confirmation emails.</li>
            <li>A hashed form of your account password, handled by Supabase Auth.</li>
            <li>Encrypted rows: ciphertext, an IV, and a format version.</li>
            <li>Your key settings: a random salt and the Argon2id parameters.</li>
            <li>
              Two wrapped copies of your vault key — one opened by your master password, one by your
              Recovery Key — and a third per device if you turn on quick unlock.
            </li>
            <li>Timestamps for when rows were created and last changed.</li>
          </ul>
        </Section>

        <Section title="What is not stored">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your master password, or anything that could be used to work it out.</li>
            <li>Your Recovery Key.</li>
            <li>Any readable title, web address, username, password, card number or note.</li>
            <li>Device identifiers, IP-based profiles or behavioural data.</li>
          </ul>
        </Section>

        <Section title="No tracking">
          <p>
            There are no analytics, no advertising pixels, no session recorders and no third-party
            scripts. The content security policy blocks them outright, so one could not be added
            quietly.
          </p>
          <p>
            The app makes exactly two kinds of outbound request: to your own Supabase project, and —
            only when you press &ldquo;Check for breaches&rdquo; — to Have I Been Pwned, which
            receives five characters of a hash and nothing that identifies you.
          </p>
          <p>
            Website icons are never fetched. Asking a third party for favicons would reveal which
            sites you hold accounts on, so sites are drawn as monograms instead.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Two cookies: the Supabase session cookie that keeps you signed in, and a small
            preference cookie remembering whether you chose the light or dark theme. Neither is used
            for tracking, and there is no cookie banner because there is nothing to consent to.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            Settings → Danger zone → <strong className="text-ink">Delete account</strong> erases
            every encrypted row, every key wrapper and your sign-in record. It happens immediately
            and cannot be undone.
          </p>
          <p>
            You can also export an encrypted backup first, from Settings → Data, so you keep a copy
            you control.
          </p>
        </Section>

        <p className="border-t border-line pt-8 text-ink-muted">
          For the technical detail,{' '}
          <Link href="/security" className="font-medium text-safe underline underline-offset-2">
            see how your vault is sealed
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </>
  )
}
