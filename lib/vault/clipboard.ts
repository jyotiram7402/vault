import { readSettings } from '@/lib/vault/settings'

/**
 * Copying secrets, with a best-effort clipboard wipe afterwards.
 *
 * "Best effort" is honest: a browser only lets a page write to the clipboard
 * while it has focus, and some platforms (iOS in particular) will refuse.
 * Failures are swallowed rather than shown, because a failed wipe is not
 * something the user can act on — and the countdown ring already tells them
 * roughly how long the secret will sit there.
 */

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let lastWritten: string | null = null

export class ClipboardUnavailableError extends Error {
  constructor() {
    super('This browser wouldn’t let the page copy. Select the text and copy it yourself.')
    this.name = 'ClipboardUnavailableError'
  }
}

function cancelPendingClear(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

async function writeClipboard(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new ClipboardUnavailableError()
  }
  await navigator.clipboard.writeText(value)
}

/**
 * Copy a secret and schedule the clipboard to be emptied.
 * Returns the number of seconds until the wipe, or 0 when wiping is off.
 */
export async function copySecret(value: string): Promise<number> {
  await writeClipboard(value)
  cancelPendingClear()
  lastWritten = value

  const seconds = readSettings().clipboardSeconds
  if (seconds <= 0) return 0

  pendingTimer = setTimeout(() => {
    pendingTimer = null
    // Only clear what we put there, and only while we still have focus.
    if (lastWritten !== value) return
    if (typeof document !== 'undefined' && !document.hasFocus()) return
    void writeClipboard('')
      .then(() => {
        lastWritten = null
      })
      .catch(() => {
        // Nothing useful to tell the user.
      })
  }, seconds * 1000)

  return seconds
}

/** Copy something that isn't a secret (a username, a URL). No wipe. */
export async function copyPlain(value: string): Promise<void> {
  await writeClipboard(value)
}

/** Called when the vault locks: stop any pending wipe and forget the value. */
export function forgetClipboard(): void {
  cancelPendingClear()
  lastWritten = null
}
