'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ShieldCheck } from 'lucide-react'
import { nextTwoFrames } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import {
  REPROMPT_GRACE_MINUTES,
  getServerRepromptPending,
  isRepromptPending,
  resolveReprompt,
  subscribeRepromptRequest,
} from '@/lib/vault/reprompt'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'

/**
 * "Enter your master password" — shown whenever something asks to reveal or
 * copy a stored secret and the grace period has run out.
 *
 * Rendered once, in the app shell, and driven by the request store. That is
 * what lets a row in the list and the command palette use it too, not just the
 * item detail pane.
 *
 * The check is real: it derives a key from what was typed and unwraps the
 * stored wrapped key with it, so a wrong password fails. The key that comes
 * out is discarded — the session already has one — so this only ever answers
 * yes or no.
 */
export function RepromptHost() {
  const open = useSyncExternalStore(
    subscribeRepromptRequest,
    isRepromptPending,
    getServerRepromptPending,
  )
  const { userId, keyset } = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Never leave a typed master password sitting in state between requests.
  useEffect(() => {
    if (!open) {
      setPassword('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const deny = () => resolveReprompt(false)

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

      setPassword('')
      // Starts the grace period and releases whatever was waiting.
      resolveReprompt(true)
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t check that password.',
      )
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={deny}
      title="Enter your master password"
      description="Needed before a secret is shown or copied."
      size="sm"
      footer={
        <>
          <Button onClick={deny} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="reprompt-form" variant="primary" loading={busy}>
            <ShieldCheck aria-hidden="true" className="size-4" />
            Continue
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
