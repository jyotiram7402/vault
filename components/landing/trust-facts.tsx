import Link from 'next/link'

/**
 * Four plain facts, straight under the hero.
 *
 * A trust strip only earns trust if every line on it can be checked, so there
 * are no badges, logos or testimonials here: each fact is something the code
 * or the response headers will confirm. Keep it that way. If one stops being
 * true, remove it rather than soften it.
 */
const FACTS = [
  {
    value: 'AES-256-GCM',
    label: 'Every item is sealed on your device before anything is sent.',
  },
  {
    value: 'Argon2id',
    label: '64 MiB and three passes make your master password slow to guess.',
  },
  {
    value: 'No trackers',
    label: 'No analytics and no third-party scripts, on any page.',
  },
  {
    value: 'Open source',
    label: 'Read the code, or host it yourself and trust nobody.',
  },
]

export function TrustFacts() {
  return (
    <section
      aria-labelledby="trust-facts-title"
      className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6"
    >
      <h2 id="trust-facts-title" className="sr-only">
        What protects your vault
      </h2>
      <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.value} className="bg-surface p-5">
            <dt className="plate-tight text-base text-ink">{fact.value}</dt>
            <dd className="mt-1 text-sm text-ink-muted">{fact.label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink-muted">
        <Link href="/security" className="font-medium text-safe underline underline-offset-2">
          Read how each of these works
        </Link>
      </p>
    </section>
  )
}
