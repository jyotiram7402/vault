# Security

Vault is a zero-knowledge password manager: everything is encrypted in your browser before anything is sent, and the server only ever stores ciphertext.

This document describes what that means precisely, what it does not protect against, and how to report a problem.

---

## Threat model

### What this app is designed to resist

| Threat | Defence |
|---|---|
| The database is stolen or leaked | Every item is AES-256-GCM ciphertext. The key is wrapped under a key derived from a master password that was never sent. |
| The hosting provider or a database administrator reads the data | Same. There is no server-side key, no escrow and no recovery channel. |
| Another user tries to read your rows | Row Level Security on every table, with owner-only policies, plus AAD binding each ciphertext to its owner's user id. |
| Someone steals your account password | They can sign in, but not open the vault. With two-factor on, Row Level Security refuses them even the ciphertext. |
| An attacker swaps one item's ciphertext for another's | AES-GCM additional authenticated data binds every ciphertext to the user id, the item id and the format version. |
| Someone walks up to your unlocked laptop | Auto-lock, lock-on-hidden, cross-tab locking, a privacy screen that blurs secrets when the window loses focus, and clipboard clearing. |
| Offline brute force of the master password | Argon2id with 64 MiB of memory and three passes, with a per-user random salt. **How much that buys you depends entirely on the password you choose — see below.** |
| Online guessing of the master password | Exponential backoff after three wrong attempts, capped at 60 seconds. |
| Cross-site scripting | A strict nonce-based Content Security Policy with `strict-dynamic`; no third-party scripts at all. |
| Leaking which sites you use | Website icons are never fetched. Sites are drawn as locally generated monograms. |
| Leaking password lengths | Payloads are padded with spaces to a multiple of 256 bytes before encryption. |

### What this app cannot resist

These are in section 3.8 of the build brief, and they are worth repeating plainly.

- **Malware or a keylogger on your device defeats any password manager**, including this one. If something is reading your keystrokes or your browser's memory, no amount of encryption helps.
- **Whoever controls the hosting could ship modified JavaScript.** A malicious deployment could serve a build that exfiltrates your master password the next time you type it. The mitigations are that the source is open, the Content Security Policy forbids third-party scripts, and anyone who wants full control can self-host.
- **A malicious server could serve an older version of an item.** The AAD stops ciphertext being swapped between items or users, but it does not prove freshness. A server could withhold an update and replay a previous ciphertext for the same item.
- **Supabase session cookies are readable by JavaScript.** The browser client needs them, so they are not `HttpOnly`. The strict CSP is the defence against XSS reading them.
- **Losing both the master password and the Recovery Key means nobody can open the vault.** That is the cost of zero-knowledge encryption, and the app says so before setup finishes.

- **The master password has no strength requirement.** The only rules are six characters or more, and not your own email address. Digits only, letters only, any mixture — all permitted.

  This is a deliberate choice by whoever deployed this app, and it is the weakest point in everything described above. Argon2id makes each guess expensive, not impossible: a six-digit master password is a million guesses, and a memory-hard KDF does not save you from a search space that small. Someone who obtains a copy of the encrypted rows can grind them offline, at their leisure, with no rate limit to stop them — the throttling in this app only applies to the unlock screen.

  Every other defence here assumes the master password is hard to guess. If it isn't, they are decoration. The strength meter and an estimated crack time are shown while you type; they inform, they no longer block.

  To change this back, restore the strength gate in `masterPasswordProblem` in `lib/password/strength.ts`.

---

## Cryptographic design

All primitives come from the Web Crypto API (`crypto.subtle`), except Argon2id, which comes from `hash-wasm` (WebAssembly). Binary values are stored as standard base64 text.

| What | How |
|---|---|
| KDF salt | 16 random bytes per user, from `crypto.getRandomValues` |
| Master key material | `argon2id({ password: masterPassword.normalize('NFKC'), salt, memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32 })` — 64 MiB, three passes |
| Master KEK | HKDF-SHA-256 over those 32 bytes, salt = 32 zero bytes, info = `tijori-vault-v1:master-kek` → non-extractable AES-GCM-256 key with usages `wrapKey`/`unwrapKey` |
| Vault key | `generateKey({ name: 'AES-GCM', length: 256 })`, created once at setup |
| Wrapped vault key | `wrapKey('raw', vaultKey, masterKek, { name: 'AES-GCM', iv, additionalData })`, fresh 12-byte IV, AAD `tijori-vault-v1:vault-key:${userId}` |
| Recovery Key | 20 random bytes shown as 32 Crockford base32 characters in 8 groups of 4. Decoding ignores case, spaces and hyphens, and maps I/L to 1 and O to 0. |
| Recovery KEK | HKDF-SHA-256 over those 20 bytes, zero salt, info `tijori-vault-v1:recovery-kek` |
| Recovery-wrapped vault key | As above, own IV, AAD `tijori-vault-v1:recovery-vault-key:${userId}` |
| Passkey KEK (optional) | HKDF-SHA-256 over the 32-byte WebAuthn PRF output, info `tijori-vault-v1:passkey-kek` |
| Passkey-wrapped vault key | AAD `tijori-vault-v1:passkey-vault-key:${userId}:${credentialId}` |
| Item ciphertext | `encrypt({ name: 'AES-GCM', iv, additionalData }, vaultKey, paddedPayload)`, fresh 12-byte IV, AAD `tijori-vault-v1:item:${userId}:${itemId}:${encVersion}` |
| Encrypted backup | Argon2id with a fresh salt and the current defaults, then AES-256-GCM over the JSON array with AAD `tijori-vault-v1:backup` |

