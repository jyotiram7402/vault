import { forgetClipboard } from '@/lib/vault/clipboard'
import type { KeysetRow, VaultItem } from '@/lib/vault/types'

/**
 * The in-memory vault.
 *
 * Framework-free on purpose: no React import, so there is exactly one place
 * that holds decrypted data and it is easy to audit.
 *
 * THE VAULT KEY NEVER ENTERS THE SNAPSHOT. It lives in a private module
 * variable so it can never be serialised into React state, DevTools, an error
 * report or a storage API. Nothing in this module writes to localStorage,
 * sessionStorage, IndexedDB, cookies or the URL.
 *
 * Reloading the page means locked: this module's state is simply gone.
 */

export type VaultStatus = 'locked' | 'unlocked'

export type LockReason = 'manual' | 'idle' | 'hidden' | 'remote' | 'signout'

export interface VaultSnapshot {
  status: VaultStatus
  userId: string | null
  email: string | null
  /** Decrypted, sorted by updatedAt, newest first. */
  items: readonly VaultItem[]
  keyset: KeysetRow | null
  lastSyncedAt: number | null
}

const LOCKED_SNAPSHOT: VaultSnapshot = {
  status: 'locked',
  userId: null,
  email: null,
  items: [],
  keyset: null,
  lastSyncedAt: null,
}

let vaultKey: CryptoKey | null = null
let snapshot: VaultSnapshot = LOCKED_SNAPSHOT
let lastLockReason: LockReason | null = null

const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

function sortItems(items: readonly VaultItem[]): VaultItem[] {
  return [...items].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id),
  )
}

/** Replaces the snapshot and tells subscribers. */
function setSnapshot(next: VaultSnapshot): void {
  snapshot = next
  emit()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Must return the SAME object until something actually changes, or
 * useSyncExternalStore loops forever.
 */
export function getSnapshot(): VaultSnapshot {
  return snapshot
}

/** One constant snapshot for server rendering: the vault is always locked there. */
export function getServerSnapshot(): VaultSnapshot {
  return LOCKED_SNAPSHOT
}

export function unlockSession(input: {
  userId: string
  email: string | null
  key: CryptoKey
  keyset: KeysetRow
  items: readonly VaultItem[]
}): void {
  vaultKey = input.key
  lastLockReason = null
  setSnapshot({
    status: 'unlocked',
    userId: input.userId,
    email: input.email,
    items: sortItems(input.items),
    keyset: input.keyset,
    lastSyncedAt: Date.now(),
  })
}

export function lock(reason: LockReason = 'manual'): void {
  const wasUnlocked = snapshot.status === 'unlocked'
  vaultKey = null
  lastLockReason = reason
  forgetClipboard()
  if (wasUnlocked || snapshot !== LOCKED_SNAPSHOT) {
    setSnapshot(LOCKED_SNAPSHOT)
  }
}

export function getLastLockReason(): LockReason | null {
  return lastLockReason
}

export class VaultLockedError extends Error {
  constructor() {
    super('The vault is locked.')
    this.name = 'VaultLockedError'
  }
}

/** Throws when locked, so no caller can accidentally operate on null. */
export function getVaultKey(): CryptoKey {
  if (!vaultKey || snapshot.status !== 'unlocked') throw new VaultLockedError()
  return vaultKey
}

export function isUnlocked(): boolean {
  return snapshot.status === 'unlocked' && vaultKey !== null
}

export function replaceItems(items: readonly VaultItem[]): void {
  if (snapshot.status !== 'unlocked') return
  setSnapshot({ ...snapshot, items: sortItems(items), lastSyncedAt: Date.now() })
}

export function markSynced(): void {
  if (snapshot.status !== 'unlocked') return
  setSnapshot({ ...snapshot, lastSyncedAt: Date.now() })
}

export function upsertItem(item: VaultItem): void {
  if (snapshot.status !== 'unlocked') return
  const without = snapshot.items.filter((existing) => existing.id !== item.id)
  setSnapshot({ ...snapshot, items: sortItems([...without, item]) })
}

export function removeItem(id: string): void {
  if (snapshot.status !== 'unlocked') return
  const items = snapshot.items.filter((existing) => existing.id !== id)
  if (items.length === snapshot.items.length) return
  setSnapshot({ ...snapshot, items })
}

/** Update the cached keyset after a master password or Recovery Key change. */
export function setKeyset(keyset: KeysetRow): void {
  if (snapshot.status !== 'unlocked') return
  setSnapshot({ ...snapshot, keyset })
}

export function findItem(id: string): VaultItem | null {
  return snapshot.items.find((item) => item.id === id) ?? null
}
