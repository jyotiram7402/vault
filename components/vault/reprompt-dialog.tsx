'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { nextTwoFrames } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import { REPROMPT_GRACE_MINUTES, markReprompted } from '@/lib/vault/reprompt'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

/**
 * "Enter your master password to show this."
 *
 * The check is real: it derives the key from what was typed and unwraps the
 * stored wrapped key with it. A wrong password fails the unwrap. The key that
 * comes out is thrown away immediately — the session already has one — so this
 * only ever answers yes or no.
 *
 * That costs an Argon2id run, which is deliberately about a second, so one
 * success covers a few minutes rather than every field.
 */
export function RepromptDialog({
  open,
  onClose,
  onVerified,
}: {
  open: boolean
  onClose: () => void
  onVerified: () => void
}) {
  const { userId, keyset } = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId || !keyset) return

    setBusy(true)
    setError(null)
    await nextTwoFrames()

    try {
      const kek = await deriveMasterKek(password, fromBase64(keyset.kdf_salt), {
        memoryKiB: keyset.kdf_memory_kib,
        iterations: keyset.kdf_iterations,
        parallelism: keyset.kdf_parallelism,
      })
      // Succeeds only with the right password. The key is not kept.
      await unwrapVaultKey(
        keyset.wrapped_key,
        keyset.wrapped_key_iv,
        kek,
        vaultKeyAad(userId),
        false,
      )

      markReprompted()
      setPassword('')
      onVerified()
      onClose()
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t check that password.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Enter your master password"
      description="Needed before a secret is shown on screen."
      size="sm"
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="reprompt-form" variant="primary" loading={busy}>
            <Eye aria-hidden="true" className="size-4" />
            Show
          </Button>
        </>
      }
    >
      <form id="reprompt-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="reprompt-password"
          label="Master password"
          hint={`You won’t be asked again for ${REPROMPT_GRACE_MINUTES} minutes, or until the vault locks.`}
          error={error}
        >
          <PasswordInput
            id="reprompt-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            autoFocus
            required
            invalid={Boolean(error)}
            aria-describedby={error ? 'reprompt-password-error' : 'reprompt-password-hint'}
          />
        </Field>
      </form>
    </Dialog>
  )
}
