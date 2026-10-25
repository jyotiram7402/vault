'use client'

import { useMemo, useState } from 'react'
import { nextTwoFrames } from '@/lib/utils'
import { fromBase64, toBase64 } from '@/lib/crypto/bytes'
import { KDF_DEFAULTS, vaultKeyAad } from '@/lib/crypto/constants'
import {
  WrongPasswordError,
  deriveMasterKek,
  newKdfSalt,
  unwrapVaultKey,
  verifyWrappedKey,
  wrapVaultKey,
} from '@/lib/crypto/keys'
import {
  estimateStrength,
  masterPasswordCaution,
  masterPasswordProblem,
} from '@/lib/password/strength'
import { createClient } from '@/lib/supabase/client'
import { updateKeyset } from '@/lib/vault/api'
import { setKeyset } from '@/lib/vault/store'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { StrengthMeter } from '@/components/vault/strength-meter'
import { SettingsSection } from '@/components/settings/section'

/**
 * Changing the master password re-wraps the vault key; the vault key itself
 * never changes. That is why nothing has to be re-encrypted, and why quick
 * unlock keeps working afterwards.
 */
export function MasterPasswordSection() {
  const { toast } = useToast()
  const { userId, email, keyset } = useVault()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(
    () => estimateStrength(next, { email: email ?? undefined }),
    [next, email],
  )
  const caution = useMemo(() => masterPasswordCaution(next, email), [next, email])

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
    setOpen(false)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId || !keyset) return

    const problem = masterPasswordProblem(next, confirm, email)
    if (problem) {
      setError(problem)
      return
    }
    if (next === current) {
      setError('That is already your master password.')
      return
    }

    setBusy(true)
    setError(null)
    await nextTwoFrames()

    try {
      const aad = vaultKeyAad(userId)

      // Unwrap as extractable only inside this flow, then drop it.
      const oldKek = await deriveMasterKek(current, fromBase64(keyset.kdf_salt), {
        memoryKiB: keyset.kdf_memory_kib,
        iterations: keyset.kdf_iterations,
        parallelism: keyset.kdf_parallelism,
      })
      const vaultKey = await unwrapVaultKey(
        keyset.wrapped_key,
        keyset.wrapped_key_iv,
        oldKek,
        aad,
        true,
      )

      const salt = newKdfSalt()
      const newKek = await deriveMasterKek(next, salt, KDF_DEFAULTS)
      const wrapped = await wrapVaultKey(vaultKey, newKek, aad)
      await verifyWrappedKey(wrapped, newKek, aad)

      const supabase = createClient()
      const updated = await updateKeyset(supabase, userId, keyset.key_version, {
        kdf_salt: toBase64(salt),
        kdf_memory_kib: KDF_DEFAULTS.memoryKiB,
        kdf_iterations: KDF_DEFAULTS.iterations,
        kdf_parallelism: KDF_DEFAULTS.parallelism,
        wrapped_key: wrapped.wrapped,
        wrapped_key_iv: wrapped.iv,
      })
      setKeyset(updated)

      reset()
      toast({ message: 'Master password changed', tone: 'success' })
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That current master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t change your master password. Nothing was changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      title="Master password"
      description="The one that opens your vault. Changing it does not change your sign-in password."
    >
      {!open ? (
        <Button onClick={() => setOpen(true)}>Change master password</Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field id="mp-current" label="Current master password">
            <PasswordInput
              id="mp-current"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Field id="mp-next" label="New master password">
              <PasswordInput
                id="mp-next"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            {next ? (
              <>
                <StrengthMeter result={strength} detailed />
                {caution ? <p className="text-sm text-warn">{caution}</p> : null}
              </>
            ) : null}
          </div>

          <Field id="mp-confirm" label="Confirm new master password" error={error}>
            <PasswordInput
              id="mp-confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
              invalid={Boolean(error)}
              aria-describedby={error ? 'mp-confirm-error' : undefined}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy}>
              Change master password
            </Button>
            <Button onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  )
}
