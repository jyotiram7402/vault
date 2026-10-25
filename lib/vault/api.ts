import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { EncryptedItemRow, KeysetRow, PasskeyRow } from '@/lib/vault/types'

/**
 * Everything that talks to Supabase about vault data.
 *
 * All of it runs in the browser with the user's own session. There are no API
 * routes for vault data, so no server of ours ever sees a row — Row Level
 * Security is what keeps each account to its own rows.
 *
 * Without generated database types the client is untyped, so query results are
 * cast to the row interfaces exactly here, at the boundary, and nowhere else.
 */

const ITEM_COLUMNS = 'id, ciphertext, iv, enc_version, created_at, updated_at'
const PASSKEY_COLUMNS =
  'id, user_id, credential_id, prf_salt, wrapped_key, wrapped_key_iv, label, created_at, last_used_at'
const PAGE_SIZE = 1000

export class VaultRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultRequestError'
  }
}

/** Another device changed the keyset first. Never overwrite it. */
export class VaultConflictError extends Error {
  constructor() {
    super('Your vault changed on another device. Reload and try again.')
    this.name = 'VaultConflictError'
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session expired. Sign in again.')
    this.name = 'SessionExpiredError'
  }
}

interface SupabaseErrorLike {
  message?: string
  code?: string
}

const NETWORK_MESSAGE =
  'Can’t reach the vault server. Check your connection and try again. If you run this app, your free Supabase project may be paused: restore it from the Supabase dashboard.'

/** Turn a Postgrest error into something a person can act on, then throw. */
export function throwVaultError(error: SupabaseErrorLike | null, fallback: string): never {
  const code = error?.code ?? ''
  const message = (error?.message ?? '').toLowerCase()

  if (code === 'PGRST301' || message.includes('jwt') || message.includes('not authenticated')) {
    throw new SessionExpiredError()
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed')
  ) {
    throw new VaultRequestError(NETWORK_MESSAGE)
  }
  if (message.includes('item limit reached')) {
    throw new VaultRequestError('This vault has reached its limit of 5000 items.')
  }
  if (code === '42501' || message.includes('row-level security')) {
    throw new VaultRequestError(
      'The server refused that change. If two-factor sign-in is on, verify your code and try again.',
    )
  }
  throw new VaultRequestError(fallback)
}

/** Tightly scoped cast: the untyped client returns `any` for row data. */
function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

/** Tightly scoped cast, as above, for a single row. */
function asRow<T>(data: unknown): T | null {
  return data ? (data as T) : null
}

// ---------------------------------------------------------------- keyset ----

/**
 * The user's keyset, or null when they have none yet.
 *
 * A row hidden by Row Level Security comes back as empty data, NOT as an
 * error. Callers must already have confirmed the sign-in assurance level
 * before treating null as "this user has no vault".
 */
