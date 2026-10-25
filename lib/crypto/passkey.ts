import { fromBase64, fromBase64Url, toBase64, toBase64Url, toBytes } from '@/lib/crypto/bytes'
import { PRF_SALT_BYTES, passkeyKekInfo, passkeyVaultKeyAad } from '@/lib/crypto/constants'
import { hkdfAesKey } from '@/lib/crypto/kdf'
import { unwrapVaultKey, verifyWrappedKey, wrapVaultKey, type WrappedKey } from '@/lib/crypto/keys'
import { randomBytes } from '@/lib/crypto/random'
import type { PasskeyRow } from '@/lib/vault/types'

/**
 * Quick unlock with a passkey, through the WebAuthn PRF extension.
 *
 * The authenticator derives 32 secret bytes from a salt we store, but only
 * after it has verified the user (fingerprint, face or device PIN). Those
 * bytes become a key-encryption key for a third wrapped copy of the vault key.
 *
 * NOTE ON THE CHALLENGE: no server checks it here, which would be a flaw in a
 * normal WebAuthn login. It isn't one in this design, because nothing is
 * authenticated by the ceremony. Security comes entirely from the PRF output,
 * which only this authenticator can produce and only after user verification.
 * A replayed or attacker-chosen challenge yields no key material.
 *
 * Quick unlock never replaces the master password; it is an extra wrapper that
 * can be removed at any time.
 */

// ---------- Local PRF types (lib.dom may not declare them yet) ----------

interface PrfValues {
  first: BufferSource
  second?: BufferSource
}

interface PrfInput {
  eval?: PrfValues
  evalByCredential?: Record<string, PrfValues>
}

interface PrfOutput {
  enabled?: boolean
  results?: { first?: ArrayBuffer; second?: ArrayBuffer }
}

interface ExtensionsWithPrf {
  prf?: PrfInput
}

interface ExtensionResultsWithPrf {
  prf?: PrfOutput
}

interface ClientCapabilities {
  [key: string]: boolean | undefined
}

export class PasskeyUnsupportedError extends Error {
  constructor(message = 'This device doesn’t support quick unlock.') {
    super(message)
    this.name = 'PasskeyUnsupportedError'
  }
}

export class PasskeyCancelledError extends Error {
  constructor(message = 'Quick unlock was cancelled.') {
    super(message)
    this.name = 'PasskeyCancelledError'
  }
}

/** Only ever call this from an effect or an event handler. */
export function isPasskeyApiAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

/**
 * `true` when the browser says PRF is available, `false` when it says it is
 * not, and `null` when it can't tell (then we try and handle the failure).
 */
export async function prfCapability(): Promise<boolean | null> {
  if (!isPasskeyApiAvailable()) return false
  const ctor = window.PublicKeyCredential as typeof PublicKeyCredential & {
    getClientCapabilities?: () => Promise<ClientCapabilities>
  }
  if (typeof ctor.getClientCapabilities !== 'function') return null
  try {
    const capabilities = await ctor.getClientCapabilities()
    const value = capabilities['extension:prf']
    return typeof value === 'boolean' ? value : null
  } catch {
    return null
  }
}

function extensionResults(credential: PublicKeyCredential): ExtensionResultsWithPrf {
  // The PRF results are not in lib.dom's type yet; cast through unknown.
  return credential.getClientExtensionResults() as unknown as ExtensionResultsWithPrf
}

function prfExtension(input: PrfInput): AuthenticationExtensionsClientInputs {
  const extensions: ExtensionsWithPrf = { prf: input }
  return extensions as unknown as AuthenticationExtensionsClientInputs
}

function asCredential(value: Credential | null): PublicKeyCredential {
  if (value === null) throw new PasskeyCancelledError()
  return value as PublicKeyCredential
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  )
}

async function prfBytes(
  credentialRawId: ArrayBuffer,
  salt: Uint8Array<ArrayBuffer>,
  existing: PrfOutput | undefined,
): Promise<Uint8Array<ArrayBuffer>> {
  if (existing?.results?.first) return toBytes(existing.results.first)

  // Many platforms only return PRF results during an assertion, not at
  // creation time. Ask again straight away with the same salt.
  const assertion = asCredential(
    await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: credentialRawId }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: prfExtension({ eval: { first: salt } }),
      },
    }),
  )
  const result = extensionResults(assertion).prf?.results?.first
  if (!result) throw new PasskeyUnsupportedError()
  return toBytes(result)
}

