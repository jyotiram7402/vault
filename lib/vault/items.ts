import { decryptItem, encryptItem, toInsertRow, toUpdateRow } from '@/lib/crypto/items'
import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import {
  fetchAllItemRows,
  insertItemRow,
  insertItemRows,
  updateItemRow,
} from '@/lib/vault/api'
import { buildSearchText } from '@/lib/vault/search'
import { unlockSession } from '@/lib/vault/store'
import type { EncryptedItemRow, ItemPayload, KeysetRow, VaultItem } from '@/lib/vault/types'

/**
 * Turning encrypted rows into usable items and back.
 *
 * Keeps the crypto layer and the Supabase layer from knowing about each other:
 * `lib/crypto/*` never imports Supabase, and `lib/vault/api.ts` never imports
 * crypto.
 */

const DECRYPT_BATCH = 50

export function toVaultItem(row: EncryptedItemRow, payload: ItemPayload): VaultItem {
  return {
    id: row.id,
    data: payload,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    rowUpdatedAt: row.updated_at,
    searchText: buildSearchText(payload),
    encrypted: {
      ciphertext: row.ciphertext,
      iv: row.iv,
      encVersion: row.enc_version,
    },
  }
}

export interface DecryptResult {
  items: VaultItem[]
  /** Rows that wouldn't decrypt or didn't validate. Counted, never shown. */
  failed: number
}

/**
 * Decrypt in batches so a large vault doesn't block the main thread in one go.
 * A row that fails is left out and counted; the rest still open.
 */
export async function decryptRows(
  vaultKey: CryptoKey,
  userId: string,
  rows: readonly EncryptedItemRow[],
): Promise<DecryptResult> {
  const items: VaultItem[] = []
  let failed = 0

  for (let start = 0; start < rows.length; start += DECRYPT_BATCH) {
    const batch = rows.slice(start, start + DECRYPT_BATCH)
    const settled = await Promise.all(
      batch.map(async (row) => {
        try {
          const payload = await decryptItem(vaultKey, userId, row.id, {
            ciphertext: row.ciphertext,
            iv: row.iv,
            encVersion: row.enc_version,
          })
          return toVaultItem(row, payload)
        } catch {
          return null
        }
      }),
    )
    for (const item of settled) {
      if (item) items.push(item)
      else failed += 1
    }
  }

  return { items, failed }
}

function stamped(payload: ItemPayload, createdAt?: string): ItemPayload {
  const now = new Date().toISOString()
  return { ...payload, createdAt: createdAt ?? payload.createdAt ?? now, updatedAt: now }
}

/** Create a brand-new item. The id is chosen before encryption: it is in the AAD. */
export async function createItem(
  supabase: SupabaseBrowserClient,
  vaultKey: CryptoKey,
  userId: string,
  payload: ItemPayload,
): Promise<VaultItem> {
  const id = crypto.randomUUID()
  const data = stamped(payload)
  const encrypted = await encryptItem(vaultKey, userId, id, data)
  const row = await insertItemRow(supabase, toInsertRow(id, userId, encrypted))
  return toVaultItem(row, data)
}

export async function saveItem(
  supabase: SupabaseBrowserClient,
  vaultKey: CryptoKey,
  userId: string,
  id: string,
  payload: ItemPayload,
  createdAt: string,
): Promise<VaultItem> {
  const data = stamped(payload, createdAt)
  const encrypted = await encryptItem(vaultKey, userId, id, data)
  const row = await updateItemRow(supabase, userId, id, toUpdateRow(encrypted))
  return toVaultItem(row, data)
}

/**
 * Undo a delete by putting the exact same row back: same id, same ciphertext,
 * same IV. Nothing is re-encrypted, so the item is byte-for-byte what it was.
 */
export async function restoreItem(
  supabase: SupabaseBrowserClient,
  userId: string,
  item: VaultItem,
): Promise<void> {
  await insertItemRow(supabase, {
    id: item.id,
    user_id: userId,
    ciphertext: item.encrypted.ciphertext,
    iv: item.encrypted.iv,
    enc_version: item.encrypted.encVersion,
  })
}

/** Encrypt and insert many payloads, in batches, for import. */
export async function createItemsInBatches(
  supabase: SupabaseBrowserClient,
  vaultKey: CryptoKey,
  userId: string,
  payloads: readonly ItemPayload[],
  options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<VaultItem[]> {
  const batchSize = options.batchSize ?? 100
  const created: VaultItem[] = []

  for (let start = 0; start < payloads.length; start += batchSize) {
    const slice = payloads.slice(start, start + batchSize)
    const prepared = await Promise.all(
      slice.map(async (payload) => {
        const id = crypto.randomUUID()
        const data = stamped(payload)
        const encrypted = await encryptItem(vaultKey, userId, id, data)
        return { id, data, encrypted }
      }),
    )

    await insertItemRows(
      supabase,
      prepared.map((entry) => toInsertRow(entry.id, userId, entry.encrypted)),
    )

    const now = new Date().toISOString()
    for (const entry of prepared) {
      created.push(
        toVaultItem(
          {
            id: entry.id,
            ciphertext: entry.encrypted.ciphertext,
            iv: entry.encrypted.iv,
            enc_version: entry.encrypted.encVersion,
            created_at: now,
            updated_at: now,
          },
          entry.data,
        ),
      )
    }

    options.onProgress?.(Math.min(start + batchSize, payloads.length), payloads.length)
  }

  return created
}

/**
 * Merge freshly fetched rows into what is already decrypted, decrypting only
 * what actually changed.
 */
export async function mergeRows(
  vaultKey: CryptoKey,
  userId: string,
  rows: readonly EncryptedItemRow[],
  existing: readonly VaultItem[],
): Promise<DecryptResult> {
  const byId = new Map(existing.map((item) => [item.id, item]))
  const unchanged: VaultItem[] = []
  const changed: EncryptedItemRow[] = []

  for (const row of rows) {
    const current = byId.get(row.id)
    if (current && current.rowUpdatedAt === row.updated_at) unchanged.push(current)
    else changed.push(row)
  }

  const result = await decryptRows(vaultKey, userId, changed)
  return { items: [...unchanged, ...result.items], failed: result.failed }
}

/**
 * Load every row, decrypt it and open the in-memory vault.
 * Returns how many rows could not be read, so the caller can mention it
 * without blocking everything else.
 */
export async function openVault(options: {
  supabase: SupabaseBrowserClient
  vaultKey: CryptoKey
  userId: string
  email: string | null
  keyset: KeysetRow
}): Promise<number> {
  const rows = await fetchAllItemRows(options.supabase, options.userId)
  const { items, failed } = await decryptRows(options.vaultKey, options.userId, rows)
  unlockSession({
    userId: options.userId,
    email: options.email,
    key: options.vaultKey,
    keyset: options.keyset,
    items,
  })
  return failed
}
