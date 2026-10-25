/**
 * ============================================================================
 *  PROTOCOL CONSTANTS — DO NOT CHANGE
 * ============================================================================
 *  These strings are mixed into every key derivation and every authenticated
 *  encryption as HKDF `info` and AES-GCM `additionalData`. Changing any of
 *  them makes EVERY EXISTING VAULT IMPOSSIBLE TO OPEN. There is no migration
 *  and no recovery: the data is simply lost.
 *
 *  They are deliberately NOT built from APP_NAME. Renaming the app must never
 *  touch the crypto protocol.
 *
 *  A new protocol would mean a new constant (`tijori-vault-v2`) plus code that
 *  re-wraps and re-encrypts everything while both versions are supported.
 * ============================================================================
 */

export const CRYPTO_PROTOCOL = 'tijori-vault-v1'

// ---------- HKDF info strings ----------

export function masterKekInfo(): string {
  return `${CRYPTO_PROTOCOL}:master-kek`
}

export function recoveryKekInfo(): string {
  return `${CRYPTO_PROTOCOL}:recovery-kek`
}

export function passkeyKekInfo(): string {
  return `${CRYPTO_PROTOCOL}:passkey-kek`
}

// ---------- AES-GCM additionalData (AAD) strings ----------

/** Binds the wrapped vault key to this user. */
export function vaultKeyAad(userId: string): string {
  return `${CRYPTO_PROTOCOL}:vault-key:${userId}`
}

/** Binds the recovery-wrapped vault key to this user. */
export function recoveryVaultKeyAad(userId: string): string {
  return `${CRYPTO_PROTOCOL}:recovery-vault-key:${userId}`
}

/** Binds a passkey-wrapped vault key to this user and credential. */
export function passkeyVaultKeyAad(userId: string, credentialIdBase64Url: string): string {
  return `${CRYPTO_PROTOCOL}:passkey-vault-key:${userId}:${credentialIdBase64Url}`
}

/**
 * Binds an item's ciphertext to this user, this item id and this format
 * version. Ciphertext cannot be moved between items or between users.
 */
export function itemAad(userId: string, itemId: string, encVersion: number): string {
  return `${CRYPTO_PROTOCOL}:item:${userId}:${itemId}:${encVersion}`
}

/** Encrypted backup files. */
export function backupAad(): string {
  return `${CRYPTO_PROTOCOL}:backup`
}

// ---------- Parameters ----------

export interface KdfParams {
  memoryKiB: number
  iterations: number
  parallelism: number
}

/** New keysets always use these. Existing vaults keep the values in their row. */
export const KDF_DEFAULTS: KdfParams = {
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
}

/** Stored parameters below these are refused: too weak to derive from. */
export const KDF_MINIMUMS: KdfParams = {
  memoryKiB: 19456,
  iterations: 2,
  parallelism: 1,
}

/** Format version of an item's encrypted payload. */
export const ENC_VERSION = 1

/** Payloads are padded with spaces to a multiple of this many bytes. */
export const PAD_BLOCK = 256

/** Bytes in a KDF salt. */
export const KDF_SALT_BYTES = 16

/** Bytes in every AES-GCM initialisation vector. */
export const IV_BYTES = 12

/** Bytes behind a Recovery Key (160 bits → 32 base32 characters). */
export const RECOVERY_KEY_BYTES = 20

/** Bytes in a WebAuthn PRF salt. */
export const PRF_SALT_BYTES = 32
