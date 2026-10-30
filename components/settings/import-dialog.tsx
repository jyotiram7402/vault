'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileUp, TriangleAlert } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { createClient } from '@/lib/supabase/client'
import { holdLockOnHide } from '@/lib/vault/auto-lock'
import { createItemsInBatches } from '@/lib/vault/items'
import { getVaultKey, upsertItem } from '@/lib/vault/store'
import { parseImportCsv, prepareBackupImport, previewRows, type ImportPreview } from '@/lib/vault/import'
import { useVault } from '@/lib/vault/use-vault'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { PasswordInput } from '@/components/ui/password-input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type Tab = 'csv' | 'backup'

const TABS = [
  { value: 'csv' as const, label: 'From a browser' },
  { value: 'backup' as const, label: `${APP_NAME} backup` },
]

const BROWSER_HELP = [
  {
    name: 'Chrome',
    steps: 'Settings → Autofill and passwords → Google Password Manager → Settings → Export passwords.',
  },
  {
    name: 'Edge',
    steps: 'Settings → Profiles → Passwords → the ⋯ menu above the list → Export passwords.',
  },
  {
    name: 'Firefox',
    steps: 'Settings → Privacy & Security → Saved Passwords → the ⋯ menu → Export Logins.',
  },
  {
    name: 'Safari',
    steps: 'Settings → Passwords → the ⋯ button under the list → Export All Passwords.',
  },
]

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const { userId, items } = useVault()

  const [tab, setTab] = useState<Tab>('csv')
  const [text, setText] = useState('')
  const [backupText, setBackupText] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState<number | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const backupFileRef = useRef<HTMLInputElement>(null)

  // A native file picker can report the tab as hidden for a moment; locking
  // in the middle of choosing a file would discard the whole import.
  useEffect(() => {
    if (!open) return
    return holdLockOnHide()
  }, [open])

  const reset = () => {
    setText('')
    setBackupText('')
    setBackupPassword('')
    setPreview(null)
    setError(null)
    setFinished(null)
    setProgress({ done: 0, total: 0 })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const readCsv = (value: string) => {
    setText(value)
    setError(null)
    if (!value.trim()) {
      setPreview(null)
      return
    }
    const result = parseImportCsv(value, items)
    setPreview(result)
    if (result.error) setError(result.error)
  }

  const openBackup = async () => {
    setError(null)
    setBusy(true)
    try {
      const { parseBackupFile, readBackup } = await import('@/lib/crypto/backup')
      const file = parseBackupFile(backupText)
      const payloads = await readBackup(file, backupPassword)
      setPreview(prepareBackupImport(payloads, items))
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : 'Couldn’t open that backup.')
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    if (!userId || !preview) return
    const chosen = skipDuplicates
      ? preview.candidates.filter((candidate) => !candidate.duplicate)
      : preview.candidates
    if (chosen.length === 0) {
      setError('There is nothing left to import.')
      return
    }

    setBusy(true)
    setError(null)
    setProgress({ done: 0, total: chosen.length })

    try {
      const supabase = createClient()
      const created = await createItemsInBatches(
        supabase,
        getVaultKey(),
        userId,
        chosen.map((candidate) => candidate.payload),
        {
          batchSize: 100,
          onProgress: (done, total) => setProgress({ done, total }),
        },
      )
      for (const item of created) upsertItem(item)
      setFinished(created.length)
      toast({
        message: `${created.length} ${created.length === 1 ? 'item' : 'items'} imported`,
        tone: 'success',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t import those items.')
    } finally {
      setBusy(false)
    }
  }

  const rows = preview ? previewRows(preview.candidates) : []
  const importable = preview
    ? skipDuplicates
      ? preview.candidates.filter((candidate) => !candidate.duplicate).length
      : preview.candidates.length
    : 0

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import passwords"
      description="Everything is encrypted in this browser before it is saved."
      size="lg"
      footer={
        finished === null ? (
          <>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void runImport()}
              loading={busy}
              disabled={!preview || importable === 0}
            >
              Import {importable > 0 ? importable : ''} {importable === 1 ? 'item' : 'items'}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        )
      }
    >
      {finished !== null ? (
        <div className="flex flex-col gap-3">
          <p className="text-ink">
            {finished} {finished === 1 ? 'item was' : 'items were'} imported and encrypted.
          </p>
          <p className="flex items-start gap-2 rounded-field border border-warn/40 bg-surface-2 p-3 text-sm text-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" />
            Delete the CSV file from your device now; it contains your passwords in plain text.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Segmented
            label="Import source"
            value={tab}
            options={TABS}
            onChange={(value) => {
              setTab(value)
              reset()
            }}
          />

          {tab === 'csv' ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (file) readCsv(await file.text())
                  }}
                />
                <Button onClick={() => fileRef.current?.click()}>
                  <FileUp aria-hidden="true" className="size-4" />
                  Choose CSV file
                </Button>
                <span className="text-sm text-ink-muted">or paste it below</span>
              </div>

              <Field id="import-paste" label="CSV contents">
                <Textarea
                  id="import-paste"
                  value={text}
                  onChange={(event) => readCsv(event.target.value)}
                  rows={5}
                  secret
                  autoComplete="off"
                  placeholder="name,url,username,password"
                  className="mono text-xs"
                />
              </Field>

              <details className="rounded-panel border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
                  How do I export from my browser?
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                </summary>
                <ul className="border-t border-line px-4 py-3 text-sm">
                  {BROWSER_HELP.map((entry) => (
                    <li key={entry.name} className="py-1.5">
                      <strong className="text-ink">{entry.name}:</strong>{' '}
                      <span className="text-ink-muted">{entry.steps}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={backupFileRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      setBackupText(await file.text())
                      setPreview(null)
                      setError(null)
                    }
                  }}
                />
                <Button onClick={() => backupFileRef.current?.click()}>
                  <FileUp aria-hidden="true" className="size-4" />
                  Choose backup file
                </Button>
                {backupText ? (
                  <span className="text-sm text-ink-muted">File loaded</span>
                ) : null}
              </div>

              <Field id="import-backup-password" label="Backup password">
                <PasswordInput
                  id="import-backup-password"
                  value={backupPassword}
                  onChange={(event) => setBackupPassword(event.target.value)}
                  autoComplete="off"
                />
              </Field>

              <Button
                onClick={() => void openBackup()}
                loading={busy}
                disabled={!backupText || !backupPassword}
                className="self-start"
              >
                Open backup
              </Button>
            </>
          )}

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          {preview && !preview.error ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">
                {preview.candidates.length}{' '}
                {preview.candidates.length === 1 ? 'item' : 'items'} ready to import
                {preview.skipped > 0
                  ? `, ${preview.skipped} ${preview.skipped === 1 ? 'row' : 'rows'} skipped (no username or password)`
                  : ''}
                .
              </p>

              {preview.duplicates > 0 ? (
                <Switch
                  label="Skip duplicates"
                  description={`${preview.duplicates} ${preview.duplicates === 1 ? 'item matches' : 'items match'} something already in your vault.`}
                  checked={skipDuplicates}
                  onChange={setSkipDuplicates}
                />
              ) : null}

              <div className="overflow-hidden rounded-panel border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-2">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium text-ink-muted">
                        Title
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium text-ink-muted">
                        Username
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium text-ink-muted">
                        Password
                      </th>
                    </tr>
                  </thead>
                  <tbody className="hairline-y">
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td className="secret truncate px-3 py-2 text-ink">{row.title}</td>
                        <td className="secret truncate px-3 py-2 text-ink-muted">
                          {row.username || '—'}
                        </td>
                        <td className="mono px-3 py-2 text-ink-muted">{row.masked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {busy && progress.total > 0 ? (
                <div>
                  <div
                    role="progressbar"
                    aria-valuenow={progress.done}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-label="Importing"
                    className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${Math.round((progress.done / progress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="tabular mt-2 text-sm text-ink-muted" aria-live="polite">
                    Encrypted {progress.done} of {progress.total}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
