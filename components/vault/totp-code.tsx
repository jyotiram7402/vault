'use client'

import { useEffect, useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  formatTotpCode,
  generateTotp,
  parseTotpInput,
  runTotpSelfTest,
  totpSecondsRemaining,
  type TotpConfig,
} from '@/lib/totp'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/vault/copy-button'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * A live 2FA code with a countdown ring.
 * One interval per component, paused while the page is hidden.
 */
export function TotpCode({ secret, className }: { secret: string; className?: string }) {
  const [code, setCode] = useState('')
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const config = useMemo<TotpConfig | null>(() => {
    try {
      return parseTotpInput(secret)
    } catch {
      return null
    }
  }, [secret])

  useEffect(() => {
    void runTotpSelfTest()
  }, [])

  useEffect(() => {
    if (!config) {
      setError('This 2FA setup key can’t be read. Edit the item to fix it.')
      return
    }
    setError(null)

    let cancelled = false
    let lastCounter = -1

    const tick = async () => {
      if (cancelled || document.visibilityState === 'hidden') return
      const now = Date.now()
      const counter = Math.floor(now / 1000 / config.period)
      setRemaining(totpSecondsRemaining(config, now))
      if (counter === lastCounter) return
      lastCounter = counter
      try {
        const next = await generateTotp(config, now)
        if (!cancelled) setCode(next)
      } catch {
        if (!cancelled) setError('This 2FA setup key can’t be read. Edit the item to fix it.')
      }
    }

    void tick()
    const interval = setInterval(() => void tick(), 500)
    const onVisible = () => void tick()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [config])

  if (error) {
    return (
      <p className={cn('flex items-center gap-2 text-sm text-warn', className)}>
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        {error}
      </p>
    )
  }

  const progress = config ? remaining / config.period : 0
  const expiringSoon = remaining <= 5

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'mono secret tabular text-lg',
          expiringSoon ? 'text-warn' : 'text-ink',
        )}
      >
        {code ? formatTotpCode(code) : '••• •••'}
      </span>

      <span
        className="relative inline-flex size-6 items-center justify-center"
        title={`${Math.ceil(remaining)} seconds left`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 -rotate-90">
          <circle cx="12" cy="12" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="2" />
          <circle
            cx="12"
            cy="12"
            r={RADIUS}
            fill="none"
            stroke={expiringSoon ? 'var(--warn)' : 'var(--safe)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <span className="sr-only">{Math.ceil(remaining)} seconds until this code changes</span>
      </span>

      {code ? <CopyButton value={code} label="2FA code" size="sm" /> : null}
    </div>
  )
}
