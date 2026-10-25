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
 * Turn a configured address into a clean origin, or null if it isn't usable.
 * Tolerates a value entered without a scheme (`my-app.vercel.app`), which is
 * the mistake people actually make — especially in hosting dashboards that
 * mask the field while you type.
 */
function toOrigin(value: string): string | null {
  if (!value) return null
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(candidate).origin
  } catch {
    return null
  }
}

/**
 * Absolute site address, GUARANTEED to parse.
 *
 * The root layout does `metadataBase: new URL(siteUrl())`. If this ever
 * returned something malformed, that would throw at the top of the root
 * layout and every page in the app would 500 — landing, sign-in and vault
 * alike — over a single mistyped environment variable. A bad value degrades
 * to the browser's own origin instead.
 */
export function siteUrl(): string {
  const configured = toOrigin(SITE_URL)
  if (configured) return configured
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
