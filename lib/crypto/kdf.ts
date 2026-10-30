import { utf8Encode } from '@/lib/crypto/bytes'
import { KDF_MINIMUMS, type KdfParams } from '@/lib/crypto/constants'

/**
 * Key derivation.
 *
 * Argon2id turns a human password into 32 bytes of key material. HKDF-SHA-256
 * then separates that material into purpose-bound AES keys, so the same bytes
 * can never be reused for two different jobs.
 *
 * hash-wasm is loaded with a dynamic import: the WebAssembly module is a few
 * hundred kilobytes and is only needed on the unlock and setup paths.
 */

/**
 * The hash-wasm module, fetched once and shared.
 *
 * It is a few hundred kilobytes of WebAssembly, and it used to be requested
 * only at the moment someone pressed Unlock — so the download sat in front of
 * Argon2id instead of beside it. `preloadKdf()` lets the vault gate start that
 * fetch while it is already waiting on the network for the keyset.
 */
let hashWasm: Promise<typeof import('hash-wasm')> | null = null

function loadHashWasm(): Promise<typeof import('hash-wasm')> {
  if (!hashWasm) {
    hashWasm = import('hash-wasm').catch((error: unknown) => {
      // Let a later attempt try again rather than caching the failure.
      hashWasm = null
      throw error
    })
  }
  return hashWasm
}

/** Fire-and-forget warm-up. Safe to call more than once; failures are ignored. */
export function preloadKdf(): void {
  void loadHashWasm().catch(() => undefined)
}

export class WeakKdfParamsError extends Error {
  constructor() {
    super(
      'This vault was created with settings that are no longer considered safe. ' +
        'Open it on a device with the current version of the app.',
    )
    this.name = 'WeakKdfParamsError'
  }
}

/** Refuse stored parameters below the minimum rather than deriving a weak key. */
export function assertKdfParamsAllowed(params: KdfParams): void {
  if (
    params.memoryKiB < KDF_MINIMUMS.memoryKiB ||
    params.iterations < KDF_MINIMUMS.iterations ||
    params.parallelism < KDF_MINIMUMS.parallelism
  ) {
    throw new WeakKdfParamsError()
  }
}

/**
 * Argon2id over the NFKC-normalised master password.
 * Normalisation matters: the same password typed on two keyboards can produce
 * different Unicode byte sequences otherwise.
 */
export async function deriveKeyMaterial(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  params: KdfParams,
): Promise<Uint8Array<ArrayBuffer>> {
  assertKdfParamsAllowed(params)
  const { argon2id } = await loadHashWasm()
  const material = await argon2id({
    password: password.normalize('NFKC'),
    salt,
    memorySize: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  })
  // hash-wasm returns a plain Uint8Array; copy it so the buffer is an ArrayBuffer.
  return new Uint8Array(material)
}

/**
 * HKDF-SHA-256 over raw key material into an AES-GCM-256 key.
 * The salt is 32 zero bytes: the material is already high-entropy, and the
 * `info` string provides the domain separation.
 */
export async function hkdfAesKey(
  material: Uint8Array<ArrayBuffer>,
  info: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveKey'])
  // importKey has copied the bytes into the CryptoKey; the raw material has
  // no further use, so overwrite it. Defence in depth, not a guarantee —
  // JavaScript cannot promise no other copy exists (the wasm heap, the GC) —
  // but it removes the one copy we do control.
  material.fill(0)
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: utf8Encode(info),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  )
}
