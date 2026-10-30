'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { fetchPasskeys } from '@/lib/vault/api'
import {
  autoLockLabel,
  clipboardLabel,
  getServerSettings,
  readSettings,
  subscribeSettings,
} from '@/lib/vault/settings'
import { useVault } from '@/lib/vault/use-vault'
import { SettingsSection } from '@/components/settings/section'

/**
 * One glance at every protection and whether it is on.
 *
 * Deliberately a checklist, not a score. A number invites gaming and hides
 * which thing is actually off; a list with the off items marked tells you
 * exactly what to go and fix, and links to where you fix it.
 */

interface Check {
  label: string
  /** True when the protection is active. Ignored for optional rows. */
  ok: boolean
  value: string
  /** Where to turn it on. */
  href: string
  /** Optional protections are shown but never counted against you. */
  optional?: boolean
}

type Async<T> = { state: 'loading' } | { state: 'ready'; value: T }

export function SecurityStatus() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, getServerSettings)
  const { userId } = useVault()
  const [twoFactor, setTwoFactor] = useState<Async<boolean>>({ state: 'loading' })
  const [passkeys, setPasskeys] = useState<Async<number>>({ state: 'loading' })

  useEffect(() => {
    let active = true
    const supabase = createClient()

    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => {
        if (!active) return
        const on = Boolean(data?.totp?.some((factor) => factor.status === 'verified'))
        setTwoFactor({ state: 'ready', value: on })
      })
      .catch(() => {
        if (active) setTwoFactor({ state: 'ready', value: false })
      })

    if (userId) {
      fetchPasskeys(supabase, userId)
        .then((rows) => {
          if (active) setPasskeys({ state: 'ready', value: rows.length })
        })
        .catch(() => {
          if (active) setPasskeys({ state: 'ready', value: 0 })
        })
    }

    return () => {
      active = false
    }
  }, [userId])

  const checks: Check[] = [
    {
      label: 'Two-factor sign-in',
      ok: twoFactor.state === 'ready' && twoFactor.value,
      value:
        twoFactor.state === 'loading'
          ? 'Checking…'
          : twoFactor.value
            ? 'On'
            : 'Off — a stolen sign-in password would be enough to reach your encrypted data',
      href: '#two-factor',
    },
    {
      label: 'Lock when switching away',
      ok: settings.lockOnHide,
      value: settings.lockOnHide ? 'On' : 'Off — the vault stays open in a hidden tab',
      href: '#security',
    },
    {
      label: 'Lock after inactivity',
      ok: settings.autoLockMinutes <= 15,
      value:
        settings.autoLockMinutes <= 15
          ? autoLockLabel(settings.autoLockMinutes)
          : `${autoLockLabel(settings.autoLockMinutes)} — a long window on a shared device`,
      href: '#security',
    },
    {
      label: 'Master password before reveal or copy',
      ok: settings.requireMasterToReveal,
      value: settings.requireMasterToReveal
        ? 'On'
        : 'Off — anyone at your unlocked screen can copy a password',
      href: '#security',
    },
    {
      label: 'Privacy screen',
      ok: settings.privacyScreen,
      value: settings.privacyScreen ? 'On' : 'Off — secrets stay readable when the window loses focus',
      href: '#security',
    },
    {
      label: 'Clipboard clearing',
      ok: settings.clipboardSeconds > 0,
      value:
        settings.clipboardSeconds > 0
          ? clipboardLabel(settings.clipboardSeconds)
          : 'Never — a copied password stays on the clipboard',
      href: '#security',
    },
    {
      label: 'Quick unlock devices',
      ok: passkeys.state === 'ready' && passkeys.value > 0,
      value:
        passkeys.state === 'loading'
          ? 'Checking…'
          : passkeys.value === 0
            ? 'None set up (optional)'
            : `${passkeys.value} ${passkeys.value === 1 ? 'device' : 'devices'}`,
      href: '#quick-unlock',
      optional: true,
    },
  ]

  const counted = checks.filter((check) => !check.optional)
  const onCount = counted.filter((check) => check.ok).length
  const allOn = onCount === counted.length

  return (
    <SettingsSection
      title="Security status"
      description={
        allOn
          ? 'Every protection is on.'
          : `${onCount} of ${counted.length} protections on. The ones marked below are worth turning on.`
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {checks.map((check) => {
          const warn = !check.ok && !check.optional
          return (
            <li key={check.label} className="flex items-start gap-3 py-3">
              {check.ok ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
              ) : check.optional ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warn" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{check.label}</p>
                <p className={cn('text-sm', warn ? 'text-warn' : 'text-ink-muted')}>{check.value}</p>
              </div>
              {!check.ok ? (
                <a
                  href={check.href}
                  className="shrink-0 text-sm font-medium text-safe underline underline-offset-2"
                >
                  {check.optional ? 'Set up' : 'Turn on'}
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </SettingsSection>
  )
}
