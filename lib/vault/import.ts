import { foldText } from '@/lib/utils'
import { hostOf, normalizeWebsite } from '@/lib/security/url'
import { headerIndex, parseCsv, pickColumn } from '@/lib/vault/csv'
import {
  CATEGORY_IDS,
  CATEGORY_LABELS,
  LIMITS,
  type CategoryId,
  type ItemPayload,
  type LoginItem,
  type NoteItem,
  type VaultItem,
} from '@/lib/vault/types'

/**
 * Importing a CSV exported from another password manager.
 *
 * The file is read in the browser, mapped, encrypted and inserted. It is never
 * uploaded. Afterwards the dialog reminds the user to delete it, because a
 * browser export is plain text containing every password they own.
 */

const COLUMNS = {
  title: ['name', 'title', 'account', 'website name', 'item name', 'display name'],
  url: ['url', 'login_uri', 'website', 'web site', 'login url', 'origin', 'uri', 'urls'],
  username: ['username', 'login_username', 'user name', 'user', 'email', 'login', 'account name'],
  password: ['password', 'login_password', 'pass', 'secret'],
  notes: ['note', 'notes', 'extra', 'comments', 'comment'],
  totp: ['totp', 'login_totp', 'otp', 'otpauth', 'otp secret', 'two factor secret'],
  category: ['folder', 'grouping', 'category', 'group', 'collection'],
} as const

/** Folder names people actually use, mapped onto our categories. */
const CATEGORY_SYNONYMS: Record<string, CategoryId> = {
  bank: 'finance',
  banking: 'finance',
  money: 'finance',
  financial: 'finance',
  job: 'work',
  business: 'work',
  company: 'work',
  dev: 'developer',
  development: 'developer',
  code: 'developer',
  media: 'entertainment',
  streaming: 'entertainment',
  games: 'entertainment',
  gaming: 'entertainment',
  shop: 'shopping',
  shops: 'shopping',
  retail: 'shopping',
  mail: 'email',
  inbox: 'email',
  gov: 'government',
  official: 'government',
  home: 'personal',
  family: 'personal',
  misc: 'other',
}

function toCategory(value: string): { category?: CategoryId; tag?: string } {
  const clean = value.trim()
  if (!clean) return {}

  const folded = foldText(clean)
  for (const id of CATEGORY_IDS) {
    if (folded === id || folded === foldText(CATEGORY_LABELS[id])) return { category: id }
  }
  const synonym = CATEGORY_SYNONYMS[folded]
  if (synonym) return { category: synonym }

  // Anything else survives as a tag rather than being thrown away.
  return { tag: clean.slice(0, LIMITS.tagLength) }
}

function cell(row: readonly string[], index: number | null): string {
  if (index === null || index >= row.length) return ''
  return (row[index] ?? '').trim()
}

export interface ImportCandidate {
  payload: ItemPayload
  duplicate: boolean
}

export interface ImportPreview {
  candidates: ImportCandidate[]
  /** Rows with neither a username nor a password. */
  skipped: number
  totalRows: number
  duplicates: number
  error: string | null
}

/** Host + username + password identifies "the same login" well enough. */
function fingerprint(url: string, username: string, password: string): string {
  return `${foldText(hostOf(url))}|${foldText(username)}|${password}`
}

function existingFingerprints(items: readonly VaultItem[]): Set<string> {
  const set = new Set<string>()
  for (const item of items) {
    if (item.data.type !== 'login') continue
    set.add(fingerprint(item.data.url ?? '', item.data.username ?? '', item.data.password ?? ''))
  }
  return set
}

