import type { Metadata } from 'next'
import { VaultGate } from '@/components/vault/vault-gate'

export const metadata: Metadata = {
  title: 'Vault',
  // The vault must never be indexed, whatever robots.txt says.
  robots: { index: false, follow: false, nocache: true },
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <VaultGate>{children}</VaultGate>
}
