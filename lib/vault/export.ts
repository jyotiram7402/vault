import { createBackup, type BackupFile } from '@/lib/crypto/backup'
import { APP_SLUG } from '@/lib/config'
import { downloadTextFile, isoDateStamp } from '@/lib/utils'
import { hostOf } from '@/lib/security/url'
import { stringifyCsv } from '@/lib/vault/csv'
import type { ItemPayload, VaultItem } from '@/lib/vault/types'

/**
 * Files that leave the app: the Emergency Kit, encrypted backups and plain CSV.
 *
 * All three are produced in the browser with a Blob and an object URL. Nothing
 * is uploaded anywhere to be turned into a file.
 */

// ------------------------------------------------------------ emergency kit -

export interface EmergencyKitInput {
  appName: string
  siteUrl: string
  email: string
  recoveryKey: string
  createdAt?: Date
}

const KIT_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function buildEmergencyKit({
  appName,
  siteUrl,
  email,
  recoveryKey,
  createdAt = new Date(),
}: EmergencyKitInput): string {
  return `${appName.toUpperCase()} EMERGENCY KIT
Keep this somewhere safe and offline. With this kit and access to your
account, anyone can open your vault.

Website:       ${siteUrl}
Account email: ${email}
Recovery Key:  ${recoveryKey}
Created:       ${KIT_DATE_FORMAT.format(createdAt)}

Master password (optional, write it by hand): ____________________________

Forgot your master password? Sign in, choose "Use recovery key" on the
unlock screen, enter the key above, and choose a new master password.
`
}

export function downloadEmergencyKit(input: EmergencyKitInput): void {
  downloadTextFile(
    `${input.appName.toLowerCase()}-emergency-kit-${isoDateStamp()}.txt`,
    buildEmergencyKit(input),
  )
}

// ------------------------------------------------------------------ backup --

export async function downloadEncryptedBackup(
  payloads: readonly ItemPayload[],
  password: string,
): Promise<BackupFile> {
  const file = await createBackup(payloads, password)
  // The file NAME follows the app name; the format id INSIDE the file does
  // not, so backups made before a rename still import afterwards.
  downloadTextFile(
    `${APP_SLUG}-backup-${isoDateStamp()}.json`,
    JSON.stringify(file, null, 2),
    'application/json;charset=utf-8',
  )
  return file
}

// --------------------------------------------------------------- plain CSV --

/** Bitwarden-compatible columns, so other password managers can read it. */
const CSV_HEADER = [
  'folder',
  'favorite',
  'type',
  'name',
  'notes',
  'fields',
  'reprompt',
  'login_uri',
  'login_username',
  'login_password',
  'login_totp',
] as const

function customFieldsText(payload: ItemPayload): string {
  if (payload.type !== 'login' || !payload.fields?.length) return ''
  return payload.fields.map((field) => `${field.label}: ${field.value}`).join('\n')
}

/**
 * Logins and notes only. Cards are never written to a plain file — they go in
 * encrypted backups, and the export dialog says so.
 */
export function buildPlainCsv(items: readonly VaultItem[]): string {
  const rows: string[][] = [[...CSV_HEADER]]

  for (const item of items) {
    const payload = item.data
    if (payload.type === 'card') continue

    rows.push([
      payload.category ?? '',
      payload.favorite ? '1' : '',
      payload.type === 'login' ? 'login' : 'note',
      payload.title,
      payload.notes ?? '',
      customFieldsText(payload),
      '0',
      payload.type === 'login' ? (payload.url ?? '') : '',
      payload.type === 'login' ? (payload.username ?? '') : '',
      payload.type === 'login' ? (payload.password ?? '') : '',
      payload.type === 'login' ? (payload.totp ?? '') : '',
    ])
  }

  return stringifyCsv(rows)
}

export function downloadPlainCsv(items: readonly VaultItem[]): void {
  downloadTextFile(
    `${APP_SLUG}-export-${isoDateStamp()}.csv`,
    buildPlainCsv(items),
    'text/csv;charset=utf-8',
  )
}

/** How many items a plain CSV would leave out (cards). */
export function countExcludedFromCsv(items: readonly VaultItem[]): number {
  return items.filter((item) => item.data.type === 'card').length
}

/** A short label for an item in an export summary. */
export function exportLabel(item: VaultItem): string {
  if (item.data.type === 'login') {
    const host = hostOf(item.data.url)
    return host || item.data.title
  }
  return item.data.title
}
