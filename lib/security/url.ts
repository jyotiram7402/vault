/**
 * Every URL that comes from user data passes through here before it becomes a
 * link. Only http: and https: are allowed — `javascript:` and `data:` links in
 * a vault item would otherwise be a script-injection path.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

function parse(value: string): URL | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed)
  } catch {
    return null
  }
}

/** Returns the URL as text when it is safe to link to, otherwise null. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const url = parse(value)
  if (!url || !ALLOWED_PROTOCOLS.has(url.protocol)) return null
  return url.toString()
}

/**
 * Turn whatever a person typed into a canonical https URL.
 * Returns null when it can't be made into a valid http(s) address.
 */
export function normalizeWebsite(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = parse(withScheme)
  if (!url || !ALLOWED_PROTOCOLS.has(url.protocol)) return null
  if (!url.hostname || !url.hostname.includes('.')) return null
  return url.toString()
}

/** The display host, without `www.`. Empty string when there isn't one. */
export function hostOf(value: string | null | undefined): string {
  if (!value) return ''
  const url = parse(value) ?? parse(`https://${value.trim()}`)
  if (!url || !ALLOWED_PROTOCOLS.has(url.protocol)) return ''
  return url.hostname.replace(/^www\./i, '')
}

/** The registrable-ish name used for monograms and search ("gmail" for mail.google.com). */
export function siteLabel(value: string | null | undefined): string {
  const host = hostOf(value)
  if (!host) return ''
  const parts = host.split('.')
  if (parts.length <= 2) return parts[0] ?? host
  // Drop a leading subdomain like "mail." or "accounts." when there is one.
  return parts[parts.length - 2] ?? host
}
