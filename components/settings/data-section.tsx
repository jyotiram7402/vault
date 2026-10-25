'use client'

import { Suspense, lazy, useState } from 'react'
import { Download, Eye, Upload } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { fetchRawSample } from '@/lib/vault/api'
import { useVault } from '@/lib/vault/use-vault'
import type { EncryptedItemRow } from '@/lib/vault/types'
import { Button } from '@/components/ui/button'
import { SettingsRow, SettingsSection } from '@/components/settings/section'

const ImportDialog = lazy(() =>
  import('@/components/settings/import-dialog').then((module) => ({
    default: module.ImportDialog,
  })),
)
const ExportDialog = lazy(() =>
  import('@/components/settings/export-dialog').then((module) => ({
    default: module.ExportDialog,
  })),
)

export function DataSection() {
  const { userId, items } = useVault()
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [rows, setRows] = useState<EncryptedItemRow[] | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)

  const showRaw = async () => {
    if (!userId) return
    setLoadingRows(true)
    setRowsError(null)
    try {
      const supabase = createClient()
      setRows(await fetchRawSample(supabase, userId, 5))
    } catch (cause) {
      setRowsError(cause instanceof Error ? cause.message : 'Couldn’t read the stored rows.')
    } finally {
      setLoadingRows(false)
    }
  }

  return (
    <SettingsSection title="Data" description="Bring passwords in, take a backup out.">
      <div className="flex flex-col divide-y divide-line">
        <SettingsRow
          label="Import"
          description={`From Chrome, Edge, Firefox, Safari, Bitwarden, LastPass, 1Password, or a ${APP_NAME} backup.`}
        >
          <Button onClick={() => setImportOpen(true)}>
            <Upload aria-hidden="true" className="size-4" />
            Import
          </Button>
        </SettingsRow>

        <SettingsRow
          label="Export"
          description={`${items.length} ${items.length === 1 ? 'item' : 'items'} — as an encrypted backup, or plain CSV for moving elsewhere.`}
        >
          <Button onClick={() => setExportOpen(true)}>
            <Download aria-hidden="true" className="size-4" />
            Export
          </Button>
        </SettingsRow>

        <div className="py-3">
          <SettingsRow
            label="See what the server stores"
            description="Up to five rows, exactly as they sit in the database."
          >
            <Button onClick={() => void showRaw()} loading={loadingRows}>
              <Eye aria-hidden="true" className="size-4" />
              Show rows
            </Button>
          </SettingsRow>

          {rowsError ? <p className="text-sm font-medium text-danger">{rowsError}</p> : null}

          {rows ? (
            rows.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">There are no rows to show yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="overflow-hidden rounded-panel border border-line bg-bg p-3"
                  >
                    <dl className="flex flex-col gap-1.5 text-xs">
                      <div>
                        <dt className="text-ink-muted">id</dt>
                        <dd className="mono break-all text-ink">{row.id}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">iv</dt>
                        <dd className="mono break-all text-ink">{row.iv}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">ciphertext (first 64 characters)</dt>
                        <dd className="mono break-all text-safe">
                          {row.ciphertext.slice(0, 64)}…
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">created / updated</dt>
                        <dd className="text-ink">
                          {formatDate(row.created_at)} / {formatDate(row.updated_at)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>

      {importOpen ? (
        <Suspense fallback={null}>
          <ImportDialog open onClose={() => setImportOpen(false)} />
        </Suspense>
      ) : null}
      {exportOpen ? (
        <Suspense fallback={null}>
          <ExportDialog open onClose={() => setExportOpen(false)} />
        </Suspense>
      ) : null}
    </SettingsSection>
  )
}
