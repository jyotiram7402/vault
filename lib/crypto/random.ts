/**
 * All randomness comes from the platform CSPRNG. Never Math.random().
 */

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * A uniform integer in [0, maxExclusive) by rejection sampling on 32-bit
 * values, so there is no modulo bias.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('randomInt needs a positive integer bound')
  }
  if (maxExclusive === 1) return 0
  const range = 2 ** 32
  const limit = range - (range % maxExclusive)
  const buffer = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buffer)
    const value = buffer[0]
    if (value < limit) return value % maxExclusive
  }
}

/** Draw `count` uniform integers in [0, maxExclusive) in as few calls as possible. */
export function randomInts(count: number, maxExclusive: number): number[] {
  if (count <= 0) return []
  const range = 2 ** 32
  const limit = range - (range % maxExclusive)
  const out: number[] = []
  while (out.length < count) {
    const need = count - out.length
    const buffer = crypto.getRandomValues(new Uint32Array(Math.max(need * 2, 8)))
    for (let i = 0; i < buffer.length && out.length < count; i += 1) {
      if (buffer[i] < limit) out.push(buffer[i] % maxExclusive)
    }
  }
  return out
}

/** Fisher–Yates with CSPRNG randomness. Shuffles in place and returns the array. */
export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const swap = items[i]
    items[i] = items[j]
    items[j] = swap
  }
  return items
}

export function randomItem<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error('randomItem needs a non-empty list')
  return items[randomInt(items.length)]
}
