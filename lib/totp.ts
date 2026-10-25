import { utf8Encode } from '@/lib/crypto/bytes'

/**
 * Time-based one-time passwords (RFC 6238) on top of Web Crypto HMAC.
 *
 * Accepts either a bare base32 secret (spaces allowed, as printed on setup
 * pages) or a full `otpauth://totp/…` URI as produced by a QR code.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512'

export interface TotpConfig {
  secret: Uint8Array<ArrayBuffer>
  algorithm: TotpAlgorithm
  digits: number
  period: number
  label?: string
  issuer?: string
}

export class InvalidTotpError extends Error {
  constructor(message = 'That doesn’t look like a valid setup key.') {
    super(message)
    this.name = 'InvalidTotpError'
  }
}

/** RFC 4648 base32, ignoring spacing, hyphens and padding. */
export function decodeBase32(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (clean.length === 0) throw new InvalidTotpError()

  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index < 0) throw new InvalidTotpError()
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  if (bytes.length === 0) throw new InvalidTotpError()
  return new Uint8Array(bytes)
}

function normalizeAlgorithm(value: string | null): TotpAlgorithm {
  switch ((value ?? '').toUpperCase().replace('-', '')) {
    case 'SHA256':
      return 'SHA-256'
    case 'SHA512':
      return 'SHA-512'
    case 'SHA1':
    case '':
      return 'SHA-1'
    default:
      throw new InvalidTotpError('That setup key uses an algorithm this app doesn’t support.')
  }
}

/** Parse a bare secret or an otpauth:// URI into a usable config. */
export function parseTotpInput(input: string): TotpConfig {
  const trimmed = input.trim()
  if (!trimmed) throw new InvalidTotpError()

  if (/^otpauth:\/\//i.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      throw new InvalidTotpError()
    }
    if (url.host.toLowerCase() !== 'totp') {
      throw new InvalidTotpError('Only time-based (TOTP) codes are supported.')
    }

    const secretParam = url.searchParams.get('secret')
    if (!secretParam) throw new InvalidTotpError()

    const digits = Number.parseInt(url.searchParams.get('digits') ?? '6', 10)
    const period = Number.parseInt(url.searchParams.get('period') ?? '30', 10)
    if (digits !== 6 && digits !== 8) {
      throw new InvalidTotpError('Only 6- and 8-digit codes are supported.')
    }
    if (!Number.isFinite(period) || period < 10 || period > 120) throw new InvalidTotpError()

    const path = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const [issuerFromPath, labelFromPath] = path.includes(':')
      ? path.split(':', 2)
      : [undefined, path]

    return {
      secret: decodeBase32(secretParam),
      algorithm: normalizeAlgorithm(url.searchParams.get('algorithm')),
      digits,
      period,
      label: labelFromPath || undefined,
      issuer: url.searchParams.get('issuer') ?? issuerFromPath ?? undefined,
    }
  }

  return {
    secret: decodeBase32(trimmed),
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
  }
}

function counterBytes(counter: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8)
  let value = counter
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = value & 255
    value = Math.floor(value / 256)
  }
  return bytes
}

/** The code for a given moment. `nowMs` exists so the self-test can pin time. */
export async function generateTotp(config: TotpConfig, nowMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(nowMs / 1000 / config.period)
  const key = await crypto.subtle.importKey(
    'raw',
    config.secret,
    { name: 'HMAC', hash: config.algorithm },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes(counter)))

  // Dynamic truncation, RFC 4226 §5.4.
  const offset = signature[signature.length - 1] & 0x0f
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    (signature[offset + 1] << 16) |
    (signature[offset + 2] << 8) |
    signature[offset + 3]

  const modulus = 10 ** config.digits
  return String(binary % modulus).padStart(config.digits, '0')
}

/** Seconds left before the current code rotates. */
export function totpSecondsRemaining(config: TotpConfig, nowMs: number = Date.now()): number {
  const seconds = nowMs / 1000
  return config.period - (seconds % config.period)
}

/** `123456` → `123 456` */
export function formatTotpCode(code: string): string {
  const half = Math.ceil(code.length / 2)
  return `${code.slice(0, half)} ${code.slice(half)}`
}

/**
 * RFC 6238 test vector, run only in development and only from an effect.
 * SHA-1, ASCII secret "12345678901234567890", t = 59s, 8 digits → 94287082.
 */
export async function runTotpSelfTest(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  const config: TotpConfig = {
    secret: utf8Encode('12345678901234567890'),
    algorithm: 'SHA-1',
    digits: 8,
    period: 30,
  }
  const code = await generateTotp(config, 59_000)
  if (code !== '94287082') {
    console.warn(`TOTP self-test failed: expected 94287082, got ${code}`)
  }
}