### Rules the code follows

- The session key is always **unwrapped as non-extractable** with usages `['encrypt', 'decrypt']`. That non-extractable key is the only key kept while the vault is open.
- An **extractable** copy is produced only inside flows that must re-wrap it — changing the master password, recovering with the Recovery Key, creating a new Recovery Key, and enrolling a passkey. Each of those asks for the master password or Recovery Key again, and the extractable reference is dropped as soon as the flow ends.
- **Round-trip before saving.** Every newly produced wrapped key is unwrapped again, and a test value is encrypted and decrypted with the result, before anything is written. A keyset that cannot be unwrapped would lock the user out permanently, so this check is not optional.
- Every item is **decrypted and compared** against the input immediately after encryption, before the row is sent.
- Stored KDF parameters **below 19456 KiB or 2 iterations are refused** outright rather than used.
- KDF parameters live in the database row, so they can be raised later without breaking existing vaults. New keysets always use the current defaults.
- Keyset updates carry the `key_version` they were read at and set `key_version + 1`, so two devices cannot silently overwrite each other's key material.

### Protocol constants

The strings above are fixed forever. They live in `lib/crypto/constants.ts` with a prominent warning: **changing any of them makes every existing vault impossible to open.** They are deliberately not built from the application name, so renaming the app is safe.

---

## What the server stores, and what it can see

### `vault_items`

| Column | Contents |
|---|---|
| `id` | a random UUID, chosen in the browser before encryption |
| `user_id` | the owner |
| `ciphertext` | AES-256-GCM ciphertext, base64 |
| `iv` | the 12-byte IV, base64 |
| `enc_version` | the payload format version |
| `created_at`, `updated_at` | server timestamps |

### `vault_keys`

One row per user: the KDF salt and parameters, and two wrapped copies of the vault key (one opened by the master password, one by the Recovery Key), plus `key_version`.

### `vault_passkeys`

One row per device enrolled for quick unlock: the credential id, the PRF salt, and a third wrapped copy of the vault key.

### What that lets an observer infer

Someone with full read access to the database learns:

- your **email address** (you sign in with it),
- **how many items** you have,
- **when** each row was created and last changed,
- the **size of each ciphertext, rounded up to a 256-byte step** — so "short" and "long" items are distinguishable in coarse buckets, but a password's exact length is not.

They do not learn any title, web address, username, password, card number, note, tag, category or favourite flag. All of those live inside the ciphertext.

---

## What the app never does

- Send the master password, the Recovery Key, or anything derived from them, over the network.
- Write keys or decrypted data to `localStorage`, `sessionStorage`, IndexedDB, cookies, URLs, logs or error messages. The vault key lives in a private module variable and nowhere else.
- Fetch favicons or any other remote image.
- Load third-party scripts, analytics, trackers or fonts at runtime.
- Cache HTML pages or API responses in the service worker.

There are exactly two kinds of outbound request: to your own Supabase project, and — only when you press "Check for breaches" — to `api.pwnedpasswords.com`, which receives the first five hexadecimal characters of a SHA-1 hash and returns several hundred candidate suffixes for comparison in the browser.

---

## Synchronisation

Two devices editing the same item is resolved as **last write wins**. There is no merge and no conflict UI: the most recent save replaces what was there. Keyset changes are the exception — those are guarded by `key_version` and will fail loudly rather than overwrite.

---

## Content Security Policy

Every response carries a per-request nonce:

```
default-src 'self';
script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://YOUR-PROJECT.supabase.co https://api.pwnedpasswords.com;
worker-src 'self'; manifest-src 'self';
media-src 'none'; frame-src 'none'; frame-ancestors 'none';
object-src 'none'; base-uri 'none'; form-action 'self';
upgrade-insecure-requests
```

`'wasm-unsafe-eval'` is required for the Argon2id WebAssembly module. `'unsafe-inline'` for styles is acceptable because images, fonts and network destinations are all locked to known origins, which closes the CSS-based exfiltration paths; scripts remain nonce-only.

---

## Reporting a vulnerability

Please report security issues privately, not as a public issue.

**Contact:** `security@example.com` *(the person who deployed this app should replace this with a real address, and consider adding a PGP key)*

Please include what you did, what happened, and what you expected. If you have a proof of concept, a minimal one is ideal. We will confirm receipt and keep you updated while a fix is prepared.
