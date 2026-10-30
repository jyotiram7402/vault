/**
 * Preferences, kept in localStorage under `<STORAGE_PREFIX>-settings`.
 *
 * Nothing here is secret: how long until auto-lock, how long before the
 * clipboard is cleared, and whether the privacy screen is on. Validated every
 * time it is read, because localStorage can hold anything.
 */

import { STORAGE_PREFIX } from '@/lib/config'

const STORAGE_KEY = `${STORAGE_PREFIX}-settings`

export interface VaultSettings {
  autoLockMinutes: number
  /** 0 means "never clear the clipboard". */
  clipboardSeconds: number
  privacyScreen: boolean
  /** Ask for the master password again before showing a secret on screen. */
  requireMasterToReveal: boolean
  /** Lock the moment the tab is hidden, rather than after the idle timeout. */
  lockOnHide: boolean
}

export const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 60] as const
export const CLIPBOARD_OPTIONS = [15, 30, 60, 90, 0] as const

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  clipboardSeconds: 30,
  privacyScreen: true,
  requireMasterToReveal: true,
  lockOnHide: true,
}

function validate(value: unknown): VaultSettings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS
  const record = value as Record<string, unknown>
  const autoLock = record.autoLockMinutes
  const clipboard = record.clipboardSeconds
  const privacy = record.privacyScreen
  const reprompt = record.requireMasterToReveal
  const lockOnHide = record.lockOnHide
  return {
    requireMasterToReveal:
      typeof reprompt === 'boolean' ? reprompt : DEFAULT_SETTINGS.requireMasterToReveal,
    lockOnHide: typeof lockOnHide === 'boolean' ? lockOnHide : DEFAULT_SETTINGS.lockOnHide,
    autoLockMinutes:
      typeof autoLock === 'number' && (AUTO_LOCK_OPTIONS as readonly number[]).includes(autoLock)
        ? autoLock
        : DEFAULT_SETTINGS.autoLockMinutes,
    clipboardSeconds:
      typeof clipboard === 'number' && (CLIPBOARD_OPTIONS as readonly number[]).includes(clipboard)
        ? clipboard
        : DEFAULT_SETTINGS.clipboardSeconds,
    privacyScreen: typeof privacy === 'boolean' ? privacy : DEFAULT_SETTINGS.privacyScreen,
  }
}

let cached: VaultSettings = DEFAULT_SETTINGS
let loaded = false
const listeners = new Set<() => void>()

/** Never call during server rendering; `getServerSettings` is for that. */
export function readSettings(): VaultSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  if (loaded) return cached
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    cached = raw ? validate(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    cached = DEFAULT_SETTINGS
  }
  loaded = true
  return cached
}

export function getServerSettings(): VaultSettings {
  return DEFAULT_SETTINGS
}

export function writeSettings(patch: Partial<VaultSettings>): VaultSettings {
  const next = validate({ ...readSettings(), ...patch })
  cached = next
  loaded = true
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing or blocked storage: the setting still applies this session.
  }
  listeners.forEach((listener) => listener())
  return next
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function autoLockLabel(minutes: number): string {
  return minutes === 1 ? 'After 1 minute' : `After ${minutes} minutes`
}

export function clipboardLabel(seconds: number): string {
  if (seconds === 0) return 'Never clear'
  return `After ${seconds} seconds`
}
