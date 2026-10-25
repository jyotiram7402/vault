'use client'

import { useSyncExternalStore } from 'react'
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type VaultSnapshot,
} from '@/lib/vault/store'
import {
  getServerViewState,
  getViewState,
  subscribeViewState,
  type VaultViewState,
} from '@/lib/vault/view-state'

/** React's view of the vault. The key itself is never exposed here. */
export function useVault(): VaultSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Which filter, item and form are on screen. Never hits the network. */
export function useVaultView(): VaultViewState {
  return useSyncExternalStore(subscribeViewState, getViewState, getServerViewState)
}
