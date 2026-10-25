/**
 * Environment variables.
 *
 * Each one is read with a direct `process.env.NEXT_PUBLIC_…` reference so that
 * Next.js can inline the value at build time. Nothing here ever throws: a
 * missing variable must not break the build or a public page. Pages that need
 * Supabase check `isSupabaseConfigured` and render the "Setup needed" panel.
 */

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function read(value: string | undefined): string {
  return typeof value === 'string' ? trimTrailingSlashes(value.trim()) : ''
}

export const SUPABASE_URL = read(process.env.NEXT_PUBLIC_SUPABASE_URL)

/**
 * The publishable key (`sb_publishable_…`). Projects that only have the legacy
 * anon key can set NEXT_PUBLIC_SUPABASE_ANON_KEY instead.
 */
export const SUPABASE_KEY =
  read(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  read(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export const SITE_URL = read(process.env.NEXT_PUBLIC_SITE_URL)

export const GOOGLE_AUTH_ENABLED =
  read(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH).toLowerCase() === 'true'

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== ''

/** Names of the variables that are missing, for the "Setup needed" panel. */
export function missingEnvNames(): string[] {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  return missing
}

/**
 * Absolute site address. Falls back to the current origin in the browser, then
 * to a sensible placeholder on the server so metadata never crashes.
 */
export function siteUrl(): string {
  if (SITE_URL) return SITE_URL
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
