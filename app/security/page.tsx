import type { Metadata } from 'next'
import Link from 'next/link'
import { APP_NAME } from '@/lib/config'
import { SiteHeader } from '@/components/landing/site-header'
import { SiteFooter } from '@/components/landing/site-footer'

export const metadata: Metadata = {
  title: 'How your vault is sealed',
  description:
    'In plain language: what is encrypted, with what, what the server can see, and what happens if you forget your master password.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="plate text-2xl text-ink">{title}</h2>
      <div className="prose-measure mt-3 flex flex-col gap-3 text-ink-muted">{children}</div>
    </section>
  )
}

export default function SecurityPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="plate text-3xl text-ink sm:text-4xl">How your vault is sealed</h1>
        <p className="prose-measure mt-3 text-lg text-ink-muted">
          No jargon, no hand-waving. Here is exactly what happens to your data.
        </p>

        <Section title="Two passwords, two jobs">
          <p>
            Your <strong className="text-ink">account password</strong> signs you in. Supabase
            stores it in the usual hashed form and can send you a reset link if you forget it.
          </p>
          <p>
            Your <strong className="text-ink">master password</strong> opens the vault. It is never
            sent anywhere, never stored, and cannot be reset by anyone. If you forget it, the
            Recovery Key you saved at setup is the only way back in.
          </p>
          <p>Please do not use the same password for both.</p>
        </Section>

        <Section title="What is encrypted, and with what">
          <p>
            Your master password goes through <strong className="text-ink">Argon2id</strong> (64 MiB
            of memory, three passes) to produce a key. That key never encrypts your data directly:
            it wraps a separate, randomly generated <strong className="text-ink">vault key</strong>,
            so you can change your master password without re-encrypting everything.
          </p>
          <p>
            Every item is encrypted with <strong className="text-ink">AES-256-GCM</strong> using the
            vault key, a fresh random IV, and extra authenticated data that binds the ciphertext to
            your account and to that specific item. Ciphertext cannot be moved between items or
            between accounts.
          </p>
          <p>
            Before anything is saved, the app unwraps the key it just produced and encrypts and
            decrypts a test value with it. A key that fails that check is never written, because a
            broken key would lock you out permanently.
          </p>
        </Section>

        <Section title="What the server actually sees">
          <p>For each item, the database holds four things:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>a random id</li>
            <li>the ciphertext</li>
            <li>the IV</li>
            <li>the time the row was created and last changed</li>
          </ul>
          <p>
            Titles, web addresses, usernames, tags, categories and favourites all live{' '}
            <em>inside</em> the ciphertext. Payloads are padded to a multiple of 256 bytes before
            encryption, so even the length of a password is blurred.
          </p>
          <p>
            The server also knows your email address (you sign in with it), roughly how many items
            you have, and when you last changed them.
          </p>
        </Section>

        <Section title="What this app never does">
          <ul className="list-disc space-y-1 pl-5">
            <li>Send your master password, or anything derived from it, over the network.</li>
            <li>
              Fetch website icons. That would tell a third party which sites you have accounts on,
              so sites are shown as generated monograms instead.
            </li>
            <li>Load third-party scripts, analytics or trackers of any kind.</li>
            <li>Write keys or decrypted data to localStorage, cookies, IndexedDB or any log.</li>
          </ul>
          <p>
            Breach checking is the one outbound request, and only when you press the button: the
            first five characters of a scrambled fingerprint of each password go to Have I Been
            Pwned, which returns hundreds of possible matches for the comparison to happen here.
          </p>
        </Section>

        <Section title="Honest limits">
          <p>
            Malware or a keylogger on your device defeats any password manager, including this one.
          </p>
          <p>
            Whoever hosts the app could serve modified JavaScript. The defences are that the source
            is open, the content security policy is strict and allows no third-party scripts, and
            you can host it yourself if you want to trust nobody.
          </p>
          <p>
            Losing both your master password and your Recovery Key means the data is gone. Nobody
            can recover it.
          </p>
        </Section>

        <p className="border-t border-line pt-8 text-ink-muted">
          The full threat model lives in SECURITY.md in the {APP_NAME} repository.{' '}
          <Link href="/privacy" className="font-medium text-safe underline underline-offset-2">
            Read the privacy page
          </Link>{' '}
          for what is stored about your account.
        </p>
      </main>

      <SiteFooter />
    </>
  )
}
