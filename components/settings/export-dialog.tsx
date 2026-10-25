'use client'

import { useState } from 'react'
import { FileDown, TriangleAlert } from 'lucide-react'
import { nextTwoFrames } from '@/lib/utils'
import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { Segmented } from '@/components/ui/segmented'
import { useToast } from '@/components/ui/toast'

type Tab = 'encrypted' | 'csv'

const TABS = [
  { value: 'encrypted' as const, label: 'Encrypted backup' },
  { value: 'csv' as const, label: 'Plain CSV' },
]

const MIN_BACKUP_PASSWORD = 12

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const { items, userId, keyset } = useVault()

  const [tab, setTab] = useState<Tab>('encrypted')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cardCount = items.filter((item) => item.data.type === 'card').length

  const reset = () => {
    setPassword('')
    setConfirm('')
    setMasterPassword('')
    setAcknowledged(false)
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const exportEncrypted = async () => {
    setError(null)
    if (password.length < MIN_BACKUP_PASSWORD) {
      setError(`Use at least ${MIN_BACKUP_PASSWORD} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }

    setBusy(true)
    await nextTwoFrames()
    try {
      const { downloadEncryptedBackup } = await import('@/lib/vault/export')
      await downloadEncryptedBackup(
        items.map((item) => item.data),
        password,
      )
      reset()
      toast({ message: 'Encrypted backup downloaded', tone: 'success' })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t create the backup.')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setError(null)
    if (!acknowledged) {
      setError('Tick the box to confirm you understand this file is not encrypted.')
      return
    }
    if (!userId || !keyset) return

    setBusy(true)
    await nextTwoFrames()
    try {
      // Re-check the master password before writing plaintext to disk.
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

      const { downloadPlainCsv } = await import('@/lib/vault/export')
      downloadPlainCsv(items)
      reset()
      toast({ message: 'CSV downloaded. Delete it when you’re done.', tone: 'success' })
      onClose()
    } catch (cause) {
      setError(
        cause instanceof WrongPasswordError
          ? 'That master password is wrong.'
          : cause instanceof Error
            ? cause.message
            : 'Couldn’t create the CSV.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Export your vault"
      size="md"
      footer={
        <>
          <Button onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={tab === 'csv' ? 'danger' : 'primary'}
            loading={busy}
            onClick={() => void (tab === 'encrypted' ? exportEncrypted() : exportCsv())}
          >
            <FileDown aria-hidden="true" className="size-4" />
            {tab === 'encrypted' ? 'Download backup' : 'Download CSV'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Segmented
          label="Export format"
          value={tab}
          options={TABS}
          onChange={(value) => {
            setTab(value)
            reset()
          }}
        />

        {tab === 'encrypted' ? (
          <>
            <p className="text-sm text-ink-muted">
              A single file, sealed with a password of its own so it still opens after you change
              your master password. This is the recommended backup.
            </p>
            <Field id="export-password" label="Backup password">
              <PasswordInput
                id="export-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={MIN_BACKUP_PASSWORD}
                autoFocus
              />
            </Field>
            <Field id="export-confirm" label="Confirm backup password" error={error}>
              <PasswordInput
                id="export-confirm"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                invalid={Boolean(error)}
                aria-describedby={error ? 'export-confirm-error' : undefined}
              />
            </Field>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-field border border-danger/40 bg-surface-2 p-3 text-sm text-ink">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
              This file holds every password in readable text. Only use it to move into another
              password manager, and delete it immediately afterwards.
            </p>

            {cardCount > 0 ? (
              <p className="text-sm text-ink-muted">
                {cardCount} {cardCount === 1 ? 'card is' : 'cards are'} left out: card details are
                only ever written to encrypted backups.
              </p>
            ) : null}

            <Field id="export-master" label="Master password">
              <PasswordInput
                id="export-master"
                value={masterPassword}
                onChange={(event) => setMasterPassword(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </Field>

            <label className="flex items-start gap-3 rounded-field border border-line p-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm text-ink">I understand this file is not encrypted.</span>
            </label>

            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          </>
        )}
      </div>
    </Dialog>
  )
}
