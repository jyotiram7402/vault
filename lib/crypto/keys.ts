import { fromBase64, toBase64, toBytes, utf8Decode, utf8Encode } from '@/lib/crypto/bytes'
import {
  CRYPTO_PROTOCOL,
  IV_BYTES,
  KDF_SALT_BYTES,
  type KdfParams,
  masterKekInfo,
  recoveryKekInfo,
} from '@/lib/crypto/constants'
import { deriveKeyMaterial, hkdfAesKey } from '@/lib/crypto/kdf'
import { randomBytes } from '@/lib/crypto/random'

/** A wrapped key plus the IV it was wrapped under, both as base64. */
export interface WrappedKey {
  wrapped: string
  iv: string
}

/** A wrong master password surfaces as this, never as a stack trace. */
export class WrongPasswordError extends Error {
  constructor(message = 'That master password didn’t open the vault. Check Caps Lock and try again.') {
    super(message)
    this.name = 'WrongPasswordError'
  }
}

export class RoundTripError extends Error {
  constructor() {
    super('The new key failed its safety check and was not saved. Nothing has changed. Try again.')
    this.name = 'RoundTripError'
  }
}

export function newKdfSalt(): Uint8Array<ArrayBuffer> {
  return randomBytes(KDF_SALT_BYTES)
}

/** Key-encryption key from the master password. Wraps and unwraps only. */
export async function deriveMasterKek(
  masterPassword: string,
  salt: Uint8Array<ArrayBuffer>,
  params: KdfParams,
): Promise<CryptoKey> {
  const material = await deriveKeyMaterial(masterPassword, salt, params)
  return hkdfAesKey(material, masterKekInfo(), ['wrapKey', 'unwrapKey'])
}

/** Key-encryption key from the 20 bytes behind a Recovery Key. */
export async function deriveRecoveryKek(secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return hkdfAesKey(secret, recoveryKekInfo(), ['wrapKey', 'unwrapKey'])
}

/**
 * The vault key. Created once at setup and extractable only so it can be
 * wrapped; the copy kept for the session is always non-extractable.
 */
export function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function wrapVaultKey(
  vaultKey: CryptoKey,
  kek: CryptoKey,
  aad: string,
): Promise<WrappedKey> {
  const iv = randomBytes(IV_BYTES)
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, kek, {
    name: 'AES-GCM',
    iv,
    additionalData: utf8Encode(aad),
  })
  return { wrapped: toBase64(toBytes(wrapped)), iv: toBase64(iv) }
}

export async function unwrapVaultKey(
  wrapped: string,
  iv: string,
  kek: CryptoKey,
  aad: string,
  extractable: boolean,
): Promise<CryptoKey> {
  try {
    return await crypto.subtle.unwrapKey(
      'raw',
      fromBase64(wrapped),
      kek,
      { name: 'AES-GCM', iv: fromBase64(iv), additionalData: utf8Encode(aad) },
      { name: 'AES-GCM', length: 256 },
      extractable,
      ['encrypt', 'decrypt'],
    )
  } catch (error) {
    // An OperationError here means the KEK is wrong, i.e. the password is wrong.
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new WrongPasswordError()
    }
    throw error
  }
}

const ROUND_TRIP_PROBE = `${CRYPTO_PROTOCOL}:round-trip`

/**
 * Never save a keyset that hasn't passed this.
 *
 * Unwraps the key again with exactly the stored material, then encrypts and
 * decrypts a test value with the result. A keyset that cannot be unwrapped
 * locks the user out of their vault forever, so the check is not optional.
 */
export async function verifyWrappedKey(
  wrappedKey: WrappedKey,
  kek: CryptoKey,
  aad: string,
): Promise<void> {
  let key: CryptoKey
  try {
    key = await unwrapVaultKey(wrappedKey.wrapped, wrappedKey.iv, kek, aad, false)
  } catch {
    throw new RoundTripError()
  }
  try {
    const iv = randomBytes(IV_BYTES)
    const probe = utf8Encode(ROUND_TRIP_PROBE)
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, probe)
    const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, sealed)
    if (utf8Decode(toBytes(opened)) !== ROUND_TRIP_PROBE) throw new RoundTripError()
  } catch {
    throw new RoundTripError()
  }
}

/**
 * Confirms that two wrapped copies really hold the same key, so recovering
 * with the Recovery Key can never produce a different vault key.
 */
export async function assertSameKey(a: CryptoKey, b: CryptoKey): Promise<void> {
  const iv = randomBytes(IV_BYTES)
  const probe = utf8Encode(ROUND_TRIP_PROBE)
  try {
    const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, a, probe)
    const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, b, sealed)
    if (utf8Decode(toBytes(opened)) !== ROUND_TRIP_PROBE) throw new RoundTripError()
  } catch {
    throw new RoundTripError()
  }
}
