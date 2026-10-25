/**
 * Theme preference.
 *
 * Stored in the `<STORAGE_PREFIX>-theme` cookie so the root layout can read it on the
 * server and set `data-theme` on <html> before anything paints. That is why no
 * inline theme script is needed, which matters: an inline script would need a
 * nonce and would weaken the strict CSP for no real gain.
 */

import { STORAGE_PREFIX } from '@/lib/config'

export type Theme = 'system' | 'light' | 'dark'

export const THEME_COOKIE = `${STORAGE_PREFIX}-theme`

const ONE_YEAR_SECONDS = 31_536_000

export const THEME_LABELS: Record<Theme, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

function isTheme(value: string): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** Only safe to call in the browser (an effect or an event handler). */
export function readTheme(): Theme {
  if (typeof document === 'undefined') return 'system'
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
  const value = match?.slice(THEME_COOKIE.length + 1) ?? ''
  return isTheme(value) ? value : 'system'
}

/** Write the cookie and update <html> straight away, with no reload. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure}`

  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** For the "Switch theme" action: system → light → dark → system. */
export function nextTheme(current: Theme): Theme {
  if (current === 'system') return 'light'
  if (current === 'light') return 'dark'
  return 'system'
}
