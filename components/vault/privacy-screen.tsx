'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { getServerSettings, readSettings, subscribeSettings } from '@/lib/vault/settings'

/**
 * The privacy screen.
 *
 * Blurs everything marked `.secret` when the window loses focus or the page is
 * hidden — for the moment you alt-tab away, or hand someone your phone. It
 * works through two attributes on <html> and a CSS rule, so no element has to
 * re-render when focus changes.
 */
export function PrivacyScreen() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, getServerSettings)
  const enabled = settings.privacyScreen

  useEffect(() => {
    const root = document.documentElement
    root.dataset.privacy = enabled ? 'on' : 'off'

    const update = () => {
      const hidden = document.visibilityState === 'hidden' || !document.hasFocus()
      root.dataset.hidden = hidden ? 'true' : 'false'
    }

    update()
    window.addEventListener('blur', update)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)

    return () => {
      window.removeEventListener('blur', update)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
      delete root.dataset.privacy
      delete root.dataset.hidden
    }
  }, [enabled])

  return null
}
