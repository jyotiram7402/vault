import { RECOVERY_KEY_BYTES } from '@/lib/crypto/constants'
import { randomBytes } from '@/lib/crypto/random'

/**
 * The Recovery Key: 20 random bytes (160 bits) written as 32 Crockford base32
 * characters in 8 groups of 4, like `7KQ2-M9XD-…`.
 *
 * Crockford's alphabet leaves out I, L, O and U, so the only characters that
 * can be confused are handled when decoding: I and L become 1, O becomes 0.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const RECOVERY_KEY_LENGTH = 32
export const RECOVERY_GROUP_SIZE = 4

export class InvalidRecoveryKeyError extends Error {
  constructor() {
    super('That recovery key didn’t work. Check for typos.')
    this.name = 'InvalidRecoveryKeyError'
  }
}

/** 20 fresh bytes plus their formatted text. */
export function generateRecoveryKey(): { bytes: Uint8Array<ArrayBuffer>; text: string } {
  const bytes = randomBytes(RECOVERY_KEY_BYTES)
  return { bytes, text: formatRecoveryKey(encodeRecoveryKey(bytes)) }
}

/** 20 bytes → 32 unformatted base32 characters. */
export function encodeRecoveryKey(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** `7KQ2M9XD…` → `7KQ2-M9XD-…` */
export function formatRecoveryKey(raw: string): string {
  const groups: string[] = []
  for (let i = 0; i < raw.length; i += RECOVERY_GROUP_SIZE) {
    groups.push(raw.slice(i, i + RECOVERY_GROUP_SIZE))
  }
  return groups.join('-')
}

/** Strip spacing and hyphens, upper-case, and fix the look-alike characters. */
export function canonicalizeRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
}

/** Decode whatever the user typed back into the 20 bytes. */
export function decodeRecoveryKey(input: string): Uint8Array<ArrayBuffer> {
  const clean = canonicalizeRecoveryKey(input)
  if (clean.length !== RECOVERY_KEY_LENGTH) throw new InvalidRecoveryKeyError()

  const out = new Uint8Array(RECOVERY_KEY_BYTES)
  let bits = 0
  let value = 0
  let index = 0
  for (const character of clean) {
    const digit = ALPHABET.indexOf(character)
    if (digit < 0) throw new InvalidRecoveryKeyError()
    value = (value << 5) | digit
    bits += 5
    if (bits >= 8) {
      if (index >= out.length) throw new InvalidRecoveryKeyError()
      out[index] = (value >>> (bits - 8)) & 255
      index += 1
      bits -= 8
    }
  }
  if (index !== RECOVERY_KEY_BYTES) throw new InvalidRecoveryKeyError()
  return out
}

/** `true` when the text could be a Recovery Key, for enabling the button. */
export function looksLikeRecoveryKey(input: string): boolean {
  return canonicalizeRecoveryKey(input).length === RECOVERY_KEY_LENGTH
}

/** The last four characters, used to confirm the key was really written down. */
export function recoveryKeyTail(text: string): string {
  return canonicalizeRecoveryKey(text).slice(-4)
}
