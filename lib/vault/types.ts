/**
 * Item payloads and the rows they live in.
 *
 * Everything readable is inside `ItemPayload`, which is JSON, padded, then
 * encrypted. The server sees only `id`, `ciphertext`, `iv` and `enc_version`.
 */

export type ItemType = 'login' | 'card' | 'note'

export type CategoryId =
  | 'personal'
  | 'work'
  | 'finance'
  | 'social'
  | 'shopping'
  | 'email'
  | 'entertainment'
  | 'developer'
  | 'government'
  | 'other'

export const CATEGORY_IDS: readonly CategoryId[] = [
  'personal',
  'work',
  'finance',
  'social',
  'shopping',
  'email',
  'entertainment',
  'developer',
  'government',
  'other',
]

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  personal: 'Personal',
  work: 'Work',
  finance: 'Finance',
  social: 'Social',
  shopping: 'Shopping',
  email: 'Email',
  entertainment: 'Entertainment',
  developer: 'Developer',
  government: 'Government',
  other: 'Other',
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  login: 'Login',
  card: 'Card',
  note: 'Secure note',
}

interface ItemBase {
  v: 1
  type: ItemType
  title: string
  notes?: string
  category?: CategoryId
  tags?: string[]
  favorite?: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomField {
  label: string
  value: string
  hidden: boolean
}

export interface PasswordHistoryEntry {
  value: string
  changedAt: string
}

export interface LoginItem extends ItemBase {
  type: 'login'
  url?: string
  username?: string
  password?: string
  totp?: string
  passwordUpdatedAt?: string
  passwordHistory?: PasswordHistoryEntry[]
  fields?: CustomField[]
}

export interface CardItem extends ItemBase {
  type: 'card'
  cardholder?: string
  number?: string
  expMonth?: string
  expYear?: string
  cvv?: string
  pin?: string
}

export interface NoteItem extends ItemBase {
  type: 'note'
}

export type ItemPayload = LoginItem | CardItem | NoteItem

// ---------- Limits (enforced in the form and again before encrypting) ----------

export const LIMITS = {
  title: 200,
  notes: 20000,
  url: 2048,
  username: 500,
  password: 1000,
  totp: 1024,
  tags: 20,
  tagLength: 32,
  fields: 20,
  fieldLabel: 100,
  fieldValue: 2000,
  passwordHistory: 10,
  cardholder: 200,
  cardNumber: 19,
  cvv: 8,
  pin: 16,
} as const

// ---------- Rows ----------

/** A row of `vault_items` exactly as Postgres returns it. */
export interface EncryptedItemRow {
  id: string
  ciphertext: string
  iv: string
  enc_version: number
  created_at: string
  updated_at: string
}

/** The encrypted form kept in memory so Undo can re-insert a row unchanged. */
export interface EncryptedPayload {
  ciphertext: string
  iv: string
  encVersion: number
}

/** A decrypted item held in memory while the vault is unlocked. */
export interface VaultItem {
  id: string
  data: ItemPayload
  /** From the payload, not the row: the server never sees real timestamps. */
  createdAt: string
  updatedAt: string
  /** The server's `updated_at`, used only to decide what changed when syncing. */
  rowUpdatedAt: string
  searchText: string
  encrypted: EncryptedPayload
}

/** A row of `vault_keys`. */
export interface KeysetRow {
  user_id: string
  kdf_algorithm: string
  kdf_salt: string
  kdf_memory_kib: number
  kdf_iterations: number
  kdf_parallelism: number
  wrapped_key: string
  wrapped_key_iv: string
  recovery_wrapped_key: string
  recovery_wrapped_key_iv: string
  key_version: number
  created_at: string
  updated_at: string
}

/** A row of `vault_passkeys`. */
export interface PasskeyRow {
  id: string
  user_id: string
  credential_id: string
  prf_salt: string
  wrapped_key: string
  wrapped_key_iv: string
  label: string
  created_at: string
  last_used_at: string | null
}

// ---------- Validation ----------

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isOptionalString(value: unknown, max: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= max)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isCategory(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}

function areTags(value: unknown): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > LIMITS.tags) return false
  return value.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= LIMITS.tagLength)
}

function areFields(value: unknown): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > LIMITS.fields) return false
  return value.every((field) => {
    if (typeof field !== 'object' || field === null) return false
    const record = field as Record<string, unknown>
    return (
      typeof record.label === 'string' &&
      record.label.length <= LIMITS.fieldLabel &&
      typeof record.value === 'string' &&
      record.value.length <= LIMITS.fieldValue &&
      typeof record.hidden === 'boolean'
    )
  })
}

function isHistory(value: unknown): boolean {
  if (value === undefined) return true
  if (!Array.isArray(value) || value.length > LIMITS.passwordHistory) return false
  return value.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const record = entry as Record<string, unknown>
    return (
      typeof record.value === 'string' &&
      record.value.length <= LIMITS.password &&
      isIsoDate(record.changedAt)
    )
  })
}

/**
 * Hand-written type guard. Anything that fails is left out of the list and
 * counted, never shown and never silently repaired.
 */
export function isItemPayload(value: unknown): value is ItemPayload {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>

  if (record.v !== 1) return false
  if (!isNonEmptyString(record.title, LIMITS.title)) return false
  if (!isOptionalString(record.notes, LIMITS.notes)) return false
  if (record.category !== undefined && !isCategory(record.category)) return false
  if (!areTags(record.tags)) return false
  if (record.favorite !== undefined && typeof record.favorite !== 'boolean') return false
  if (!isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) return false

  if (record.type === 'login') {
    return (
      isOptionalString(record.url, LIMITS.url) &&
      isOptionalString(record.username, LIMITS.username) &&
      isOptionalString(record.password, LIMITS.password) &&
      isOptionalString(record.totp, LIMITS.totp) &&
      (record.passwordUpdatedAt === undefined || isIsoDate(record.passwordUpdatedAt)) &&
      isHistory(record.passwordHistory) &&
      areFields(record.fields)
    )
  }
  if (record.type === 'card') {
    return (
      isOptionalString(record.cardholder, LIMITS.cardholder) &&
      isOptionalString(record.number, LIMITS.cardNumber) &&
      isOptionalString(record.expMonth, 2) &&
      isOptionalString(record.expYear, 4) &&
      isOptionalString(record.cvv, LIMITS.cvv) &&
      isOptionalString(record.pin, LIMITS.pin)
    )
  }
  return record.type === 'note'
}

/** Narrow a payload to a login without a cast at every call site. */
export function isLogin(payload: ItemPayload): payload is LoginItem {
  return payload.type === 'login'
}

export function isCard(payload: ItemPayload): payload is CardItem {
  return payload.type === 'card'
}
