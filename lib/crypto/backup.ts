import { fromBase64, toBase64, toBytes, utf8Decode, utf8Encode } from '@/lib/crypto/bytes'
import {
  IV_BYTES,
  KDF_DEFAULTS,
  KDF_SALT_BYTES,
  backupAad,
  type KdfParams,
} from '@/lib/crypto/constants'
import { assertKdfParamsAllowed, deriveKeyMaterial } from '@/lib/crypto/kdf'
import { randomBytes } from '@/lib/crypto/random'
import { isItemPayload, type ItemPayload } from '@/lib/vault/types'

/**
 * Encrypted backup files.
 *
 * A backup is sealed under its own password, independent of the master
 * password, so a backup can still be opened after the master password changes.
 */

export const BACKUP_FORMAT = 'tijori-backup'
export const BACKUP_VERSION = 1

export interface BackupKdf {
  algorithm: 'argon2id'
  salt: string
  memoryKiB: number
  iterations: number
  parallelism: number
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  itemCount: number
  kdf: BackupKdf
  iv: string
  ciphertext: string
}

export class BackupFormatError extends Error {
  constructor(message = 'That file isn’t a Tijori backup.') {
    super(message)
    this.name = 'BackupFormatError'
  }
}

export class BackupPasswordError extends Error {
  constructor() {
    super('That backup password didn’t work. Check it and try again.')
    this.name = 'BackupPasswordError'
  }
}

async function backupKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  params: KdfParams,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const material = await deriveKeyMaterial(password, salt, params)
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM', length: 256 }, false, usages)
}

export async function createBackup(
  payloads: readonly ItemPayload[],
  password: string,
): Promise<BackupFile> {
  const salt = randomBytes(KDF_SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await backupKey(password, salt, KDF_DEFAULTS, ['encrypt'])
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8Encode(backupAad()) },
    key,
    utf8Encode(JSON.stringify(payloads)),
  )
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    itemCount: payloads.length,
    kdf: {
      algorithm: 'argon2id',
      salt: toBase64(salt),
      memoryKiB: KDF_DEFAULTS.memoryKiB,
      iterations: KDF_DEFAULTS.iterations,
      parallelism: KDF_DEFAULTS.parallelism,
    },
    iv: toBase64(iv),
    ciphertext: toBase64(toBytes(sealed)),
  }
}

/** Parse untrusted JSON into a backup file shape. */
export function parseBackupFile(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupFormatError()
  }
  if (typeof parsed !== 'object' || parsed === null) throw new BackupFormatError()
  const record = parsed as Record<string, unknown>
  if (record.format !== BACKUP_FORMAT) throw new BackupFormatError()
  if (typeof record.version !== 'number' || record.version > BACKUP_VERSION) {
    throw new BackupFormatError('This backup was made by a newer version of the app.')
  }
  const kdf = record.kdf
  if (typeof kdf !== 'object' || kdf === null) throw new BackupFormatError()
  const kdfRecord = kdf as Record<string, unknown>
  if (
    kdfRecord.algorithm !== 'argon2id' ||
    typeof kdfRecord.salt !== 'string' ||
    typeof kdfRecord.memoryKiB !== 'number' ||
    typeof kdfRecord.iterations !== 'number' ||
    typeof kdfRecord.parallelism !== 'number' ||
    typeof record.iv !== 'string' ||
    typeof record.ciphertext !== 'string'
  ) {
    throw new BackupFormatError()
  }
  return {
    format: BACKUP_FORMAT,
    version: record.version,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
    itemCount: typeof record.itemCount === 'number' ? record.itemCount : 0,
    kdf: {
      algorithm: 'argon2id',
      salt: kdfRecord.salt,
      memoryKiB: kdfRecord.memoryKiB,
      iterations: kdfRecord.iterations,
      parallelism: kdfRecord.parallelism,
    },
    iv: record.iv,
    ciphertext: record.ciphertext,
  }
}

export async function readBackup(file: BackupFile, password: string): Promise<ItemPayload[]> {
  const params: KdfParams = {
    memoryKiB: file.kdf.memoryKiB,
    iterations: file.kdf.iterations,
    parallelism: file.kdf.parallelism,
  }
  assertKdfParamsAllowed(params)

  const key = await backupKey(password, fromBase64(file.kdf.salt), params, ['decrypt'])
  let json: string
  try {
    const opened = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(file.iv),
        additionalData: utf8Encode(backupAad()),
      },
      key,
      fromBase64(file.ciphertext),
    )
    json = utf8Decode(toBytes(opened))
  } catch {
    throw new BackupPasswordError()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new BackupFormatError('The backup opened but its contents are damaged.')
  }
  if (!Array.isArray(parsed)) throw new BackupFormatError('The backup opened but its contents are damaged.')
  return parsed.filter(isItemPayload)
}
