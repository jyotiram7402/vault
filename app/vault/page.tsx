import { Suspense } from 'react'
import { VaultView } from '@/components/vault/vault-view'

export default function VaultPage() {
  // VaultView reads ?item=, ?new=, ?filter= and ?import=, so it needs Suspense.
  return (
    <Suspense fallback={null}>
      <VaultView />
    </Suspense>
  )
}
