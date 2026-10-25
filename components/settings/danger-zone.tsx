'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import { createClient } from '@/lib/supabase/client'
import {
  deleteAllItemRows,
  deleteAllPasskeys,
  deleteKeyset,
} from '@/lib/vault/api'
import { postSessionMessage } from '@/lib/vault/broadcast'
import { lock, replaceItems } from '@/lib/vault/store'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useToast } from '@/components/ui/toast'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

export function DangerZone() {
  const router = useRouter()
  const { toast } = useToast()
  const { userId, items, keyset } = useVault()

  const [clearOpen, setClearOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetDialogs = () => {
    setConfirmation('')
    setMasterPassword('')
    setError(null)
    setBusy(false)
  }

  const clearItems = async () => {
    if (!userId) return
    if (confirmation !== 'DELETE') {
      setError('Type DELETE exactly to confirm.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      await deleteAllItemRows(supabase, userId)
      replaceItems([])
      setClearOpen(false)
      resetDialogs()
      toast({ message: 'All items deleted', tone: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t delete your items.')
      setBusy(false)
    }
  }

  const deleteAccount = async () => {
    if (!userId || !keyset) return
    if (confirmation !== 'DELETE') {
      setError('Type DELETE exactly to confirm.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()

      // Prove they are the vault owner, not just someone at an open laptop.
      const kek = await deriveMasterKek(masterPassword, fromBase64(keyset.kdf_salt), {
        memoryKiB: keyset.kdf_memory_kib,
        iterations: keyset.kdf_iterations,
        parallelism: keyset.kdf_parallelism,
      })
      await unwrapVaultKey(
        keyset.wrapped_key,
        keyset.wrapped_key_iv,
        kek,
        vaultKeyAad(userId),
        false,
      )

      await deleteAllItemRows(supabase, userId)
      await deleteAllPasskeys(supabase, userId)
      await deleteKeyset(supabase, userId)

      let accountRemoved = true
      try {
        const { error: rpcError } = await supabase.rpc('delete_my_account')
        if (rpcError) accountRemoved = false
      } catch {
        accountRemoved = false
      }

      lock('signout')
      postSessionMessage({ type: 'signout' })
      try {
        await supabase.auth.signOut()
      } catch {
        // Nothing left to protect locally; the key is already gone.
      }

      toast({
        message: accountRemoved
          ? 'Your account and vault have been deleted.'
          : 'Your vault data is erased. Your sign-in couldn’t be removed automatically; the app owner can remove it in Supabase.',
        tone: accountRemoved ? 'success' : 'danger',
        duration: 10000,
      })
      router.replace('/')
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t delete your account.',
      )
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsSection
        title="Danger zone"
        description="These cannot be undone, and there is no backup unless you made one."
        tone="danger"
      >
        <div className="flex flex-col divide-y divide-line">
          <SettingsRow
            label="Delete all items"
            description={`Removes all ${items.length} ${items.length === 1 ? 'item' : 'items'}. Your vault key and account stay.`}
          >
            <Button
              variant="danger"
              onClick={() => {
                resetDialogs()
                setClearOpen(true)
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Delete all items
            </Button>
          </SettingsRow>

          <SettingsRow
            label="Delete account"
            description="Erases every item, every key and your sign-in record."
          >
            <Button
              variant="danger"
              onClick={() => {
                resetDialogs()
                setDeleteOpen(true)
              }}
            >
              Delete account
            </Button>
          </SettingsRow>
        </div>
      </SettingsSection>

      <Dialog
        open={clearOpen}
        onClose={() => {
          setClearOpen(false)
          resetDialogs()
        }}
        title="Delete all items?"
        description="Every item in this vault will be removed from every device."
        size="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setClearOpen(false)
                resetDialogs()
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearItems()} loading={busy}>
              Delete all items
            </Button>
          </>
        }
      >
        <Field id="clear-confirm" label="Type DELETE to confirm" error={error}>
          <Input
            id="clear-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            autoComplete="off"
            secret
            className="mono"
            invalid={Boolean(error)}
            aria-describedby={error ? 'clear-confirm-error' : undefined}
          />
        </Field>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          resetDialogs()
        }}
        title="Delete your account?"
        description="This erases your vault and your sign-in. It cannot be undone."
        size="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setDeleteOpen(false)
                resetDialogs()
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void deleteAccount()} loading={busy}>
              Delete account
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            Export an encrypted backup first if you want to keep a copy.
          </p>
          <Field id="delete-master" label="Master password">
            <PasswordInput
              id="delete-master"
              value={masterPassword}
              onChange={(event) => setMasterPassword(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field id="delete-confirm" label="Type DELETE to confirm" error={error}>
            <Input
              id="delete-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
              autoComplete="off"
              secret
              className="mono"
              invalid={Boolean(error)}
              aria-describedby={error ? 'delete-confirm-error' : undefined}
            />
          </Field>
        </div>
      </Dialog>
    </>
  )
}
