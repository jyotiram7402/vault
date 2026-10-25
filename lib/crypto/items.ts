import { fromBase64, toBase64, toBytes, utf8Decode, utf8Encode } from '@/lib/crypto/bytes'
import { ENC_VERSION, IV_BYTES, PAD_BLOCK, itemAad } from '@/lib/crypto/constants'
import { randomBytes } from '@/lib/crypto/random'
import { isItemPayload, type EncryptedPayload, type ItemPayload } from '@/lib/vault/types'

export class ItemDecryptError extends Error {
  constructor(message = 'This item couldn’t be read.') {
    super(message)
    this.name = 'ItemDecryptError'
  }
}

/**
 * Pad with spaces to a multiple of PAD_BLOCK bytes.
 *
 * JSON.parse ignores trailing whitespace, so the padding costs nothing on the
 * way back. It hides the exact length of a password or note from the server:
 * ciphertext sizes only reveal which 256-byte step an item falls into.
 */
function padToBlock(json: string): Uint8Array<ArrayBuffer> {
  const length = utf8Encode(json).length
  const remainder = length % PAD_BLOCK
  const padding = remainder === 0 ? 0 : PAD_BLOCK - remainder
  return utf8Encode(padding > 0 ? json + ' '.repeat(padding) : json)
}

/**
 * Encrypt one item.
 *
 * `itemId` must be the id the row will be inserted with: it is part of the
 * AAD, which is what stops ciphertext from being swapped between items.
 */
export async function encryptItem(
  vaultKey: CryptoKey,
  userId: string,
  itemId: string,
  payload: ItemPayload,
): Promise<EncryptedPayload> {
  const json = JSON.stringify(payload)
  const iv = randomBytes(IV_BYTES)
  const aad = utf8Encode(itemAad(userId, itemId, ENC_VERSION))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    vaultKey,
    padToBlock(json),
  )
  const encrypted: EncryptedPayload = {
    ciphertext: toBase64(toBytes(sealed)),
    iv: toBase64(iv),
    encVersion: ENC_VERSION,
  }

  // Cheap insurance: decrypt what we are about to send and compare.
  const check = await decryptItem(vaultKey, userId, itemId, encrypted)
  if (JSON.stringify(check) !== json) {
    throw new Error('This item failed its safety check and was not saved. Try again.')
  }
  return encrypted
}

/** Decrypt and validate one item. Throws `ItemDecryptError` on any problem. */
export async function decryptItem(
  vaultKey: CryptoKey,
  userId: string,
  itemId: string,
  encrypted: EncryptedPayload,
): Promise<ItemPayload> {
  let json: string
  try {
    const aad = utf8Encode(itemAad(userId, itemId, encrypted.encVersion))
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(encrypted.iv), additionalData: aad },
      vaultKey,
      fromBase64(encrypted.ciphertext),
    )
    json = utf8Decode(toBytes(opened))
  } catch {
    throw new ItemDecryptError()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new ItemDecryptError()
  }
  if (!isItemPayload(parsed)) throw new ItemDecryptError()
  return parsed
}

/**
 * The only place that builds a row for Supabase.
 *
 * Nothing readable may ever be added here: no title, URL, username, tags,
 * category, favourite flag or real timestamp. They all live inside ciphertext.
 */
export function toInsertRow(
  id: string,
  userId: string,
  encrypted: EncryptedPayload,
): { id: string; user_id: string; ciphertext: string; iv: string; enc_version: number } {
  return {
    id,
    user_id: userId,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    enc_version: encrypted.encVersion,
  }
}

export function toUpdateRow(encrypted: EncryptedPayload): {
  ciphertext: string
  iv: string
  enc_version: number
} {
  return {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    enc_version: encrypted.encVersion,
  }
}
