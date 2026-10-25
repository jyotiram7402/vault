'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import type { VaultItem } from '@/lib/vault/types'
import { uniquePasswords } from '@/lib/vault/health'
import { Button } from '@/components/ui/button'

/**
 * The breach check.
 *
 * Only the first five hex characters of each password's SHA-1 hash leave the
 * device, and only when the button is pressed. Results live in memory and are
 * gone the moment the vault locks.
 */

export interface BreachScanProps {
  items: readonly VaultItem[]
  onResults: (results: Map<string, number>) => void
  scanned: boolean
  foundCount: number
}

export function BreachScan({ items, onResults, scanned, foundCount }: BreachScanProps) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const hasScannedRef = useRef(false)

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      // Drop the cached ranges when this page goes away — but only if a scan
      // actually ran. Otherwise this would download the hibp chunk on unmount
      // purely to clear a cache that was never populated.
      if (hasScannedRef.current) {
        void import('@/lib/password/hibp').then((module) => module.clearBreachCache())
      }
    }
  }, [])

  const start = async () => {
    const passwords = uniquePasswords(items)
    if (passwords.length === 0) return

    const controller = new AbortController()
    controllerRef.current = controller
    hasScannedRef.current = true

    setRunning(true)
    setError(null)
    setProgress({ done: 0, total: passwords.length })

    try {
      const { checkPasswords } = await import('@/lib/password/hibp')
      const results = await checkPasswords(passwords, {
        signal: controller.signal,
        onProgress: setProgress,
      })
      if (!controller.signal.aborted) onResults(results)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Couldn’t reach the breach database. Try again later.',
        )
      }
    } finally {
      controllerRef.current = null
      setRunning(false)
    }
  }

  const cancel = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setRunning(false)
  }

  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="rounded-panel border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        {scanned && foundCount === 0 ? (
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
        ) : (
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="plate-tight text-base text-ink">Check for breaches</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Compares your passwords against Have I Been Pwned, the public database of passwords
            exposed in known breaches.
          </p>

          {running ? (
            <div className="mt-4">
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Checking passwords"
                className="h-1.5 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="tabular mt-2 text-sm text-ink-muted" aria-live="polite">
                Checked {progress.done} of {progress.total}
              </p>
              <Button size="sm" className="mt-3" onClick={cancel}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void start()}>
                {scanned ? 'Check again' : 'Check for breaches'}
              </Button>
              {scanned ? (
                <p className="text-sm text-ink-muted" aria-live="polite">
                  {foundCount === 0
                    ? 'None of your passwords appear in the database.'
                    : `${foundCount} ${foundCount === 1 ? 'password appears' : 'passwords appear'} in known breaches.`}
                </p>
              ) : null}
            </div>
          )}

          {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            Only the first 5 characters of a scrambled fingerprint of each password are sent to Have
            I Been Pwned. Your passwords never leave this device.
          </p>
        </div>
      </div>
    </section>
  )
}
