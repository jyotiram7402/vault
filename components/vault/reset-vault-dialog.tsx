'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { verifySignInPassword } from '@/lib/supabase/verify-password'
import { deleteAllItemRows, deleteAllPasskeys, deleteKeyset } from '@/lib/vault/api'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'

/**
 * The last resort: someone has lost both their master password and their
 * Recovery Key, so the data is already unreachable. This clears it out so they
 * can start again. The account itself stays.
 *
 * It sits on the lock screen, where anyone at a signed-in computer can reach
 * it, so it asks for the sign-in password first. Whoever has really lost the
 * master password still knows that one, or can reset it by email.
 */
export function ResetVaultDialog({
  open,
  userId,
  email,
  onClose,
  onReset,
}: {
  open: boolean
  userId: string
  email: string | null
  onClose: () => void
  onReset: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clear = () => {
    setConfirmation('')
    setSignInPassword('')
    setError(null)
  }

  const handleReset = async () => {
    if (!email) {
      setError('This account has no email address to check a password against.')
      return
    }
    if (!signInPassword) {
      setError('Enter your sign-in password.')
      return
    }
    if (confirmation !== 'RESET') {
      setError('Type RESET exactly to confirm.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const check = await verifySignInPassword(email, signInPassword)
      if (!check.ok) {
        setError(
          check.wrongPassword
            ? 'That sign-in password is wrong. It’s the one you use on the sign-in page, not your master password.'
            : check.message,
        )
        return
      }

      const supabase = createClient()
      // Items first, then passkeys, then the keyset: if this is interrupted,
      // the keyset is the last thing to go, so a retry still has a vault row.
      await deleteAllItemRows(supabase, userId)
      await deleteAllPasskeys(supabase, userId)
      await deleteKeyset(supabase, userId)
      clear()
      onReset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t reset the vault.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        clear()
        onClose()
      }}
      title="Reset vault"
      description="Everything in this vault will be deleted permanently and cannot be recovered."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReset} loading={busy}>
            Delete everything
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          Every item, every key and every quick-unlock device for this account will be erased. There
          is no backup and no undo. Your sign-in stays, so you can set up a fresh vault afterwards.
        </p>

        <Field
          id="reset-sign-in-password"
          label="Sign-in password"
          hint="The one you use on the sign-in page, not your master password."
        >
          <PasswordInput
            id="reset-sign-in-password"
            value={signInPassword}
            onChange={(event) => setSignInPassword(event.target.value)}
            autoComplete="current-password"
            mono={false}
            aria-describedby="reset-sign-in-password-hint"
          />
        </Field>

        <Field id="reset-confirm" label="Type RESET to confirm">
          <Input
            id="reset-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            autoComplete="off"
            secret
            className="mono"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
