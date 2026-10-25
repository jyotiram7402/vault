'use client'

import { useSyncExternalStore } from 'react'
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type VaultSnapshot,
} from '@/lib/vault/store'

/** React's view of the vault. The key itself is never exposed here. */
export function useVault(): VaultSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