export async function fetchKeyset(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<KeysetRow | null> {
  const { data, error } = await supabase
    .from('vault_keys')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throwVaultError(error, 'Couldn’t load your vault settings.')
  return asRow<KeysetRow>(data)
}

export interface NewKeyset {
  kdf_salt: string
  kdf_memory_kib: number
  kdf_iterations: number
  kdf_parallelism: number
  wrapped_key: string
  wrapped_key_iv: string
  recovery_wrapped_key: string
  recovery_wrapped_key_iv: string
}

/** Insert only — an upsert could overwrite a working keyset and lose a vault. */
export async function insertKeyset(
  supabase: SupabaseBrowserClient,
  userId: string,
  keyset: NewKeyset,
): Promise<KeysetRow> {
  const { data, error } = await supabase
    .from('vault_keys')
    .insert({ ...keyset, user_id: userId, kdf_algorithm: 'argon2id' })
    .select()
    .single()

  if (error) throwVaultError(error, 'Couldn’t create your vault. Nothing was saved.')
  const row = asRow<KeysetRow>(data)
  if (!row) throw new VaultRequestError('Couldn’t create your vault. Nothing was saved.')
  return row
}

export type KeysetPatch = Partial<NewKeyset>

/**
 * Every keyset update is guarded by the version it was read at, so two devices
 * can never silently overwrite each other's key material.
 */
export async function updateKeyset(
  supabase: SupabaseBrowserClient,
  userId: string,
  currentVersion: number,
  patch: KeysetPatch,
): Promise<KeysetRow> {
  const { data, error } = await supabase
    .from('vault_keys')
    .update({ ...patch, key_version: currentVersion + 1 })
    .eq('user_id', userId)
    .eq('key_version', currentVersion)
    .select()

  if (error) throwVaultError(error, 'Couldn’t save your new key. Nothing was changed.')
  const rows = asRows<KeysetRow>(data)
  if (rows.length === 0) throw new VaultConflictError()
  return rows[0]
}

export async function deleteKeyset(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('vault_keys').delete().eq('user_id', userId)
  if (error) throwVaultError(error, 'Couldn’t remove your vault key.')
}

// ----------------------------------------------------------------- items ----

/** Supabase returns at most 1000 rows per request, so page until a page is short. */
export async function fetchAllItemRows(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<EncryptedItemRow[]> {
  const all: EncryptedItemRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from('vault_items')
      .select(ITEM_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throwVaultError(error, 'Couldn’t load your items.')
    const page = asRows<EncryptedItemRow>(data)
    all.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

/** A few raw rows exactly as stored, for "See what the server stores". */
export async function fetchRawSample(
  supabase: SupabaseBrowserClient,
  userId: string,
  limit = 5,
): Promise<EncryptedItemRow[]> {
  const { data, error } = await supabase
    .from('vault_items')
    .select(ITEM_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throwVaultError(error, 'Couldn’t read the stored rows.')
  return asRows<EncryptedItemRow>(data)
}

export async function insertItemRow(
  supabase: SupabaseBrowserClient,
  row: { id: string; user_id: string; ciphertext: string; iv: string; enc_version: number },
): Promise<EncryptedItemRow> {
  const { data, error } = await supabase.from('vault_items').insert(row).select(ITEM_COLUMNS).single()
  if (error) throwVaultError(error, 'Couldn’t save this item.')
  const saved = asRow<EncryptedItemRow>(data)
  if (!saved) throw new VaultRequestError('Couldn’t save this item.')
  return saved
}

/** Insert many at once, in batches, for import. */
export async function insertItemRows(
  supabase: SupabaseBrowserClient,
  rows: { id: string; user_id: string; ciphertext: string; iv: string; enc_version: number }[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from('vault_items').insert(rows)
  if (error) throwVaultError(error, 'Couldn’t save some of these items.')
}

/** `row` comes from `toUpdateRow`, the one function that picks these fields. */
export async function updateItemRow(
  supabase: SupabaseBrowserClient,
  userId: string,
  id: string,
  row: { ciphertext: string; iv: string; enc_version: number },
): Promise<EncryptedItemRow> {
  const { data, error } = await supabase
    .from('vault_items')
    .update(row)
    .eq('id', id)
    .eq('user_id', userId)
    .select(ITEM_COLUMNS)
    .single()

  if (error) throwVaultError(error, 'Couldn’t save your changes.')
  const saved = asRow<EncryptedItemRow>(data)
  if (!saved) throw new VaultRequestError('Couldn’t save your changes.')
  return saved
}

export async function deleteItemRow(
  supabase: SupabaseBrowserClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('vault_items').delete().eq('id', id).eq('user_id', userId)
  if (error) throwVaultError(error, 'Couldn’t delete this item.')
}

/** Deletes always carry a filter, so a mistake can never clear the table. */
export async function deleteAllItemRows(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('vault_items').delete().eq('user_id', userId)
  if (error) throwVaultError(error, 'Couldn’t delete your items.')
}

// -------------------------------------------------------------- passkeys ----

export async function fetchPasskeys(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<PasskeyRow[]> {
  const { data, error } = await supabase
    .from('vault_passkeys')
    .select(PASSKEY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throwVaultError(error, 'Couldn’t load your quick-unlock devices.')
  return asRows<PasskeyRow>(data)
}

export async function insertPasskey(
  supabase: SupabaseBrowserClient,
  row: {
    user_id: string
    credential_id: string
    prf_salt: string
    wrapped_key: string
    wrapped_key_iv: string
    label: string
  },
): Promise<PasskeyRow> {
  const { data, error } = await supabase
    .from('vault_passkeys')
    .insert(row)
    .select(PASSKEY_COLUMNS)
    .single()

  if (error) throwVaultError(error, 'Couldn’t set up quick unlock on this device.')
  const saved = asRow<PasskeyRow>(data)
  if (!saved) throw new VaultRequestError('Couldn’t set up quick unlock on this device.')
  return saved
}

export async function touchPasskey(
  supabase: SupabaseBrowserClient,
  userId: string,
  id: string,
): Promise<void> {
  // Best effort: failing to record "last used" must never block an unlock.
  await supabase
    .from('vault_passkeys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function deletePasskey(
  supabase: SupabaseBrowserClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('vault_passkeys').delete().eq('id', id).eq('user_id', userId)
  if (error) throwVaultError(error, 'Couldn’t remove that device.')
}

export async function deleteAllPasskeys(
  supabase: SupabaseBrowserClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('vault_passkeys').delete().eq('user_id', userId)
  if (error) throwVaultError(error, 'Couldn’t remove your quick-unlock devices.')
}