async function passkeyKek(secret: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return hkdfAesKey(secret, passkeyKekInfo(), ['wrapKey', 'unwrapKey'])
}

export interface PasskeyEnrolment {
  credentialId: string
  prfSalt: string
  wrappedKey: WrappedKey
}

/**
 * Create a credential and wrap the vault key under its PRF output.
 * `vaultKey` must be an extractable copy (the caller re-asked for the master
 * password to get one) and should be dropped as soon as this returns.
 */
export async function enrollPasskey(options: {
  userId: string
  email: string
  appName: string
  vaultKey: CryptoKey
}): Promise<PasskeyEnrolment> {
  if (!isPasskeyApiAvailable()) throw new PasskeyUnsupportedError()
  const prfSalt = randomBytes(PRF_SALT_BYTES)

  let credential: PublicKeyCredential
  try {
    credential = asCredential(
      await navigator.credentials.create({
        publicKey: {
          rp: { name: options.appName, id: location.hostname },
          user: {
            id: randomBytes(16),
            name: options.email,
            displayName: options.email,
          },
          challenge: randomBytes(32),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
          timeout: 60_000,
          extensions: prfExtension({ eval: { first: prfSalt } }),
        },
      }),
    )
  } catch (error) {
    if (isCancellation(error)) throw new PasskeyCancelledError()
    throw new PasskeyUnsupportedError()
  }

  const prf = extensionResults(credential).prf
  if (prf?.enabled === false) throw new PasskeyUnsupportedError()

  const secret = await prfBytes(credential.rawId, prfSalt, prf)
  const kek = await passkeyKek(secret)
  const credentialId = toBase64Url(toBytes(credential.rawId))
  const aad = passkeyVaultKeyAad(options.userId, credentialId)
  const wrappedKey = await wrapVaultKey(options.vaultKey, kek, aad)
  await verifyWrappedKey(wrappedKey, kek, aad)

  return { credentialId, prfSalt: toBase64(prfSalt), wrappedKey }
}

export interface PasskeyUnlockResult {
  vaultKey: CryptoKey
  passkeyId: string
}

/**
 * Unlock with any enrolled passkey. Returns a NON-extractable vault key, the
 * only kind kept for a session.
 */
export async function unlockWithPasskey(
  userId: string,
  rows: readonly PasskeyRow[],
): Promise<PasskeyUnlockResult> {
  if (!isPasskeyApiAvailable()) throw new PasskeyUnsupportedError()
  if (rows.length === 0) throw new PasskeyUnsupportedError('No device is set up for quick unlock.')

  const evalByCredential: Record<string, PrfValues> = {}
  const allowCredentials: PublicKeyCredentialDescriptor[] = []
  for (const row of rows) {
    // prf_salt is stored as standard base64; credential_id as base64url.
    evalByCredential[row.credential_id] = { first: fromBase64(row.prf_salt) }
    allowCredentials.push({ type: 'public-key', id: fromBase64Url(row.credential_id) })
  }

  let assertion: PublicKeyCredential
  try {
    assertion = asCredential(
      await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials,
          userVerification: 'required',
          timeout: 60_000,
          extensions: prfExtension({ evalByCredential }),
        },
      }),
    )
  } catch (error) {
    if (isCancellation(error)) throw new PasskeyCancelledError()
    throw new PasskeyUnsupportedError()
  }

  const credentialId = toBase64Url(toBytes(assertion.rawId))
  const row = rows.find((candidate) => candidate.credential_id === credentialId)
  if (!row) throw new PasskeyUnsupportedError('That device isn’t set up for this vault.')

  const result = extensionResults(assertion).prf?.results?.first
  if (!result) throw new PasskeyUnsupportedError()

  const kek = await passkeyKek(toBytes(result))
  const vaultKey = await unwrapVaultKey(
    row.wrapped_key,
    row.wrapped_key_iv,
    kek,
    passkeyVaultKeyAad(userId, credentialId),
    false,
  )
  return { vaultKey, passkeyId: row.id }
}
