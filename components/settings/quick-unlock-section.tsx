'use client'

import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Trash2 } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { formatDate, formatRelative, nextTwoFrames } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import { createClient } from '@/lib/supabase/client'
import { deletePasskey, fetchPasskeys, insertPasskey } from '@/lib/vault/api'
import { useVault } from '@/lib/vault/use-vault'
import type { PasskeyRow } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { SettingsSection } from '@/components/settings/section'

/**
 * Quick unlock with a passkey.
 *
 * Entirely optional and isolated: if WebAuthn or the PRF extension is missing,
 * this section simply doesn't appear, and nothing else changes.
 */
export function QuickUnlockSection() {
  const { toast } = useToast()
  const { userId, email, keyset } = useVault()

  const [supported, setSupported] = useState<boolean | null>(null)
  const [rows, setRows] = useState<PasskeyRow[]>([])
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('This device')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const supabase = createClient()
      setRows(await fetchPasskeys(supabase, userId))
    } catch {
      // Listing devices is not critical; the section still offers enrolment.
    }
  }, [userId])

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const { isPasskeyApiAvailable, prfCapability } = await import('@/lib/crypto/passkey')
        if (!isPasskeyApiAvailable()) {
          if (active) setSupported(false)
          return
        }
        const capability = await prfCapability()
        // null means "can't tell": offer it and handle the failure if it comes.
        if (active) setSupported(capability !== false)
      } catch {
        if (active) setSupported(false)
      }
    }
    void check()
    void load()
    return () => {
      active = false
    }
  }, [load])

  if (supported === null || supported === false) return null

  const handleEnroll = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId || !keyset) return

    setBusy(true)
    setError(null)
    await nextTwoFrames()

    try {
      // The master password is asked for again: enrolment needs an
      // extractable vault key, which is dropped as soon as this finishes.
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

      const { enrollPasskey } = await import('@/lib/crypto/passkey')
      const enrolment = await enrollPasskey({
        userId,
        email: email ?? `${APP_NAME} user`,
        appName: APP_NAME,
        vaultKey,
      })

      const supabase = createClient()
      await insertPasskey(supabase, {
        user_id: userId,
        credential_id: enrolment.credentialId,
        prf_salt: enrolment.prfSalt,
        wrapped_key: enrolment.wrappedKey.wrapped,
        wrapped_key_iv: enrolment.wrappedKey.iv,
        label: label.trim().slice(0, 60) || 'This device',
      })

      setPassword('')
      setOpen(false)
      await load()
      toast({ message: 'Quick unlock is set up on this device', tone: 'success' })
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t set up quick unlock on this device.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (row: PasskeyRow) => {
    if (!userId) return
    try {
      const supabase = createClient()
      await deletePasskey(supabase, userId, row.id)
      await load()
      toast({ message: `${row.label} removed`, tone: 'success' })
    } catch (cause) {
      toast({
        message: cause instanceof Error ? cause.message : 'Couldn’t remove that device.',
        tone: 'danger',
      })
    }
  }

  return (
    <SettingsSection
      title="Quick unlock"
      description="Open your vault with a fingerprint, face or device PIN. It never replaces your master password."
    >
      {rows.length > 0 ? (
        <ul className="mb-4 flex flex-col divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <Fingerprint aria-hidden="true" className="size-5 shrink-0 text-safe" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{row.label}</p>
                <p className="text-xs text-ink-muted">
                  Added {formatDate(row.created_at)}
                  {row.last_used_at ? ` · Last used ${formatRelative(row.last_used_at)}` : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => void handleRemove(row)}>
                <Trash2 aria-hidden="true" className="size-4" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!open ? (
        <Button onClick={() => setOpen(true)}>Set up on this device</Button>
      ) : (
        <form onSubmit={handleEnroll} className="flex flex-col gap-4">
          <Field id="qu-label" label="Name this device">
            <Input
              id="qu-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="My phone"
            />
          </Field>

          <Field id="qu-master" label="Master password" error={error}>
            <PasswordInput
              id="qu-master"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              required
              invalid={Boolean(error)}
              aria-describedby={error ? 'qu-master-error' : undefined}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy}>
              <Fingerprint aria-hidden="true" className="size-4" />
              Set up quick unlock
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
