/**
 * Where to send someone after signing in, from an untrusted `next=` value.
 *
 * Only a path on this site survives. String checks alone are not enough:
 * every browser's URL parser deletes tabs and newlines before it reads a URL,
 * so `/<TAB>/evil.com` passes a "doesn't start with //" test and then opens
 * evil.com. So the value is resolved exactly the way a browser would, against
 * a placeholder origin, and kept only if it is still on that origin.
 */

const PLACEHOLDER_ORIGIN = 'https://next.invalid'

// Control characters, whitespace and backslashes never appear in a path this
// app builds, and browsers rewrite all three before resolving a URL.
const UNSAFE_CHARACTERS = /[\u0000-\u001F\u007F\s\\]/

export function safeNextPath(value: string | null | undefined, fallback = '/vault'): string {
  if (!value || UNSAFE_CHARACTERS.test(value)) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  let resolved: URL
  try {
    resolved = new URL(value, PLACEHOLDER_ORIGIN)
  } catch {
    return fallback
  }
  if (resolved.origin !== PLACEHOLDER_ORIGIN) return fallback
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
