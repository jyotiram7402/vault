import { STORAGE_PREFIX } from '@/lib/config'

/**
 * Auto-lock.
 *
 * Three triggers: no interaction for the configured time; coming back to a
 * tab that was hidden for longer than that time; and — when "lock when I
 * switch away" is on — the tab being hidden at all. The hidden-tab cases
 * matter more than they look: a phone with the screen off fires no pointer
 * events, so idle alone would never notice.
 */

const CHECK_INTERVAL_MS = 15_000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

/**
 * Immediate lock-on-hide can be suspended while something on screen must not
 * be lost. The cases that need it are real: a newly created Recovery Key
 * (the old one has already stopped working), and file pickers or print
 * dialogs, which on some platforms briefly report the tab as hidden.
 */
let hideLockHolds = 0

/** Suspend immediate lock-on-hide. Returns a release function; call it once. */
export function holdLockOnHide(): () => void {
  hideLockHolds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    hideLockHolds -= 1
  }
}

export interface AutoLockOptions {
  /** Read fresh each tick so a change in Settings takes effect immediately. */
  getTimeoutMs: () => number
  /** Read fresh on every visibility change, for the same reason. */
  getLockOnHide: () => boolean
  onLock: (reason: 'idle' | 'hidden') => void
}

export function startAutoLock({ getTimeoutMs, getLockOnHide, onLock }: AutoLockOptions): () => void {
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
      // Lock the instant the tab is hidden, unless a flow has asked us not to.
      if (getLockOnHide() && hideLockHolds === 0 && !stopped) onLock('hidden')
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

const THROTTLE_KEY = `${STORAGE_PREFIX}-unlock-throttle`
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

/**
 * The same record, kept in memory as well. localStorage is trivially wiped by
 * clearing site data; this tab's memory of the attempts it has already seen is
 * not. Whichever is stricter applies.
 */
let memory: ThrottleState = { failures: 0, nextAllowedAt: 0 }

function currentThrottle(): ThrottleState {
  const stored = readThrottle()
  return {
    failures: Math.max(stored.failures, memory.failures),
    nextAllowedAt: Math.max(stored.nextAllowedAt, memory.nextAllowedAt),
  }
}

/** Seconds the user must still wait, or 0 when they may try now. */
export function unlockWaitSeconds(): number {
  const { nextAllowedAt } = currentThrottle()
  const remaining = Math.ceil((nextAllowedAt - Date.now()) / 1000)
  return remaining > 0 ? remaining : 0
}

/** Record a wrong master password and return how long to wait next time. */
export function recordUnlockFailure(): number {
  const state = currentThrottle()
  const failures = state.failures + 1
  const delaySeconds =
    failures <= FREE_ATTEMPTS ? 0 : Math.min(2 ** (failures - FREE_ATTEMPTS), MAX_DELAY_SECONDS)
  const next = { failures, nextAllowedAt: Date.now() + delaySeconds * 1000 }
  memory = next
  writeThrottle(next)
  return delaySeconds
}

export function clearUnlockFailures(): void {
  memory = { failures: 0, nextAllowedAt: 0 }
  try {
    window.localStorage.removeItem(THROTTLE_KEY)
  } catch {
    // Nothing to do.
  }
}
