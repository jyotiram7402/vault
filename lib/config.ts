/**
 * One place to rename the app.
 *
 * IMPORTANT: crypto strings are NEVER built from APP_NAME. See
 * `lib/crypto/constants.ts` — those strings must stay fixed forever, even if
 * the app is renamed, or every existing vault becomes impossible to open.
 */

export const APP_NAME = 'Tijori'

export const APP_TAGLINE = 'A safe for every password you own.'

export const APP_DESCRIPTION =
  'Tijori encrypts your logins on your device before anything is saved. Our servers only hold scrambled data they can’t read. Your master password is the only key.'

/** Public repository address. Leave empty to hide the repository link. */
export const REPO_URL = ''

/** Maximum items one account may hold (matches the database trigger). */
export const ITEM_LIMIT = 5000
