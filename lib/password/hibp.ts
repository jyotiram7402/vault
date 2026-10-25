import { toBytes, toHex, utf8Encode } from '@/lib/crypto/bytes'

/**
 * Have I Been Pwned, k-anonymity range API.
 *
 * Only the first five hex characters of a password's SHA-1 hash ever leave the
 * device. The server returns every suffix that shares that prefix — hundreds
 * of them — and the comparison happens here. HIBP cannot tell which password
 * was asked about, and never sees the password itself.
 *
 * The request runs straight from the browser. There is no server route for it,
 * because a server route would mean our own server seeing the prefixes.
 */

const RANGE_URL = 'https://api.pwnedpasswords.com/range/'
const CONCURRENCY = 4

/** prefix → map of suffix → count. Memory only, cleared when the tab closes. */
const prefixCache = new Map<string, Map<string, number>>()

export class BreachScanError extends Error {
  constructor() {
    super('Couldn’t reach the breach database. Check your connection and try again.')
    this.name = 'BreachScanError'
  }
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', utf8Encode(value))
  return toHex(toBytes(digest)).toUpperCase()
}

async function fetchRange(prefix: string, signal: AbortSignal): Promise<Map<string, number>> {
  const cached = prefixCache.get(prefix)
  if (cached) return cached

  let response: Response
  try {
    // Add-Padding makes every response a similar size, so the length of the
    // reply can't hint at the prefix. A few proxies reject the header, so we
    // retry once without it.
    response = await fetch(`${RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal,
      cache: 'no-store',
    })
  } catch (error) {
    if (signal.aborted) throw error
    try {
      response = await fetch(`${RANGE_URL}${prefix}`, { signal, cache: 'no-store' })
    } catch {
      throw new BreachScanError()
    }
  }

  if (!response.ok) throw new BreachScanError()

  const text = await response.text()
  const suffixes = new Map<string, number>()
  for (const line of text.split('\n')) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const suffix = line.slice(0, separator).trim().toUpperCase()
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10)
    // A count of 0 is padding, not a real breach.
    if (suffix && Number.isFinite(count) && count > 0) suffixes.set(suffix, count)
  }

  prefixCache.set(prefix, suffixes)
  return suffixes
}

export interface BreachProgress {
  done: number
  total: number
}

/**
 * Check a list of unique passwords. Returns a map from password to the number
 * of times it appears in known breaches (absent means "not found").
 */
export async function checkPasswords(
  passwords: readonly string[],
  options: {
    signal: AbortSignal
    onProgress?: (progress: BreachProgress) => void
  },
): Promise<Map<string, number>> {
  const unique = Array.from(new Set(passwords.filter(Boolean)))
  const results = new Map<string, number>()
  if (unique.length === 0) return results

  let done = 0
  let cursor = 0

  const worker = async () => {
    for (;;) {
      if (options.signal.aborted) return
      const index = cursor
      cursor += 1
      if (index >= unique.length) return

      const password = unique[index]
      const hash = await sha1Hex(password)
      const prefix = hash.slice(0, 5)
      const suffix = hash.slice(5)
      const suffixes = await fetchRange(prefix, options.signal)
      const count = suffixes.get(suffix)
      if (count !== undefined) results.set(password, count)

      done += 1
      options.onProgress?.({ done, total: unique.length })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker))
  return results
}

/** Drop the cache, e.g. when the vault locks. */
export function clearBreachCache(): void {
  prefixCache.clear()
}
