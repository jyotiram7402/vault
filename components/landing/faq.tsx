import { ChevronDown } from 'lucide-react'

const QUESTIONS = [
  {
    question: 'Can you see my passwords?',
    answer:
      'No. Everything is encrypted in your browser before it is sent. The database holds ciphertext, a random IV and the time a row last changed. We have no way to turn that back into readable data, and neither does anyone who obtains a copy of it.',
  },
  {
    question: 'What if I forget my master password?',
    answer:
      'Use the Recovery Key you saved when you set the vault up: choose "Use recovery key" on the unlock screen, enter it, and pick a new master password. If you have lost both, nobody can open the vault — not us, not anyone. That is the cost of real zero-knowledge encryption, and we tell you so before setup finishes.',
  },
  {
    question: 'What if I lose my phone?',
    answer:
      'Nothing is stored on the device itself. Sign in on another device with your account password and unlock with your master password, and everything is there. If your phone had quick unlock set up, remove that device from Settings so its fingerprint can no longer open the vault.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes. It runs on the free tiers of Vercel and Supabase, and the source is open. There are no trackers, no analytics and no third-party scripts, so there is nothing to sell.',
  },
  {
    question: 'Where is my data stored?',
    answer:
      'In a Postgres database on Supabase, in whichever region the person who deployed this app chose. Row Level Security means each account can only reach its own rows, and the only readable fields are timestamps.',
  },
]

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="plate text-3xl text-ink sm:text-4xl">Questions</h2>
      <div className="mt-8 overflow-hidden rounded-panel border border-line">
        {QUESTIONS.map((item, index) => (
          <details
            key={item.question}
            className={index > 0 ? 'border-t border-line bg-surface' : 'bg-surface'}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="plate-tight text-base text-ink">{item.question}</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
            </summary>
            <p className="prose-measure px-5 pb-5 text-ink-muted">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
