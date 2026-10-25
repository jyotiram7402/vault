import { readSettings } from '@/lib/vault/settings'

/**
 * Asking for the master password again before a secret is shown on screen.
 *
 * BE CLEAR ABOUT WHAT THIS IS. The vault is already unlocked, so the password
 * is already decrypted in memory. This is not a cryptographic control: it
 * protects against someone glancing at your screen, or picking up your laptop
 * while you are away from it. It does not protect against someone who already
 * has your unlocked machine and is willing to use the copy button — for that,
 * lock the vault.
 *
 * Verification is a real Argon2id derivation plus an unwrap of the stored key,
 * so a wrong password genuinely fails. Because that takes about a second, one
 * success covers a short grace period rather than every single field.
 */

const GRACE_MS = 5 * 60_000

let verifiedAt: number | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeReprompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True when a secret may be shown without asking again. */
export function isRepromptSatisfied(): boolean {
  if (!readSettings().requireMasterToReveal) return true
  return verifiedAt !== null && Date.now() - verifiedAt < GRACE_MS
}

/** Seconds left on the current grace period, or 0. */
export function repromptSecondsLeft(): number {
  if (verifiedAt === null) return 0
  const left = Math.ceil((verifiedAt + GRACE_MS - Date.now()) / 1000)
  return left > 0 ? left : 0
}

export function markReprompted(): void {
  verifiedAt = Date.now()
  emit()
}

/** Called when the vault locks, so a new session always asks again. */
export function clearReprompt(): void {
  if (verifiedAt === null) return
  verifiedAt = null
  emit()
}

export const REPROMPT_GRACE_MINUTES = GRACE_MS / 60_000
