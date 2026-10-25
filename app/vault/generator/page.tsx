import type { Metadata } from 'next'
import { PasswordGenerator } from '@/components/generator/password-generator'

export const metadata: Metadata = {
  title: 'Password generator',
  robots: { index: false, follow: false },
}

export default function VaultGeneratorPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="plate text-2xl text-ink">Password generator</h1>
      <p className="prose-measure mt-2 text-ink-muted">
        Generated on this device. Use the copy button, or paste it straight into an item.
      </p>
      <div className="mt-6">
        <PasswordGenerator />
      </div>
    </div>
  )
}
