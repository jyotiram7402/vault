import { readSettings } from '@/lib/vault/settings'

/**
 * Copying secrets, with a clipboard wipe afterwards.
 *
 * A page may only write to the clipboard while it has focus, and copying a
 * password nearly always means leaving this page to paste it — which, with
 * "lock when I switch away" on, also locks the vault. A wipe that used to fall
 * due in the background was simply skipped, so it almost never ran. Now it is
 * owed instead: it runs the moment this page has focus again, locked or not.
 *
 * Only the fact that a wipe is owed is kept, never the secret. The cost is
 * that if you copied something else elsewhere in the meantime, coming back
 * clears that too, which is the right way round for a password manager.
 *
 * Still best effort: some browsers only allow clipboard writes right after a
 * click, and the operating system's own clipboard history is out of reach.
 */

let wipeDueAt: number | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

export class ClipboardUnavailableError extends Error {
  constructor() {
    super('This browser wouldn’t let the page copy. Select the text and copy it yourself.')
    this.name = 'ClipboardUnavailableError'
  }
}

async function writeClipboard(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new ClipboardUnavailableError()
  }
  await navigator.clipboard.writeText(value)
}

function startListening(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('focus', attemptWipe)
  document.addEventListener('visibilitychange', attemptWipe)
}

function stopListening(): void {
  if (!listening) return
  listening = false
  window.removeEventListener('focus', attemptWipe)
  document.removeEventListener('visibilitychange', attemptWipe)
}

function cancelWipe(): void {
  wipeDueAt = null
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  stopListening()
}

/** Empty the clipboard if a wipe is due, or wait for focus if it can't yet. */
function attemptWipe(): void {
  if (wipeDueAt === null || Date.now() < wipeDueAt) return
  if (typeof document === 'undefined' || !document.hasFocus()) {
    startListening()
    return
  }
  const due = wipeDueAt
  void writeClipboard('')
    .then(() => {
      // A newer copy may have re-armed the wipe while this one was in flight.
      if (wipeDueAt === due) cancelWipe()
    })
    .catch(() => {
      // Refused, often because the browser wants a click first. Try again
      // the next time the page has focus.
      startListening()
    })
}

/**
 * Copy a secret and schedule the clipboard to be emptied.
 * Returns the number of seconds until the wipe, or 0 when wiping is off.
 */
export async function copySecret(value: string): Promise<number> {
  await writeClipboard(value)
  cancelWipe()

  const seconds = readSettings().clipboardSeconds
  if (seconds <= 0) return 0

  wipeDueAt = Date.now() + seconds * 1000
  timer = setTimeout(() => {
    timer = null
    attemptWipe()
  }, seconds * 1000)
  return seconds
}

/** Copy something that isn't a secret (a username, a URL). No wipe. */
export async function copyPlain(value: string): Promise<void> {
  await writeClipboard(value)
  // The secret is no longer on the clipboard, so there is nothing to wipe.
  cancelWipe()
}