export function parseImportCsv(text: string, existing: readonly VaultItem[]): ImportPreview {
  const empty: ImportPreview = {
    candidates: [],
    skipped: 0,
    totalRows: 0,
    duplicates: 0,
    error: null,
  }

  let rows: string[][]
  try {
    rows = parseCsv(text)
  } catch {
    return { ...empty, error: 'That file couldn’t be read as CSV.' }
  }

  if (rows.length < 2) {
    return { ...empty, error: 'That file has no rows to import.' }
  }

  const index = headerIndex(rows[0])
  const columns = {
    title: pickColumn(index, COLUMNS.title),
    url: pickColumn(index, COLUMNS.url),
    username: pickColumn(index, COLUMNS.username),
    password: pickColumn(index, COLUMNS.password),
    notes: pickColumn(index, COLUMNS.notes),
    totp: pickColumn(index, COLUMNS.totp),
    category: pickColumn(index, COLUMNS.category),
  }

  if (columns.password === null && columns.username === null) {
    return {
      ...empty,
      error:
        'That file has no username or password column, so there is nothing to import. Export again from your browser’s password settings.',
    }
  }

  const seen = existingFingerprints(existing)
  const withinFile = new Set<string>()
  const candidates: ImportCandidate[] = []
  let skipped = 0
  let duplicates = 0
  const now = new Date().toISOString()

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]

    const username = cell(row, columns.username).slice(0, LIMITS.username)
    const password = cell(row, columns.password).slice(0, LIMITS.password)
    const notes = cell(row, columns.notes).slice(0, LIMITS.notes)
    const rawUrl = cell(row, columns.url)
    const rawTitle = cell(row, columns.title)
    const totp = cell(row, columns.totp).slice(0, LIMITS.totp)
    const { category, tag } = toCategory(cell(row, columns.category))

    if (!username && !password) {
      // A note-only row is still worth keeping if it has a title and text.
      if (rawTitle && notes) {
        const note: NoteItem = {
          v: 1,
          type: 'note',
          title: rawTitle.slice(0, LIMITS.title),
          notes,
          category,
          tags: tag ? [tag] : undefined,
          createdAt: now,
          updatedAt: now,
        }
        candidates.push({ payload: note, duplicate: false })
        continue
      }
      skipped += 1
      continue
    }

    const url = normalizeWebsite(rawUrl) ?? undefined
    const title = (rawTitle || hostOf(url) || username || 'Untitled').slice(0, LIMITS.title)

    const login: LoginItem = {
      v: 1,
      type: 'login',
      title,
      url: url?.slice(0, LIMITS.url),
      username: username || undefined,
      password: password || undefined,
      totp: totp || undefined,
      notes: notes || undefined,
      category,
      tags: tag ? [tag] : undefined,
      favorite: undefined,
      passwordUpdatedAt: password ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }

    const print = fingerprint(url ?? '', username, password)
    const duplicate = seen.has(print) || withinFile.has(print)
    if (duplicate) duplicates += 1
    withinFile.add(print)

    candidates.push({ payload: login, duplicate })
  }

  return {
    candidates,
    skipped,
    totalRows: rows.length - 1,
    duplicates,
    error: null,
  }
}

/** Payloads from a Tijori backup, re-stamped so they import as new items. */
export function prepareBackupImport(
  payloads: readonly ItemPayload[],
  existing: readonly VaultItem[],
): ImportPreview {
  const seen = existingFingerprints(existing)
  const candidates: ImportCandidate[] = []
  let duplicates = 0

  for (const payload of payloads) {
    let duplicate = false
    if (payload.type === 'login') {
      const print = fingerprint(payload.url ?? '', payload.username ?? '', payload.password ?? '')
      duplicate = seen.has(print)
      if (duplicate) duplicates += 1
    }
    candidates.push({ payload, duplicate })
  }

  return {
    candidates,
    skipped: 0,
    totalRows: payloads.length,
    duplicates,
    error: null,
  }
}

/** A masked preview row for the dialog, so passwords never appear on screen. */
export interface PreviewRow {
  title: string
  username: string
  masked: string
  duplicate: boolean
}

export function previewRows(candidates: readonly ImportCandidate[], limit = 10): PreviewRow[] {
  return candidates.slice(0, limit).map((candidate) => {
    const payload = candidate.payload
    const username = payload.type === 'login' ? (payload.username ?? '') : ''
    const hasPassword = payload.type === 'login' && Boolean(payload.password)
    return {
      title: payload.title,
      username,
      masked: hasPassword ? '••••••••••••' : '—',
      duplicate: candidate.duplicate,
    }
  })
}
