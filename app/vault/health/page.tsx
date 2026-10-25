'use client'

import { useMemo, useState } from 'react'
import { computeHealth } from '@/lib/vault/health'
import { useVault } from '@/lib/vault/use-vault'
import { HealthScore } from '@/components/health/health-score'
import { IssueList } from '@/components/health/issue-list'
import { BreachScan } from '@/components/health/breach-scan'

/**
 * Vault health. Everything here is computed from items already decrypted in
 * memory; only the breach check makes a network request, and only on demand.
 */
export default function VaultHealthPage() {
  const { items } = useVault()
  const [breaches, setBreaches] = useState<Map<string, number> | null>(null)

  const report = useMemo(
    () => computeHealth(items, breaches ?? undefined),
    [items, breaches],
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="plate text-2xl text-ink">Vault health</h1>
      <p className="prose-measure mt-2 text-ink-muted">
        Weak, reused and ageing passwords, found on this device without sending anything anywhere.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <HealthScore report={report} scanned={breaches !== null} />
        <BreachScan
          items={items}
          onResults={setBreaches}
          scanned={breaches !== null}
          foundCount={report.breached.length}
        />
        <IssueList report={report} scanned={breaches !== null} />
      </div>
    </div>
  )
}
