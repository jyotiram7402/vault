/**
 * Cross-tab session messages.
 *
 * Locking or signing out in one tab must do the same everywhere, or a second
 * tab left open on a shared computer undoes the lock entirely.
 *
 * Only the words "lock" and "signout" travel: never a key, an item or a user
 * id. BroadcastChannel is same-origin, but there is no reason to send more.
 */

const CHANNEL_NAME = 'tijori-session'

export type SessionMessage = { type: 'lock' } | { type: 'signout' }

function isSessionMessage(value: unknown): value is SessionMessage {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as { type?: unknown }).type
  return type === 'lock' || type === 'signout'
}

function openChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export function postSessionMessage(message: SessionMessage): void {
  const channel = openChannel()
  if (!channel) return
  try {
    channel.postMessage(message)
  } finally {
    channel.close()
  }
}

/** Listen for messages from other tabs. Returns an unsubscribe function. */
export function subscribeSession(handler: (message: SessionMessage) => void): () => void {
  const channel = openChannel()
  if (!channel) return () => undefined

  const onMessage = (event: MessageEvent) => {
    if (isSessionMessage(event.data)) handler(event.data)
  }
  channel.addEventListener('message', onMessage)

  return () => {
    channel.removeEventListener('message', onMessage)
    channel.close()
  }
}
