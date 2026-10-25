/**
 * Byte helpers.
 *
 * Every function that hands bytes to Web Crypto returns `Uint8Array<ArrayBuffer>`:
 * since TypeScript 5.7 `Uint8Array` is generic, and `crypto.subtle` wants a
 * buffer backed by a real `ArrayBuffer`, not a `SharedArrayBuffer`.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function utf8Encode(value: string): Uint8Array<ArrayBuffer> {
  // TextEncoder always allocates a fresh ArrayBuffer-backed view.
  return encoder.encode(value) as Uint8Array<ArrayBuffer>
}

export function utf8Decode(bytes: Uint8Array | ArrayBuffer): string {
  return decoder.decode(bytes)
}

export function toBytes(buffer: ArrayBuffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer)
}

/** Standard base64. Converted in chunks: spreading a big array overflows the stack. */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = padded.length % 4
  return fromBase64(remainder === 0 ? padded : padded + '='.repeat(4 - remainder))
}

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Length-independent comparison, so timing never reveals how much matched. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

/** `true` when the text decodes as base64 of exactly `length` bytes. */
export function isBase64OfLength(value: unknown, length: number): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    return fromBase64(value).length === length
  } catch {
    return false
  }
}
