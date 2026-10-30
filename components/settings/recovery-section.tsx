'use client'

import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { siteUrl } from '@/lib/env'
import { nextTwoFrames } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { recoveryVaultKeyAad, vaultKeyAad } from '@/lib/crypto/constants'
import {
  WrongPasswordError,
  deriveMasterKek,
  deriveRecoveryKek,
  unwrapVaultKey,
  verifyWrappedKey,
  wrapVaultKey,
} from '@/lib/crypto/keys'
import { generateRecoveryKey } from '@/lib/crypto/recovery-key'
import { createClient } from '@/lib/supabase/client'
import { updateKeyset } from '@/lib/vault/api'
import { holdLockOnHide } from '@/lib/vault/auto-lock'
import { setKeyset } from '@/lib/vault/store'
import { buildEmergencyKit, downloadEmergencyKit } from '@/lib/vault/export'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { CopyButton } from '@/components/vault/copy-button'
import { SecretText } from '@/components/vault/secret-text'
import { SettingsSection } from '@/components/settings/section'

export function RecoverySection() {
  const { toast } = useToast()
  const { userId, email, keyset } = useVault()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  // While the new key is on screen the old one has already stopped working.
  // A print or save dialog can momentarily hide the tab on some platforms, and
  // an immediate lock here would throw the only copy away. Hold it off.
  useEffect(() => {
    if (!created) return
    return holdLockOnHide()
  }, [created])

  const site = siteUrl()
  const kitText = created
    ? buildEmergencyKit({
        appName: APP_NAME,
        siteUrl: site,
        email: email ?? 'your account',
        recoveryKey: created,
      })
    : ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId || !keyset) return

    setBusy(true)
    setError(null)
    await nextTwoFrames()

    try {
      // Re-ask for the master password: this needs an extractable vault key.
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
        true,
      )

      const recoveryKey = generateRecoveryKey()
      const recoveryKek = await deriveRecoveryKek(recoveryKey.bytes)
      const aad = recoveryVaultKeyAad(userId)
      const wrapped = await wrapVaultKey(vaultKey, recoveryKek, aad)
      await verifyWrappedKey(wrapped, recoveryKek, aad)

      const supabase = createClient()
      const updated = await updateKeyset(supabase, userId, keyset.key_version, {
        recovery_wrapped_key: wrapped.wrapped,
        recovery_wrapped_key_iv: wrapped.iv,
      })
      setKeyset(updated)

      setPassword('')
      setCreated(recoveryKey.text)
      setOpen(false)
      toast({ message: 'New Recovery Key created', tone: 'success' })
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t create a new Recovery Key. Nothing was changed.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      title="Recovery Key"
      description="The only way into your vault if you forget your master password."
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">
            Here is your new Recovery Key. Save it now — it is not shown again, and your previous
            key no longer works.
          </p>
          <div className="rounded-panel border border-brass/50 bg-bg p-4">
            <SecretText value={created} size="lg" className="tracking-wide" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={created} label="Recovery Key" />
            <Button
              size="sm"
              onClick={() => {
                downloadEmergencyKit({
                  appName: APP_NAME,
                  siteUrl: site,
                  email: email ?? 'your account',
                  recoveryKey: created,
                })
                toast({ message: 'Emergency Kit downloaded', tone: 'success' })
              }}
            >
              <Download aria-hidden="true" className="size-4" />
              Download Emergency Kit
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" />
              Print
            </Button>
            <Button size="sm" variant="primary" onClick={() => setCreated(null)}>
              I’ve saved it
            </Button>
          </div>
          <div className="print-only print-root">{kitText}</div>
        </div>
      ) : !open ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Creating a new key immediately stops the old one working. Do it if your Emergency Kit
            may have been seen by someone else.
          </p>
          <Button className="self-start" onClick={() => setOpen(true)}>
            Create a new Recovery Key
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            id="recovery-master"
            label="Master password"
            hint="Needed to unlock your vault key so it can be re-wrapped."
            error={error}
          >
            <PasswordInput
              id="recovery-master"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              autoFocus
              required
              invalid={Boolean(error)}
              aria-describedby={error ? 'recovery-master-error' : 'recovery-master-hint'}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy}>
              Create new Recovery Key
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                setPassword('')
                setError(null)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  )
}
