/**
 * One place to rename the app.
 *
 * IMPORTANT: crypto strings are NEVER built from APP_NAME. See
 * `lib/crypto/constants.ts` — those strings must stay fixed forever, even if
 * the app is renamed, or every existing vault becomes impossible to open.
 */

export const APP_NAME = 'Vault'

/**
 * Lower-case, hyphenated form of APP_NAME, used for download file names
 * (`vault-backup-2026-10-25.json`). Derived, so renaming stays a one-line job.
 */
export const APP_SLUG = APP_NAME.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

/**
 * Namespace for everything this app stores in the browser: the settings and
 * throttle entries in localStorage, the theme cookie, and the BroadcastChannel
 * tabs talk over.
 *
 * Deliberately a literal rather than derived from APP_NAME. Browser storage is
 * a persistence contract, and tying it to a display name would mean a future
 * rename silently reset everyone's preferences. Change it only if you actually
 * want that reset.
 *
 * None of this is secret, and none of it ever holds vault data.
 */
export const STORAGE_PREFIX = 'vault'

export const APP_TAGLINE = 'A safe for every password you own.'

/**
 * Deliberately does not name the app: the product name and the word "vault"
 * would otherwise collide in copy like "Vault encrypts your vault".
 */
export const APP_DESCRIPTION =
  'Your logins are encrypted on your device before anything is saved. Our servers only hold scrambled data they can’t read. Your master password is the only key.'

/** Public repository address. Leave empty to hide the repository link. */
export const REPO_URL = ''

/** Maximum items one account may hold (matches the database trigger). */
export const ITEM_LIMIT = 5000
