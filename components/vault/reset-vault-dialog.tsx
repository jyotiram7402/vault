'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteAllItemRows, deleteAllPasskeys, deleteKeyset } from '@/lib/vault/api'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * The last resort: someone has lost both their master password and their
 * Recovery Key, so the data is already unreachable. This clears it out so they
 * can start again. The account itself stays.
 */
export function ResetVaultDialog({
  open,
  userId,
  onClose,
  onReset,
}: {
  open: boolean
  userId: string
  onClose: () => void
  onReset: () => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async () => {
    if (confirmation !== 'RESET') {
      setError('Type RESET exactly to confirm.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      // Items first, then passkeys, then the keyset: if this is interrupted,
      // the keyset is the last thing to go, so a retry still has a vault row.
      await deleteAllItemRows(supabase, userId)
      await deleteAllPasskeys(supabase, userId)
      await deleteKeyset(supabase, userId)
      setConfirmation('')
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
        setConfirmation('')
        setError(null)
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

        <Field id="reset-confirm" label="Type RESET to confirm" error={error}>
          <Input
            id="reset-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            autoComplete="off"
            secret
            className="mono"
            invalid={Boolean(error)}
            aria-describedby={error ? 'reset-confirm-error' : undefined}
          />
        </Field>
      </div>
    </Dialog>
  )
}
