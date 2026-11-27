import { fromBase64 } from '@/lib/crypto/bytes'
import { vaultKeyAad } from '@/lib/crypto/constants'
import { WrongPasswordError, deriveMasterKek, unwrapVaultKey } from '@/lib/crypto/keys'
import {
  clearUnlockFailures,
  recordUnlockFailure,
  unlockWaitSeconds,
} from '@/lib/vault/auto-lock'
import type { KeysetRow } from '@/lib/vault/types'

/**
 * Checking the master password while the vault is already open.
 *
 * Six places ask for it again: the reveal prompt, both exports, changing the
 * master password, a new Recovery Key, quick-unlock enrolment and deleting
 * the account. Each used to derive and unwrap on its own, with no throttle,
 * so someone at an unlocked machine could guess through any of them at
 * Argon2id speed while the lock screen made the same person wait up to a
 * minute between tries. They all come through here now and share the lock
 * screen's counter in lib/vault/auto-lock.ts.
 *
 * Returns the vault key, non-extractable unless a re-wrap flow asks for an
 * extractable copy; callers that only need a yes or no discard it. Throws
 * UnlockThrottledError before deriving anything while a wait is owed,
 * WrongPasswordError for a wrong password (recorded against the throttle),
 * and whatever the KDF throws for parameters below the minimums.
 */
export class UnlockThrottledError extends Error {
  readonly seconds: number

  constructor(seconds: number) {
    super(`Too many wrong master passwords. Wait ${seconds} seconds and try again.`)
    this.name = 'UnlockThrottledError'
    this.seconds = seconds
  }
}

export async function unwrapWithMasterPassword(
  keyset: KeysetRow,
  userId: string,
  masterPassword: string,
  extractable = false,
): Promise<CryptoKey> {
  const wait = unlockWaitSeconds()
  if (wait > 0) throw new UnlockThrottledError(wait)

  const kek = await deriveMasterKek(masterPassword, fromBase64(keyset.kdf_salt), {
    memoryKiB: keyset.kdf_memory_kib,
    iterations: keyset.kdf_iterations,
    parallelism: keyset.kdf_parallelism,
  })

  try {
    const key = await unwrapVaultKey(
      keyset.wrapped_key,
      keyset.wrapped_key_iv,
      kek,
      vaultKeyAad(userId),
      extractable,
    )
    clearUnlockFailures()
    return key
  } catch (cause) {
    if (cause instanceof WrongPasswordError) recordUnlockFailure()
    throw cause
  }
}
