'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { nextTwoFrames, sleep } from '@/lib/utils'
import { toBase64 } from '@/lib/crypto/bytes'
import { KDF_DEFAULTS, recoveryVaultKeyAad, vaultKeyAad } from '@/lib/crypto/constants'
import {
  deriveMasterKek,
  deriveRecoveryKek,
  newKdfSalt,
  unwrapVaultKey,
  verifyWrappedKey,
  wrapVaultKey,
} from '@/lib/crypto/keys'
import {
  InvalidRecoveryKeyError,
  decodeRecoveryKey,
  looksLikeRecoveryKey,
} from '@/lib/crypto/recovery-key'
import { estimateStrength, masterPasswordProblem } from '@/lib/password/strength'
import { createClient } from '@/lib/supabase/client'
import { updateKeyset } from '@/lib/vault/api'
import { openVault } from '@/lib/vault/items'
import { clearUnlockFailures } from '@/lib/vault/auto-lock'
import type { KeysetRow } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Dial, type DialState } from '@/components/brand/dial'
import { StrengthMeter } from '@/components/vault/strength-meter'

/**
 * Recovery: open the vault with the Recovery Key, then set a new master
 * password.
 *
 * The vault key itself never changes — only the wrapper around it — so every
 * existing item stays readable without being re-encrypted.
 */

type Step = 'key' | 'password' | 'done'

export interface RecoveryFlowProps {
  userId: string
  email: string | null
  keyset: KeysetRow
  onUnlocked: (failedCount: number) => void
  onCancel: () => void
}

export function RecoveryFlow({
  userId,
  email,
  keyset,
  onUnlocked,
  onCancel,
}: RecoveryFlowProps) {
  const [step, setStep] = useState<Step>('key')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dial, setDial] = useState<DialState>('idle')

  /** Extractable only for the length of this flow, then dropped. */
  const [recoveredKey, setRecoveredKey] = useState<CryptoKey | null>(null)

  const strength = useMemo(
    () => estimateStrength(password, { email: email ?? undefined }),
    [password, email],
  )

  const handleCheckKey = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setDial('working')
    await nextTwoFrames()

    try {
      const secret = decodeRecoveryKey(recoveryKey)
      const kek = await deriveRecoveryKek(secret)
      const vaultKey = await unwrapVaultKey(
        keyset.recovery_wrapped_key,
        keyset.recovery_wrapped_key_iv,
        kek,
        recoveryVaultKeyAad(userId),
        true,
      )
      setRecoveredKey(vaultKey)
      setRecoveryKey('')
      setDial('idle')
      setStep('password')
    } catch (cause) {
      setDial('error')
      setError(
        cause instanceof InvalidRecoveryKeyError
          ? cause.message
          : 'That recovery key didn’t work. Check for typos.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!recoveredKey) return

    const problem = masterPasswordProblem(password, confirm, email)
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError(null)
    setDial('working')
    await nextTwoFrames()

    try {
      const salt = newKdfSalt()
      const kek = await deriveMasterKek(password, salt, KDF_DEFAULTS)
      const aad = vaultKeyAad(userId)
      const wrapped = await wrapVaultKey(recoveredKey, kek, aad)
      await verifyWrappedKey(wrapped, kek, aad)

      const supabase = createClient()
      const updated = await updateKeyset(supabase, userId, keyset.key_version, {
        kdf_salt: toBase64(salt),
        kdf_memory_kib: KDF_DEFAULTS.memoryKiB,
        kdf_iterations: KDF_DEFAULTS.iterations,
        kdf_parallelism: KDF_DEFAULTS.parallelism,
        wrapped_key: wrapped.wrapped,
        wrapped_key_iv: wrapped.iv,
      })

      // Session key is always the non-extractable copy.
      const sessionKey = await unwrapVaultKey(wrapped.wrapped, wrapped.iv, kek, aad, false)

      setRecoveredKey(null)
      setPassword('')
      setConfirm('')

      setDial('success')
      await sleep(450)

      const failed = await openVault({
        supabase,
        vaultKey: sessionKey,
        userId,
        email,
        keyset: updated,
      })
      clearUnlockFailures()
      setStep('done')
      // Let the "make a new Recovery Key" note be seen before handing over.
      await sleep(1400)
      onUnlocked(failed)
    } catch (cause) {
      setDial('error')
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t save your new master password.',
      )
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10">
      <Dial
        state={dial}
        statusText={
          dial === 'working'
            ? step === 'key'
              ? 'Checking your recovery key…'
              : 'Making your new key…'
            : dial === 'error'
              ? 'That didn’t work'
              : dial === 'success'
                ? 'Unlocked'
                : ''
        }
      />

      {step === 'key' ? (
        <form onSubmit={handleCheckKey} className="mt-6 w-full">
          <h1 className="plate text-center text-2xl text-ink">Use your recovery key</h1>
          <p className="mt-3 text-ink-muted">
            Enter the 32-character key from your Emergency Kit. Spacing and capitals don’t matter.
          </p>

          <Field
            id="recovery-key"
            label="Recovery Key"
            error={error}
            className="mt-6"
          >
            <Input
              id="recovery-key"
              value={recoveryKey}
              onChange={(event) => setRecoveryKey(event.target.value)}
              autoComplete="off"
              autoFocus
              secret
              className="mono tracking-wide"
              placeholder="7KQ2-M9XD-…"
              invalid={Boolean(error)}
              aria-describedby={error ? 'recovery-key-error' : undefined}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            className="mt-4"
            loading={busy}
            disabled={!looksLikeRecoveryKey(recoveryKey)}
          >
            <KeyRound aria-hidden="true" className="size-4" />
            Open with recovery key
          </Button>

          <button
            type="button"
            onClick={onCancel}
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-sm text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to master password
          </button>
        </form>
      ) : null}

      {step === 'password' ? (
        <form onSubmit={handleSetPassword} className="mt-6 w-full">
          <h1 className="plate text-center text-2xl text-ink">Choose a new master password</h1>
          <p className="mt-3 text-ink-muted">
            Your vault is open. Pick a new master password — the old one stops working straight
            away.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Field id="recovery-password" label="New master password">
                <PasswordInput
                  id="recovery-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </Field>
              {password ? <StrengthMeter result={strength} detailed /> : null}
            </div>

            <Field id="recovery-confirm" label="Confirm master password" error={error}>
              <PasswordInput
                id="recovery-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(error)}
                aria-describedby={error ? 'recovery-confirm-error' : undefined}
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy}>
              Save and unlock
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="mt-6 w-full text-center">
          <h1 className="plate text-2xl text-ink">Vault unlocked</h1>
          <p className="mt-3 text-ink-muted">
            Your old Recovery Key still works. Create a new one in Settings → Recovery Key so the
            old Emergency Kit can’t open your vault.
          </p>
        </div>
      ) : null}
    </div>
  )
}
