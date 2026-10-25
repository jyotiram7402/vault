import {
  Dices,
  Download,
  Fingerprint,
  Gauge,
  Lock,
  Smartphone,
  Timer,
  Vault,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Lock,
    title: 'Encrypted on your device',
    body: 'Your master password never leaves the browser tab you typed it into.',
  },
  {
    icon: Smartphone,
    title: 'Phone and computer',
    body: 'Installs like an app, with a bottom tab bar on mobile and three panes on desktop.',
  },
  {
    icon: Dices,
    title: 'Password generator',
    body: 'Random strings or readable passphrases, with the real entropy shown.',
  },
  {
    icon: Gauge,
    title: 'Vault health',
    body: 'Finds weak, reused and ageing passwords, and checks them against known breaches.',
  },
  {
    icon: Fingerprint,
    title: '2FA codes',
    body: 'Keeps your authenticator codes beside the login they belong to.',
  },
  {
    icon: Download,
    title: 'Import what you have',
    body: 'Brings passwords in from Chrome, Edge, Firefox, Safari and Bitwarden.',
  },
  {
    icon: Timer,
    title: 'Auto-lock and clipboard clearing',
    body: 'Locks itself when you walk away and wipes copied passwords after 30 seconds.',
  },
  {
    icon: Vault,
    title: 'Free and open source',
    body: 'Run it on free hosting, or host it yourself and trust nobody at all.',
  },
]

export function FeatureList() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="plate text-3xl text-ink sm:text-4xl">What you get</h2>
      <ul className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex gap-3.5">
            <feature.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-safe" />
            <div className="min-w-0">
              <h3 className="plate-tight text-base text-ink">{feature.title}</h3>
              <p className="mt-0.5 text-ink-muted">{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
