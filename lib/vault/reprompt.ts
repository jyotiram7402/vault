import { readSettings } from '@/lib/vault/settings'

/**
 * Asking for the master password again before a secret leaves the vault —
 * whether that is onto the screen or onto the clipboard.
 *
 * BE CLEAR ABOUT WHAT THIS IS. The vault is already unlocked, so the password
 * is already decrypted in memory. This is not a cryptographic control; it is a
 * barrier against someone at your unlocked machine, or reading over your
 * shoulder. Anything that can run JavaScript on the page can still reach the
 * decrypted items, so locking the vault remains the real protection when you
 * walk away.
 *
 * Verification is a real Argon2id derivation plus an unwrap of the stored key,
 * so a wrong password genuinely fails. Because that takes about a second, one
 * success covers a short grace period rather than every single field.
 *
 * The request itself lives here rather than in a React context, because the
 * places that need it — the item detail, a row in the list, the command
 * palette — do not share one.
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
  // A dialog left open when the vault locks must not resolve as "allowed".
  if (pending) resolveReprompt(false)
  if (verifiedAt === null) return
  verifiedAt = null
  emit()
}

// ------------------------------------------------------- pending request ----

type Resolver = (allowed: boolean) => void

let pending: Resolver | null = null
const requestListeners = new Set<() => void>()

function emitRequest(): void {
  requestListeners.forEach((listener) => listener())
}

export function subscribeRepromptRequest(listener: () => void): () => void {
  requestListeners.add(listener)
  return () => {
    requestListeners.delete(listener)
  }
}

export function isRepromptPending(): boolean {
  return pending !== null
}

export function getServerRepromptPending(): boolean {
  return false
}

/**
 * Ask permission to expose a secret. Resolves true immediately when the grace
 * period is still running, otherwise opens the dialog and resolves once the
 * person has answered it.
 *
 * NOTE ON THE CLIPBOARD: callers that copy do so after awaiting this, which
 * means after an Argon2id derivation of roughly a second. Browsers only allow
 * a page to write to the clipboard shortly after a user gesture. Chromium's
 * window is generous enough; Safari may refuse, and the copy helper already
 * tells the user to copy by hand if the write is rejected.
 */
export function requireReprompt(): Promise<boolean> {
  if (isRepromptSatisfied()) return Promise.resolve(true)
  // One at a time; the dialog is modal, so a second request means a stray call.
  if (pending) return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    pending = resolve
    emitRequest()
  })
}

/** Called by the dialog. `true` also starts a fresh grace period. */
export function resolveReprompt(allowed: boolean): void {
  const resolver = pending
  pending = null
  if (allowed) markReprompted()
  emitRequest()
  resolver?.(allowed)
}

export const REPROMPT_GRACE_MINUTES = GRACE_MS / 60_000
