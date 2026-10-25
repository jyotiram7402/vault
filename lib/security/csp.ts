import { SUPABASE_URL } from '@/lib/env'

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  let supabaseOrigin = ''
  try {
    if (SUPABASE_URL) supabaseOrigin = new URL(SUPABASE_URL).origin
  } catch {
    supabaseOrigin = ''
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ['connect-src', "'self'", supabaseOrigin, 'https://api.pwnedpasswords.com'].filter(Boolean).join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ]
  if (!isDev) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}
