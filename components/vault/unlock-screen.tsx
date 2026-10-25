'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Fingerprint, KeyRound } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { nextTwoFrames, sleep } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { assertKdfParamsAllowed } from '@/lib/crypto/kdf'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import { createClient } from '@/lib/supabase/client'
import { fetchPasskeys, touchPasskey } from '@/lib/vault/api'
import { openVault } from '@/lib/vault/items'
import {
  clearUnlockFailures,
  recordUnlockFailure,
  unlockWaitSeconds,
} from '@/lib/vault/auto-lock'
import type { KeysetRow } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { Dial, type DialState } from '@/components/brand/dial'
import { RecoveryFlow } from '@/components/vault/recovery-flow'
import { ResetVaultDialog } from '@/components/vault/reset-vault-dialog'

export interface UnlockScreenProps {
  userId: string
  email: string | null
  keyset: KeysetRow
  onUnlocked: (failedCount: number) => void
  onVaultReset: () => void
  onSignOut: () => void
}

type Mode = 'password' | 'recovery'

export function UnlockScreen({
  userId,
  email,
  keyset,
  onUnlocked,
  onVaultReset,
  onSignOut,
}: UnlockScreenProps) {
  const [mode, setMode] = useState<Mode>('password')
  const [password, setPassword] = useState('')
  const [dial, setDial] = useState<DialState>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capsLock, setCapsLock] = useState(false)
  const [wait, setWait] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const [quickUnlockReady, setQuickUnlockReady] = useState(false)
  const [quickBusy, setQuickBusy] = useState(false)

  // Count down the throttle delay after repeated wrong passwords.
  useEffect(() => {
    setWait(unlockWaitSeconds())
    const interval = setInterval(() => setWait(unlockWaitSeconds()), 500)
    return () => clearInterval(interval)
  }, [])

  // Quick unlock is optional and must never affect anything else.
  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const { isPasskeyApiAvailable } = await import('@/lib/crypto/passkey')
        if (!isPasskeyApiAvailable()) return
        const supabase = createClient()
        const rows = await fetchPasskeys(supabase, userId)
        if (active && rows.length > 0) setQuickUnlockReady(true)
      } catch {
        // No quick unlock on this device. The master password still works.
      }
    }
    void check()
    return () => {
      active = false
    }
  }, [userId])

  const finish = useCallback(
    async (vaultKey: CryptoKey) => {
      const supabase = createClient()
      setDial('success')
      await sleep(450)
      const failed = await openVault({ supabase, vaultKey, userId, email, keyset })
      clearUnlockFailures()
      onUnlocked(failed)
    },
    [email, keyset, onUnlocked, userId],
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (unlockWaitSeconds() > 0) return

    setBusy(true)
    setError(null)
    setDial('working')
    // Two frames, so the dial is already turning when Argon2id takes the thread.
    await nextTwoFrames()

    try {
      assertKdfParamsAllowed({
        memoryKiB: keyset.kdf_memory_kib,
        iterations: keyset.kdf_iterations,
        parallelism: keyset.kdf_parallelism,
      })

      const kek = await deriveMasterKek(password, fromBase64(keyset.kdf_salt), {
        memoryKiB: keyset.kdf_memory_kib,
        iterations: keyset.kdf_iterations,
        parallelism: keyset.kdf_parallelism,
      })

      const vaultKey = await unwrapVaultKey(
        keyset.wrapped_key,
        keyset.wrapped_key_iv,
        kek,
        vaultKeyAad(userId),
        false,
      )

      setPassword('')
      await finish(vaultKey)
    } catch (cause) {
      setDial('error')
      if (cause instanceof WrongPasswordError) {
        const delay = recordUnlockFailure()
        setWait(delay)
        setError('That master password didn’t open the vault. Check Caps Lock and try again.')
      } else {
        setError(
          cause instanceof Error ? cause.message : 'Couldn’t open the vault. Try again.',
        )
      }
      setBusy(false)
    }
  }

  const handleQuickUnlock = async () => {
    setQuickBusy(true)
    setError(null)
    try {
      const { unlockWithPasskey } = await import('@/lib/crypto/passkey')
      const supabase = createClient()
      const rows = await fetchPasskeys(supabase, userId)
      const { vaultKey, passkeyId } = await unlockWithPasskey(userId, rows)
      void touchPasskey(supabase, userId, passkeyId)
      await finish(vaultKey)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Quick unlock didn’t work. Use your master password.',
      )
      setQuickBusy(false)
    }
  }

  if (mode === 'recovery') {
    return (
      <RecoveryFlow
        userId={userId}
        email={email}
        keyset={keyset}
        onUnlocked={onUnlocked}
        onCancel={() => setMode('password')}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10">
      <Dial state={dial} />

      <h1 className="plate mt-6 text-center text-2xl text-ink">Unlock your vault</h1>
      {email ? (
        <p className="mt-2 text-center text-sm text-ink-muted">Signed in as {email}</p>
      ) : null}

      {quickUnlockReady ? (
        <Button
          size="lg"
          variant="primary"
          fullWidth
          className="mt-7"
          loading={quickBusy}
          onClick={handleQuickUnlock}
        >
          <Fingerprint aria-hidden="true" className="size-4" />
          Unlock with fingerprint or face
        </Button>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 w-full">
        <Field id="unlock-master" label="Master password" error={error}>
          <PasswordInput
            id="unlock-master"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            autoComplete="off"
            autoFocus
            required
            invalid={Boolean(error)}
            aria-describedby={error ? 'unlock-master-error' : undefined}
          />
        </Field>

        {capsLock ? (
          <p aria-live="polite" className="mt-2 text-sm font-medium text-warn">
            Caps Lock is on
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          className="mt-4"
          loading={busy}
          disabled={wait > 0 || password.length === 0}
        >
          {wait > 0 ? `Wait ${wait}s` : 'Unlock'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setMode('recovery')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-safe underline underline-offset-2"
        >
          <KeyRound aria-hidden="true" className="size-4" />
          Use recovery key
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="text-sm text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </div>

      <details className="mt-8 w-full rounded-panel border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
          Can’t unlock at all?
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
        </summary>
        <div className="border-t border-line px-4 py-4">
          <p className="text-sm text-ink-muted">
            If you have lost both your master password and your Recovery Key, nobody can open this
            vault — not even {APP_NAME}. You can start again with an empty vault, but everything in
            it will be deleted permanently.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setResetOpen(true)}>
            Reset vault
          </Button>
        </div>
      </details>

      <ResetVaultDialog
        open={resetOpen}
        userId={userId}
        onClose={() => setResetOpen(false)}
        onReset={onVaultReset}
      />
    </div>
  )
}
