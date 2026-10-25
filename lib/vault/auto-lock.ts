/**
 * Auto-lock.
 *
 * Two triggers: no interaction for the configured time, and coming back to a
 * tab that was hidden for longer than that time. The second matters more than
 * it looks — a phone with the screen off fires no pointer events at all, so
 * idle alone would never notice.
 */

const CHECK_INTERVAL_MS = 15_000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

export interface AutoLockOptions {
  /** Read fresh each tick so a change in Settings takes effect immediately. */
  getTimeoutMs: () => number
  onLock: (reason: 'idle' | 'hidden') => void
}

export function startAutoLock({ getTimeoutMs, onLock }: AutoLockOptions): () => void {
  if (typeof window === 'undefined') return () => undefined

  let lastActivity = Date.now()
  let hiddenSince: number | null = null
  let stopped = false

  const noteActivity = () => {
    lastActivity = Date.now()
  }

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, noteActivity, { passive: true, capture: true })
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now()
      return
    }
    const since = hiddenSince
    hiddenSince = null
    noteActivity()
    if (since !== null && Date.now() - since > getTimeoutMs() && !stopped) {
      onLock('hidden')
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)

  const interval = setInterval(() => {
    if (stopped) return
    if (document.visibilityState === 'hidden') return
    if (Date.now() - lastActivity > getTimeoutMs()) onLock('idle')
  }, CHECK_INTERVAL_MS)

  return () => {
    stopped = true
    clearInterval(interval)
    document.removeEventListener('visibilitychange', handleVisibility)
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, noteActivity, { capture: true })
    }
  }
}

/** Throttling after wrong master passwords (not secret, so localStorage is fine). */

const THROTTLE_KEY = 'tijori-unlock-throttle'
const FREE_ATTEMPTS = 3
const MAX_DELAY_SECONDS = 60

interface ThrottleState {
  failures: number
  nextAllowedAt: number
}

function readThrottle(): ThrottleState {
  if (typeof window === 'undefined') return { failures: 0, nextAllowedAt: 0 }
  try {
    const raw = window.localStorage.getItem(THROTTLE_KEY)
    if (!raw) return { failures: 0, nextAllowedAt: 0 }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { failures: 0, nextAllowedAt: 0 }
    const record = parsed as Record<string, unknown>
    return {
      failures: typeof record.failures === 'number' ? record.failures : 0,
      nextAllowedAt: typeof record.nextAllowedAt === 'number' ? record.nextAllowedAt : 0,
    }
  } catch {
    return { failures: 0, nextAllowedAt: 0 }
  }
}

function writeThrottle(state: ThrottleState): void {
  try {
    window.localStorage.setItem(THROTTLE_KEY, JSON.stringify(state))
  } catch {
    // Storage blocked: throttling is best effort.
  }
}

/** Seconds the user must still wait, or 0 when they may try now. */
export function unlockWaitSeconds(): number {
  const { nextAllowedAt } = readThrottle()
  const remaining = Math.ceil((nextAllowedAt - Date.now()) / 1000)
  return remaining > 0 ? remaining : 0
}

/** Record a wrong master password and return how long to wait next time. */
export function recordUnlockFailure(): number {
  const state = readThrottle()
  const failures = state.failures + 1
  const delaySeconds =
    failures <= FREE_ATTEMPTS ? 0 : Math.min(2 ** (failures - FREE_ATTEMPTS), MAX_DELAY_SECONDS)
  writeThrottle({ failures, nextAllowedAt: Date.now() + delaySeconds * 1000 })
  return delaySeconds
}

export function clearUnlockFailures(): void {
  try {
    window.localStorage.removeItem(THROTTLE_KEY)
  } catch {
    // Nothing to do.
  }
}
