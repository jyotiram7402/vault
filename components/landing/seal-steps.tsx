const STEPS = [
  {
    title: 'You type your master password on your device.',
    body: 'It is never sent to us, never stored, and never written to disk. It exists in the memory of your browser tab and nowhere else.',
  },
  {
    title: 'Argon2id stretches it into a key.',
    body: 'That is the dial you will see turning: 64 MiB of memory and three passes, deliberately slow, so guessing it is expensive even for someone with your encrypted data.',
  },
  {
    title: 'AES-256-GCM locks every entry with a key only you can open.',
    body: 'Each item gets its own random IV and is tied to your account and that item, so no entry can be swapped for another.',
  },
  {
    title: 'We store the locked result. Nothing else.',
    body: 'The database holds ciphertext, an IV, and the time a row changed. No titles, no addresses, no usernames.',
  },
]

export function SealSteps() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="plate text-3xl text-ink sm:text-4xl">How your vault is sealed</h2>
      <ol className="mt-8 flex flex-col gap-px overflow-hidden rounded-panel border border-line bg-line">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4 bg-surface p-5 sm:gap-6 sm:p-6">
            <span
              aria-hidden="true"
              className="plate tabular mt-0.5 shrink-0 text-2xl text-brass"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 className="plate-tight text-lg text-ink">{step.title}</h3>
              <p className="prose-measure mt-1 text-ink-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
